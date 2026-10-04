package com.groupmart.service.impl;

import com.groupmart.entity.SearchHistory;
import com.groupmart.entity.SearchSource;
import com.groupmart.repository.SearchHistoryRepository;
import com.groupmart.service.SearchHistoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class SearchHistoryServiceImpl implements SearchHistoryService {

    private final SearchHistoryRepository searchHistoryRepository;

    // REQUIRES_NEW: callers (e.g. the AI assistant chat flow) run in a read-only
    // transaction; this write must not join it, or Postgres rejects the INSERT.
    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String userEmail, String queryText, SearchSource source) {
        if (queryText == null || queryText.trim().isEmpty()) {
            return;
        }
        try {
            searchHistoryRepository.save(SearchHistory.builder()
                    .userEmail(userEmail)
                    .queryText(queryText.trim())
                    .source(source)
                    .build());
        } catch (Exception ex) {
            log.warn("Failed to record search history: {}", ex.getMessage());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<SearchHistory> getRecentQueries(String userEmail, int limit) {
        if (userEmail == null || userEmail.isBlank()) {
            return Collections.emptyList();
        }
        List<SearchHistory> recent = searchHistoryRepository.findTop5ByUserEmailOrderByCreatedAtDesc(userEmail);
        return recent.size() > limit ? recent.subList(0, limit) : recent;
    }
}
