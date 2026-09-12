const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Chatty Product Hunt Gallery Slides</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #000; font-family: 'Plus Jakarta Sans', sans-serif; }
    .slide {
      width: 1270px; height: 760px; position: relative; overflow: hidden;
      background: #080c14; color: #fff; display: flex; align-items: center;
      padding: 0 64px; justify-content: space-between;
    }
    .slide-bg-grid {
      position: absolute; inset: 0;
      background-image: radial-gradient(rgba(249, 115, 22, 0.12) 1px, transparent 1px);
      background-size: 32px 32px; pointer-events: none;
    }
    .slide-glow {
      position: absolute; width: 680px; height: 680px; border-radius: 50%;
      background: radial-gradient(circle, rgba(249, 115, 22, 0.2) 0%, transparent 70%);
      top: -120px; right: 60px; pointer-events: none; filter: blur(75px);
    }
    .slide-content { max-width: 520px; position: relative; z-index: 10; }
    .slide-tag {
      display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px;
      border-radius: 9999px; background: rgba(249, 115, 22, 0.14);
      border: 1px solid rgba(249, 115, 22, 0.35); color: #fb923c;
      font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
      margin-bottom: 18px;
    }
    .slide-title {
      font-size: 42px; font-weight: 800; line-height: 1.15; letter-spacing: -0.03em;
      margin-bottom: 16px; color: #f8fafc;
    }
    .slide-title span {
      background: linear-gradient(135deg, #f97316, #fdba74);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .slide-desc { font-size: 15px; line-height: 1.6; color: #94a3b8; margin-bottom: 26px; }
    .slide-features { display: flex; flex-direction: column; gap: 12px; }
    .slide-feat-item { display: flex; align-items: center; gap: 12px; font-size: 14px; font-weight: 600; color: #e2e8f0; }
    .slide-feat-icon {
      width: 26px; height: 26px; border-radius: 50%; background: rgba(249, 115, 22, 0.18);
      border: 1px solid #f97316; color: #fb923c; display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 800; flex-shrink: 0;
    }

    .ui-showcase-frame {
      position: relative; z-index: 10;
      border-radius: 24px;
      box-shadow: 0 25px 65px -15px rgba(0, 0, 0, 0.88), 0 0 0 1px rgba(255, 255, 255, 0.14);
      overflow: hidden;
      background: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .widget-img-wrapper {
      width: 400px;
      height: 670px;
      overflow: hidden;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      border-radius: 24px;
      background: #ffffff;
    }

    .widget-img-wrapper img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }

    .browser-frame {
      width: 610px;
      border-radius: 16px;
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.16);
      box-shadow: 0 25px 65px -15px rgba(0, 0, 0, 0.9);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
      z-index: 10;
    }
    .browser-header {
      height: 38px; background: #1f2937; border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex; align-items: center; padding: 0 14px; gap: 8px;
    }
    .browser-dot { width: 10px; height: 10px; border-radius: 50%; }
    .browser-bar {
      flex: 1; height: 22px; background: #111827; border-radius: 6px;
      display: flex; align-items: center; padding: 0 10px; font-size: 11px;
      color: #9ca3af; font-family: monospace; margin-left: 6px;
    }
    .browser-body { width: 100%; overflow: hidden; }
    .browser-body img { width: 100%; height: auto; display: block; }
  </style>
</head>
<body>

  <!-- Slide 1: Hero & Modern Widget -->
  <div id="slide-1" class="slide">
    <div class="slide-bg-grid"></div>
    <div class="slide-glow"></div>
    <div class="slide-content">
      <div class="slide-tag">Next-Gen AI Customer Support</div>
      <h1 class="slide-title">Chatty by <span>PersonaliAI</span></h1>
      <p class="slide-desc">The modern customer support assistant with native in-chat calendar booking, live WebRTC voice calls, and automated knowledge base grounding.</p>
      <div class="slide-features">
        <div class="slide-feat-item"><span class="slide-feat-icon">✓</span> In-Chat Interactive Calendar Booking</div>
        <div class="slide-feat-item"><span class="slide-feat-icon">✓</span> Real-Time WebRTC Voice Agent Calls</div>
        <div class="slide-feat-item"><span class="slide-feat-icon">✓</span> Grounded on Your Website & Knowledge Base</div>
        <div class="slide-feat-item"><span class="slide-feat-icon">✓</span> Official WordPress & WooCommerce Integration</div>
      </div>
    </div>
    <div class="ui-showcase-frame">
      <div class="widget-img-wrapper">
        <img src="chatty_home_tab.png" alt="Real Chatty Widget Home UI" />
      </div>
    </div>
  </div>

  <!-- Slide 2: In-Chat Calendar Booking -->
  <div id="slide-2" class="slide">
    <div class="slide-bg-grid"></div>
    <div class="slide-glow"></div>
    <div class="slide-content">
      <div class="slide-tag">Zero Friction Scheduling</div>
      <h1 class="slide-title">In-Chat <span>Calendar Booking</span></h1>
      <p class="slide-desc">Stop losing leads to external booking links. Chatty embeds full date pill selection, available slot pickers, and attendee forms directly inside the chat conversation.</p>
      <div class="slide-features">
        <div class="slide-feat-item"><span class="slide-feat-icon">📅</span> Native Slot Picker (No Calendly Needed)</div>
        <div class="slide-feat-item"><span class="slide-feat-icon">📅</span> Automatic Google & Outlook Calendar Sync</div>
        <div class="slide-feat-item"><span class="slide-feat-icon">📅</span> Attendee Name, Email, & Phone Lead Capture</div>
        <div class="slide-feat-item"><span class="slide-feat-icon">📅</span> Automatic Timezone Detection & Conversion</div>
      </div>
    </div>
    <div class="ui-showcase-frame">
      <div class="widget-img-wrapper">
        <img src="chatty_booking_card_loaded.png" alt="Real Chatty In-Chat Booking UI" />
      </div>
    </div>
  </div>

  <!-- Slide 3: Live Voice Agent -->
  <div id="slide-3" class="slide">
    <div class="slide-bg-grid"></div>
    <div class="slide-glow"></div>
    <div class="slide-content">
      <div class="slide-tag">Real-Time WebRTC Audio</div>
      <h1 class="slide-title">Interactive <span>Voice Agent</span></h1>
      <p class="slide-desc">Talk naturally to your assistant right from the browser. Featuring low-latency WebRTC streaming, animated audio orb, live transcript, and in-call interactive booking.</p>
      <div class="slide-features">
        <div class="slide-feat-item"><span class="slide-feat-icon">🎙️</span> Ultra Low-Latency WebRTC Voice Streaming</div>
        <div class="slide-feat-item"><span class="slide-feat-icon">🎙️</span> Pulsing Audio Orb with Speaking States</div>
        <div class="slide-feat-item"><span class="slide-feat-icon">🎙️</span> Synchronized Real-Time Speech Transcripts</div>
        <div class="slide-feat-item"><span class="slide-feat-icon">🎙️</span> In-Call Interactive Booking Card</div>
      </div>
    </div>
    <div class="ui-showcase-frame">
      <div class="widget-img-wrapper">
        <img src="real_voice_widget.png" alt="Real Chatty Voice Agent UI" />
      </div>
    </div>
  </div>

  <!-- Slide 4: Knowledge Grounding & Citations -->
  <div id="slide-4" class="slide">
    <div class="slide-bg-grid"></div>
    <div class="slide-glow"></div>
    <div class="slide-content">
      <div class="slide-tag">100% Grounded AI Answers</div>
      <h1 class="slide-title">Trained on <span>Your Content</span></h1>
      <p class="slide-desc">Zero hallucinations. Chatty retrieves answers exclusively from your crawled website URLs, documents, and product catalog, linking clickable citations on every response.</p>
      <div class="slide-features">
        <div class="slide-feat-item"><span class="slide-feat-icon">📚</span> Auto Website Crawling & Sitemap Ingestion</div>
        <div class="slide-feat-item"><span class="slide-feat-icon">📚</span> PDF, DOCX, & Markdown Knowledge Uploads</div>
        <div class="slide-feat-item"><span class="slide-feat-icon">📚</span> Clickable Source Citation Pills on Answers</div>
        <div class="slide-feat-item"><span class="slide-feat-icon">📚</span> Real-Time Visitor CSAT Feedback Loop</div>
      </div>
    </div>
    <div class="ui-showcase-frame">
      <div class="widget-img-wrapper">
        <img src="chatty_full_reply.png" alt="Real Chatty AI Response with Citations" />
      </div>
    </div>
  </div>

  <!-- Slide 5: WordPress Plugin Directory -->
  <div id="slide-5" class="slide">
    <div class="slide-bg-grid"></div>
    <div class="slide-glow"></div>
    <div class="slide-content">
      <div class="slide-tag">Instant 1-Click Deployment</div>
      <h1 class="slide-title">Official <span>WordPress Plugin</span></h1>
      <p class="slide-desc">Install directly from WordPress.org in under 60 seconds. Connect your Bot ID, train on your WooCommerce store, and start capturing leads 24/7.</p>
      <div class="slide-features">
        <div class="slide-feat-item"><span class="slide-feat-icon">🔌</span> Verified on WordPress.org Plugin Directory</div>
        <div class="slide-feat-item"><span class="slide-feat-icon">🔌</span> Zero-Code Setup via WP Admin Settings</div>
        <div class="slide-feat-item"><span class="slide-feat-icon">🔌</span> Native WooCommerce Product Catalog Support</div>
        <div class="slide-feat-item"><span class="slide-feat-icon">🔌</span> Universal 1-line script embed for React, Next, HTML</div>
      </div>
    </div>
    <div class="browser-frame">
      <div class="browser-header">
        <div class="browser-dot" style="background:#ef4444;"></div>
        <div class="browser-dot" style="background:#f59e0b;"></div>
        <div class="browser-dot" style="background:#10b981;"></div>
        <div class="browser-bar">wordpress.org/plugins/personaliai-customer-support-chatbot/</div>
      </div>
      <div class="browser-body">
        <img src="live_wordpress_directory.png" alt="Official WordPress Directory Listing" />
      </div>
    </div>
  </div>

</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, '../public/product-hunt-assets/slides_stage.html'), htmlContent, 'utf8');

async function renderSlides() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe'
  });
  const page = await browser.newPage({ viewport: { width: 1270, height: 760 }, deviceScaleFactor: 2 });
  const fileUrl = 'file:///' + path.resolve(__dirname, '../public/product-hunt-assets/slides_stage.html').replace(/\\\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const brainDir = 'C:\\\\Users\\\\HP\\\\.gemini\\\\antigravity\\\\brain\\\\1ca617eb-bc44-4730-826c-47a5eaa19628';

  for (let i = 1; i <= 5; i++) {
    const slide = page.locator('#slide-' + i);
    const pubPath = path.join(__dirname, '../public/product-hunt-assets/gallery-slide-' + i + '.png');
    const brainPath = path.join(brainDir, 'gallery-slide-' + i + '.png');
    await slide.screenshot({ path: pubPath });
    fs.copyFileSync(pubPath, brainPath);
    console.log('Rendered gallery-slide-' + i + '.png');
  }

  await browser.close();
}

renderSlides().catch(err => {
  console.error(err);
  process.exit(1);
});
