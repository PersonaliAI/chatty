# Chatty Ecommerce Multimodal RAG Review

**Review date:** 2026-09-21  
**Scope:** existing backend/frontend implementation only. No code was changed.

**Implementation update (2026-09-25):** The formerly identified commerce
durability gap has since been addressed: WooCommerce authorization and manual
syncs publish to the Redis worker with idempotency, retries, per-store
concurrency, dead-letter handling, and resumable checkpoints. Production
requests fail closed when the durable queue is absent; an ephemeral fallback
is available only when explicitly enabled for local development. Outbound
human email replies now use the same durable worker path.

## Executive verdict

Chatty has a credible ecommerce-assistant foundation and **can connect to WooCommerce today**. The end-to-end routing is present for web and WhatsApp: an incoming image reaches the common assistant, a vision model turns it into textual attributes, catalog retrieval is scoped to the bot, and the model is asked to return product-card data with a purchase URL.

It is **not yet industrial-grade for price, inventory, or image-match promises**. The current design is an LLM-mediated, asynchronously replicated catalog, rather than an authoritative live-commerce lookup. That is appropriate for discovery and assisted selling after the blockers below are resolved; it should not yet make unconditional “current price”, “in stock”, or “exact visual match” claims.

## What is already working

| Capability | Evidence in implementation | Assessment |
| --- | --- | --- |
| Catalog model | `chatty_media_items` stores tenant-scoped products, SKU, price, currency, URLs, stock metadata, variants, and embeddings. | Good base data model. |
| Image-to-catalog route | A visitor image is analysed by Gemini, converted into a text query, embedded, then searched against the bot catalog. | Functional semantic visual discovery. |
| WooCommerce import | Connect and authorization endpoints exist; published products, metadata, images, prices, stock and variations are imported. | Feasible and already implemented. |
| Freshness events | Product create/update/delete webhooks update the local catalog. | Correct direction, but security and durability need work. |
| Web product card | The widget removes a `PRODUCT_CARD` token and renders image, price, stock badge and external product link. | Good customer experience when token contents are valid. |
| WhatsApp input | Meta Cloud API messages, images, voice and documents use the same assistant function as the web widget. | Shared behavior exists. |
| WhatsApp resilience | Meta signature verification (when configured), inbound event idempotency, outgoing retry and message splitting are present. | Good foundations. |

## Required fixes before a production commerce launch

### P0 — WooCommerce webhooks can be accepted without a signature

The public receiver only validates the HMAC if `X-WC-Webhook-Signature` is present. A request with no signature is processed and can create, update, or delete catalog entries. Require a non-empty signature and reject any event that fails verification. Add replay protection/event identity as well, because a valid signed event can otherwise be replayed.

### P0 — TLS verification is disabled during product sync

The import client is constructed with `verify=False`. This exposes store credentials and catalog data to man-in-the-middle attacks and contradicts the documentation’s TLS claim. TLS verification must remain enabled for every connection, including background imports.

### P0 — “Current price and stock” is not authoritative at answer time

The assistant retrieves the locally replicated record and the LLM writes the response/card token. The WooCommerce import and webhooks are asynchronous, and no live product/variation lookup is performed before the answer is sent. A price or stock change can therefore be stale; the LLM can also emit a card value that differs from the retrieved value.

For commerce-critical questions, use retrieval only to identify a candidate product, then perform a bounded live read from WooCommerce by product/variation ID immediately before composing the response. Generate the product card server-side from that verified result, rather than asking the model to manufacture JSON. When the live lookup is unavailable, say that availability must be confirmed and link to the product page.

### P0 — The card contract is model-generated and incomplete

The prompt shows placeholder values (`"..."`) rather than a validated per-product card payload, and the formatted catalog context does not expose the media-item ID. The regex parser silently drops malformed JSON. This makes a wrong title/price/link, missing card, or unrendered token an expected operational failure mode.

Introduce a typed server-side response contract: candidate IDs chosen from retrieval, card fields resolved from the catalog/live store, URL allowlisted to the connected store, and output schema validation before delivery. Persist the selected product IDs, data version, retrieval scores, and card-render result for auditability.

### P0 — The claimed visual search is text-based, not image-vector matching

Catalog images are not embedded as images. The query image is described by Gemini and that text is embedded against text created from title/description/SKU/optional attributes. It can find “red floral dress” but does not implement true visual similarity, product-image deduplication, or robust exact-match search.

For an image-led ecommerce promise, create and store image embeddings for every catalog image using one consistent multimodal embedding model. Use a two-stage ranker: image-to-image similarity plus text/attribute/brand/SKU signals. Fetch and index all product gallery images, not only the first image. Keep the current vision-extracted attributes as explainability and filters, not as the sole visual representation.

### P0 — WooCommerce credentials are over-privileged and the store URL is not protected by the existing SSRF guard

The authorization request asks for `read_write`, while this connector only reads products. The manual connection also accepts a merchant-supplied URL and uses direct `httpx` requests; the repository already contains an SSRF-safe request utility but the WooCommerce connector does not use it. Require read-only keys, validate/pin public HTTPS destinations, block private/link-local hosts and redirects, and rotate/revoke credentials on disconnect.

## High-priority reliability and correctness work

1. **Maintain durable jobs.** Commerce syncs and outbound human email replies now use the Redis/job-worker pattern with idempotency keys, retries, per-store concurrency limits where applicable, dead-letter handling, and resumable sync checkpoints. Keep queue configuration and worker capacity as release-gated production dependencies.
2. **Re-embed after a product changes.** Update and webhook paths modify title/description but do not refresh the stored embedding. Over time semantic retrieval drifts away from the product facts. Put embedding regeneration in the durable ingestion job and version the embedding model.
3. **Fix variable-product selection.** Variations are loaded into parent metadata, but retrieval/indexing and the response contract do not select a concrete in-stock variation. For a size/colour request, rank variants directly and return the exact variation price, availability and a variant-safe buy link/cart action.
4. **Treat data quality as a state machine.** Missing primary images become a placeholder, unpublished/hidden catalog facts need explicit policy, and a later update without image data can overwrite an existing image incorrectly. Track `source_updated_at`, `synced_at`, `catalog_version`, ingestion status and per-product errors.
5. **Enforce bounded retrieval.** Current fallback reads up to 20 products then does simple token scoring. Add full-text search/lexical ranking, filters for active/in-stock/category/language/price range, score normalization and a minimum confidence threshold. Do not recommend a weak visual match as the same product.
6. **Do not publish the entire catalog through RLS by default.** The migration creates an unrestricted public SELECT policy on all media items. Prefer service/API-mediated, bot-scoped retrieval and issue signed image URLs where catalog imagery is not intentionally public.
7. **Limit WhatsApp media before memory/model use.** Media downloaded from Meta is read fully without an explicit size/content limit in that path. Enforce Meta-compatible type and byte caps, inspect declared and actual content type, and quarantine/scan files before sending them to model/storage systems.

## WhatsApp readiness

The shared assistant invocation means image-based product discovery is conceptually available in WhatsApp. The experience differs from the web widget:

| Web widget | WhatsApp |
| --- | --- |
| `PRODUCT_CARD` is parsed and rendered as a rich card. | The token is not parsed; it will be sent as raw text unless stripped or transformed. |
| Product image, stock badge and click target are rendered by React. | Current send logic supports text and reply buttons only; it does not send a WhatsApp image/catalog/product message. |
| Product page can open in a new browser tab. | A product URL can be included in text; an approved template/policy path is also needed for messages outside the customer-service window. |

Before advertising WhatsApp support, add a channel renderer. It must remove internal tokens, send a concise plain-text answer with an approved product URL, optionally send an image/media or Meta catalog product message, and respect Meta message-window/template rules. Test text, image with caption, image without caption, variable product, no-match, stale product, rate limiting, duplicate delivery, and a failed Meta send.

## Recommended target architecture

```text
Web widget / WhatsApp image + question
  -> channel validation, idempotency, size caps
  -> vision attributes + image embedding
  -> tenant-scoped hybrid retrieval (image, text, SKU, filters)
  -> confidence gate / clarification on ambiguity
  -> live WooCommerce read for selected product + variation
  -> deterministic product response builder
  -> web card renderer OR WhatsApp channel renderer
  -> audit event, metrics, tracing
```

Use the local catalog for low-latency discovery and browse recommendations. Use WooCommerce as the source of truth for price, stock, sales, variants, product status and checkout URL. A short live-read cache (for example, tens of seconds with webhook invalidation) gives a good balance between response time and correctness.

## Industrial-grade feature set

**Commerce:** multi-store/region/currency support, tax/shipping disclaimers, promotion windows, product and variation IDs, cart/deep-link support, substitute recommendations, order lookup only with verified customer identity, and human handoff for complex cases.

**RAG quality:** image embedding evaluation set, product/variant ground-truth labels, query rewrite, brand/SKU OCR, hybrid retrieval, reranking, confidence calibration, multilingual retrieval, negative/no-match behavior, and offline plus production evaluation dashboards.

**Safety and governance:** strict tenant/store isolation, encrypted secrets with KMS rotation, least-privilege read keys, webhook signing plus replay defense, SSRF controls, PII minimization, retention/deletion controls, audit logs, prompt-injection resistance for catalog descriptions, and outbound-link allowlists.

**Operations:** queue-backed ingestion, backfills, partial-sync recovery, freshness SLOs, webhook lag alerts, product sync error dashboards, dead-letter replay, model/provider fallbacks, rate limits per bot/store/customer, cost budgets, structured traces, and alerting on price/card disagreement or low retrieval confidence.

## Acceptance gates

Do not label this capability “industrial-grade” until all of these are true:

1. Every WooCommerce webhook is signed, replay-safe, and rejected without a valid signature; sync uses verified TLS and SSRF-safe connections.
2. A shopping answer uses a verified product/variation record, and its card/link is server generated and schema validated.
3. The WhatsApp renderer produces customer-ready messages with no internal tokens and is tested against the relevant Meta delivery policy path.
4. Image matching is evaluated on representative merchant catalog images with defined precision/recall and no-match thresholds.
5. Sync is durable, observable and recoverable, with a measurable freshness SLO.
6. End-to-end tests cover the exact shopper scenario: photo + “how much?”, no exact match, size/colour variation, out of stock, price change, malformed/forged webhook, duplicate WhatsApp event and Meta retry.

## Validation performed

The focused current test suite was run with the repository’s Python launcher:

```text
58 passed in 8.35s
```

Those tests cover WooCommerce authorization-state handling, WhatsApp webhook/security behaviors, and widget-brain helper logic. They do not provide end-to-end evidence for import, image retrieval, card correctness, live price freshness, webhook signature absence, or WhatsApp commerce rendering; those are the highest-value tests to add next.
