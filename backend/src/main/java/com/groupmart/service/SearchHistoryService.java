package com.groupmart.service;

import com.groupmart.entity.SearchHistory;
import com.groupmart.entity.SearchSource;

import java.util.List;

/**
 * Tracks what customers search for (site search bar and AI assistant chat alike) so the
 * RAG assistant can personalize its answers with "what this customer has been looking for" context.
 */
public interface SearchHistoryService {

    void record(String userEmail, String queryText, SearchSource source);

    List<SearchHistory> getRecentQueries(String userEmail, int limit);
}
