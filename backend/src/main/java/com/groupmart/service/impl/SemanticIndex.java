package com.groupmart.service.impl;

import com.groupmart.entity.KnowledgeChunk;
import com.groupmart.entity.Product;

import java.util.*;

/**
 * A self-built, in-memory TF-IDF search index — no external embedding API involved.
 * Every product and knowledge chunk is tokenized and turned into a sparse term-frequency
 * vector, weighted by inverse document frequency across the whole corpus and L2-normalized,
 * so cosine similarity between a query vector and a document vector is a plain dot product.
 * This is the "retrieval" half of the RAG pipeline, computed entirely from data already in
 * the database, rebuilt whenever the catalog changes.
 */
final class SemanticIndex {

    private static final Set<String> STOPWORDS = Set.of(
            "the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "for", "of", "and", "or", "to",
            "in", "on", "with", "i", "you", "we", "it", "its", "this", "that", "my", "your", "our", "their", "his",
            "her", "please", "show", "find", "me", "want", "looking", "need", "do", "does", "did", "can", "could",
            "would", "should", "will", "what", "where", "when", "how", "why", "who", "about", "from", "at", "as",
            "by", "if", "so", "but", "not", "have", "has", "had", "am"
    );

    private static final SemanticIndex EMPTY = new SemanticIndex(Map.of(), Map.of(), Map.of());

    private final Map<String, Double> idf;
    private final Map<UUID, Map<String, Double>> productVectors;
    private final Map<UUID, Map<String, Double>> knowledgeVectors;

    private SemanticIndex(Map<String, Double> idf,
                           Map<UUID, Map<String, Double>> productVectors,
                           Map<UUID, Map<String, Double>> knowledgeVectors) {
        this.idf = idf;
        this.productVectors = productVectors;
        this.knowledgeVectors = knowledgeVectors;
    }

    static SemanticIndex empty() {
        return EMPTY;
    }

    static SemanticIndex build(List<Product> products, List<KnowledgeChunk> chunks) {
        Map<UUID, List<String>> productTokens = new LinkedHashMap<>();
        for (Product p : products) {
            productTokens.put(p.getId(), tokenize(productText(p)));
        }
        Map<UUID, List<String>> knowledgeTokens = new LinkedHashMap<>();
        for (KnowledgeChunk c : chunks) {
            knowledgeTokens.put(c.getId(), tokenize(knowledgeText(c)));
        }

        int totalDocs = productTokens.size() + knowledgeTokens.size();
        Map<String, Integer> docFrequency = new HashMap<>();
        for (List<String> tokens : productTokens.values()) {
            for (String term : new HashSet<>(tokens)) {
                docFrequency.merge(term, 1, Integer::sum);
            }
        }
        for (List<String> tokens : knowledgeTokens.values()) {
            for (String term : new HashSet<>(tokens)) {
                docFrequency.merge(term, 1, Integer::sum);
            }
        }

        Map<String, Double> idf = new HashMap<>();
        for (Map.Entry<String, Integer> e : docFrequency.entrySet()) {
            // Smoothed IDF (sklearn-style): ln((1+N)/(1+df)) + 1, always positive, never divides by zero.
            idf.put(e.getKey(), Math.log((1.0 + totalDocs) / (1.0 + e.getValue())) + 1.0);
        }

        Map<UUID, Map<String, Double>> productVectors = new HashMap<>();
        for (Map.Entry<UUID, List<String>> e : productTokens.entrySet()) {
            productVectors.put(e.getKey(), tfIdfVector(e.getValue(), idf));
        }
        Map<UUID, Map<String, Double>> knowledgeVectors = new HashMap<>();
        for (Map.Entry<UUID, List<String>> e : knowledgeTokens.entrySet()) {
            knowledgeVectors.put(e.getKey(), tfIdfVector(e.getValue(), idf));
        }

        return new SemanticIndex(idf, productVectors, knowledgeVectors);
    }

    List<Map.Entry<UUID, Double>> topProducts(String query, int topK, double minScore) {
        return topMatches(query, productVectors, topK, minScore);
    }

    List<Map.Entry<UUID, Double>> topKnowledge(String query, int topK, double minScore) {
        return topMatches(query, knowledgeVectors, topK, minScore);
    }

    private List<Map.Entry<UUID, Double>> topMatches(String query, Map<UUID, Map<String, Double>> vectors, int topK, double minScore) {
        Map<String, Double> queryVector = tfIdfVector(tokenize(query), idf);
        double queryNorm = norm(queryVector);
        if (queryVector.isEmpty() || queryNorm == 0) {
            return List.of();
        }

        List<Map.Entry<UUID, Double>> scored = new ArrayList<>();
        for (Map.Entry<UUID, Map<String, Double>> entry : vectors.entrySet()) {
            double score = dot(queryVector, entry.getValue()) / queryNorm; // doc vectors are already unit-normalized
            if (score >= minScore) {
                scored.add(Map.entry(entry.getKey(), score));
            }
        }
        scored.sort((a, b) -> Double.compare(b.getValue(), a.getValue()));
        return scored.size() > topK ? scored.subList(0, topK) : scored;
    }

    private static Map<String, Double> tfIdfVector(List<String> tokens, Map<String, Double> idf) {
        if (tokens.isEmpty()) {
            return Map.of();
        }
        Map<String, Double> termFrequency = new HashMap<>();
        for (String t : tokens) {
            termFrequency.merge(t, 1.0, Double::sum);
        }

        Map<String, Double> vector = new HashMap<>();
        for (Map.Entry<String, Double> e : termFrequency.entrySet()) {
            Double weight = idf.get(e.getKey());
            if (weight != null) { // ignore terms never seen in the indexed corpus
                vector.put(e.getKey(), e.getValue() * weight);
            }
        }

        double norm = norm(vector);
        if (norm > 0) {
            for (Map.Entry<String, Double> e : vector.entrySet()) {
                e.setValue(e.getValue() / norm);
            }
        }
        return vector;
    }

    private static double norm(Map<String, Double> vector) {
        double sumSquares = 0;
        for (double v : vector.values()) {
            sumSquares += v * v;
        }
        return Math.sqrt(sumSquares);
    }

    private static double dot(Map<String, Double> a, Map<String, Double> b) {
        Map<String, Double> smaller = a.size() <= b.size() ? a : b;
        Map<String, Double> larger = smaller == a ? b : a;
        double sum = 0;
        for (Map.Entry<String, Double> e : smaller.entrySet()) {
            Double other = larger.get(e.getKey());
            if (other != null) {
                sum += e.getValue() * other;
            }
        }
        return sum;
    }

    private static String knowledgeText(KnowledgeChunk c) {
        return c.getTitle() + " " + c.getContent() + " " + String.join(" ", c.getSteps());
    }

    private static String productText(Product p) {
        String category = p.getCategory() != null ? p.getCategory().getName() : "";
        String description = p.getDescription() != null ? p.getDescription() : "";
        return p.getName() + " " + category + " " + description;
    }

    private static List<String> tokenize(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        String[] raw = text.toLowerCase(Locale.ROOT).split("[^a-z0-9]+");
        List<String> tokens = new ArrayList<>();
        for (String t : raw) {
            if (t.length() >= 2 && !STOPWORDS.contains(t)) {
                tokens.add(t);
            }
        }
        return tokens;
    }
}
