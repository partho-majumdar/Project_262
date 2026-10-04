package com.groupmart.entity;

/**
 * The seller-defined target condition of a Reverse Group Buying offer.
 * <p>
 * In every case the condition is unlocked by the same collective trigger - the accumulated customer
 * demand reaching {@code targetQuantity}. What differs is the <em>shape of the reward</em> the seller
 * configures, which is what customers see and what validation enforces:
 * <ul>
 *   <li>{@link #TARGET_QUANTITY} - "buy at this absolute price once N units are collectively demanded".</li>
 *   <li>{@link #TARGET_PRICE} - same absolute unlocked price, expressed as a price drop the seller commits to.</li>
 *   <li>{@link #DISCOUNT_THRESHOLD} - a percentage off the base price; the unlocked price is derived from it.</li>
 * </ul>
 * This is deliberately <b>not</b> the CWP wholesale minimum: CWP pools quantity to reach a
 * seller's wholesale minimum at a wholesale price, Reverse Group Buying pools demand to unlock a
 * seller-defined purchasing condition.
 */
public enum ReverseTargetType {
    TARGET_QUANTITY,
    TARGET_PRICE,
    DISCOUNT_THRESHOLD
}
