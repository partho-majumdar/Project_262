package com.groupmart.service;

/**
 * Seeds the store's policy/FAQ knowledge base that the self-built RAG index retrieves
 * relevant chunks from, instead of dumping every policy into every prompt regardless of
 * what was asked.
 */
public interface KnowledgeBaseService {

    /**
     * Inserts missing default policy/FAQ chunks and refreshes existing ones from the
     * built-in definitions. Idempotent, so it is safe to call on every startup.
     */
    void seedDefaults();
}
