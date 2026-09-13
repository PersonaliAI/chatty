import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.resolve(__dirname, '../../producthunt-gallery');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const artifactDir = path.resolve('C:/Users/HP/.gemini/antigravity/brain/97783b53-e963-4539-8904-28eebcb5d63f');

function toBase64(filePath) {
  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).replace('.', '');
    const data = fs.readFileSync(filePath).toString('base64');
    return `data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,${data}`;
  }
  return '';
}

// Official Chatty Icon (smiling orange C speech bubble)
const chattyIcon = toBase64(path.resolve(__dirname, '../public/favicon.png'));
const logoGoogleCal = toBase64(path.resolve(__dirname, '../public/logos/google-calendar.png'));
const logoOutlook = toBase64(path.resolve(__dirname, '../public/logos/outlook-calendar.png'));
const logoGoogleMeet = toBase64(path.resolve(__dirname, '../public/logos/google-meet.png'));
const logoTeams = toBase64(path.resolve(__dirname, '../public/logos/ms-teams.png'));

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=1270, height=760, initial-scale=1.0" />
  <title>Chatty Product Hunt Gallery Suite</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #000000;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
      margin: 0;
      padding: 0;
    }

    /* Outer Canvas matching Product Hunt recommended 1270 x 760 */
    .slide {
      width: 1270px;
      height: 760px;
      position: relative;
      overflow: hidden;
      display: flex;
      padding: 36px 46px;
      border-bottom: 2px solid #000;
    }

    /* Common Floating Pill Sticker (Resurf style) */
    .sticker-pill {
      position: absolute;
      z-index: 50;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 800;
      box-shadow: 0 14px 32px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.15);
      border: 1.5px solid rgba(255, 255, 255, 0.45);
      color: #ffffff;
      white-space: nowrap;
      user-select: none;
    }
    .sticker-orange { background: linear-gradient(135deg, #f97316, #ea580c); }
    .sticker-emerald { background: linear-gradient(135deg, #10b981, #059669); }
    .sticker-purple { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
    .sticker-blue { background: linear-gradient(135deg, #0284c7, #0369a1); }
    .sticker-yellow { background: linear-gradient(135deg, #f59e0b, #d97706); color: #1e1b18; }
    .sticker-rose { background: linear-gradient(135deg, #f43f5e, #e11d48); }

    /* macOS Window Shell */
    .mac-window {
      background: #ffffff;
      border-radius: 18px;
      box-shadow: 0 28px 70px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
      z-index: 20;
    }
    .mac-titlebar {
      height: 36px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      padding: 0 16px;
      gap: 14px;
      flex-shrink: 0;
    }
    .mac-dots {
      display: flex;
      gap: 7px;
    }
    .mac-dot {
      width: 11px;
      height: 11px;
      border-radius: 50%;
    }
    .mac-dot.close { background: #ff5f56; border: 1px solid #e0443e; }
    .mac-dot.min { background: #ffbd2e; border: 1px solid #dea123; }
    .mac-dot.max { background: #27c93f; border: 1px solid #1aab29; }
    .mac-urlbar {
      flex: 1;
      max-width: 380px;
      height: 24px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      gap: 6px;
    }

    /* =========================================================
       SLIDE 1: SOCIAL PREVIEW & HERO (VIBRANT ROYAL COBALT)
       ========================================================= */
    #slide-1 {
      background: linear-gradient(140deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%);
      display: grid;
      grid-template-columns: 430px 1fr;
      gap: 32px;
      align-items: center;
    }
    .s1-blueprint {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(to right, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
      background-size: 36px 36px;
      pointer-events: none;
      z-index: 0;
    }
    .s1-left-col {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .s1-logo-badge {
      width: 56px;
      height: 56px;
      background: #ffffff;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.25);
    }
    .s1-logo-badge img {
      width: 40px;
      height: 40px;
      object-fit: contain;
    }
    .s1-hero-headline {
      font-size: 42px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.12;
      letter-spacing: -0.035em;
    }
    .s1-hero-headline span {
      color: #fed7aa;
      text-decoration: underline;
      text-decoration-color: #f97316;
      text-underline-offset: 6px;
    }
    .s1-hero-desc {
      font-size: 14.5px;
      color: rgba(255, 255, 255, 0.92);
      line-height: 1.55;
      max-width: 410px;
    }
    .s1-tag-row {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.2);
      padding: 8px 16px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      color: #ffffff;
      width: fit-content;
    }

    /* S1 Desktop View Frame */
    .s1-window-frame {
      width: 100%;
      height: 624px;
      background: #f8fafc;
      border-radius: 20px;
      box-shadow: 0 32px 80px rgba(0, 0, 0, 0.45);
      border: 1px solid rgba(255, 255, 255, 0.3);
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .s1-website-mock {
      flex: 1;
      background: #ffffff;
      padding: 22px 24px;
      position: relative;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .mock-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 12px;
      border-bottom: 1px solid #f1f5f9;
    }
    .mock-brand {
      font-size: 13.5px;
      font-weight: 800;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .mock-links {
      display: flex;
      gap: 14px;
      font-size: 11.5px;
      color: #64748b;
      font-weight: 600;
    }
    .mock-hero-text {
      margin-top: 22px;
      max-width: 260px;
    }
    .mock-hero-text h3 {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.22;
    }
    .mock-hero-text p {
      font-size: 11.5px;
      color: #64748b;
      margin-top: 8px;
      line-height: 1.5;
    }

    /* =========================================================
       EXACT CHATTY WIDGET UI REPLICA (MATCHING ChatWidgetCore.tsx)
       ========================================================= */
    .chatty-exact-widget {
      position: absolute;
      bottom: 16px;
      right: 16px;
      width: 382px;
      height: 546px;
      background: #ffffff;
      border-radius: 18px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      z-index: 30;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    }
    
    /* Authentic Header (.chat-header) */
    .c-header {
      background: #f97316;
      color: #ffffff;
      padding: 12px 14px 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(0,0,0,0.06);
      flex-shrink: 0;
    }
    .c-bot-meta {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .c-avatar-wrap {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }
    .c-avatar-wrap img {
      width: 22px;
      height: 22px;
      object-fit: contain;
    }
    .c-bot-title-area {
      line-height: 1.25;
    }
    .c-bot-name {
      font-size: 13.5px;
      font-weight: 700;
      color: #ffffff;
    }
    .c-bot-sub {
      font-size: 9.5px;
      color: rgba(255, 255, 255, 0.9);
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: 500;
    }
    .c-pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #86efac;
      box-shadow: 0 0 6px #86efac;
    }
    .c-header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .c-icon-btn {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.9);
      background: rgba(255, 255, 255, 0.14);
      cursor: pointer;
    }
    .c-icon-btn svg {
      width: 13.5px;
      height: 13.5px;
      stroke-width: 2.2;
    }

    /* Message Area */
    .c-body {
      flex: 1;
      overflow-y: auto;
      background: #fafaf9;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .c-user-msg {
      align-self: flex-end;
      max-width: 84%;
      background: #f97316;
      color: #ffffff;
      padding: 9px 13px;
      border-radius: 16px;
      border-top-right-radius: 4px;
      font-size: 11.5px;
      line-height: 1.45;
      box-shadow: 0 2px 6px rgba(249, 115, 22, 0.15);
    }
    .c-bot-row {
      display: flex;
      gap: 8px;
      max-width: 98%;
      align-self: flex-start;
    }
    .c-bot-mini-avatar {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #f97316;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 2px;
      overflow: hidden;
    }
    .c-bot-mini-avatar img {
      width: 14px;
      height: 14px;
      object-fit: contain;
    }
    .c-bot-content {
      display: flex;
      flex-direction: column;
      gap: 3px;
      flex: 1;
      min-width: 0;
    }
    .c-sender-tag {
      font-size: 8.5px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding-left: 2px;
    }
    .c-bot-bubble {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      color: #1e293b;
      padding: 10px 12px;
      border-radius: 16px;
      border-top-left-radius: 4px;
      font-size: 11.5px;
      line-height: 1.45;
      box-shadow: 0 2px 6px rgba(0,0,0,0.02);
    }

    /* Exact Inline Booking Card (.inline-booking-card) */
    .c-booking-card {
      margin-top: 8px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 4px 14px rgba(0,0,0,0.04);
      display: flex;
      flex-direction: column;
    }
    .c-bk-top {
      padding: 6px 10px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10.5px;
    }
    .c-bk-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #475569;
      font-weight: 600;
      font-size: 10px;
    }
    .c-bk-meta svg {
      width: 12px;
      height: 12px;
      color: #94a3b8;
    }
    .c-bk-tz {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px 6px;
      border-radius: 6px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      font-size: 9.5px;
      color: #475569;
      font-weight: 600;
    }
    .c-bk-tz svg {
      width: 10px;
      height: 10px;
      color: #64748b;
    }
    .c-bk-body {
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .c-bk-title {
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
    }
    .c-bk-days {
      display: flex;
      gap: 5px;
    }
    .c-bk-day {
      flex: 1;
      border-radius: 9px;
      padding: 5px 6px;
      text-align: center;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .c-bk-day.active {
      background: #f97316;
      border-color: #f97316;
      color: #ffffff;
      box-shadow: 0 2px 6px rgba(249,115,22,0.25);
    }
    .c-bk-day-name {
      font-size: 8.5px;
      font-weight: 600;
      text-transform: uppercase;
      opacity: 0.85;
    }
    .c-bk-day-date {
      font-size: 10.5px;
      font-weight: 800;
      line-height: 1.2;
    }
    .c-bk-day-slots {
      font-size: 8px;
      opacity: 0.8;
      margin-top: 1px;
    }
    .c-bk-slots-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 5px;
    }
    .c-bk-slot {
      padding: 5px 2px;
      border-radius: 7px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      font-size: 10px;
      font-weight: 600;
      color: #475569;
      text-align: center;
    }
    .c-bk-slot.selected {
      border: 1.5px solid #f97316;
      background: #fff7ed;
      color: #c2410c;
      font-weight: 800;
      box-shadow: 0 1px 4px rgba(249,115,22,0.12);
    }
    .c-bk-confirmed {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 8px;
      padding: 5px 8px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 9.5px;
      color: #065f46;
      font-weight: 700;
    }

    /* Grounded citation chip & thumbs */
    .c-source-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 5px;
      padding-top: 4px;
      border-top: 1px solid #f1f5f9;
    }
    .c-source-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 9.5px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 2px 7px;
      border-radius: 9999px;
      color: #64748b;
      font-weight: 600;
    }
    .c-source-pill svg {
      width: 10px;
      height: 10px;
      color: #94a3b8;
    }
    .c-feedback-icons {
      display: flex;
      gap: 4px;
      color: #94a3b8;
    }
    .c-feedback-icons svg {
      width: 11px;
      height: 11px;
      cursor: pointer;
    }

    /* Composer Bar (.chat-input-bar) */
    .c-footer {
      padding: 8px 12px;
      background: #ffffff;
      border-top: 1px solid #f1f5f9;
      flex-shrink: 0;
    }
    .c-input-shell {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 7px 10px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .c-input-ph {
      font-size: 11px;
      color: #94a3b8;
    }
    .c-input-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .c-input-tools {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #94a3b8;
    }
    .c-input-tools svg {
      width: 14px;
      height: 14px;
      cursor: pointer;
    }
    .c-send-btn {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: #f97316;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(249,115,22,0.3);
      cursor: pointer;
    }
    .c-send-btn svg {
      width: 12px;
      height: 12px;
      stroke-width: 2.5;
      margin-left: 1px;
    }

    /* Bottom Nav Bar (Tabs) */
    .c-tabs {
      display: flex;
      border-top: 1px solid #f1f5f9;
      background: #ffffff;
      flex-shrink: 0;
    }
    .c-tab {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 5px 0;
      gap: 1px;
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #94a3b8;
      position: relative;
    }
    .c-tab.active {
      color: #f97316;
    }
    .c-tab.active::before {
      content: '';
      position: absolute;
      top: 0;
      left: 18px;
      right: 18px;
      height: 2px;
      background: #f97316;
      border-radius: 9999px;
    }
    .c-tab svg {
      width: 13px;
      height: 13px;
    }

    /* Sub-footer Branding */
    .c-subfoot {
      text-align: center;
      padding: 4px 0;
      background: #ffffff;
      font-size: 9px;
      color: #94a3b8;
      font-family: 'JetBrains Mono', monospace;
      border-top: 1px solid #f8fafc;
      flex-shrink: 0;
    }
    .c-subfoot b {
      color: #64748b;
    }

    /* =========================================================
       SLIDE 2: KNOWLEDGE INGESTION (WARM TERRACOTTA FRAME)
       ========================================================= */
    #slide-2 {
      background: #c2410c;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .full-window {
      width: 1170px;
      height: 640px;
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 32px 80px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
    }
    .s2-content {
      flex: 1;
      padding: 26px 34px;
      background: #f8fafc;
      display: grid;
      grid-template-columns: 460px 1fr;
      gap: 30px;
    }
    .s2-sources-col {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .s2-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 13px 15px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
    }
    .s2-card.highlight {
      border-color: #f97316;
      background: #fff7ed;
    }
    .s2-inspector {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.04);
    }

    /* =========================================================
       SLIDE 3: CALENDAR BOOKING (RICH FOREST EMERALD)
       ========================================================= */
    #slide-3 {
      background: #0f766e;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .s3-content {
      flex: 1;
      padding: 24px 32px;
      background: #f8fafc;
      display: grid;
      grid-template-columns: 480px 1fr;
      gap: 28px;
    }
    .s3-cal-panel {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 6px 20px rgba(0,0,0,0.05);
    }
    .s3-crm-panel {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.05);
    }

    /* =========================================================
       SLIDE 4: OMNICHANNEL LIVE INBOX (DEEP ROYAL VIOLET)
       ========================================================= */
    #slide-4 {
      background: #581c87;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .s4-inbox-grid {
      flex: 1;
      display: grid;
      grid-template-columns: 210px 320px 1fr;
      background: #ffffff;
      overflow: hidden;
    }
    .s4-channels-col {
      background: #f8fafc;
      border-right: 1px solid #e2e8f0;
      padding: 18px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .s4-queue-col {
      background: #ffffff;
      border-right: 1px solid #e2e8f0;
      padding: 18px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .s4-thread-col {
      background: #fafaf9;
      padding: 18px 22px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* =========================================================
       SLIDE 5: VOICE CALL & MCP PLATFORM (ELECTRIC INDIGO)
       ========================================================= */
    #slide-5 {
      background: #312e81;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .s5-content {
      flex: 1;
      padding: 26px 34px;
      background: #f8fafc;
      display: grid;
      grid-template-columns: 460px 1fr;
      gap: 30px;
    }
    .s5-voice-box {
      background: #0f172a;
      border-radius: 16px;
      padding: 24px;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }
    .s5-mcp-box {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* =========================================================
       SLIDE 6: 21 MODULES ALL-IN-ONE (DEEP SUNSET AMBER)
       ========================================================= */
    #slide-6 {
      background: #7c2d12;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .s6-dashboard {
      flex: 1;
      display: grid;
      grid-template-columns: 230px 1fr;
      background: #ffffff;
      overflow: hidden;
    }
    .s6-sidebar {
      background: #f8fafc;
      border-right: 1px solid #e2e8f0;
      padding: 18px 12px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .s6-main {
      padding: 24px 28px;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
  </style>
</head>
<body>

  <!-- =========================================================
       SLIDE 1: SOCIAL PREVIEW & HERO (VIBRANT ROYAL COBALT)
       ========================================================= -->
  <div class="slide" id="slide-1">
    <div class="s1-blueprint"></div>

    <!-- Floating Sticker Pills (Tilted, Resurf Style - Elegantly framing without overlapping widget) -->
    <div class="sticker-pill sticker-orange" style="top: 18px; left: 470px; transform: rotate(-3deg);">
      <span>📅</span> In-Chat Booking
    </div>
    <div class="sticker-pill sticker-purple" style="top: 18px; right: 46px; transform: rotate(3deg);">
      <span>⚡</span> Instant RAG
    </div>
    <div class="sticker-pill sticker-emerald" style="bottom: 18px; right: 260px; transform: rotate(-2deg);">
      <span>🎯</span> 94% Deflection
    </div>
    <div class="sticker-pill sticker-blue" style="bottom: 22px; left: 330px; transform: rotate(2deg);">
      <span>🔑</span> Free BYOK Forever
    </div>
    <div class="sticker-pill sticker-yellow" style="bottom: 84px; left: 46px; transform: rotate(-3deg);">
      <span>💬</span> Live Human Takeover
    </div>

    <div class="s1-left-col">
      <div class="s1-logo-badge">
        <img src="${chattyIcon}" alt="Chatty" />
      </div>
      <h1 class="s1-hero-headline">
        Turn website visitors into <span>booked revenue.</span>
      </h1>
      <p class="s1-hero-desc">
        Trained on your content. Captures verified leads and books calendar appointments directly inside chat with zero drop-off.
      </p>
      <div class="s1-tag-row">
        <span>⚡ Live in 5 minutes</span> · <span>Zero coding</span> · <span>Free BYOK</span>
      </div>
    </div>

    <!-- Right Window Frame Mockup -->
    <div class="s1-window-frame">
      <div class="mac-titlebar">
        <div class="mac-dots">
          <div class="mac-dot close"></div>
          <div class="mac-dot min"></div>
          <div class="mac-dot max"></div>
        </div>
        <div class="mac-urlbar">
          <span style="color:#10b981;">🔒</span> acme.io
        </div>
      </div>
      <div class="s1-website-mock">
        <div class="mock-nav">
          <div class="mock-brand">⚡ Acme Cloud</div>
          <div class="mock-links">
            <span>Features</span>
            <span>Integrations</span>
            <span>Pricing</span>
          </div>
          <div style="font-size:11px;background:#f97316;color:white;padding:5px 12px;border-radius:6px;font-weight:700;">Get Started</div>
        </div>
        <div class="mock-hero-text">
          <h3>The modern platform for fast-growing teams.</h3>
          <p>Automate your workflow, connect your tools, and scale without friction.</p>
          <div style="margin-top:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;">
            <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Platform Health</div>
            <div style="font-size:15px;font-weight:800;color:#10b981;margin-top:2px;">99.99% Uptime</div>
          </div>
        </div>

        <!-- EXACT CHATTY WIDGET UI REPLICA -->
        <div class="chatty-exact-widget">
          <!-- Header -->
          <div class="c-header">
            <div class="c-bot-meta">
              <div class="c-avatar-wrap">
                <img src="${chattyIcon}" alt="Chatty" />
              </div>
              <div class="c-bot-title-area">
                <div class="c-bot-name">Chatty Assistant</div>
                <div class="c-bot-sub">
                  <span class="c-pulse-dot"></span>
                  Online · replies instantly
                </div>
              </div>
            </div>
            <div class="c-header-actions">
              <!-- Voice Phone Button -->
              <div class="c-icon-btn" title="Voice Call">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </div>
              <!-- Bell Notification Button -->
              <div class="c-icon-btn" title="Notifications">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
              </div>
              <!-- Refresh Conversation Button -->
              <div class="c-icon-btn" title="Refresh">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
              </div>
              <!-- Close Button -->
              <div class="c-icon-btn" title="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </div>
            </div>
          </div>

          <!-- Body Messages Stream -->
          <div class="c-body">
            <!-- User Message Bubble -->
            <div class="c-user-msg">
              Can we schedule a 30-min product walkthrough for next week?
            </div>

            <!-- Bot Message Row -->
            <div class="c-bot-row">
              <div class="c-bot-mini-avatar">
                <img src="${chattyIcon}" alt="C" />
              </div>
              <div class="c-bot-content">
                <span class="c-sender-tag">AI</span>
                <div class="c-bot-bubble">
                  I'd love to! I sync directly with live team calendars. Pick an open slot right here:
                  
                  <!-- Exact Inline Booking Card Component -->
                  <div class="c-booking-card">
                    <!-- Top Strip -->
                    <div class="c-bk-top">
                      <div class="c-bk-meta">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>30m</span>
                        <span style="color:#cbd5e1;">|</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
                        <span>Google Meet</span>
                      </div>
                      <div class="c-bk-tz">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                        <span>New York (ET)</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                    </div>

                    <!-- Card Body -->
                    <div class="c-bk-body">
                      <div class="c-bk-title">Select a Date & Time</div>
                      
                      <!-- Day Strip -->
                      <div class="c-bk-days">
                        <div class="c-bk-day active">
                          <span class="c-bk-day-name">WED</span>
                          <span class="c-bk-day-date">16 SEP</span>
                          <span class="c-bk-day-slots">6 slots</span>
                        </div>
                        <div class="c-bk-day">
                          <span class="c-bk-day-name" style="color:#94a3b8;">THU</span>
                          <span class="c-bk-day-date">17 SEP</span>
                          <span class="c-bk-day-slots" style="color:#94a3b8;">4 slots</span>
                        </div>
                        <div class="c-bk-day">
                          <span class="c-bk-day-name" style="color:#94a3b8;">FRI</span>
                          <span class="c-bk-day-date">18 SEP</span>
                          <span class="c-bk-day-slots" style="color:#94a3b8;">5 slots</span>
                        </div>
                      </div>

                      <!-- Slots Grid -->
                      <div class="c-bk-slots-grid">
                        <div class="c-bk-slot">10:00 AM</div>
                        <div class="c-bk-slot selected">02:30 PM</div>
                        <div class="c-bk-slot">04:00 PM</div>
                      </div>

                      <!-- Confirmed Badge -->
                      <div class="c-bk-confirmed">
                        <svg style="width:12px;height:12px;color:#10b981;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>Confirmed! Google Meet invite sent to alex@acme.com</span>
                      </div>
                    </div>
                  </div>

                  <!-- Grounded citation & thumbs -->
                  <div class="c-source-row">
                    <div class="c-source-pill">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                      <span>docs/product-demo.md</span>
                    </div>
                    <div class="c-feedback-icons">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Composer Bar -->
          <div class="c-footer">
            <div class="c-input-shell">
              <div class="c-input-ph">Compose your message…</div>
              <div class="c-input-row">
                <div class="c-input-tools">
                  <!-- Smile Emoji -->
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>
                  <!-- Paperclip Attachment -->
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  <!-- Voice Mic -->
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                </div>
                <div class="c-send-btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Tabs Nav -->
          <div class="c-tabs">
            <div class="c-tab">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span>Home</span>
            </div>
            <div class="c-tab active">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>Chat</span>
            </div>
            <div class="c-tab">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              <span>Articles</span>
            </div>
          </div>

          <!-- Powered by Chatty Footer -->
          <div class="c-subfoot">
            Powered by <b>Chatty</b>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- =========================================================
       SLIDE 2: KNOWLEDGE INGESTION (WARM TERRACOTTA FRAME)
       ========================================================= -->
  <div class="slide" id="slide-2">
    <!-- Floating Sticker Pills -->
    <div class="sticker-pill sticker-emerald" style="top: 20px; left: 80px; transform: rotate(-3deg);">
      <span>🌐</span> Auto-Sync Daily
    </div>
    <div class="sticker-pill sticker-purple" style="top: 18px; right: 120px; transform: rotate(4deg);">
      <span>📄</span> PDFs & Documents
    </div>
    <div class="sticker-pill sticker-blue" style="bottom: 18px; left: 140px; transform: rotate(2deg);">
      <span>📚</span> Help Center Hub
    </div>
    <div class="sticker-pill sticker-orange" style="bottom: 18px; right: 140px; transform: rotate(-3deg);">
      <span>🛡️</span> Zero Hallucinations
    </div>

    <div class="full-window mac-window">
      <div class="mac-titlebar">
        <div class="mac-dots">
          <div class="mac-dot close"></div>
          <div class="mac-dot min"></div>
          <div class="mac-dot max"></div>
        </div>
        <div class="mac-urlbar">
          <img src="${chattyIcon}" style="width:14px;height:14px;" />
          <span>chatty.personaliai.com/dashboard/knowledge</span>
        </div>
      </div>
      <div class="s2-content">
        <div class="s2-sources-col">
          <div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:4px;">Trained Knowledge Sources</div>
          <div class="s2-card highlight">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="font-size:20px;">🌐</div>
              <div>
                <div style="font-size:13px;font-weight:700;color:#0f172a;">Website Auto-Crawler</div>
                <div style="font-size:11px;color:#64748b;">https://acme.io/* · 142 pages indexed</div>
              </div>
            </div>
            <div style="font-size:11px;font-weight:700;color:#10b981;background:#d1fae5;padding:3px 8px;border-radius:6px;">Daily Sync ✓</div>
          </div>
          <div class="s2-card">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="font-size:20px;">📄</div>
              <div>
                <div style="font-size:13px;font-weight:700;color:#0f172a;">Enterprise Security Whitepaper</div>
                <div style="font-size:11px;color:#64748b;">security-2026.pdf · 4.2M tokens</div>
              </div>
            </div>
            <div style="font-size:11px;font-weight:700;color:#0284c7;background:#e0f2fe;padding:3px 8px;border-radius:6px;">Vectorized ✓</div>
          </div>
          <div class="s2-card">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="font-size:20px;">📚</div>
              <div>
                <div style="font-size:13px;font-weight:700;color:#0f172a;">Help Center Articles</div>
                <div style="font-size:11px;color:#64748b;">28 Articles · Automatic Webhook Sync</div>
              </div>
            </div>
            <div style="font-size:11px;font-weight:700;color:#10b981;background:#d1fae5;padding:3px 8px;border-radius:6px;">Live ✓</div>
          </div>
          <div class="s2-card" style="background:#fff7ed;border-color:#fed7aa;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="font-size:20px;">⚙️</div>
              <div>
                <div style="font-size:13px;font-weight:700;color:#c2410c;">Multi-Model & Free BYOK</div>
                <div style="font-size:11px;color:#9a3412;">Gemini 2.5 Flash, Claude 3.5, GPT-4o</div>
              </div>
            </div>
            <div style="font-size:11px;font-weight:700;color:#c2410c;background:#ffedd5;padding:3px 8px;border-radius:6px;">100% Free BYOK</div>
          </div>
        </div>

        <div class="s2-inspector">
          <div style="font-size:14px;font-weight:800;color:#0f172a;display:flex;justify-content:space-between;align-items:center;">
            <span>Grounded Vector Retrieval</span>
            <span style="font-size:11px;font-weight:700;color:#10b981;background:#d1fae5;padding:2px 8px;border-radius:6px;">pgvector HNSW: 0.12ms</span>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px 14px;border-radius:10px;">
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#f97316;letter-spacing:0.04em;">Visitor Question</div>
            <div style="font-size:13px;font-weight:700;color:#0f172a;margin-top:2px;">"What is your refund policy for annual enterprise contracts?"</div>
          </div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:16px;border-radius:12px;font-size:13px;line-height:1.6;color:#166534;flex:1;">
            "Under Section 4.2 of our Enterprise Terms, annual contracts include a <b>30-day money-back guarantee</b> with a full prorated refund. For SLA breaches below 99.9%, automatic service credits are applied."
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px 14px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:#64748b;">
            <span><b style="color:#0f172a;">Source:</b> legal/terms-of-service.pdf</span>
            <span style="font-weight:700;color:#10b981;">Match Confidence: 99.4% ✓</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- =========================================================
       SLIDE 3: CALENDAR BOOKING (RICH FOREST EMERALD)
       ========================================================= -->
  <div class="slide" id="slide-3">
    <!-- Floating Sticker Pills -->
    <div class="sticker-pill sticker-orange" style="top: 20px; left: 80px; transform: rotate(-3deg);">
      <span>🗓️</span> 2-Way Calendar Sync
    </div>
    <div class="sticker-pill sticker-blue" style="top: 18px; right: 120px; transform: rotate(4deg);">
      <span>🕒</span> Auto-Timezone Detection
    </div>
    <div class="sticker-pill sticker-yellow" style="bottom: 18px; left: 140px; transform: rotate(2deg);">
      <span>👥</span> Round-Robin Routing
    </div>
    <div class="sticker-pill sticker-emerald" style="bottom: 18px; right: 140px; transform: rotate(-3deg);">
      <span>🎉</span> Zero Drop-off Booking
    </div>

    <div class="full-window mac-window">
      <div class="mac-titlebar">
        <div class="mac-dots">
          <div class="mac-dot close"></div>
          <div class="mac-dot min"></div>
          <div class="mac-dot max"></div>
        </div>
        <div class="mac-urlbar">
          <img src="${chattyIcon}" style="width:14px;height:14px;" />
          <span>chatty.personaliai.com/dashboard/meetings</span>
        </div>
      </div>
      <div class="s3-content">
        <!-- Left Column: Exact Chatty Widget with Inline Booking -->
        <div class="s3-cal-panel">
          <!-- Widget Header -->
          <div class="c-header" style="border-radius:16px 16px 0 0;">
            <div class="c-bot-meta">
              <div class="c-avatar-wrap">
                <img src="${chattyIcon}" alt="Chatty" />
              </div>
              <div class="c-bot-title-area">
                <div class="c-bot-name">Chatty Assistant</div>
                <div class="c-bot-sub">
                  <span class="c-pulse-dot"></span>
                  Online · In-Chat Scheduling
                </div>
              </div>
            </div>
            <div class="c-header-actions">
              <div class="c-icon-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></div>
              <div class="c-icon-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></div>
            </div>
          </div>

          <!-- Body -->
          <div class="c-body" style="padding:14px;flex:1;">
            <div class="c-user-msg" style="font-size:12px;">
              Can we book a 30-min enterprise onboarding demo?
            </div>
            <div class="c-bot-row" style="max-width:100%;">
              <div class="c-bot-mini-avatar"><img src="${chattyIcon}" alt="C" /></div>
              <div class="c-bot-content">
                <span class="c-sender-tag">AI</span>
                <div class="c-bot-bubble" style="font-size:12px;">
                  Certainly! Pick any open slot directly on our live calendar:
                  
                  <!-- Complete Inline Booking Card -->
                  <div class="c-booking-card" style="margin-top:10px;">
                    <div class="c-bk-top">
                      <div class="c-bk-meta">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>30m Meeting</span>
                        <span style="color:#cbd5e1;">|</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
                        <span>Google Meet</span>
                      </div>
                      <div class="c-bk-tz">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                        <span>New York (EDT)</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                    </div>

                    <div class="c-bk-body" style="padding:12px;">
                      <div class="c-bk-title">Select an Available Slot</div>
                      <div class="c-bk-days">
                        <div class="c-bk-day" style="padding:6px;"><span class="c-bk-day-name">MON</span><b class="c-bk-day-date">14</b><span class="c-bk-day-slots">3 slots</span></div>
                        <div class="c-bk-day" style="padding:6px;"><span class="c-bk-day-name">TUE</span><b class="c-bk-day-date">15</b><span class="c-bk-day-slots">5 slots</span></div>
                        <div class="c-bk-day active" style="padding:6px;"><span class="c-bk-day-name">WED</span><b class="c-bk-day-date">16</b><span class="c-bk-day-slots">6 slots</span></div>
                        <div class="c-bk-day" style="padding:6px;"><span class="c-bk-day-name">THU</span><b class="c-bk-day-date">17</b><span class="c-bk-day-slots">4 slots</span></div>
                      </div>

                      <div class="c-bk-slots-grid" style="gap:6px;">
                        <div class="c-bk-slot" style="padding:7px;">09:30 AM</div>
                        <div class="c-bk-slot selected" style="padding:7px;">10:00 AM</div>
                        <div class="c-bk-slot" style="padding:7px;">02:30 PM</div>
                      </div>

                      <div class="c-bk-confirmed" style="padding:8px 10px;">
                        <svg style="width:14px;height:14px;color:#10b981;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>Confirmed! Google Meet invite sent to alex@acme.com</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Calendar Providers Strip -->
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#ffffff;border-top:1px solid #e2e8f0;">
            <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#475569;font-weight:600;"><img src="${logoGoogleCal}" style="width:15px;height:15px;" /> Google Calendar</div>
            <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#475569;font-weight:600;"><img src="${logoOutlook}" style="width:15px;height:15px;" /> Outlook 365</div>
            <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#475569;font-weight:600;"><img src="${logoGoogleMeet}" style="width:15px;height:15px;" /> Meet</div>
            <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#475569;font-weight:600;"><img src="${logoTeams}" style="width:15px;height:15px;" /> Teams</div>
          </div>
        </div>

        <!-- Right Column: CRM Lead Record -->
        <div class="s3-crm-panel">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:15px;font-weight:800;color:#0f172a;">Captured Lead CRM Record</div>
            <span style="font-size:11px;font-weight:700;color:#10b981;background:#d1fae5;padding:3px 10px;border-radius:9999px;">98% High Intent</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#f8fafc;padding:16px;border-radius:12px;border:1px solid #e2e8f0;">
            <div>
              <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Full Name</div>
              <div style="font-size:13.5px;font-weight:800;color:#0f172a;margin-top:2px;">Alex Morgan</div>
            </div>
            <div>
              <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Work Email</div>
              <div style="font-size:13.5px;font-weight:700;color:#0f172a;margin-top:2px;">alex@acme.com</div>
            </div>
            <div>
              <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Company</div>
              <div style="font-size:13.5px;font-weight:700;color:#0f172a;margin-top:2px;">Acme Cloud Inc.</div>
            </div>
            <div>
              <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Phone</div>
              <div style="font-size:13.5px;font-weight:700;color:#0f172a;margin-top:2px;">+1 (555) 234-8901</div>
            </div>
          </div>

          <div style="background:#ffffff;border:1px solid #e2e8f0;padding:14px;border-radius:12px;display:flex;flex-direction:column;gap:8px;">
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Auto-Assigned Representative</div>
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:34px;height:34px;border-radius:50%;background:#e0e7ff;color:#4338ca;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;">SJ</div>
              <div>
                <div style="font-size:13.5px;font-weight:800;color:#0f172a;">Sarah Jenkins (Senior AE)</div>
                <div style="font-size:11px;color:#64748b;">Round-robin distribution · Calendar synced ✓</div>
              </div>
            </div>
          </div>

          <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:12px 14px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#166534;margin-top:auto;">
            <span><b>Google Meet Link:</b> meet.google.com/xyz-qwer-abc</span>
            <span style="font-weight:700;color:#10b981;">2-Way Synced in 0.4s ✓</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- =========================================================
       SLIDE 4: OMNICHANNEL LIVE INBOX (DEEP ROYAL VIOLET)
       ========================================================= -->
  <div class="slide" id="slide-4">
    <!-- Floating Sticker Pills -->
    <div class="sticker-pill sticker-orange" style="top: 20px; left: 80px; transform: rotate(-3deg);">
      <span>⚡</span> 30s SLA Target
    </div>
    <div class="sticker-pill sticker-emerald" style="top: 18px; right: 120px; transform: rotate(4deg);">
      <span>🤖</span> Auto-Pilot to Human
    </div>
    <div class="sticker-pill sticker-blue" style="bottom: 18px; left: 140px; transform: rotate(2deg);">
      <span>🌐</span> 5+ Channels In One
    </div>
    <div class="sticker-pill sticker-yellow" style="bottom: 18px; right: 140px; transform: rotate(-3deg);">
      <span>✨</span> AI Copilot Replies
    </div>

    <div class="full-window mac-window">
      <div class="mac-titlebar">
        <div class="mac-dots">
          <div class="mac-dot close"></div>
          <div class="mac-dot min"></div>
          <div class="mac-dot max"></div>
        </div>
        <div class="mac-urlbar">
          <img src="${chattyIcon}" style="width:14px;height:14px;" />
          <span>chatty.personaliai.com/dashboard/inbox</span>
        </div>
      </div>
      <div class="s4-inbox-grid">
        <!-- Channels Sidebar -->
        <div class="s4-channels-col">
          <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Connected Inboxes</div>
          <div style="background:#ffffff;border:1px solid #e2e8f0;padding:8px 10px;border-radius:8px;font-size:12px;font-weight:700;color:#0f172a;display:flex;justify-content:space-between;align-items:center;">
            <span>💬 All Messages</span>
            <span style="background:#f1f5f9;color:#475569;font-size:10px;padding:2px 6px;border-radius:9999px;">24</span>
          </div>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;padding:8px 10px;border-radius:8px;font-size:12px;font-weight:700;color:#1d4ed8;display:flex;justify-content:space-between;align-items:center;">
            <span>🌐 Web Widget</span>
            <span style="background:#2563eb;color:white;font-size:10px;padding:2px 6px;border-radius:9999px;">14</span>
          </div>
          <div style="padding:8px 10px;font-size:12px;font-weight:600;color:#64748b;display:flex;justify-content:space-between;align-items:center;">
            <span>📱 WhatsApp</span>
            <span style="color:#94a3b8;font-size:10px;">5</span>
          </div>
          <div style="padding:8px 10px;font-size:12px;font-weight:600;color:#64748b;display:flex;justify-content:space-between;align-items:center;">
            <span>✈️ Telegram</span>
            <span style="color:#94a3b8;font-size:10px;">3</span>
          </div>
          <div style="padding:8px 10px;font-size:12px;font-weight:600;color:#64748b;display:flex;justify-content:space-between;align-items:center;">
            <span>💼 Slack Connect</span>
            <span style="color:#94a3b8;font-size:10px;">2</span>
          </div>
        </div>

        <!-- Queue Column -->
        <div class="s4-queue-col">
          <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;">Live Conversations</div>
          <div style="background:#f8fafc;border:1.5px solid #2563eb;border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:4px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;font-weight:800;color:#0f172a;">Alex Morgan (Acme)</span>
              <span style="font-size:9.5px;font-weight:700;background:#dbeafe;color:#1e40af;padding:2px 6px;border-radius:4px;">⚡ 2m SLA</span>
            </div>
            <div style="font-size:11px;color:#64748b;line-height:1.4;">"Need custom HIPAA compliance addendum before signing..."</div>
            <div style="display:flex;gap:6px;margin-top:4px;">
              <span style="font-size:9px;background:#dcfce7;color:#15803d;padding:1px 6px;border-radius:4px;font-weight:700;">High Intent</span>
              <span style="font-size:9px;background:#f1f5f9;color:#475569;padding:1px 6px;border-radius:4px;">Web Widget</span>
            </div>
          </div>

          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:4px;opacity:0.75;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;font-weight:700;color:#0f172a;">David K.</span>
              <span style="font-size:9.5px;color:#64748b;">4m ago</span>
            </div>
            <div style="font-size:11px;color:#64748b;">"Does the API support bulk embedding ingestion?"</div>
          </div>
        </div>

        <!-- Thread Column -->
        <div class="s4-thread-col">
          <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
            <div>
              <div style="font-size:14px;font-weight:800;color:#0f172a;">Alex Morgan · San Francisco, CA</div>
              <div style="font-size:11px;color:#64748b;">Visiting /enterprise-pricing · Chrome on macOS</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:10px;font-weight:700;color:#dc2626;background:#fee2e2;padding:4px 10px;border-radius:9999px;">👤 Human Takeover ACTIVE</span>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;margin:16px 0;">
            <div style="background:#ffffff;border:1px solid #e2e8f0;padding:10px 14px;border-radius:12px;max-width:80%;align-self:flex-start;font-size:12px;line-height:1.45;">
              "Hi team! We are evaluating Chatty for 500 agents. Can we get custom HIPAA BAAs signed?"
            </div>
            <div style="background:#2563eb;color:white;padding:10px 14px;border-radius:12px;max-width:80%;align-self:flex-end;font-size:12px;line-height:1.45;">
              "Hello Alex! Yes absolutely. Our enterprise plan includes standard BAAs and SOC-2 Type II attestation. I can share our security packet right now."
            </div>
          </div>

          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">AI Copilot Suggested Response:</span>
              <span style="font-size:10px;color:#2563eb;font-weight:700;cursor:pointer;">Tab to Insert ↵</span>
            </div>
            <div style="background:#f8fafc;border:1px dashed #cbd5e1;padding:8px 10px;border-radius:8px;font-size:11.5px;color:#475569;">
              "I've also attached our SOC-2 report and scheduled our compliance team to join tomorrow's walkthrough."
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- =========================================================
       SLIDE 5: VOICE CALL & MCP PLATFORM (ELECTRIC INDIGO)
       ========================================================= -->
  <div class="slide" id="slide-5">
    <!-- Floating Sticker Pills -->
    <div class="sticker-pill sticker-orange" style="top: 20px; left: 80px; transform: rotate(-3deg);">
      <span>🎙️</span> 450ms Voice Latency
    </div>
    <div class="sticker-pill sticker-purple" style="top: 18px; right: 120px; transform: rotate(4deg);">
      <span>🛠️</span> 55+ MCP Tool Server
    </div>
    <div class="sticker-pill sticker-emerald" style="bottom: 18px; left: 140px; transform: rotate(2deg);">
      <span>⚡</span> LiveKit WebRTC
    </div>
    <div class="sticker-pill sticker-blue" style="bottom: 18px; right: 140px; transform: rotate(-3deg);">
      <span>🔌</span> Open Protocol Ready
    </div>

    <div class="full-window mac-window">
      <div class="mac-titlebar">
        <div class="mac-dots">
          <div class="mac-dot close"></div>
          <div class="mac-dot min"></div>
          <div class="mac-dot max"></div>
        </div>
        <div class="mac-urlbar">
          <img src="${chattyIcon}" style="width:14px;height:14px;" />
          <span>chatty.personaliai.com/dashboard/voice-and-mcp</span>
        </div>
      </div>
      <div class="s5-content">
        <!-- Voice Widget Box -->
        <div class="s5-voice-box">
          <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
            <div style="font-size:13px;font-weight:800;display:flex;align-items:center;gap:6px;">
              <span style="width:8px;height:8px;border-radius:50%;background:#10b981;"></span> LiveKit Real-time Voice
            </div>
            <span style="font-size:10px;background:rgba(255,255,255,0.15);padding:2px 8px;border-radius:9999px;">02:14</span>
          </div>

          <!-- Pulsing Animated Voice Orb -->
          <div style="display:flex;flex-direction:column;align-items:center;gap:14px;margin:20px 0;">
            <div style="width:90px;height:90px;border-radius:50%;background:radial-gradient(circle, #f97316 0%, #c2410c 70%);box-shadow:0 0 50px rgba(249,115,22,0.6);display:flex;align-items:center;justify-content:center;position:relative;">
              <img src="${chattyIcon}" style="width:42px;height:42px;filter:brightness(1.2);" />
            </div>
            <div style="display:flex;align-items:center;gap:3px;height:24px;">
              <span style="width:3px;height:12px;background:#f97316;border-radius:2px;"></span>
              <span style="width:3px;height:22px;background:#f97316;border-radius:2px;"></span>
              <span style="width:3px;height:16px;background:#f97316;border-radius:2px;"></span>
              <span style="width:3px;height:24px;background:#f97316;border-radius:2px;"></span>
              <span style="width:3px;height:18px;background:#f97316;border-radius:2px;"></span>
              <span style="width:3px;height:10px;background:#f97316;border-radius:2px;"></span>
            </div>
            <div style="font-size:11.5px;color:rgba(255,255,255,0.9);font-weight:600;">Agent Speaking · 450ms Latency</div>
          </div>

          <!-- Real-time Transcription Stream -->
          <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);padding:10px 14px;border-radius:10px;font-size:11px;line-height:1.45;color:#e2e8f0;width:100%;">
            "I've verified your enterprise license and scheduled the onboarding call for tomorrow at 2:30 PM."
          </div>
        </div>

        <!-- MCP Developer Panel -->
        <div class="s5-mcp-box">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:14px;font-weight:800;color:#0f172a;">Model Context Protocol (MCP) Server</div>
            <span style="font-size:11px;font-weight:700;color:#2563eb;background:#eff6ff;padding:2px 8px;border-radius:6px;">55 Tools Loaded</span>
          </div>

          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px 12px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:12px;font-weight:700;color:#0f172a;font-family:'JetBrains Mono', monospace;">calendar.book_slot()</div>
                <div style="font-size:10.5px;color:#64748b;">Invokes 2-way Google Cal / Outlook sync</div>
              </div>
              <span style="font-size:10px;font-weight:700;color:#10b981;">Active ✓</span>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px 12px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:12px;font-weight:700;color:#0f172a;font-family:'JetBrains Mono', monospace;">rag.query_pgvector()</div>
                <div style="font-size:10.5px;color:#64748b;">HNSW similarity search across indexed docs</div>
              </div>
              <span style="font-size:10px;font-weight:700;color:#10b981;">Active ✓</span>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px 12px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:12px;font-weight:700;color:#0f172a;font-family:'JetBrains Mono', monospace;">crm.upsert_lead()</div>
                <div style="font-size:10.5px;color:#64748b;">Syncs attendee to HubSpot, Salesforce & webhook</div>
              </div>
              <span style="font-size:10px;font-weight:700;color:#10b981;">Active ✓</span>
            </div>
          </div>

          <div style="background:#0f172a;padding:12px;border-radius:10px;font-family:'JetBrains Mono', monospace;font-size:10px;color:#38bdf8;line-height:1.45;margin-top:auto;">
            <span style="color:#a855f7;">POST</span> /mcp/v1/tools/call<br>
            <span style="color:#64748b;">{ "name": "calendar.book_slot", "args": { "slot": "2026-09-16T14:30:00Z" } }</span><br>
            <span style="color:#4ade80;">HTTP/2 200 OK (0.08s latency)</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- =========================================================
       SLIDE 6: 21 MODULES ALL-IN-ONE (DEEP SUNSET AMBER)
       ========================================================= -->
  <div class="slide" id="slide-6">
    <!-- Floating Sticker Pills -->
    <div class="sticker-pill sticker-orange" style="top: 20px; left: 80px; transform: rotate(-3deg);">
      <span>🚀</span> 21 Modules Suite
    </div>
    <div class="sticker-pill sticker-emerald" style="top: 18px; right: 120px; transform: rotate(4deg);">
      <span>💰</span> Free BYOK
    </div>
    <div class="sticker-pill sticker-purple" style="bottom: 18px; left: 140px; transform: rotate(2deg);">
      <span>🛠️</span> 10 Custom Themes
    </div>
    <div class="sticker-pill sticker-blue" style="bottom: 18px; right: 140px; transform: rotate(-3deg);">
      <span>📈</span> 10x ROI
    </div>

    <div class="full-window mac-window">
      <div class="mac-titlebar">
        <div class="mac-dots">
          <div class="mac-dot close"></div>
          <div class="mac-dot min"></div>
          <div class="mac-dot max"></div>
        </div>
        <div class="mac-urlbar">
          <img src="${chattyIcon}" style="width:14px;height:14px;" />
          <span>chatty.personaliai.com/dashboard</span>
        </div>
      </div>
      <div class="s6-dashboard">
        <!-- Sidebar -->
        <div class="s6-sidebar">
          <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Chatty Platform</div>
          <div style="background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:700;padding:8px 10px;border-radius:8px;">📊 Overview</div>
          <div style="color:#475569;font-size:12px;font-weight:600;padding:8px 10px;">📚 Knowledge Base</div>
          <div style="color:#475569;font-size:12px;font-weight:600;padding:8px 10px;">💬 Chat Widget (10 Presets)</div>
          <div style="color:#475569;font-size:12px;font-weight:600;padding:8px 10px;">📥 Omnichannel Inbox</div>
          <div style="color:#475569;font-size:12px;font-weight:600;padding:8px 10px;">📅 Calendar & Bookings</div>
          <div style="color:#475569;font-size:12px;font-weight:600;padding:8px 10px;">🎙️ LiveKit Voice Call</div>
          <div style="color:#475569;font-size:12px;font-weight:600;padding:8px 10px;">🛠️ MCP Developer Server</div>
        </div>

        <!-- Main Content -->
        <div class="s6-main">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:17px;font-weight:800;color:#0f172a;">All-in-One Conversational Revenue Platform</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px;">Everything you need to turn visitors into pipeline without stitching 10 different tools.</div>
            </div>
            <div style="font-size:12px;font-weight:800;color:#ffffff;background:#f97316;padding:6px 14px;border-radius:8px;">Live Demo</div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:12px;flex:1;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:14px;border-radius:12px;">
              <div style="font-size:22px;margin-bottom:6px;">📚</div>
              <div style="font-size:13px;font-weight:800;color:#0f172a;">Instant Vector RAG</div>
              <div style="font-size:11px;color:#64748b;margin-top:4px;line-height:1.4;">Auto-crawls websites, ingests PDFs, Notion, & docs with zero hallucination.</div>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:14px;border-radius:12px;">
              <div style="font-size:22px;margin-bottom:6px;">📅</div>
              <div style="font-size:13px;font-weight:800;color:#0f172a;">In-Chat Calendar Booking</div>
              <div style="font-size:11px;color:#64748b;margin-top:4px;line-height:1.4;">Native Google Cal & Outlook sync. Captures leads and books demos directly in chat.</div>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:14px;border-radius:12px;">
              <div style="font-size:22px;margin-bottom:6px;">📥</div>
              <div style="font-size:13px;font-weight:800;color:#0f172a;">Omnichannel Live Inbox</div>
              <div style="font-size:11px;color:#64748b;margin-top:4px;line-height:1.4;">Web, WhatsApp, Telegram, Messenger with live human takeover & SLA alerts.</div>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:14px;border-radius:12px;">
              <div style="font-size:22px;margin-bottom:6px;">🎙️</div>
              <div style="font-size:13px;font-weight:800;color:#0f172a;">Real-Time Voice Agent</div>
              <div style="font-size:11px;color:#64748b;margin-top:4px;line-height:1.4;">Sub-500ms WebRTC voice calls powered by LiveKit with live voice transcription.</div>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:14px;border-radius:12px;">
              <div style="font-size:22px;margin-bottom:6px;">🛠️</div>
              <div style="font-size:13px;font-weight:800;color:#0f172a;">55+ MCP Tool Server</div>
              <div style="font-size:11px;color:#64748b;margin-top:4px;line-height:1.4;">Extensible Model Context Protocol server enabling bots to call any database or API.</div>
            </div>
            <div style="background:#fff7ed;border:1.5px solid #fdba74;padding:14px;border-radius:12px;">
              <div style="font-size:22px;margin-bottom:6px;">🔑</div>
              <div style="font-size:13px;font-weight:800;color:#c2410c;">Free BYOK Forever</div>
              <div style="font-size:11px;color:#9a3412;margin-top:4px;line-height:1.4;">Bring your own OpenAI, Anthropic, or Gemini keys with zero markup.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

</body>
</html>`;

const tempHtmlPath = path.resolve(__dirname, 'temp_gallery.html');
fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');

async function renderGallery() {
  console.log('Launching Playwright Chromium to render pixel-perfect gallery...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`file://${tempHtmlPath}`, { waitUntil: 'networkidle' });

  const slides = [
    { id: '#slide-1', name: '01_social_preview_hero_showcase' },
    { id: '#slide-2', name: '02_knowledge_vector_rag_training' },
    { id: '#slide-3', name: '03_in_chat_calendar_booking_crm' },
    { id: '#slide-4', name: '04_omnichannel_live_inbox_sla' },
    { id: '#slide-5', name: '05_voice_agent_mcp_developer' },
    { id: '#slide-6', name: '06_all_in_one_21_modules_suite' },
  ];

  for (const slide of slides) {
    const element = await page.$(slide.id);
    if (element) {
      // 1. Standard Product Hunt size: 1270x760
      const standardPath = path.join(outputDir, `${slide.name}_1270x760.png`);
      await element.screenshot({ path: standardPath });
      console.log(`Rendered: ${standardPath}`);

      // Copy to artifact directory for markdown display
      const artifactStandardPath = path.join(artifactDir, `${slide.name}_1270x760.png`);
      fs.copyFileSync(standardPath, artifactStandardPath);
    }
  }

  // Also render 2x Retina @ 2540x1520 for ultra high-DPI
  console.log('Rendering 2x Retina editions...');
  const retinaPage = await browser.newPage({
    viewport: { width: 2540, height: 1520 },
    deviceScaleFactor: 2
  });
  await retinaPage.goto(`file://${tempHtmlPath}`, { waitUntil: 'networkidle' });

  for (const slide of slides) {
    const element = await retinaPage.$(slide.id);
    if (element) {
      const retinaPath = path.join(outputDir, `${slide.name}_2x.png`);
      await element.screenshot({ path: retinaPath });
      console.log(`Rendered 2x Retina: ${retinaPath}`);

      const artifactRetinaPath = path.join(artifactDir, `${slide.name}_2x.png`);
      fs.copyFileSync(retinaPath, artifactRetinaPath);
    }
  }

  await browser.close();
  if (fs.existsSync(tempHtmlPath)) {
    fs.unlinkSync(tempHtmlPath);
  }
  console.log('All gallery slides rendered successfully!');
}

renderGallery().catch(err => {
  console.error('Failed to render gallery:', err);
  process.exit(1);
});
