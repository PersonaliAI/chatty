"""Multi-Gateway Payment Adapter for Stripe, Lemon Squeezy, and Polar.sh.

Provides:
- Secure verification of API keys and credentials.
- In-chat checkout session generation for Stripe, Lemon Squeezy, and Polar.sh.
- Decoupled, PCI-DSS compliant architecture (zero card data stored locally).
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional
import httpx

logger = logging.getLogger("chatty.payment_gateways")


class PaymentGatewaysService:
    """Manages multi-gateway checkout session creation and credential verification."""

    # -------------------------------------------------------------------------
    # 1. STRIPE ADAPTER
    # -------------------------------------------------------------------------
    @staticmethod
    async def verify_stripe(secret_key: str) -> dict[str, Any]:
        """Verify Stripe API key by querying the balance endpoint."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                "https://api.stripe.com/v1/balance",
                auth=(secret_key.strip(), ""),
            )
            if res.status_code == 200:
                data = res.json()
                currency = (
                    data.get("available", [{}])[0].get("currency", "usd")
                    if data.get("available")
                    else "usd"
                )
                return {
                    "valid": True,
                    "currency": currency,
                    "livemode": data.get("livemode", False),
                }
            return {
                "valid": False,
                "error": res.json().get("error", {}).get("message", f"HTTP {res.status_code}"),
            }

    @staticmethod
    async def create_stripe_checkout(
        secret_key: str,
        amount_cents: int,
        currency: str,
        title: str,
        customer_email: Optional[str],
        success_url: str,
        cancel_url: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Create a Stripe Checkout Session via REST API."""
        async with httpx.AsyncClient(timeout=15.0) as client:
            form_data = {
                "payment_method_types[0]": "card",
                "mode": "payment",
                "success_url": success_url,
                "cancel_url": cancel_url,
                "line_items[0][price_data][currency]": currency.lower(),
                "line_items[0][price_data][unit_amount]": str(amount_cents),
                "line_items[0][price_data][product_data][name]": title,
                "line_items[0][quantity]": "1",
            }
            if customer_email:
                form_data["customer_email"] = customer_email
            if metadata:
                for k, v in metadata.items():
                    form_data[f"metadata[{k}]"] = str(v)

            res = await client.post(
                "https://api.stripe.com/v1/checkout/sessions",
                auth=(secret_key.strip(), ""),
                data=form_data,
            )
            if res.status_code in (200, 201):
                data = res.json()
                return {
                    "provider": "stripe",
                    "checkout_url": data["url"],
                    "session_id": data["id"],
                    "amount_cents": amount_cents,
                    "currency": currency,
                }
            error_msg = res.json().get("error", {}).get("message", res.text)
            raise RuntimeError(f"Stripe API error: {error_msg}")

    # -------------------------------------------------------------------------
    # 2. LEMON SQUEEZY ADAPTER
    # -------------------------------------------------------------------------
    @staticmethod
    async def verify_lemonsqueezy(api_key: str, store_id: Optional[str] = None) -> dict[str, Any]:
        """Verify Lemon Squeezy API credentials."""
        headers = {
            "Accept": "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json",
            "Authorization": f"Bearer {api_key.strip()}",
        }
        url = (
            f"https://api.lemonsqueezy.com/v1/stores/{store_id}"
            if store_id
            else "https://api.lemonsqueezy.com/v1/stores"
        )
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url, headers=headers)
            if res.status_code == 200:
                data = res.json()
                store_name = "Lemon Squeezy Store"
                resolved_store_id = store_id
                if "data" in data:
                    if isinstance(data["data"], list) and len(data["data"]) > 0:
                        store_name = data["data"][0].get("attributes", {}).get("name", store_name)
                        resolved_store_id = data["data"][0].get("id")
                    elif isinstance(data["data"], dict):
                        store_name = data["data"].get("attributes", {}).get("name", store_name)
                return {
                    "valid": True,
                    "store_name": store_name,
                    "store_id": resolved_store_id,
                }
            return {
                "valid": False,
                "error": res.json().get("errors", [{}])[0].get("detail", f"HTTP {res.status_code}"),
            }

    @staticmethod
    async def create_lemonsqueezy_checkout(
        api_key: str,
        store_id: str,
        amount_cents: int,
        currency: str,
        title: str,
        customer_email: Optional[str],
        success_url: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Create a Lemon Squeezy custom price checkout session."""
        headers = {
            "Accept": "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json",
            "Authorization": f"Bearer {api_key.strip()}",
        }
        payload = {
            "data": {
                "type": "checkouts",
                "attributes": {
                    "custom_price": amount_cents,
                    "product_options": {
                        "name": title,
                        "redirect_url": success_url,
                    },
                    "checkout_data": {
                        "email": customer_email or "",
                        "custom": metadata or {},
                    },
                },
                "relationships": {
                    "store": {
                        "data": {
                            "type": "stores",
                            "id": str(store_id),
                        }
                    }
                },
            }
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                "https://api.lemonsqueezy.com/v1/checkouts",
                headers=headers,
                json=payload,
            )
            if res.status_code in (200, 201):
                data = res.json()
                checkout_url = (
                    data.get("data", {})
                    .get("attributes", {})
                    .get("url")
                )
                checkout_id = data.get("data", {}).get("id")
                return {
                    "provider": "lemonsqueezy",
                    "checkout_url": checkout_url,
                    "session_id": checkout_id,
                    "amount_cents": amount_cents,
                    "currency": currency,
                }
            err = res.json().get("errors", [{}])[0].get("detail", res.text)
            raise RuntimeError(f"Lemon Squeezy API error: {err}")

    # -------------------------------------------------------------------------
    # 3. POLAR.SH ADAPTER
    # -------------------------------------------------------------------------
    @staticmethod
    async def verify_polar(access_token: str, organization_id: Optional[str] = None) -> dict[str, Any]:
        """Verify Polar.sh API credentials."""
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {access_token.strip()}",
        }
        url = (
            f"https://api.polar.sh/v1/organizations/{organization_id}"
            if organization_id
            else "https://api.polar.sh/v1/organizations"
        )
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url, headers=headers)
            if res.status_code == 200:
                data = res.json()
                org_name = "Polar Organization"
                resolved_org_id = organization_id
                if "items" in data and len(data["items"]) > 0:
                    org_name = data["items"][0].get("name", org_name)
                    resolved_org_id = data["items"][0].get("id")
                elif "name" in data:
                    org_name = data.get("name", org_name)
                return {
                    "valid": True,
                    "organization_name": org_name,
                    "organization_id": resolved_org_id,
                }
            return {
                "valid": False,
                "error": res.json().get("detail", f"HTTP {res.status_code}"),
            }

    @staticmethod
    async def create_polar_checkout(
        access_token: str,
        organization_id: str,
        amount_cents: int,
        currency: str,
        title: str,
        customer_email: Optional[str],
        success_url: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Create a Polar.sh custom checkout session."""
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token.strip()}",
        }
        payload = {
            "amount": amount_cents,
            "currency": currency.lower(),
            "product_name": title,
            "success_url": success_url,
            "customer_email": customer_email,
            "metadata": metadata or {},
        }
        if organization_id:
            payload["organization_id"] = organization_id

        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                "https://api.polar.sh/v1/checkouts/custom/",
                headers=headers,
                json=payload,
            )
            if res.status_code in (200, 201):
                data = res.json()
                return {
                    "provider": "polar",
                    "checkout_url": data.get("url"),
                    "session_id": data.get("id"),
                    "amount_cents": amount_cents,
                    "currency": currency,
                }
            err = res.json().get("detail", res.text)
            raise RuntimeError(f"Polar.sh API error: {err}")

    # -------------------------------------------------------------------------
    # 4. PRODUCT & PRICING CATALOG SYNC
    # -------------------------------------------------------------------------
    @classmethod
    async def fetch_stripe_products(cls, secret_key: str) -> list[dict[str, Any]]:
        """Fetch active products and prices from Stripe."""
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(
                "https://api.stripe.com/v1/prices?active=true&limit=100&expand[]=data.product",
                auth=(secret_key.strip(), ""),
            )
            if res.status_code != 200:
                logger.warning("Failed to fetch Stripe products: %s", res.text)
                return []

            items = []
            for item in res.json().get("data", []):
                prod = item.get("product") or {}
                if isinstance(prod, str):
                    prod_name = "Stripe Product"
                    prod_desc = None
                    prod_img = None
                else:
                    prod_name = prod.get("name") or "Stripe Product"
                    prod_desc = prod.get("description")
                    images = prod.get("images") or []
                    prod_img = images[0] if len(images) > 0 else None

                amount_cents = item.get("unit_amount") or 0
                currency = (item.get("currency") or "usd").upper()
                rec = item.get("recurring")
                interval = rec.get("interval") if rec else None
                formatted = f"${(amount_cents / 100):.2f} {currency}"
                if interval:
                    formatted += f" / {interval}"

                items.append({
                    "id": item["id"],
                    "price_id": item["id"],
                    "product_id": prod.get("id") if isinstance(prod, dict) else prod,
                    "provider": "stripe",
                    "name": prod_name,
                    "description": prod_desc,
                    "amount_cents": amount_cents,
                    "currency": currency,
                    "formatted_price": formatted,
                    "recurring": interval,
                    "image_url": prod_img,
                })
            return items

    @classmethod
    async def fetch_lemonsqueezy_products(cls, api_key: str, store_id: Optional[str] = None) -> list[dict[str, Any]]:
        """Fetch products and variants from Lemon Squeezy."""
        headers = {
            "Accept": "application/vnd.api+json",
            "Authorization": f"Bearer {api_key.strip()}",
        }
        url = "https://api.lemonsqueezy.com/v1/products?include=variants&page[size]=100"
        if store_id:
            url += f"&filter[store_id]={store_id}"

        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(url, headers=headers)
            if res.status_code != 200:
                logger.warning("Failed to fetch Lemon Squeezy products: %s", res.text)
                return []

            data = res.json()
            variants_map = {}
            for inc in data.get("included", []):
                if inc.get("type") == "variants":
                    variants_map[inc["id"]] = inc.get("attributes", {})

            items = []
            for prod in data.get("data", []):
                attrs = prod.get("attributes", {})
                name = attrs.get("name") or "Lemon Squeezy Product"
                desc = attrs.get("description")
                thumb = attrs.get("thumb_url")
                buy_url = attrs.get("buy_now_url")

                # Try to get price from primary variant or price field
                amount_cents = attrs.get("from_price") or attrs.get("price") or 0
                formatted = f"${(amount_cents / 100):.2f} USD"

                items.append({
                    "id": prod["id"],
                    "product_id": prod["id"],
                    "provider": "lemonsqueezy",
                    "name": name,
                    "description": desc,
                    "amount_cents": amount_cents,
                    "currency": "USD",
                    "formatted_price": formatted,
                    "recurring": None,
                    "image_url": thumb,
                    "checkout_url": buy_url,
                })
            return items

    @classmethod
    async def fetch_polar_products(cls, access_token: str, organization_id: Optional[str] = None) -> list[dict[str, Any]]:
        """Fetch products from Polar.sh."""
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {access_token.strip()}",
        }
        url = "https://api.polar.sh/v1/products/?is_archived=false&limit=100"
        if organization_id:
            url += f"&organization_id={organization_id}"

        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(url, headers=headers)
            if res.status_code != 200:
                logger.warning("Failed to fetch Polar.sh products: %s", res.text)
                return []

            items = []
            for prod in res.json().get("items", []):
                prices = prod.get("prices") or []
                primary_price = prices[0] if len(prices) > 0 else {}
                amount_cents = primary_price.get("price_amount") or 0
                currency = (primary_price.get("price_currency") or "usd").upper()
                rec = primary_price.get("recurring_interval")
                formatted = f"${(amount_cents / 100):.2f} {currency}"
                if rec:
                    formatted += f" / {rec}"

                items.append({
                    "id": prod["id"],
                    "product_id": prod["id"],
                    "price_id": primary_price.get("id"),
                    "provider": "polar",
                    "name": prod.get("name") or "Polar Product",
                    "description": prod.get("description"),
                    "amount_cents": amount_cents,
                    "currency": currency,
                    "formatted_price": formatted,
                    "recurring": rec,
                    "image_url": None,
                })
            return items
