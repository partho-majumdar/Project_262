# Implementation Plan — Reverse Group Buying & Group Buying Auction

Based on an inspection of the actual repository (Spring Boot 3.3.2 / JPA / PostgreSQL backend under
`backend/`, React + Vite frontend under `frontend/`).

## 1. Existing relevant files (read, NOT modified)

| Area | Files |
|---|---|
| CWP (the stable feature) | `entity/WholesaleOffer, WholesalePool, WholesalePurchase, WholesaleReservation`, `entity/Wholesale*Status/Mode/CloseCode`, `service/Wholesale*Service`, `service/impl/Wholesale*Impl`, `service/impl/WholesaleMapper`, `controller/WholesaleController`, `controller/SellerWholesaleController`, `controller/AdminWholesaleController`, `scheduler/WholesaleScheduler` |
| Shared core | `entity/Product, User, SellerStore, Order, OrderItem, Address, PaymentTransaction, InventoryLog`, `repository/ProductRepository, OrderRepository, OrderItemRepository, AddressRepository, InventoryLogRepository, NotificationRepository`, `service/NotificationService, DeliveryEstimateService, InventoryService` |
| Platform | `config/SecurityConfig`, `config/DataInitializer`, `common/response/ApiResponse`, `common/exception/ApiException`, `aspect/AuditAspect` |
| Frontend | `src/App.jsx`, `src/api/axiosClient.js`, `src/api/wholesaleApi.js`, `src/layouts/CustomerLayout.jsx`, `src/pages/WholesaleDealsPage.jsx`, `src/pages/MyWholesalePage.jsx`, `src/components/seller/wholesale/*`, `src/pages/SellerDashboardPage.jsx` |

## 2. Existing files that must NOT be modified (CWP isolation)

`Wholesale*` entities/repos/services/mappers/scheduler, `GroupBuy*` (existing group buying),
`OrderServiceImpl` order-placement/cancellation logic, `ProductRepository.decrementStockIfAvailable`
(only *called*, never changed), `Wholesale*` DTOs and controllers, all CWP frontend components.
`OrderType` and `Order` are extended **additively only** (new enum constants, new nullable columns);
no existing field, method or behaviour changes.

## 3. Existing services safely reused (shared generic infrastructure, not CWP business logic)

* `ProductRepository.decrementStockIfAvailable / incrementStock / findStockQuantityById` — the
  existing atomic inventory protection.
* `InventoryLogRepository` — inventory audit trail (`reason` = `REVERSE_GB_RESERVE` / `AUCTION_RESERVE` …).
* `OrderRepository`, `OrderItemRepository`, `PaymentTransactionRepository` — order storage.
* `NotificationService` — in-app notifications.
* `DeliveryEstimateService.applyOnPlacement` — delivery estimate on generated orders.
* `UserRepository`, `SellerStoreRepository`, `AddressRepository`, `CategoryRepository` — identity/address.
* `ApiResponse`, `ApiException`, `ResourceNotFoundException`, `GlobalExceptionHandler`.
* Frontend: `axiosClient`, `usePolling`, `formatMoney/formatDateTime/CountdownTimer`,
  `AddressSelectorModal`, `StatTile`, status-badge pattern.

## 4. New backend files

### Reverse Group Buying
* `entity/ReverseGroupBuyingOfferStatus`, `ReverseTargetType`, `ReverseGroupBuyingCloseCode`,
  `ReverseGroupBuyingParticipationStatus`
* `entity/ReverseGroupBuyingOffer` (table `reverse_group_buying_offers`)
* `entity/ReverseGroupBuyingParticipation` (table `reverse_group_buying_participations`)
* `entity/ReverseGroupBuyingCampaign` (table `reverse_group_buying_campaigns`)
* `repository/ReverseGroupBuyingOfferRepository`, `ReverseGroupBuyingParticipationRepository`,
  `ReverseGroupBuyingCampaignRepository`
* `dto/reverse/*` — `ReverseGroupBuyingOfferRequest`, `ReverseGroupBuyingOfferDto`,
  `ReverseGroupBuyingParticipationRequest`, `ReverseGroupBuyingParticipationDto`,
  `ReverseGroupBuyingCampaignDto`, `ReverseGroupBuyingReasonRequest`
* `service/ReverseGroupBuyingOfferService`, `ReverseGroupBuyingParticipationService`,
  `ReverseGroupBuyingCampaignService` + `service/impl/*Impl`, `service/impl/ReverseGroupBuyingMapper`
* `controller/ReverseGroupBuyingController`, `controller/SellerReverseGroupBuyingController`
* `scheduler/ReverseGroupBuyingScheduler`

### Group Buying Auction
* `entity/GroupBuyingAuctionStatus`, `GroupBuyingAuctionCloseCode`, `AuctionParticipationStatus`,
  `AuctionPricingRule`
* `entity/GroupBuyingAuction`, `GroupBuyingAuctionTier`, `GroupBuyingAuctionParticipation`,
  `GroupBuyingAuctionResult`
* `repository/GroupBuyingAuctionRepository`, `GroupBuyingAuctionTierRepository`,
  `GroupBuyingAuctionParticipationRepository`, `GroupBuyingAuctionResultRepository`
* `dto/auction/*` — `GroupBuyingAuctionRequest`, `GroupBuyingAuctionTierRequest`,
  `GroupBuyingAuctionDto`, `AuctionTierDto`, `AuctionParticipationRequest`,
  `AuctionParticipationDto`, `AuctionResultDto`
* `service/GroupBuyingAuctionService`, `AuctionParticipationService`,
  `AuctionFinalizationService`, **`AuctionPricingService`** (dedicated deterministic pricing
  engine) + `service/impl/*Impl`, `service/impl/GroupBuyingAuctionMapper`
* `controller/GroupBuyingAuctionController`, `controller/SellerGroupBuyingAuctionController`
* `scheduler/GroupBuyingAuctionScheduler`

### Modified backend files (minimum, additive only)
* `entity/OrderType` — add `REVERSE_GROUP_BUYING`, `GROUP_BUYING_AUCTION`.
* `entity/Order` — add nullable `reverseGroupBuyingCampaignId`, `groupBuyingAuctionId`
  (same pattern as the existing `wholesalePurchaseId` / `groupBuyGroupId` traceability columns).
* `config/SecurityConfig` — allow anonymous `GET` on the two public marketplaces.

## 5. Database changes

DDL is generated by Hibernate (`ddl-auto=update` in dev, `create-drop` in tests), so entities are the
single source of truth. `src/main/resources/schema-postgresql.sql` is a stale legacy script (it has
no CWP tables either) and is intentionally left untouched.

New tables and their notable columns/indexes/constraints are listed in the final report.

## 6. API changes (new endpoints only, no existing endpoint changed)

```
GET    /api/v1/reverse-group-buying/offers                (public)
GET    /api/v1/reverse-group-buying/offers/{id}           (public)
POST   /api/v1/reverse-group-buying/offers/{id}/participate
POST   /api/v1/reverse-group-buying/participations/{id}/cancel
GET    /api/v1/reverse-group-buying/participations         (my participations)

GET/POST/PUT  /api/v1/seller/reverse-group-buying[/{id}]
POST   /api/v1/seller/reverse-group-buying/{id}/activate
POST   /api/v1/seller/reverse-group-buying/{id}/close
POST   /api/v1/seller/reverse-group-buying/{id}/fulfillment
POST   /api/v1/seller/reverse-group-buying/{id}/complete
GET    /api/v1/seller/reverse-group-buying/{id}/participations

GET    /api/v1/group-buying-auctions                      (public)
GET    /api/v1/group-buying-auctions/{id}                 (public)
POST   /api/v1/group-buying-auctions/{id}/participate     (= "bid")
POST   /api/v1/group-buying-auctions/participations/{id}/cancel
GET    /api/v1/group-buying-auctions/participations        (my participations)

GET/POST/PUT  /api/v1/seller/group-buying-auctions[/{id}]
POST   /api/v1/seller/group-buying-auctions/{id}/publish   (open now)
POST   /api/v1/seller/group-buying-auctions/{id}/cancel
POST   /api/v1/seller/group-buying-auctions/{id}/finalize
GET    /api/v1/seller/group-buying-auctions/{id}/participations
GET    /api/v1/seller/group-buying-auctions/{id}/result
```

## 7. Frontend routes and components

New routes: `/reverse-group-buying`, `/reverse-group-buying/offers/:offerId`,
`/reverse-group-buying/my-demand`, `/group-buying-auctions`, `/group-buying-auctions/:auctionId`,
`/group-buying-auctions/my-bids`.
New API clients `src/api/reverseGroupBuyingApi.js`, `src/api/groupBuyingAuctionApi.js`.
New component folders `src/components/reverse/*`, `src/components/auction/*`,
`src/components/seller/reverse/*`, `src/components/seller/auction/*`,
`src/components/admin/collective/*`.
Modified: `App.jsx` (routes), `CustomerLayout.jsx` (sidebar links),
`SellerDashboardPage.jsx` (two new sub-tabs only — the CWP sub-tab is untouched),
`AdminDashboardPage.jsx` (one new `collective` oversight sub-tab).

## 8. Concurrency & deadline strategy

* Participation rows are aggregated on a `PESSIMISTIC_WRITE` row lock of the parent
  offer/auction plus an `@Version` column, mirroring the CWP pool lock technique.
* Stock is reserved per participation with the existing atomic
  `ProductRepository.decrementStockIfAvailable`, so inventory can never be oversold.
* Deadlines are enforced server-side by dedicated `@Scheduled` sweepers following the existing
  `WholesaleScheduler` pattern, **and** re-checked inside every write transaction, so a request
  that arrives after the deadline is rejected regardless of the scheduler.

## 9. Testing plan

`src/test/java/com/groupmart/collective/*`, following the existing
`AbstractWholesaleIntegrationTest` fixture style (real Postgres `groupmart_cwp_test`).
Covers: creation, participation, target reached → activation → individual orders, price/quantity
correctness, cancellation + recalculation, deadline failure + refunds, inventory oversell,
concurrency, auction pricing rules, completion/deadline, final-price locking, double finalization.
Regression: the existing CWP tests are re-run unchanged.

---

# Final Implementation Report

## What was built

Two purchasing mechanisms were added as fully independent features alongside CWP. Nothing in
`Wholesale*` was read, reused or modified; the only shared code is generic platform infrastructure
(atomic inventory methods, orders, payments, notifications, `ApiResponse`/exception handling).

### 1. Reverse Group Buying — "the seller needs demand, customers supply it"
* An offer states a **purchasing condition** (`TARGET_QUANTITY`, `TARGET_PRICE` or
  `DISCOUNT_THRESHOLD`) and the **collective demand target** that unlocks it.
* A customer commits a quantity; their units are reserved immediately through
  `ReservedStockManager` and counted toward the target.
* When collective demand reaches the target, the server creates a
  `ReverseGroupBuyingCampaign` and one **individual order per customer** at the unlocked price.
  Quantities are never merged into a shared order.
* Withdrawing before the target, a deadline that passes unmet, an early close, or an admin
  force-close all refund every commitment and release the reserved stock.
* States: `DRAFT → OPEN → ALMOST_COMPLETE → TARGET_REACHED → ACTIVATED → PROCESSING →
  FULFILLMENT → COMPLETED`, with `FAILED` / `CLOSED` / `CANCELLED` terminal outcomes.

### 2. Group Buying Auction — "the more units bid, the cheaper everyone pays"
* A seller configures one deterministic collective pricing rule:
  `COLLECTIVE_QUANTITY_TIERS` (a quantity → unit-price ladder) or
  `COLLECTIVE_QUANTITY_DISCOUNT` (a percentage off the starting price), plus an optional seller
  floor. All of it lives in `AuctionPricingService` / `AuctionPricingServiceImpl`.
* A bid is `quantity` + `maxUnitPrice` — the maximum the bidder will accept.
* At finalization the server locks **one** clearing price from the *total* collective quantity,
  writes it once to the immutable `GroupBuyingAuctionResult`, and creates orders for bids at or
  above that price. Bids above it are `OUTBID`, refunded, and their units released.
* If the minimum collective quantity is never reached the auction `FAILED`s and every bid is
  refunded. The scheduler finalizes on time; a seller can also finalize manually, and a
  double-finalize is a no-op because the auction row is locked and terminal states are rejected.

## Files

### Backend — new (all under `backend/src/main/java/com/groupmart/`)
| Area | Files |
|---|---|
| Entities | `entity/ReverseGroupBuyingOffer`, `ReverseGroupBuyingParticipation`, `ReverseGroupBuyingCampaign`, `ReverseGroupBuyingOfferStatus`, `ReverseTargetType`, `ReverseGroupBuyingCloseCode`, `ReverseGroupBuyingParticipationStatus`, `GroupBuyingAuction`, `GroupBuyingAuctionTier`, `GroupBuyingAuctionParticipation`, `GroupBuyingAuctionResult`, `GroupBuyingAuctionStatus`, `GroupBuyingAuctionCloseCode`, `AuctionParticipationStatus`, `AuctionPricingRule` |
| Repositories | `repository/ReverseGroupBuyingOfferRepository`, `ReverseGroupBuyingParticipationRepository`, `ReverseGroupBuyingCampaignRepository`, `GroupBuyingAuctionRepository`, `GroupBuyingAuctionTierRepository`, `GroupBuyingAuctionParticipationRepository`, `GroupBuyingAuctionResultRepository` |
| DTOs | `dto/reverse/*` (6), `dto/auction/*` (7) |
| Services | `service/ReverseGroupBuyingOfferService`, `ReverseGroupBuyingParticipationService`, `ReverseGroupBuyingCampaignService`, `GroupBuyingAuctionService`, `AuctionParticipationService`, `AuctionFinalizationService`, `AuctionPricingService` + `service/impl/*Impl`, `service/impl/ReverseGroupBuyingMapper`, `GroupBuyingAuctionMapper`, `ReservedStockManager`, `CollectiveOrderFactory` |
| Controllers | `controller/ReverseGroupBuyingController`, `SellerReverseGroupBuyingController`, `AdminReverseGroupBuyingController`, `GroupBuyingAuctionController`, `SellerGroupBuyingAuctionController`, `AdminGroupBuyingAuctionController` |
| Schedulers | `scheduler/ReverseGroupBuyingScheduler`, `GroupBuyingAuctionScheduler` |

### Backend — modified (additive only)
* `entity/OrderType.java` — added `REVERSE_GROUP_BUYING`, `GROUP_BUYING_AUCTION`.
* `entity/Order.java` — added nullable `reverseGroupBuyingCampaignId`, `groupBuyingAuctionId`
  (same traceability pattern as the existing `wholesalePurchaseId` / `groupBuyGroupId`).
* `config/SecurityConfig.java` — public reads on the two marketplaces, authenticated access to
  participation lists, role guards on seller/admin prefixes.

### Frontend — new
`src/api/reverseGroupBuyingApi.js`, `src/api/groupBuyingAuctionApi.js`;
`src/components/reverse/{reverseMeta,ReverseTargetProgress,ParticipateReverseModal,RgbStatusBadge}.jsx`;
`src/components/auction/{auctionMeta,AuctionPriceLadder,PlaceBidModal,AuctionStatusBadge}.jsx`;
`src/components/seller/reverse/{ReverseOfferForm,ReverseOfferDetail,SellerReverseTab}.jsx`;
`src/components/seller/auction/{AuctionForm,AuctionDetail,SellerAuctionTab}.jsx`;
`src/components/admin/collective/AdminCollectiveTab.jsx`;
`src/pages/{ReverseDealsPage,ReverseOfferDetailPage,MyReverseDemandPage,GroupBuyingAuctionsPage,GroupBuyingAuctionDetailPage,MyAuctionBidsPage}.jsx`.

### Frontend — modified
`src/App.jsx` (6 new routes), `src/layouts/CustomerLayout.jsx` (4 new sidebar links),
`src/pages/SellerDashboardPage.jsx` (2 new sub-tabs: `reverse-group-buying`,
`group-buying-auctions`), `src/pages/AdminDashboardPage.jsx` (1 new `collective` sub-tab).

## Database
Hibernate owns the DDL (`ddl-auto=update` in dev, `create-drop` in tests), so the entities are the
single source of truth. `src/main/resources/schema-postgresql.sql` is stale legacy (it predates CWP
too) and was deliberately left untouched.

New tables: `reverse_group_buying_offers`, `reverse_group_buying_participations`,
`reverse_group_buying_campaigns`, `group_buying_auctions`, `group_buying_auction_tiers`,
`group_buying_auction_participations`, `group_buying_auction_results`.

## APIs
Customer (public reads, authenticated writes):

```
GET  /api/v1/reverse-group-buying/offers                    GET  /api/v1/reverse-group-buying/offers/{id}
GET  /api/v1/reverse-group-buying/offers/{id}/campaign      POST /api/v1/reverse-group-buying/offers/{id}/participate
POST /api/v1/reverse-group-buying/participations/{id}/cancel
GET  /api/v1/reverse-group-buying/participations

GET  /api/v1/group-buying-auctions                          GET  /api/v1/group-buying-auctions/{id}
GET  /api/v1/group-buying-auctions/{id}/result              POST /api/v1/group-buying-auctions/{id}/participate
POST /api/v1/group-buying-auctions/participations/{id}/cancel
GET  /api/v1/group-buying-auctions/participations
```

Seller: `/api/v1/seller/reverse-group-buying` (`GET/POST/PUT`, `activate`, `close`, `fulfillment`,
`complete`, `participations`, `campaign`) and `/api/v1/seller/group-buying-auctions`
(`GET/POST/PUT`, `publish`, `finalize`, `cancel`, `participations`, `result`).
Admin: `/api/v1/admin/reverse-group-buying` (`GET`, `GET /{id}`, `force-close`) and
`/api/v1/admin/group-buying-auctions` (`GET`, `GET /{id}`, `GET /{id}/result`, `force-cancel`).

## User flows
* **Customer, RGB:** browse offers → open one → see the condition, target progress, deadline and
  per-customer limits → commit a quantity with an address and sandbox payment method → watch
  progress from *My demand* → withdraw for a full refund at any time before the unlock → receive an
  individual order when the target is met, or a refund if the deadline passes unmet.
* **Customer, auction:** browse auctions → inspect the price ladder and current collective quantity
  → bid a quantity and a maximum unit price → track the bid from *My bids* → after finalization see
  either the order created at the clearing price, or a refund if outbid.
* **Seller, RGB:** draft an offer (product, condition type, target demand, unlocked price or
  discount, quantity limits, deadline) → activate → watch collective demand and each customer's
  commitment → start fulfillment → mark completed, or close early with refunds.
* **Seller, auction:** draft an auction (product, starting price, seller floor, pricing rule and
  ladder or discount, minimum collective quantity, per-bidder limits, start/end) → publish (opens
  now, or schedules if the start is in the future) → watch bids → finalize (or let the scheduler
  do it) → winning bids become orders, the rest are refunded.
* **Admin:** the *Reverse Buys & Auctions* terminal lists every offer and auction with live
  progress, and can force-close / force-cancel (refunding everyone) anything not yet terminal.

## CWP isolation
* No `Wholesale*` entity, repository, service, mapper, scheduler, DTO, controller or frontend
  component was edited while building these two mechanisms; the CWP regression tests pass unchanged
  against the same tree. (Note: the working tree is largely uncommitted, so CWP itself shows as
  untracked in `git status` — isolation was established by construction and by those tests, not by
  a git diff against a committed CWP baseline.)
* The CWP wholesale price, lot capacity and reservation model are never read by either mechanism.
  Inventory is taken incrementally through `ReservedStockManager` on top of the existing atomic
  `ProductRepository.decrementStockIfAvailable` / `incrementStock`.
* Auction pricing is confined to `AuctionPricingService`, which reads only the auction's own
  starting price, tiers, discount and floor.
* Orders are tagged with the new `OrderType` values and the new nullable traceability columns, and
  the four existing CWP integration tests still pass unchanged.

## Verification
```
cd backend
mvn -o -q -DskipTests compile
mvn -o -q test-compile
$env:SPRING_DATASOURCE_PASSWORD="password"; mvn -o test
→ Tests run: 28, Failures: 0, Errors: 0, Skipped: 0 — BUILD SUCCESS

cd frontend
npm run build
→ ✓ 2501 modules transformed, built successfully
```
Backend suite: `ReverseGroupBuyingFlowTest`, `ReverseGroupBuyingCancellationTest`,
`ReverseGroupBuyingDeadlineTest`, `ReverseGroupBuyingConcurrencyTest`,
`GroupBuyingAuctionFlowTest`, `GroupBuyingAuctionConcurrencyTest`, `AuctionPricingServiceTest`,
plus the CWP regression tests `WholesalePoolCompletionFlowTest`,
`WholesalePoolConcurrencyTest`, `WholesalePoolFailureFlowTest`.

Note on the auction tests: creation rejects a past end time, so those tests create a future auction,
bid, then move `endsAt` into the past to exercise the deadline sweep.

## Limitations
* Payments are sandbox stubs — no real gateway is integrated, so no money actually moves.
* Notifications are in-app only; no email or push.
* Seller participation lists show quantity, amount, status and order, but not customer identity —
  the DTO deliberately carries no customer PII.
* Projected prices shown before finalization are display-only projections; the server always
  recalculates and locks the real price.
* The frontend has no automated test suite; verification is the production build plus the backend
  integration suite.
