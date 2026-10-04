package com.groupmart.service.impl;

import com.groupmart.entity.KnowledgeChunk;
import com.groupmart.entity.KnowledgeSourceType;
import com.groupmart.repository.KnowledgeChunkRepository;
import com.groupmart.service.KnowledgeBaseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class KnowledgeBaseServiceImpl implements KnowledgeBaseService {

    private final KnowledgeChunkRepository knowledgeChunkRepository;

    private static final List<KnowledgeChunk> DEFAULT_CHUNKS = List.of(
            KnowledgeChunk.builder().sourceType(KnowledgeSourceType.POLICY).title("Shipping")
                    .content("GroupMart shipping: Standard delivery takes 3-5 business days and costs ৳5.99, or is FREE on orders over ৳50. Priority Express takes 1-2 business days for ৳14.99. Overnight Courier delivers the next business day for ৳29.99. All prices are in Bangladeshi Taka.")
                    .build(),

            KnowledgeChunk.builder().sourceType(KnowledgeSourceType.POLICY).title("Returns and refunds")
                    .content("GroupMart offers a 30-day hassle-free return window for unused items in original packaging. Once the returned item is inspected, the refund is issued to the original payment method within 2-3 business days.")
                    .steps(List.of(
                            "Open Order History from your account dashboard (/orders/history) within 30 days of delivery.",
                            "Find the delivered order and start a return on the item you want to send back.",
                            "Pack the item unused and in its original packaging.",
                            "Ship it back using the return instructions shown for that order.",
                            "Once we inspect the item, your refund goes back to the original payment method within 2-3 business days."))
                    .build(),

            KnowledgeChunk.builder().sourceType(KnowledgeSourceType.POLICY).title("Payment methods")
                    .content("GroupMart accepts Credit/Debit Cards (Visa, MasterCard, Amex via Stripe), PayPal, and Cash on Delivery (COD) for eligible areas. All online transactions are 256-bit SSL encrypted.")
                    .build(),

            KnowledgeChunk.builder().sourceType(KnowledgeSourceType.POLICY).title("Warranty")
                    .content("All products sold on GroupMart include a 1-year manufacturer warranty against hardware defects.")
                    .build(),

            KnowledgeChunk.builder().sourceType(KnowledgeSourceType.FAQ).title("How group buying works")
                    .content("Group Buys (group deals) let customers team up so everyone unlocks a lower price on the same product. Each group deal has price tiers, a minimum number of participants and a countdown timer.")
                    .steps(List.of(
                            "Open the Group Deals page (/group-deals) and pick a deal — each one shows the base price, the discounted tier prices and how many buyers are still needed.",
                            "Open the deal to see its price tiers: the more people who join, the lower the unit price everyone pays.",
                            "Either start your own group on that deal, or join an existing open group listed on the deal page.",
                            "Share your group's invite link or code — anyone who opens it joins your group directly.",
                            "Your payment is held (not charged) while the group is open, and your seat counts toward the participant target.",
                            "If the group reaches its minimum participants before the timer runs out, it succeeds: everyone is charged the discounted tier price and an order is created for each member.",
                            "If the timer expires before the minimum is reached, the group fails and every held payment is refunded in full.",
                            "You can leave an open group any time before it closes for a full refund, and follow progress under My Groups (/group-buy/my-groups)."))
                    .build(),

            KnowledgeChunk.builder().sourceType(KnowledgeSourceType.FAQ).title("How wholesale pools work")
                    .content("Wholesale pools let many buyers combine their orders to reach bulk pricing on the same product. A pool either completes once the pooled quantity reaches the wholesale minimum, or only when a full fixed lot is reserved.")
                    .steps(List.of(
                            "Open the Wholesale page (/wholesale) to browse open pools — each shows the per-unit wholesale price, the quantity pooled so far and the reservation deadline.",
                            "Open a pool to see whether it completes on reaching a minimum quantity or only when the full fixed lot is reserved.",
                            "Reserve the quantity you want; your payment is held and your units are added to the pooled total.",
                            "Watch the pool move from OPEN to ALMOST COMPLETE as it approaches the wholesale minimum.",
                            "Once the pooled quantity hits the target the pool is COMPLETED, allocations lock and no new reservations are accepted.",
                            "The seller then moves it through PROCESSING and FULFILLMENT, where each participant's individual order is created and shipped.",
                            "If the deadline passes without reaching the minimum, the pool fails and every reservation is refunded in full.",
                            "You can cancel a reservation before the pool completes — your quantity is released back to the pool — and review everything under My Reservations (/wholesale/my-reservations)."))
                    .build(),

            KnowledgeChunk.builder().sourceType(KnowledgeSourceType.FAQ).title("Tracking an order")
                    .content("You can track a GroupMart order from your account dashboard, or by giving the AI assistant your order number (format ORD-YYYYMMDD-XXXX).")
                    .steps(List.of(
                            "Go to Order Tracking (/orders/tracking), or open Order History (/orders/history) from your account dashboard.",
                            "Find the order you want and copy its order number — it looks like ORD-20260726-8849.",
                            "Or just ask me here with that number, for example \"track ORD-20260726-8849\".",
                            "You'll get the current order status, the payment status and the order total."))
                    .build(),

            KnowledgeChunk.builder().sourceType(KnowledgeSourceType.FAQ).title("Coupons and promo codes")
                    .content("Only one promotional coupon can be applied per checkout order on GroupMart. Coupons are validated against their expiry date and the order's minimum value before the discount is applied.")
                    .steps(List.of(
                            "Add the items you want to your cart and go to checkout.",
                            "Enter your promo code in the coupon field.",
                            "The code is checked against its expiry date and the order's minimum value.",
                            "Only one coupon applies per order, so use the one that gives the bigger discount."))
                    .build(),

            KnowledgeChunk.builder().sourceType(KnowledgeSourceType.FAQ).title("Cart and checkout")
                    .content("Your cart holds items until you check out. At checkout you confirm the shipping address, pick a shipping speed, apply a coupon if you have one, and choose how to pay.")
                    .steps(List.of(
                            "Add items to your cart from any product page, then open the Cart (/cart).",
                            "Review quantities and remove anything you don't want.",
                            "Go to Checkout (/checkout) and confirm your shipping address.",
                            "Pick a shipping speed — Standard (3-5 days), Priority Express (1-2 days) or Overnight.",
                            "Apply a promo code if you have one, then choose Card, PayPal or Cash on Delivery.",
                            "Place the order — you'll land on the confirmation page with your order number, and it appears immediately in Order History."))
                    .build(),

            KnowledgeChunk.builder().sourceType(KnowledgeSourceType.FAQ).title("Wishlist")
                    .content("The wishlist saves products you're interested in so you can come back to them later without searching again.")
                    .steps(List.of(
                            "Click the wishlist (heart) button on any product card or product page.",
                            "Open your Wishlist (/wishlist) to see everything you've saved.",
                            "From there you can move an item straight into your cart, or remove it."))
                    .build(),

            KnowledgeChunk.builder().sourceType(KnowledgeSourceType.FAQ).title("Product reviews and ratings")
                    .content("Products carry a star rating and customer reviews. Ratings shown on a product are the average of its customer reviews.")
                    .steps(List.of(
                            "Open the product page and scroll to the reviews section to read what other buyers said.",
                            "To leave your own review, buy the product first, then review it from that product page.",
                            "Give a star rating and write your feedback — it updates the product's average rating."))
                    .build(),

            KnowledgeChunk.builder().sourceType(KnowledgeSourceType.FAQ).title("Browsing and searching the catalog")
                    .content("You can browse GroupMart by category or search the whole catalog, then narrow results by price, rating and availability.")
                    .steps(List.of(
                            "Use the search bar at the top, or browse Categories (/categories).",
                            "On the results page, filter by price range, minimum rating or in-stock only.",
                            "Sort by newest, price low-to-high, price high-to-low or rating.",
                            "Or just ask me here in plain language — for example \"headphones between ৳300 and ৳800\"."))
                    .build(),

            KnowledgeChunk.builder().sourceType(KnowledgeSourceType.FAQ).title("Customer support")
                    .content("If something needs a human, you can raise it with GroupMart support from the Support page.")
                    .steps(List.of(
                            "Open Support (/support) from your account menu.",
                            "Describe the problem and include your order number if it's about an order.",
                            "Submit it — the support team picks it up from there.",
                            "For a problem with a group buy or a wholesale pool specifically, you can also open a dispute from that group or reservation."))
                    .build(),

            KnowledgeChunk.builder().sourceType(KnowledgeSourceType.FAQ).title("Becoming a seller")
                    .content("GroupMart is a multivendor marketplace, so anyone can apply to sell. Seller accounts get their own store, product listings, inventory, coupons, group deals and wholesale offers.")
                    .steps(List.of(
                            "Register a seller account (/seller/register), or apply from an existing account (/seller/apply).",
                            "Submit your store details for review.",
                            "Wait for admin approval — until then your account sits on the pending approval screen.",
                            "Once approved, use the Seller Dashboard (/seller/dashboard) to add products, manage inventory and launch group deals or wholesale offers."))
                    .build(),

            KnowledgeChunk.builder().sourceType(KnowledgeSourceType.FAQ).title("Account and profile")
                    .content("Your account dashboard is where your orders, wishlist, coupons and personal details live.")
                    .steps(List.of(
                            "Open your dashboard (/customer/dashboard) after signing in.",
                            "Edit your name, contact details and addresses under Profile (/profile).",
                            "Change preferences under Settings (/settings).",
                            "Your orders are under Order History (/orders/history) and your saved coupons under Coupons (/coupons)."))
                    .build(),

            KnowledgeChunk.builder().sourceType(KnowledgeSourceType.FAQ).title("Searching by image")
                    .content("GroupMart supports visual product search: upload a product photo and the assistant finds visually similar items in the live catalog.")
                    .steps(List.of(
                            "Open the AI Assistant page (/ai-assistant).",
                            "Click Upload Image in the \"Search by Image\" card.",
                            "Drop in or select a photo of the product you're looking for.",
                            "The catalog is matched against your photo and the closest products are shown."))
                    .build()
    );

    /**
     * Inserts any missing default chunk and refreshes the content/steps of ones that already
     * exist, keyed by title. Upserting (rather than only seeding an empty table) means an
     * already-seeded database still picks up new or reworded steps on the next restart.
     */
    @Override
    @Transactional
    public void seedDefaults() {
        Map<String, KnowledgeChunk> existingByTitle = knowledgeChunkRepository.findAll().stream()
                .collect(Collectors.toMap(KnowledgeChunk::getTitle, Function.identity(), (a, b) -> a));

        List<KnowledgeChunk> changed = new ArrayList<>();
        for (KnowledgeChunk definition : DEFAULT_CHUNKS) {
            KnowledgeChunk existing = existingByTitle.get(definition.getTitle());
            if (existing == null) {
                changed.add(KnowledgeChunk.builder()
                        .sourceType(definition.getSourceType())
                        .title(definition.getTitle())
                        .content(definition.getContent())
                        .steps(new ArrayList<>(definition.getSteps()))
                        .build());
            } else if (!definition.getContent().equals(existing.getContent())
                    || !definition.getSteps().equals(existing.getSteps())) {
                existing.setSourceType(definition.getSourceType());
                existing.setContent(definition.getContent());
                existing.setSteps(new ArrayList<>(definition.getSteps()));
                changed.add(existing);
            }
        }

        if (!changed.isEmpty()) {
            knowledgeChunkRepository.saveAll(changed);
            log.info("RAG: seeded/updated {} knowledge chunk(s)", changed.size());
        }
    }
}
