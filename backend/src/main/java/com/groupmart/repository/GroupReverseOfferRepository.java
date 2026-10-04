package com.groupmart.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.GroupReverseOffer;
import com.groupmart.entity.GroupReverseOfferStatus;

@Repository
public interface GroupReverseOfferRepository extends JpaRepository<GroupReverseOffer, UUID> {

    Optional<GroupReverseOffer> findByIdAndDemandId(UUID id, UUID demandId);

    List<GroupReverseOffer> findByDemandIdOrderByUnitPriceAscCreatedAtAsc(UUID demandId);

    List<GroupReverseOffer> findBySellerStoreIdOrderByCreatedAtDesc(UUID sellerStoreId);

    List<GroupReverseOffer> findByDemandIdAndStatus(UUID demandId, GroupReverseOfferStatus status);

    /**
     * Reads the accepted offer for a demand.
     * <p>
     * <b>Verification, not enforcement.</b> The "at most one accepted offer" rule is upheld by the
     * PESSIMISTIC_WRITE lock on the demand row during selection, which makes a second selection
     * observe the already-locked status and abort. It cannot be expressed as a database constraint
     * here, because it is a conditional one - unique only while the offer is ACCEPTED - and this
     * project generates its schema through Hibernate rather than migration files. The money-level
     * backstop that does exist as a real constraint is
     * {@code orders.group_reverse_member_id}, which is unique and so makes a second order
     * impossible for any member regardless of how the selection was reached.
     */
    @Query("SELECT o FROM GroupReverseOffer o WHERE o.demand.id = :demandId AND o.status = "
            + "com.groupmart.entity.GroupReverseOfferStatus.ACCEPTED")
    List<GroupReverseOffer> findAcceptedByDemand(@Param("demandId") UUID demandId);

    List<GroupReverseOffer> findByStatusOrderByCreatedAtAsc(GroupReverseOfferStatus status);
}
