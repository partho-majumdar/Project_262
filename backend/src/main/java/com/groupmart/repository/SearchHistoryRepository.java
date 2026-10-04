package com.groupmart.repository;

import com.groupmart.entity.SearchHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SearchHistoryRepository extends JpaRepository<SearchHistory, UUID> {

    List<SearchHistory> findTop5ByUserEmailOrderByCreatedAtDesc(String userEmail);
}
