package com.groupmart.config;

import java.math.BigDecimal;
import java.util.UUID;

import com.groupmart.entity.Order;
import com.groupmart.entity.OrderStatus;
import com.groupmart.entity.OrderType;
import com.groupmart.entity.PaymentMethod;
import com.groupmart.entity.PaymentStatus;
import com.groupmart.entity.Role;
import com.groupmart.entity.SellerStatus;
import com.groupmart.entity.User;
import com.groupmart.repository.OrderRepository;
import com.groupmart.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the drift that made wholesale reservations fail on a long-lived database.
 * <p>
 * The test schema is recreated on every run, so it never shows the problem this covers: a real
 * database keeps whatever value list the enum had when its table was first created, because
 * {@code ddl-auto=update} does not revisit existing CHECK constraints. The test forces that stale
 * state and asserts the startup synchronizer repairs it.
 */
@SpringBootTest
@ActiveProfiles("test")
class EnumCheckConstraintSynchronizerTest {

    private static final String CONSTRAINT = "orders_order_type_check";
    private static final String CORRECT_VALUES =
            "'STANDARD','GROUP_BUY','WHOLESALE','REVERSE_GROUP_BUYING','GROUP_BUYING_AUCTION','AUCTION',"
                    + "'GROUP_REVERSE_BUYING'";
    /** What the constraint looked like before the collective marketplace order types existed. */
    private static final String STALE_VALUES = "'STANDARD','GROUP_BUY'";

    @Autowired EnumCheckConstraintSynchronizer synchronizer;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired OrderRepository orderRepository;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    @Test
    void aStaleEnumCheckConstraintIsRewrittenToMatchTheEnum() {
        replaceConstraint(STALE_VALUES);
        assertThat(constraintDefinition()).doesNotContain("WHOLESALE");

        synchronizer.synchronize();

        String repaired = constraintDefinition();
        for (OrderType type : OrderType.values()) {
            assertThat(repaired).contains(type.name());
        }
    }

    /** The point of the repair: the write that was being rejected now succeeds. */
    @Test
    void afterRepairAnOrderUsingACollectiveTypeCanBeStored() {
        replaceConstraint(STALE_VALUES);
        User buyer = user();

        // Before the repair this insert fails the stale CHECK constraint outright.
        synchronizer.synchronize();

        Order saved = orderRepository.saveAndFlush(orderFor(buyer, OrderType.WHOLESALE, "CWP-ORDER"));

        assertThat(saved.getId()).isNotNull();
        assertThat(orderRepository.findById(saved.getId()).orElseThrow().getOrderType())
                .isEqualTo(OrderType.WHOLESALE);
    }

    /** A constraint that already lists every constant is left exactly as it was. */
    @Test
    void anUpToDateConstraintIsLeftUntouched() {
        replaceConstraint(CORRECT_VALUES);
        String before = constraintDefinition();

        synchronizer.synchronize();

        assertThat(constraintDefinition()).isEqualTo(before);
    }

    /** Repairs are per column, so every enum-backed table is inspected, not just orders. */
    @Test
    void everyEnumColumnInTheSchemaIsInspected() {
        String ordersColumn = definitionOf("orders", "order_type");
        String reservationsColumn = definitionOf("wholesale_reservations", "status");

        assertThat(ordersColumn).isNotBlank();
        assertThat(reservationsColumn).isNotBlank();
    }

    // ----- fixtures ------------------------------------------------------------------------------

    private void replaceConstraint(String values) {
        jdbcTemplate.execute("ALTER TABLE orders DROP CONSTRAINT IF EXISTS " + CONSTRAINT);
        jdbcTemplate.execute("ALTER TABLE orders ADD CONSTRAINT " + CONSTRAINT
                + " CHECK (order_type IN (" + values + "))");
    }

    private String constraintDefinition() {
        return definitionOf("orders", "order_type");
    }

    private String definitionOf(String table, String column) {
        return jdbcTemplate.queryForObject(
                "SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c "
                        + "JOIN pg_class t ON t.oid = c.conrelid "
                        + "JOIN pg_namespace n ON n.oid = t.relnamespace "
                        + "WHERE c.conname = ? AND t.relname = ? AND n.nspname = current_schema()",
                String.class, table + '_' + column + "_check", table);
    }

    private static int seq = 0;

    private User user() {
        return userRepository.save(User.builder()
                .email("ecs-user-" + (++seq) + "@test.groupmart.local")
                .password(passwordEncoder.encode("Password@123"))
                .firstName("Enum")
                .lastName("Sync")
                .role(Role.ROLE_CUSTOMER)
                .sellerStatus(SellerStatus.NONE)
                .enabled(true)
                .build());
    }

    private Order orderFor(User user, OrderType type, String prefix) {
        return Order.builder()
                .orderNumber(prefix + "-" + UUID.randomUUID())
                .user(user)
                .status(OrderStatus.PENDING)
                .paymentStatus(PaymentStatus.PENDING)
                .paymentMethod(PaymentMethod.CASH_ON_DELIVERY)
                .subtotalAmount(new BigDecimal("100.00"))
                .taxAmount(BigDecimal.ZERO)
                .shippingAmount(BigDecimal.ZERO)
                .discountAmount(BigDecimal.ZERO)
                .totalAmount(new BigDecimal("100.00"))
                .shippingAddressLine1("1 Enum Way")
                .shippingCity("Testville")
                .shippingState("TS")
                .shippingPostalCode("00000")
                .shippingCountry("Testland")
                .orderType(type)
                .build();
    }

    @AfterEach
    void restoreSchema() {
        // The shared test database is reused by the rest of the suite, so never leave it stale.
        replaceConstraint(CORRECT_VALUES);
        orderRepository.deleteAll();
        userRepository.deleteAll();
    }
}
