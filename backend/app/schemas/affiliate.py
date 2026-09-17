"""Pydantic schemas for the Chatty affiliate program."""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class AffiliateJoinRequest(BaseModel):
    referral_code: str = Field(..., min_length=2, max_length=80, description="Unique referral slug for the partner link")
    payout_email: str = Field(..., min_length=3, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", description="PayPal or email address for receiving commission payouts")
    display_name: Optional[str] = Field(None, max_length=120, description="Public partner or agency display name")
    website_url: Optional[str] = Field(None, max_length=300, description="Partner website or social profile URL")


class AffiliateSettingsUpdateRequest(BaseModel):
    payout_email: Optional[str] = Field(None, min_length=3, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    display_name: Optional[str] = Field(None, max_length=120)
    website_url: Optional[str] = Field(None, max_length=300)


class AdminAffiliateStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(pending|active|paused|rejected)$")


class AdminAffiliateRateUpdateRequest(BaseModel):
    commission_rate_bps: int = Field(..., ge=0, le=10000, description="Commission rate in basis points (e.g. 3000 = 30%)")


class AdminAffiliatePayoutCreateRequest(BaseModel):
    affiliate_id: str = Field(..., description="UUID of the affiliate profile")
    amount_cents: int = Field(..., ge=1, description="Payout amount in USD cents")
    payout_method: str = Field("paypal", max_length=50)
    external_payout_id: Optional[str] = Field(None, max_length=120, description="Transaction ID or PayPal batch ID")
    notes: Optional[str] = Field(None, max_length=500)
