# GroupMart

**A multi-vendor marketplace where buying together is a first-class commerce mechanic — not a discount gimmick.**

GroupMart is a full-stack marketplace with three complete, role-separated experiences (customer, seller, administrator) on a Spring Boot + PostgreSQL API and a React SPA. Its distinguishing feature is that it implements **six genuinely different collective-purchasing mechanisms** — each with its own settlement engine, failure semantics, and concurrency model — rather than one mechanism wearing six hats.

> **The pitch in one line:** eBay lets you outbid a stranger; Amazon lets you buy alone at a discount. GroupMart implements the entire family of mechanisms that sit between those two, so a marketplace can actually express *how* a group forms, *what* the group is buying, and *who* absorbs the risk when it doesn't work out.

---

## Table of contents

1. [Why this exists](#why-this-exists)
2. [The six collective-commerce mechanisms](#the-six-collective-commerce-mechanisms)
3. [Feature overview](#feature-overview)
4. [Tech stack](#tech-stack)
5. [Architecture](#architecture)
6. [Engineering highlights](#engineering-highlights)
7. [Quick start](#quick-start)
8. [Configuration](#configuration)
9. [Testing](#testing)
10. [Project structure](#project-structure)
11. [API surface](#api-surface)
12. [Security model](#security-model)
13. [Five-minute demo script](#five-minute-demo-script)
14. [Known limitations](#known-limitations)
15. [Roadmap](#roadmap)

---

## Why this exists

Group buying is a real, proven market — but almost every platform implements it as **one** mechanism with one rule set, then bolts a "wholesale" or "flash sale" label onto the side. The result is that the hard questions are never asked:

- What happens to the money if the group **fails**? Refund fully, or forfeit a deposit?
- Does the price move **up** or **down** as the group grows?
- Does a member who joined early ever pay **more** than one who joined late?
- Can two people bid against each other, and who sees whose ceiling?
- Does the seller get paid when a group fails?

GroupMart answers each of those differently on purpose, six times, and makes the settlement deterministic and auditable every time. It is the kind of system that rewards a technical judge who opens the service layer and a business judge who reads the comparison table.

---

## The six collective-commerce mechanisms

| # | Mechanism | Who forms the group | Price moves | Who risks money | Settlement unit |
|---|---|---|---|---|---|
| 1 | **Group Buy** | Customers start/join groups under a seller's tiered campaign | **Down** as members join (tier ladder) | Customers (full refund on failure) | One order per member at the final tier price |
| 2 | **Wholesale Pooling (CWP)** | Shoppers reserve quantity into a seller's open lot | **Flat** wholesale rate | Customers (full refund on failure) | One order per reservation when the pool fills |
| 3 | **Reverse Group Buying** | Seller states a target quantity; shoppers supply the demand to unlock it | **Down** as demand reaches target | Customers (refund on failure) | One order per participant at the unlocked price |
| 4 | **Customer Lead Group Buying** | A customer creates the demand; **sellers** compete to fulfil it | Set by the winning offer | Customer, until they accept an offer | Orders created from the selected offer |
| 5 | **Proxy Auctions** | Individual bidders, competing | **Up** as bidders compete | Sellers lose the lot; losers are refunded | Auction engine determines one winner per lot |
| 6 | **Group Buying Auctions** | Shoppers bid quantity **and** a private ceiling | **Down** via one collective rule | Customers (refund on failure) | **One clearing price** for everyone whose ceiling covered it |

The last row is the subtle one, and it is the clearest differentiator: in a Group Buying Auction **nobody pays more for outbidding anyone**. Everyone whose maximum covered the single locked clearing price fills at that same price. It is collective buying with auction *discovery*, not a race.

### Worked example — Group Buying Auction

1. Seller configures: `startingPrice` 100, `minimumCollectiveQuantity` 10, `availableQuantity` 50, a pricing rule, and a window.
2. Shoppers each bid a quantity plus a **private maximum unit price** (their ceiling — never revealed, never charged).
3. When the auction ends, one price is derived from the total collective quantity:
   - `COLLECTIVE_QUANTITY_TIERS` — highest reached tier wins; if no tier is reached, the starting price stands.
   - `COLLECTIVE_QUANTITY_DISCOUNT` — starting price minus a flat percentage.
   - A seller floor (`minimumSellerUnitPrice`) can never be undercut.
4. That price is **locked once** into `finalUnitPrice` and never recalculated.
5. Each bid is settled against it: `maxUnitPrice >= finalUnitPrice` → **WON** (own order at the clearing price); otherwise → **OUTBID** and refunded.
6. If the group never reached `minimumCollectiveQuantity` → **FAILED**, no price is ever locked, everyone is refunded.

---

## Feature overview

### Customer / shopper

**Storefront & discovery**
- Landing page, registration, login, password reset, seller application
- Category browsing, search, filtering, sorting, pagination
- Product detail, featured / deals / new-arrivals / trending, seller store pages
- Quick view, product comparison, image search
- Wishlist, cart, coupons, checkout, order confirmation

**Collective commerce** — a full surface for all six mechanisms
- Browse and join deals; start groups; join via invite link, QR code, or code
- Live group progress, countdown, urgency messaging, participant list, activity timeline
- Group buying, wholesale pools, reverse buying, customer-led demands
- Proxy auction bidding, Group Buying Auction bidding
- My participations across every mechanism, with savings history
- Per-participant quantity, address, and payment method at join time

**Orders & aftercare**
- Order history, purchase history, order tracking, cancellation
- Estimated delivery dates with per-order admin override
- Payment and refund breakdown (amount charged, refunded, net paid) on every order page
- Printable invoices
- Product reviews, ratings, helpful votes
- Support conversations
- Coupons and rewards: points, membership tiers, cashback

**AI**
- `/ai-assistant` — self-contained retrieval engine (no external model, no API key, no cost)
- Personalized and similar-product recommendations
- Answers grounded in the customer's **own** orders, scoped by JWT identity

**Account**
- Profile, address book, password, notification preferences

### Seller

- Registration and application; approval status tracking
- Store management, dashboard, analytics
- Product create / edit / delete / feature, bulk CSV import
- Inventory and stock updates, low-stock alerts, inventory logs
- Order management and status transitions (Accept → Dispatch → Delivered)
- **Mechanism management for all six**: campaigns, wholesale offers, reverse-buying offers, customer-led offer responses, auctions, Group Buying Auctions
- Coupons (percentage or fixed, with min order, max discount, usage limit, expiry)
- Review replies, wallet, payout requests
- Support, AI-assisted product copywriting
- Per-mechanism revenue, margin, and settlement reporting

### Administrator

**Governance**
- User, role, and account-status management
- Seller application review and approval/rejection
- Category and product moderation
- Seller store verification

**Commerce operations**
- Order governance: search, filter, **real refunds** (partial or full, with reason), printable invoices
- Platform coupons and platform settings
- Finance and payouts
- Security and platform-content controls

**Monitoring (all six mechanisms, config-driven shared UI)**
- Overview with "needs attention" — overdue deadlines, closing soon, stalled, near-goal
- Searchable record list with progress, price, participation, deadline
- Live monitoring: past deadline, closing within 48h, no participation, mispriced
- Delivery-date board per mechanism
- Analytics and reports (status mix, counterparty value, monthly trend)
- Dispute queue (with refund, capped at what the customer still holds)
- Audit log
- Fraud alerts (rule-based detection, see below)

**Analytics & BI**
- Admin analytics, BI analytics, CSV export
- Platform, customer, seller-revenue, and order/transaction reports

### Cross-cutting

- **Realtime** — Server-Sent Events across 14 topics (catalogue, storefront, orders, cart, group-buy, wholesale, auction, group-buying-auction, reverse-group-buying, group-reverse, seller-account, notifications, support, admin)
- **Notifications** — 9 categories, per-category mute with mandatory categories, group/unread counts, deep links
- **AI assistant** — TF-IDF retrieval built in-process, optional Gemini/OpenAI with rule-based fallback
- **Payments** — sandbox flow, fully modelled (amount charged, refunded, net, transactions)

---

## Tech stack

### Backend

| Concern | Technology |
|---|---|
| Language | Java 17 target (verified running on Java 21) |
| Framework | Spring Boot 3.3.2 |
| Web / MVC | Spring Web |
| Security | Spring Security + JWT (jjwt) |
| Persistence | Spring Data JPA / Hibernate 6, PostgreSQL (H2 for tests) |
| Validation | Jakarta Bean Validation |
| Documentation | springdoc-openapi 2.5.0 (Swagger UI) |
| Ops | Spring Boot Actuator |
| Build | Maven, Lombok |

### Frontend

| Concern | Technology |
|---|---|
| Library | React 18.3 |
| Build | Vite 5.4.11 |
| Routing | React Router 6 |
| Styling | Tailwind CSS 3.4 |
| Charts | Recharts 2.15 |
| Icons | Lucide React |
| QR | qrcode.react |
| HTTP | Axios 1.7 |
| Language | JavaScript (JSX), 53 pages / 155 components |

### Deliberate choices

- **No external AI provider is required.** The retrieval engine is implemented in-process, so the project runs and demos with zero API keys and has no per-request cost or rate limit. External models are an optional enhancement with a deterministic fallback.
- **The client never computes money.** Prices, discounts, and settlement outcomes are always derived server-side from the mechanism's own configuration. This is a trust boundary, not a convenience.
- **H2 for tests, PostgreSQL for everything real.**

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  React SPA  (customer · seller · admin)                      │
│  53 pages · shared admin monitoring shell · SSE subscriber   │
└───────────────┬───────────────────────────┬──────────────────┘
                │ REST (JWT)                │ SSE /realtime/stream
┌───────────────▼───────────────────────────▼──────────────────┐
│  Spring Boot 3.3.2                                          │
│                                                              │
│  Controllers (56)  ──►  Services (108)  ──►  Mappers          │
│         │                      │                             │
│         │              ┌───────▼────────┐                    │
│         │              │  Mechanism     │                    │
│         │              │  engines (6)   │                    │
│         │              └───────┬────────┘                    │
│         │                      │                             │
│         │          ┌───────────▼──────────┐                 │
│         │          │ Lifecycle / Scheduler │  settle,        │
│         │          │  (6 schedulers, 30s)  │  expire, remind │
│         │          └───────────┬──────────┘                 │
│         │                      │                             │
│  DTOs (157)              Repositories (48)                   │
│                                │                             │
│         Entities (89) ◄────────┘                             │
│         RealtimeHub · AuditLog · NotificationService         │
└──────────────────────────────┬───────────────────────────────┘
                               │
                        ┌──────▼──────┐
                        │ PostgreSQL  │   ddl-auto=update
                        └─────────────┘
```

**Request flow for a money-moving action** (e.g. joining a group, placing an auction bid):
1. Controller validates the DTO and resolves the authenticated principal.
2. Service acquires a pessimistic row lock (`SELECT … FOR UPDATE`) on the parent aggregate — always in a fixed order to avoid deadlock.
3. Business rules and pricing are evaluated server-side.
4. Stock is reserved or decremented atomically and written to an inventory log.
5. Orders and payment transactions are created; refunds are recorded as transactions.
6. A realtime event is published and notifications are queued.
7. The result is mapped to a DTO — entities never leave the service layer.

---

## Engineering highlights

### Concurrency correctness

Collective commerce is a correctness problem before it is a UI problem. The same unit can be sold by two shoppers at the last second, or a group can settle twice.

- **Pessimistic row locks with a fixed lock order.** Joins, leaves, bids, and settlements lock the parent aggregate then the child, always in the same order.
- **Optimistic versioning** (`@Version`) on aggregate rows as a second line of defence; conflicts surface as HTTP 409.
- **Atomic stock operations** (`decrementStockIfAvailable`, `incrementStock`) rather than read-modify-write.
- **Unique constraints** preventing duplicate participation in a group and duplicate bids.
- **Re-entrant finalization.** Settlement is guarded so running it twice is a safe no-op, and an auction whose window elapsed while the scheduler was down is resolved on startup.
- **Settlement state machines** with explicit close codes, so reports never parse free text to work out *why* a group failed.

### Proxy bidding engine

A self-contained, unit-tested engine (`ProxyBiddingEngine`) that folds many private ceilings into one public price and one leader:

- Orders eligible bids by maximum, descending, tie-broken deterministically.
- Public price = `min(leaderMaximum, runnerUpMaximum + minimumBidIncrement)` — the least amount that still beats the runner-up by exactly one increment, never more than the leader authorised.
- A lone bidder at the end of an auction pays only the starting price.
- Decoupled from entities via a `Candidate` record, so the rule is testable in isolation from persistence.

### Rule-based fraud detection

Fraud flags are computed on request rather than stored, so the rules stay honest as data changes. Only admin decisions are persisted. Detected patterns include accounts rapidly leaving groups, multiple accounts sharing a shipping address, a buyer shipping to an address saved on the seller's own account, coordinated new-account clustering, one inviter recruiting a cluster of new accounts, and repeat disputing. Address comparison normalises case, spacing, and punctuation.

### Realtime without a message broker

SSE across 14 topics with an in-process hub. No Redis, no Kafka, no WebSocket handshake — one dependency fewer to run at a hackathon, and the client resumes cleanly on reconnect.

### AI that can't hallucinate

The assistant answers from retrieved records rather than generating text: a matched knowledge chunk is returned in its own words, matching products are returned as cards, and order answers are read from the customer's own account. There is a relevance floor, deliberately stricter for policy content (0.18) than for products (0.14), because a loosely related product card is harmless while an unrelated policy sentence quoted verbatim reads as a confidently wrong answer. The index is rebuilt after committed product changes, so it never reads uncommitted rows.

---

## Quick start

### Prerequisites

| Requirement | Version |
|---|---|
| Java | 17+ (21 recommended) |
| Maven | 3.8+ |
| Node.js | 18+ |
| PostgreSQL | 14+ |

Default ports: PostgreSQL `5432`, backend `8080`, frontend `5173`.

### 1. Create the database

```sql
CREATE DATABASE groupmart_new;
```

### 2. Start the backend

```bash
cd backend
mvn spring-boot:run
```

The `dev` profile is active by default and seeds on first start: an admin account and the initial category catalog.

> **Note:** do not pass `-Dspring-boot.run.profiles=default` unless you also set `APP_JWT_SECRET`. The `prod` profile refuses to start without an explicit secret; the `dev` profile supplies a development default. If startup fails with *"app.jwt.secret must be configured"*, you are on the wrong profile.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

### 4. Accounts

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@groupmart.com` | `Admin@12345` |
| Seller | register at `/seller/register`, then **admin must approve** | — |
| Customer | register at `/register` | — |

Sellers are created as `ROLE_CUSTOMER` and hold no store until an administrator approves the application (Admin → Sellers → Applications). Until then, any seller-scoped action correctly returns 404 — the account has no store, not a permissions problem.

### Useful URLs

| Purpose | URL |
|---|---|
| Swagger UI | `http://localhost:8080/swagger-ui.html` |
| OpenAPI JSON | `http://localhost:8080/v3/api-docs` |
| Health / metrics | `http://localhost:8080/actuator` |
| Realtime stream | `http://localhost:8080/api/v1/realtime/stream` |
| Admin dashboard | `http://localhost:5173/admin/dashboard` |

---

## Configuration

Backend environment variables (all optional in development):

| Variable | Default | Purpose |
|---|---|---|
| `SPRING_DATASOURCE_PASSWORD` | `password` | PostgreSQL password |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/groupmart_new` | JDBC URL |
| `APP_JWT_SECRET` | dev default | **Required** on the `prod` profile |
| `APP_JWT_EXPIRATION_MS` | `86400000` | Token lifetime |
| `APP_CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Allowed origins |
| `SPRING_PROFILES_ACTIVE` | `dev` | Active profile |

---

## Testing

```bash
cd backend
mvn test
```

**166 tests across 30 test classes, all passing.** Coverage is concentrated where correctness actually matters:

| Area | What is tested |
|---|---|
| Concurrency | Simultaneous joins competing for limited spots; simultaneous reservation against a pool; aggregate counters never oversell |
| Group Buy lifecycle | Approval-free publish, stock reservation/release, tier pricing, success with orders and price-drop refunds, failure refunds, leader handover, pause/resume, force-close, scheduler expiry |
| Wholesale pools | Pool completion by both trigger modes, failure below minimum, reservation cancellation releasing quantity |
| Group Reverse | Deadline handling, joins, offers, concurrency, security boundary |
| Deadlines | Timezone handling and boundary conditions across every deadline-driven mechanism |
| Realtime | Hub topic routing and event publishing |
| Settings & platform | Rule persistence, validation |
| Reviews | Delivery eligibility |
| Security | Role enforcement — shoppers and sellers cannot reach admin endpoints |

Tests run against an isolated PostgreSQL database (`groupmart_cwp_test`), never the development one.

---

## Project structure

```text
GroupMart_E/
├── README.md
├── backend/
│   ├── pom.xml
│   ├── src/main/java/com/groupmart/
│   │   ├── common/            response + exception handling
│   │   ├── config/            security, seeding, web, scheduling
│   │   ├── controller/        56 REST controllers
│   │   ├── dto/               157 request/response DTOs
│   │   ├── entity/            89 JPA entities
│   │   ├── realtime/          SSE hub, publisher, topics
│   │   ├── repository/        48 Spring Data repositories
│   │   ├── scheduler/         6 lifecycle schedulers
│   │   └── service/           108 services + mechanism engines
│   └── src/test/java/         30 test classes
├── frontend/
│   ├── package.json
│   ├── .env
│   └── src/
│       ├── api/               axios clients per domain
│       ├── components/        155 components by area
│       │   ├── admin/         dashboards, groupbuy, wholesale, featureAdmin
│       │   ├── seller/
│       │   ├── groupbuy/      price ladder, timers, share, invoice
│       │   ├── auction/ · groupr/ · reverse/ · wholesale/
│       │   └── common/
│       └── pages/             53 routed pages
├── Demo_Data_For_Show/         demo account notes
├── GroupMart_CWP_Specification.docx
└── REVERSE_GROUP_BUYING_AND_AUCTION_PLAN.md
```

The repository holds two independent projects. There is no root-level install or start script — run each from its own directory.

---

## API surface

REST under `/api/v1`, JWT bearer authentication, role-scoped by audience.

| Domain | Prefix | Audiences |
|---|---|---|
| Auth | `/auth` | public + authenticated |
| Catalogue, search | `/products`, `/categories`, `/stores` | public |
| Cart, wishlist | `/cart`, `/wishlist` | customer |
| Orders, checkout | `/orders` | customer |
| Coupons & rewards | `/coupons` | customer |
| Group Buy | `/group-buys`, `/seller/group-buys`, `/admin/group-buys` | all three |
| Wholesale | `/wholesale`, `/seller/wholesale`, `/admin/wholesale` | all three |
| Reverse Group Buying | `/reverse-group-buying`, `/seller/…`, `/admin/…` | all three |
| Customer Lead Group Buying | `/group-reverse`, `/seller/…`, `/admin/…` | all three |
| Proxy Auctions | `/auctions`, `/seller/auctions`, `/admin/auctions` | all three |
| Group Buying Auctions | `/group-buying-auctions`, `/seller/…`, `/admin/…` | all three |
| AI | `/ai` | public + authenticated |
| Support | `/support` | customer + seller |
| Realtime | `/realtime/stream` | authenticated |
| Administration | `/admin` | administrator |

Full request/response schemas are browsable in Swagger UI.

---

## Security model

- **Stateless JWT** authentication; identity is taken only from the verified token, never from request parameters.
- **Role-based authorization** at the service and controller boundary: `CUSTOMER`, `SELLER`, `ADMIN`.
- **Ownership checks** on every seller-scoped operation — a seller can only act on their own store's records, regardless of role.
- **No entity ever crosses the service boundary**, which prevents lazy-loading proxies and internal fields from leaking into responses.
- **Global exception handling** returns typed, non-leaking errors; optimistic-lock and constraint violations map to 409, unreadable bodies to 400, and authentication failures to 401.
- **Secrets are never defaulted in production.** The `prod` profile refuses to start without `APP_JWT_SECRET`.
- **AI order lookups are scoped to the authenticated customer**, so an order number alone never reveals an order and a caller-supplied email is ignored.
- **Payments are sandbox-only** by design; the flow is fully modelled but never moves real money.

---

## Five-minute demo script

The fastest way to show a judge the difference between this and a template:

1. **Two minutes — proxy auction.** Open an auction, bid with two accounts. Show the public price moving by exactly one increment and never revealing either ceiling. Then place a Group Buying Auction bid and show that *both* winners pay the **same** clearing price.
2. **Two minutes — failure is handled.** Take a group below its minimum, let the scheduler settle it, and show every member refunded and a close code explaining why. Then show the admin monitoring tab flag it.
3. **One minute — the AI assistant.** Ask it a policy question, then ask what you spent last month. Both are answered from retrieved data and your own account, with no API key configured.

---

## Known limitations

Stated plainly, because a judge will find them anyway:

- **Payments are simulated.** Card/PayPal/Stripe capture is sandbox; the ledger is modelled but no processor is integrated.
- **No carrier tracking.** Estimated delivery dates are rule-based; tracking numbers and carrier names are placeholders.
- **Audit coverage is Group Buy only.** A `GROUP_BUY_`-prefixed audit trail exists for group buy moderation. Other mechanisms currently record only platform-wide admin and order actions; an `@AuditActivity` annotation and aspect exist but are not yet applied to those controllers.
- **Seller coupons are not store-scoped at validation time.** A coupon validates on code and subtotal alone, so it can be applied to a cart containing another store's products. Fixing it needs store identity on cart items threaded through validation.
- **An invalid coupon at checkout is silently ignored** rather than rejected — the order is placed at full price. The UI validates first, so this is only reachable in unusual paths.
- **Classic auction loser settlement has two known defects**: losing bids do not always set `refundAmount`/`paymentStatus=REFUNDED`, and sold auctions can notify non-winners. Group Buying Auctions are unaffected (they settle through a separate path).
- **Frontend UI was verified by build and API probing**, not by end-to-end browser automation.

---

## Roadmap

- Apply `@AuditActivity` across all mechanism controllers for uniform audit trails
- Store-scoped coupon validation (cart items carry `sellerStoreId`)
- Fix classic auction loser refunds and notification targeting
- Predicted group success / failure risk, and seller-side campaign recommendations
- AI-assisted group formation — matching a shopper to groups they can tip over the threshold
- Payment processor integration and real carrier tracking

---

## Contributing

This is a hackathon project. Conventions worth knowing:

- **Server owns money.** If a client can change a price, a discount, or an outcome by editing a request, that is a bug.
- **Entities do not leave services.** Map to DTOs at the boundary.
- **Lock in a fixed order** and say so in a comment when adding a new lock.
- **New mechanisms get a config, not a new tab.** The admin monitoring UI is driven by a single feature config; adding a seventh mechanism should mean adding a config entry, not a new component tree.

---

## License

Released for hackathon and evaluation purposes.
