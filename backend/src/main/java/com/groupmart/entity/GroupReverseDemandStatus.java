package com.groupmart.entity;

/**
 * Lifecycle of a customer-created group reverse demand.
 * <p>
 * Deliberately distinct from {@link ReverseGroupBuyingOfferStatus}: that mechanism is
 * seller-initiated (a seller declares the target condition and the unlocked price, and customers
 * supply the demand to unlock it). This one runs the opposite way - a customer raises the demand
 * first, and sellers then compete to fulfil it.
 */
public enum GroupReverseDemandStatus {
    /** Created but not yet visible to anybody. Only the leader can see it. */
    DRAFT,
    /** Live: other customers may join until the target is reached or the join deadline passes. */
    OPEN,
    /**
     * The required quantity was just reached by the most recent join.
     * <p>
     * Recorded through {@code targetReachedAt} rather than held as a resting state: the transition
     * to {@link #READY_FOR_OFFERS} happens in the same transaction, because a met target must open
     * the seller marketplace immediately rather than on the next scheduler sweep.
     */
    TARGET_REACHED,
    /** Target met, joining closed, sellers may now submit competing offers. */
    READY_FOR_OFFERS,
    /** At least one offer has been submitted; the leader may compare and select. */
    OFFERS_RECEIVED,
    /** The leader selected an offer. Price and member quantities are now locked. */
    OFFER_SELECTED,
    /** Individual member orders have been generated and are awaiting payment. */
    ORDERS_CREATED,
    /** The seller has begun fulfilling; at least one member order has shipped. */
    FULFILLING,
    /** Every member order has been delivered. */
    COMPLETED,

    /** The leader withdrew the demand before an offer was selected. */
    CANCELLED,
    /** The join deadline passed with the target unmet. */
    TARGET_NOT_REACHED,
    /** The offer deadline passed with no offer submitted. */
    NO_OFFER,
    /** The offer deadline passed with offers submitted but the leader never selected one. */
    EXPIRED;

    public boolean isTerminal() {
        return this == COMPLETED || this == CANCELLED || this == TARGET_NOT_REACHED
                || this == NO_OFFER || this == EXPIRED;
    }

    /** Only an OPEN demand can still take new members. */
    public boolean acceptsMembers() {
        return this == OPEN;
    }

    /** Only these statuses let a seller submit a competing offer. */
    public boolean acceptsOffers() {
        return this == READY_FOR_OFFERS || this == OFFERS_RECEIVED;
    }

    /** The seller is committed once an offer has been selected; the group is locked from here on. */
    public boolean isLocked() {
        return this == OFFER_SELECTED || this == ORDERS_CREATED
                || this == FULFILLING || this == COMPLETED;
    }
}
