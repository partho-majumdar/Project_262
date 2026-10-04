package com.groupmart.config;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.Table;
import jakarta.persistence.metamodel.EntityType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.lang.reflect.Field;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Keeps Hibernate's generated enum CHECK constraints in step with the Java enums.
 * <p>
 * {@code spring.jpa.hibernate.ddl-auto=update} creates CHECK constraints for
 * {@code @Enumerated(EnumType.STRING)} columns when it first creates a table, but it never
 * revisits an existing one. So a long-lived database keeps the value list the enum had when the
 * table was created: adding {@code WHOLESALE}, {@code REVERSE_GROUP_BUYING} or
 * {@code GROUP_BUYING_AUCTION} to {@link com.groupmart.entity.OrderType} left
 * {@code orders_order_type_check} accepting only the original two values, and every wholesale
 * pool completion then failed at INSERT time with a data-integrity error.
 * <p>
 * This runs after the context is ready and rewrites any enum CHECK constraint whose value list no
 * longer matches its enum, which is the only way to keep a {@code ddl-auto=update} schema honest.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EnumCheckConstraintSynchronizer {

    /** Hibernate names these {@code <table>_<column>_check}. */
    private static final String CONSTRAINT_SUFFIX = "_check";

    /** Matches the quoted values inside a {@code = ANY (ARRAY['A'::varchar, ...])} definition. */
    private static final Pattern ARRAY_VALUE = Pattern.compile("'([^']*)'");

    private final DataSource dataSource;
    private final JdbcTemplate jdbcTemplate;
    private final EntityManagerFactory entityManagerFactory;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void synchronize() {
        if (!isPostgres()) {
            log.debug("Skipping enum CHECK constraint sync: not a PostgreSQL database");
            return;
        }

        for (EnumColumn column : enumColumns()) {
            try {
                syncConstraint(column);
            } catch (RuntimeException ex) {
                // A failed repair must never stop the application from serving traffic; the next
                // restart retries it, and the constraint log line below points at the culprit.
                log.warn("Could not synchronize enum CHECK constraint {} on {}.{}: {}",
                        column.constraintName(), column.table(), column.column(),
                        ex.getMessage());
            }
        }
    }

    private void syncConstraint(EnumColumn column) {
        String existing = jdbcTemplate.query(
                "SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c "
                        + "JOIN pg_class t ON t.oid = c.conrelid "
                        + "JOIN pg_namespace n ON n.oid = t.relnamespace "
                        + "WHERE c.conname = ? AND t.relname = ? AND n.nspname = current_schema()",
                rs -> rs.next() ? rs.getString(1) : null,
                column.constraintName(), column.table());

        if (existing == null) {
            // Nothing to repair: either Hibernate has not created the table yet, or the constraint
            // was removed on purpose. Adding one here would be second-guessing the operator.
            return;
        }
        if (!isEnumValueList(existing)) {
            log.debug("Leaving {} alone: it is not a Hibernate-generated enum value list", column.constraintName());
            return;
        }

        Set<String> allowed = parseArrayValues(existing);
        if (allowed.equals(column.allowedValues())) {
            return;
        }

        log.warn("Enum CHECK constraint {}.{} is out of date: it allows {} but {} declares {}. Recreating it.",
                column.table(), column.column(), allowed, column.enumClass().getSimpleName(), column.allowedValues());

        String target = quoteIdentifier(column.table()) + '.' + quoteIdentifier(column.column());
        jdbcTemplate.execute("ALTER TABLE " + quoteIdentifier(column.table())
                + " DROP CONSTRAINT IF EXISTS " + quoteIdentifier(column.constraintName()));
        jdbcTemplate.execute("ALTER TABLE " + quoteIdentifier(column.table())
                + " ADD CONSTRAINT " + quoteIdentifier(column.constraintName())
                + " CHECK (" + target + " IN (" + quotedList(column.allowedValues()) + "))");

        log.info("Enum CHECK constraint {} now allows {}", column.constraintName(), column.allowedValues());
    }

    /** Every string-valued enum column reachable from the persistence unit. */
    private List<EnumColumn> enumColumns() {
        List<EnumColumn> columns = new ArrayList<>();
        for (EntityType<?> entityType : entityManagerFactory.getMetamodel().getEntities()) {
            Class<?> entityClass = entityType.getJavaType();
            Table table = entityClass.getAnnotation(Table.class);
            String tableName = table != null && !table.name().isBlank() ? table.name() : entityClass.getSimpleName();

            for (Field field : entityClass.getDeclaredFields()) {
                if (!field.getType().isEnum() || !field.isAnnotationPresent(Enumerated.class)) {
                    continue;
                }
                Enumerated enumerated = field.getAnnotation(Enumerated.class);
                if (enumerated.value() != EnumType.STRING) {
                    continue;
                }

                Column column = field.getAnnotation(Column.class);
                String columnName = column != null && !column.name().isBlank() ? column.name() : field.getName();

                @SuppressWarnings("unchecked")
                Class<? extends Enum<?>> enumClass = (Class<? extends Enum<?>>) field.getType();
                columns.add(new EnumColumn(
                        tableName.toLowerCase(Locale.ROOT),
                        columnName.toLowerCase(Locale.ROOT),
                        enumClass));
            }
        }
        return columns;
    }

    private boolean isPostgres() {
        try (Connection connection = dataSource.getConnection()) {
            return connection.getMetaData().getDatabaseProductName().toLowerCase(Locale.ROOT).contains("postgre");
        } catch (SQLException ex) {
            log.warn("Could not detect the database product, skipping enum CHECK constraint sync: {}",
                    ex.getMessage());
            return false;
        }
    }

    /** True for a value-list CHECK, false for a hand-written business rule that shares the name. */
    private static boolean isEnumValueList(String definition) {
        return definition.contains("= ANY") || definition.contains("= any");
    }

    private static Set<String> parseArrayValues(String definition) {
        Set<String> values = new LinkedHashSet<>();
        Matcher matcher = ARRAY_VALUE.matcher(definition);
        while (matcher.find()) {
            values.add(matcher.group(1));
        }
        return values;
    }

    private static String quotedList(Set<String> values) {
        return values.stream()
                .map(value -> "'" + value.replace("'", "''") + "'")
                .collect(Collectors.joining(", "));
    }

    private static String quoteIdentifier(String identifier) {
        return '"' + identifier.replace("\"", "\"\"") + '"';
    }

    private record EnumColumn(String table, String column, Class<? extends Enum<?>> enumClass) {

        String constraintName() {
            return table + '_' + column + CONSTRAINT_SUFFIX;
        }

        /** Constants in declaration order, so the recreated constraint matches a fresh schema. */
        Set<String> allowedValues() {
            return Arrays.stream(enumClass.getEnumConstants())
                    .map(constant -> ((Enum<?>) constant).name())
                    .collect(Collectors.toCollection(LinkedHashSet::new));
        }
    }
}
