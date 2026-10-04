package com.groupmart.service.event;

import com.groupmart.service.RagRetrievalService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Keeps the self-built RAG index in sync with the catalog: whenever a product create,
 * update or (soft) delete commits, rebuild the in-memory TF-IDF index so retrieval reflects
 * the change on the very next query.
 */
@Component
@RequiredArgsConstructor
public class ProductIndexingEventListener {

    private final RagRetrievalService ragRetrievalService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onProductChanged(ProductChangedEvent event) {
        ragRetrievalService.rebuildIndex();
    }
}
