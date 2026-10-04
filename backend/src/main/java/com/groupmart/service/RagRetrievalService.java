package com.groupmart.service;

import com.groupmart.entity.KnowledgeChunk;
import com.groupmart.entity.Product;

import java.util.List;

/**
 * The "retrieval" half of the RAG pipeline: given a user query, finds the most
 * semantically relevant products and knowledge chunks by cosine similarity over
 * their cached embedding vectors.
 */
public interface RagRetrievalService {

    List<Product> retrieveProducts(String query, int topK);

    List<KnowledgeChunk> retrieveKnowledge(String query, int topK);

    /**
     * Rebuilds the in-memory TF-IDF index from the current active products and knowledge
     * chunks. Cheap enough (pure in-process computation, no network calls) to call on every
     * catalog change.
     */
    void rebuildIndex();
}
