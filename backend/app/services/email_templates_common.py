"""Standardized, Mobile-Responsive & GDPR-Compliant Email Layout Helpers.

Ensures all outbound emails across Chatty meet:
1. Strict Mobile Responsiveness:
   - Fluid table layout (max-width 600px, 100% width on mobile)
   - Viewport meta tags, Apple mail disable reformatting, IE edge compatibility
   - Comprehensive @media queries for mobile paddings, full-width touch targets, stacked layouts
2. Strict GDPR & ePrivacy Compliance:
   - Transparent legal basis & reason for receipt ("Why am I receiving this?")
   - Physical registered business address in all footers (CAN-SPAM & GDPR Article 13/14)
   - Cryptographic 1-click Unsubscribe link (Marketing) or Preference Center link (Transactional)
   - Direct links to Privacy Policy and Terms of Service
   - Contact email for Data Protection / Right to Erasure (privacy@personaliai.com)
"""

from __future__ import annotations

import html as _html
from datetime import datetime, timezone
from typing import Optional

COMPANY_LEGAL_NAME = "PersonaliAI, Inc."
COMPANY_BRAND = "Chatty by PersonaliAI"
COMPANY_ADDRESS = "PersonaliAI, Inc. • 548 Market St, Suite 34220, San Francisco, CA 94104, USA"
PRIVACY_POLICY_URL = "https://chatty.personaliai.com/privacy"
TERMS_OF_SERVICE_URL = "https://chatty.personaliai.com/terms"
PREFERENCES_URL = "https://chatty.personaliai.com/dashboard/settings"
SUPPORT_EMAIL = "support@personaliai.com"
DPO_EMAIL = "privacy@personaliai.com"


def render_email_head(title: str, *, custom_css: str = "") -> str:
    """Renders a bulletproof, mobile-responsive HTML email <head>."""
    escaped_title = _html.escape(title)
    return f"""<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no"/>
  <title>{escaped_title}</title>
  <style>
    /* Baseline Email Client Resets */
    html, body {{
      margin: 0 !important;
      padding: 0 !important;
      height: 100% !important;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }}
    table, td {{
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
      border-collapse: collapse !important;
    }}
    img {{
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
      max-width: 100%;
    }}
    a {{
      text-decoration: none;
    }}
    * {{
      box-sizing: border-box;
    }}

    /* Mobile Responsive Overrides (max-width: 600px) */
    @media only screen and (max-width: 600px) {{
      .email-wrapper {{
        padding: 12px 6px !important;
      }}
      .email-container {{
        width: 100% !important;
        max-width: 100% !important;
        border-radius: 12px !important;
      }}
      .email-card {{
        border-radius: 12px !important;
      }}
      .email-pad-header {{
        padding: 18px 20px !important;
      }}
      .email-pad-body {{
        padding: 24px 18px !important;
      }}
      .email-pad-footer {{
        padding: 20px 18px !important;
      }}
      .email-headline {{
        font-size: 19px !important;
        line-height: 25px !important;
      }}
      .email-btn {{
        display: block !important;
        width: 100% !important;
        min-height: 48px !important;
        line-height: 48px !important;
        padding: 0 16px !important;
        text-align: center !important;
        box-sizing: border-box !important;
      }}
      .email-stack-col {{
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }}
      .email-stack-col-right {{
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        text-align: left !important;
        margin-top: 8px !important;
        box-sizing: border-box !important;
      }}
      .email-table-row {{
        display: block !important;
        width: 100% !important;
      }}
      .email-summary-label {{
        display: block !important;
        width: 100% !important;
        padding-bottom: 2px !important;
      }}
      .email-summary-value {{
        display: block !important;
        width: 100% !important;
        text-align: left !important;
        padding-bottom: 10px !important;
      }}
    }}
    {custom_css}
  </style>
</head>"""


def render_gdpr_footer_html(
    *,
    reason_text: str,
    unsubscribe_url: Optional[str] = None,
    preferences_url: Optional[str] = PREFERENCES_URL,
    support_email: str = SUPPORT_EMAIL,
    brand_color: str = "#6366f1",
    dark_mode: bool = False,
    is_marketing: bool = False,
) -> str:
    """Renders a fully GDPR & ePrivacy compliant email footer.

    Contains:
    - Reason / Legal basis notice
    - Unsubscribe link (mandatory for marketing) or Preferences link
    - Direct links to Privacy Policy and Terms of Service
    - Physical business address & copyright
    - Right to Erasure / DPO contact
    """
    year = datetime.now(timezone.utc).year
    escaped_reason = _html.escape(reason_text)
    escaped_support = _html.escape(support_email)
    escaped_brand_color = _html.escape(brand_color)

    bg_color = "#090d16" if dark_mode else "#f8fafc"
    border_color = "#1e293b" if dark_mode else "#e2e8f0"
    text_muted = "#94a3b8" if dark_mode else "#64748b"
    text_subtle = "#64748b" if dark_mode else "#94a3b8"
    link_color = escaped_brand_color

    links_parts: list[str] = []
    if is_marketing and unsubscribe_url:
        escaped_unsub = _html.escape(unsubscribe_url, quote=True)
        links_parts.append(
            f'<a href="{escaped_unsub}" style="color:{link_color};text-decoration:underline;font-weight:600;">Unsubscribe from marketing emails</a>'
        )
    elif preferences_url:
        escaped_pref = _html.escape(preferences_url, quote=True)
        links_parts.append(
            f'<a href="{escaped_pref}" style="color:{link_color};text-decoration:underline;font-weight:500;">Manage email preferences</a>'
        )

    links_parts.append(
        f'<a href="{_html.escape(PRIVACY_POLICY_URL, quote=True)}" target="_blank" rel="noopener noreferrer" style="color:{link_color};text-decoration:underline;">Privacy Policy</a>'
    )
    links_parts.append(
        f'<a href="{_html.escape(TERMS_OF_SERVICE_URL, quote=True)}" target="_blank" rel="noopener noreferrer" style="color:{link_color};text-decoration:underline;">Terms of Service</a>'
    )

    action_links_html = " &bull; ".join(links_parts)

    return f"""<!-- GDPR & Legal Footer -->
<tr>
  <td class="email-pad-footer" style="background-color:{bg_color};padding:24px 32px;border-top:1px solid {border_color};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:12px;line-height:19px;color:{text_muted};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <!-- Reason & Legal Notice -->
          <p style="margin:0 0 10px 0;font-size:12px;line-height:18px;color:{text_muted};">
            {escaped_reason}
          </p>

          <!-- Action & Legal Links -->
          <p style="margin:0 0 12px 0;font-size:12px;line-height:20px;">
            {action_links_html}
          </p>

          <!-- Support & DPO Contact -->
          <p style="margin:0 0 10px 0;font-size:11px;line-height:17px;color:{text_subtle};">
            Need help? Contact <a href="mailto:{escaped_support}" style="color:{link_color};text-decoration:none;">{escaped_support}</a>.
            To exercise your GDPR data rights or request data erasure, contact <a href="mailto:{DPO_EMAIL}" style="color:{link_color};text-decoration:none;">{DPO_EMAIL}</a>.
          </p>

          <!-- Registered Physical Office & Copyright -->
          <p style="margin:0;font-size:11px;line-height:16px;color:{text_subtle};">
            &copy; {year} {COMPANY_LEGAL_NAME} &bull; {COMPANY_ADDRESS}
          </p>
        </td>
      </tr>
    </table>
  </td>
</tr>"""
