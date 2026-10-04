package com.groupmart.entity;

/** Lifecycle of one seller's competing offer against a group reverse demand. */
public enum GroupReverseOfferStatus {
    /** Live and eligible for the creator to select. */
    SUBMITTED,
    /** Chosen by the demand creator. Price and quantity are now final. */
    ACCEPTED,
    /** Lost to another seller's accepted offer, or the demand ended without a selection. */
    CLOSED,
    /** The offer deadline passed before the creator selected. */
    EXPIRED,
    /** The seller pulled the offer back before a decision. */
    WITHDRAWN;

    public boolean isTerminal() {
        return this != SUBMITTED;
    }
}
