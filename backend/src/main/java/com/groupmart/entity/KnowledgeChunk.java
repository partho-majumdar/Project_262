package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * A retrievable piece of store knowledge (policy or FAQ) indexed for semantic
 * retrieval by the RAG-powered AI assistant, instead of being hard-coded into every prompt.
 */
@Entity
@Table(name = "knowledge_chunks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KnowledgeChunk {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "title", nullable = false, length = 150)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 30)
    private KnowledgeSourceType sourceType;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    /** Ordered how-to steps, rendered as a numbered walkthrough for "how do I..." questions. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "knowledge_chunk_steps", joinColumns = @JoinColumn(name = "chunk_id"))
    @OrderColumn(name = "step_order")
    @Column(name = "step", length = 500)
    @Builder.Default
    private List<String> steps = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
