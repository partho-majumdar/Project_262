package com.groupmart.service.event;

import java.util.UUID;

/**
 * Published after a product create/update transaction commits, so RAG re-indexing
 * always reads the row that's actually visible in the database.
 */
public record ProductChangedEvent(UUID productId) {
}
