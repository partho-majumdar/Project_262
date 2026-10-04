package com.groupmart.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.GroupBuyFlagReview;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GroupBuyFlagReviewRepository extends JpaRepository<GroupBuyFlagReview, UUID> {

    Optional<GroupBuyFlagReview> findByFlagKey(String flagKey);

    List<GroupBuyFlagReview> findByFlagKeyIn(Collection<String> flagKeys);
}
