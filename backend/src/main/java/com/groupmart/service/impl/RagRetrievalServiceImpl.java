package com.groupmart.service.impl;

import com.groupmart.entity.KnowledgeChunk;
import com.groupmart.entity.Product;
import com.groupmart.repository.KnowledgeChunkRepository;
import com.groupmart.repository.ProductRepository;
import com.groupmart.service.RagRetrievalService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Self-built RAG retriever: no external embedding/LLM API. Backed entirely by the
 * in-process TF-IDF index in {@link SemanticIndex}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RagRetrievalServiceImpl implements RagRetrievalService {

    // TF-IDF cosine scores run much lower than dense neural embeddings, so these bars
    // are tuned much lower than a typical embedding-similarity cutoff. Knowledge chunks
    // get a stricter bar than products: a loosely-related product card is harmless, but a
    // policy/FAQ sentence that only shares one generic word with the query (e.g. "product")
    // reads as a wrong, confidently-stated answer when quoted verbatim in the reply.
    private static final double PRODUCT_RELEVANCE_THRESHOLD = 0.14;
    private static final double KNOWLEDGE_RELEVANCE_THRESHOLD = 0.18;

    private final ProductRepository productRepository;
    private final KnowledgeChunkRepository knowledgeChunkRepository;

    private volatile SemanticIndex index = SemanticIndex.empty();

    @Override
    @Transactional(readOnly = true)
    public synchronized void rebuildIndex() {
        List<Product> products = productRepository.findAll().stream()
                .filter(Product::isActive)
                .collect(Collectors.toList());
        List<KnowledgeChunk> chunks = knowledgeChunkRepository.findAll();

        this.index = SemanticIndex.build(products, chunks);
        log.info("RAG: rebuilt self-built TF-IDF index over {} product(s) and {} knowledge chunk(s)", products.size(), chunks.size());
    }

    @Override
    @Transactional(readOnly = true)
    public List<Product> retrieveProducts(String query, int topK) {
        List<Map.Entry<UUID, Double>> matches = index.topProducts(query, topK, PRODUCT_RELEVANCE_THRESHOLD);
        if (matches.isEmpty()) {
            return List.of();
        }

        List<UUID> ids = matches.stream().map(Map.Entry::getKey).collect(Collectors.toList());
        Map<UUID, Product> byId = productRepository.findAllById(ids).stream()
                .filter(Product::isActive)
                .collect(Collectors.toMap(Product::getId, p -> p));

        List<Product> ordered = new ArrayList<>();
        for (Map.Entry<UUID, Double> m : matches) {
            Product p = byId.get(m.getKey());
            if (p != null) {
                ordered.add(p);
            }
        }
        return ordered;
    }

    @Override
    @Transactional(readOnly = true)
    public List<KnowledgeChunk> retrieveKnowledge(String query, int topK) {
        List<Map.Entry<UUID, Double>> matches = index.topKnowledge(query, topK, KNOWLEDGE_RELEVANCE_THRESHOLD);
        if (matches.isEmpty()) {
            return List.of();
        }

        List<UUID> ids = matches.stream().map(Map.Entry::getKey).collect(Collectors.toList());
        Map<UUID, KnowledgeChunk> byId = knowledgeChunkRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(KnowledgeChunk::getId, c -> c));

        List<KnowledgeChunk> ordered = new ArrayList<>();
        for (Map.Entry<UUID, Double> m : matches) {
            KnowledgeChunk c = byId.get(m.getKey());
            if (c != null) {
                ordered.add(c);
            }
        }
        return ordered;
    }
}
