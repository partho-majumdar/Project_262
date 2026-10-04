package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * An administrator's decision on a computed fraud flag. Flags are recalculated on every request;
 * this row remembers whether a flag with the same key was dismissed or confirmed.
 */
@Entity
@Table(name = "group_buy_flag_reviews")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupBuyFlagReview {

    public enum Decision { DISMISSED, CONFIRMED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "flag_key", nullable = false, unique = true, length = 200)
    private String flagKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "decision", nullable = false, length = 20)
    private Decision decision;

    // Evidence count when the decision was made; a dismissed flag reappears if it grows
    @Column(name = "evidence_count", nullable = false)
    private int evidenceCount;

    @Column(name = "note", length = 500)
    private String note;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by_id", nullable = false)
    private User reviewedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
