package com.groupmart.config;

import com.groupmart.service.KnowledgeBaseService;
import com.groupmart.service.RagRetrievalService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Seeds the knowledge base and builds the self-built TF-IDF retrieval index once the app
 * is fully up (after all seed data has been written), so the AI assistant has grounded
 * retrieval data ready as soon as traffic arrives.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RagStartupInitializer {

    private final KnowledgeBaseService knowledgeBaseService;
    private final RagRetrievalService ragRetrievalService;

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        knowledgeBaseService.seedDefaults();
        ragRetrievalService.rebuildIndex();
    }
}
