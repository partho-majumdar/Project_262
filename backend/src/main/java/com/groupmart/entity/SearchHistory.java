package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Records every search a customer makes (site search bar or AI assistant chat)
 * so the RAG assistant can personalize retrieval with recent search context.
 */
@Entity
@Table(name = "search_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SearchHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "user_email", length = 150)
    private String userEmail;

    @Column(name = "query_text", nullable = false, length = 500)
    private String queryText;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 30)
    private SearchSource source;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
