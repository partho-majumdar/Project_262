package com.groupmart.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.GroupBuyActivity;

import java.util.List;
import java.util.UUID;

@Repository
public interface GroupBuyActivityRepository extends JpaRepository<GroupBuyActivity, UUID> {

    @Query("SELECT a FROM GroupBuyActivity a JOIN FETCH a.buyGroup g JOIN FETCH g.campaign LEFT JOIN FETCH a.actor " +
           "ORDER BY a.createdAt DESC")
    List<GroupBuyActivity> findRecent(Pageable pageable);

    List<GroupBuyActivity> findTop30ByBuyGroupIdOrderByCreatedAtDesc(UUID groupId);
}
