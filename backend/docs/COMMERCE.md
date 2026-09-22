# Commerce, multimodal RAG, and WhatsApp

Chatty supports an ecommerce assistant without coupling the agent to a single
storefront. A bot can index a normalized product catalog, retrieve products by
text or an uploaded image, and return grounded product cards containing the
current price, currency, stock state, variants, image, and checkout URL.

## Request path

```text
visitor text/image
      -> Gemini vision attribute extraction (when an image is present)
      -> text + pgvector hybrid retrieval scoped to bot_id
      -> grounded agent prompt (no price/stock guessing)
      -> PRODUCT_CARD tokens rendered by the web widget or WhatsApp text
```

The visual stage is deliberately separated from catalog retrieval. This keeps
the database provider-neutral and lets an installation replace Gemini with its
own vision/embedding provider later. The current catalog embedding is
768-dimensional and uses the same embedding pipeline as document RAG.

## WooCommerce

Connect a store with either:

* `POST /api/bots/{bot_id}/integrations/woocommerce/connect` using a scoped
  `ck_...` / `cs_...` pair; or
* `POST .../authorize-url` and the WooCommerce `wc-auth/v1/authorize` flow.

The connector imports published products, images, categories, tags, stock,
prices, sale prices, attributes, and variation facts. It upserts by the
WooCommerce product id, exposes a progress status, and accepts signed product
created/updated/deleted webhooks for near-real-time freshness. Configure the
webhook URL returned by the status endpoint and use the returned secret as the
WooCommerce webhook secret.

Consumer credentials are encrypted with `BYOK_ENCRYPTION_KEY` before storage;
legacy plaintext rows are readable for migration and should be re-saved after
the key is configured. TLS certificate verification is always enabled for
merchant requests.

## Image search and QA

The visitor flow is automatic when an image is attached to a widget message.
Authenticated dashboard QA can call:

`POST /api/bots/{bot_id}/media-items/search-image`

with an image multipart field and optional `query_text`. Catalog assets can be
created with `POST /api/bots/{bot_id}/media-items` or imported in batches. The
`chatty_media_items` migration enables tenant-scoped HNSW vector retrieval.

## Manual catalog mode (no WooCommerce required)

WooCommerce is optional. In manual mode, the dashboard or an ERP/PIM can own
the catalog while Chatty stores a searchable, tenant-scoped copy. Add items
with `POST /api/bots/{bot_id}/media-items` (or batch `/import`), then provision
one signed webhook with `POST /api/bots/{bot_id}/media-webhook`.

The response contains a one-time `signing_secret` and webhook URL. Sign the
exact UTF-8 request body with HMAC-SHA256 and send the lowercase digest in
`X-Chatty-Signature` (optionally prefixed with `sha256=`). Supported events are
`product.created`, `product.updated`, and `product.deleted`. Example stock
update:

```json
{"event":"product.updated","external_id":"SKU-1001","item":{"price":89.99,"currency":"USD","metadata":{"in_stock":true,"stock_quantity":12,"variants":[{"sku":"SKU-1001-42","size":"42","in_stock":true}]}}}
```

Metadata is merged, so stock-only events do not erase product facts. Searchable
fields are re-embedded automatically; deletes remove the item by
`external_id`. Apply `20260921110000_manual_catalog_webhooks.sql` first and
rotate a secret with `?rotate=true` if it is exposed.

## WhatsApp Business

Chatty uses the Meta WhatsApp Cloud API at `/webhook/whatsapp`:

For dashboard one-click onboarding, configure `FACEBOOK_APP_ID`,
`FACEBOOK_APP_SECRET`, `FACEBOOK_REDIRECT_URI` (optional; defaults to
`https://<backend>/auth/whatsapp/callback`), and `BYOK_ENCRYPTION_KEY`. The
Integrations tab then opens Meta authorization, discovers the first WABA phone
number available to the business, subscribes the app, and stores the phone,
WABA, verify token, and encrypted access token on the selected bot. A real Meta
Business account and WhatsApp phone are required; the OAuth app must allow the
redirect URI and request the WhatsApp business scopes.

1. Configure the bot's phone-number id, access token, app secret, and verify
   token (or the equivalent server environment variables).
2. Set the Meta callback URL to `https://<backend>/webhook/whatsapp` and use
   `GET /webhook/whatsapp` for verification.
3. Enable the `messages` webhook field.

The Integrations dashboard provides **Test connection** after credentials are
saved. It calls `POST /api/integrations/whatsapp/test?bot_id=...` and performs a
read-only Graph API phone lookup; it does not send a WhatsApp message. A valid
lookup confirms credentials only. Meta must still deliver a real `POST
/webhook/whatsapp` event, and the Meta app must be published before production
messages from admins, developers, or testers are delivered.

Text, interactive replies, voice notes, documents, and images are routed to the
same assistant and multimodal catalog search as the web widget. Incoming Meta
message ids are stored in `chatty_channel_events` with a unique key, so retry
deliveries cannot create duplicate replies or consume quota twice. Outbound
answers are split below Meta's message limit and retried on transient 408/425/
429/5xx responses.

For high-volume deployments, run the Redis Streams worker described in
[`OPERATIONS.md`](OPERATIONS.md) and move long-running ingestion/replies behind
the queue. Keep webhook handlers fast and return 2xx once an event is claimed.

## Production checklist

- Apply all migrations, including `20260916120000_multimodal_rag.sql`,
  `20260916130000_woocommerce_integration.sql`, and
  `20260921100000_channel_event_idempotency.sql`, and
  `20260921110000_manual_catalog_webhooks.sql`.
- Set `BYOK_ENCRYPTION_KEY` in Secret Manager before connecting stores.
- Use least-privilege WooCommerce read keys unless order actions are explicitly
  enabled in a future connector.
- Configure image/object storage; data-URI media fallback is development-only
  (`ALLOW_DATA_URI_MEDIA_FALLBACK=true`) and should remain disabled in hosted
  production.
- Monitor sync failures, webhook signature failures, retrieval hit rate, and
  assistant answers that contain no product card when a product was requested.
