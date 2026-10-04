package com.groupmart.repository;

import com.groupmart.entity.KnowledgeChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface KnowledgeChunkRepository extends JpaRepository<KnowledgeChunk, UUID> {
}
