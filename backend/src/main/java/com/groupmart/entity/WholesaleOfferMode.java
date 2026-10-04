package com.groupmart.entity;

/**
 * How the seller configured the offer's completion trigger (CWP spec section 3.1).
 * Time-limited and inventory-limited behavior is already expressed by reservationDeadline
 * and maxAvailableQuantity on WholesaleOffer, so this enum only distinguishes the two
 * quantity-trigger modes.
 */
public enum WholesaleOfferMode {
    MINIMUM_QUANTITY_BASED, // Pool completes once the pooled quantity reaches the wholesale minimum
    FIXED_LOT_BASED         // Pool completes only when the full fixed lot quantity is reserved
}
