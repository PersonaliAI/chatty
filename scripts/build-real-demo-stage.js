const fs = require('fs');
const path = require('path');

const demoHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Chatty Product Hunt Real UI Demo</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1280px; height: 720px; overflow: hidden;
      background: #080c14; font-family: 'Plus Jakarta Sans', sans-serif;
      color: #fff; position: relative; user-select: none;
    }
    .bg-grid {
      position: absolute; inset: 0;
      background-image: radial-gradient(rgba(249, 115, 22, 0.12) 1px, transparent 1px);
      background-size: 32px 32px; pointer-events: none;
    }
    .bg-glow {
      position: absolute; width: 600px; height: 600px; border-radius: 50%;
      background: radial-gradient(circle, rgba(249, 115, 22, 0.16) 0%, transparent 70%);
      top: -100px; left: 100px; pointer-events: none; filter: blur(70px);
    }

    /* SaaS Landing Page */
    .saas-nav {
      height: 64px; display: flex; align-items: center; justify-content: space-between;
      padding: 0 48px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      position: relative; z-index: 10;
    }
    .saas-brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 18px; }
    .saas-brand-icon {
      width: 30px; height: 30px; border-radius: 8px; background: #f97316;
      display: flex; align-items: center; justify-content: center;
    }
    .saas-brand-icon img { width: 20px; height: 20px; object-fit: contain; }
    .saas-links { display: flex; gap: 32px; font-size: 13px; color: #94a3b8; font-weight: 600; }
    .saas-btn {
      background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15);
      color: #fff; padding: 8px 18px; border-radius: 9999px; font-size: 13px; font-weight: 700;
    }

    .saas-hero { padding: 80px 48px 0; max-width: 650px; position: relative; z-index: 10; }
    .hero-tag {
      display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px;
      border-radius: 9999px; background: rgba(249, 115, 22, 0.14);
      border: 1px solid rgba(249, 115, 22, 0.35); color: #fb923c;
      font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
      margin-bottom: 20px;
    }
    .saas-hero h1 { font-size: 46px; font-weight: 800; line-height: 1.15; letter-spacing: -0.03em; margin-bottom: 18px; }
    .saas-hero h1 span {
      background: linear-gradient(135deg, #f97316, #fdba74);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .saas-hero p { font-size: 16px; line-height: 1.6; color: #94a3b8; margin-bottom: 28px; }
    .hero-features { display: flex; gap: 24px; font-size: 13px; font-weight: 600; color: #cbd5e1; }
    .hero-feat-item { display: flex; align-items: center; gap: 8px; }
    .feat-check { color: #f97316; font-weight: 800; }

    /* Animated Cursor */
    #cursor {
      position: absolute; width: 22px; height: 22px; pointer-events: none; z-index: 9999;
      transform: translate3d(1200px, 680px, 0);
      transition: transform 0.65s cubic-bezier(0.22, 1, 0.36, 1);
    }
    #cursor svg { filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5)); }
    .click-ripple {
      position: absolute; width: 36px; height: 36px; border-radius: 50%;
      border: 2px solid #f97316; transform: translate(-50%, -50%) scale(0);
      opacity: 0; pointer-events: none; z-index: 9998;
      animation: ripple 0.5s ease-out;
    }
    @keyframes ripple {
      0% { transform: translate(-50%, -50%) scale(0.2); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
    }

    /* Chatty Floating Launcher */
    #launcher {
      position: absolute; bottom: 32px; right: 40px; width: 62px; height: 62px;
      border-radius: 50%; background: #f97316;
      box-shadow: 0 12px 32px rgba(249, 115, 22, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.2);
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      z-index: 100; transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    #launcher.hidden { transform: scale(0); pointer-events: none; }
    #launcher img { width: 34px; height: 34px; object-fit: contain; }
    .launcher-pulse {
      position: absolute; inset: -5px; border-radius: 50%;
      border: 2px solid rgba(249, 115, 22, 0.6); animation: pulseAura 2s infinite;
    }
    @keyframes pulseAura {
      0% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.18); opacity: 0; }
      100% { transform: scale(0.95); opacity: 0; }
    }

    /* Widget Stage Container */
    #widget-frame {
      position: absolute; bottom: 32px; right: 40px;
      width: 400px; height: 670px; border-radius: 24px;
      background: #ffffff;
      box-shadow: 0 30px 80px -15px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.14);
      z-index: 100; overflow: hidden;
      opacity: 0; transform: translateY(40px) scale(0.92);
      transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex; flex-direction: column;
    }
    #widget-frame.open {
      opacity: 1; transform: translateY(0) scale(1);
    }

    /* View layers inside the widget */
    .view-layer {
      position: absolute; inset: 0; width: 100%; height: 100%;
      display: none; flex-direction: column; background: #ffffff;
    }
    .view-layer.active { display: flex; }

    .view-layer img {
      width: 100%; height: 100%; object-fit: contain; display: block;
    }

    /* Outro Screen */
    #outro {
      position: absolute; inset: 0; background: #070a12;
      z-index: 500; display: flex; flex-direction: column; align-items: center; justify-content: center;
      opacity: 0; pointer-events: none; transition: opacity 0.8s ease; text-align: center;
    }
    #outro.show { opacity: 1; pointer-events: auto; }
    .outro-glow {
      position: absolute; width: 700px; height: 700px; border-radius: 50%;
      background: radial-gradient(circle, rgba(249, 115, 22, 0.22) 0%, transparent 70%);
      pointer-events: none; filter: blur(80px);
    }
    .outro-logo {
      width: 88px; height: 88px; border-radius: 24px; background: #f97316;
      display: flex; align-items: center; justify-content: center; margin-bottom: 24px;
      box-shadow: 0 15px 40px rgba(249, 115, 22, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.2);
    }
    .outro-logo img { width: 56px; height: 56px; object-fit: contain; }
    .outro-title { font-size: 52px; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 12px; }
    .outro-title span {
      background: linear-gradient(135deg, #f97316, #fdba74);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .outro-sub { font-size: 20px; color: #94a3b8; font-weight: 500; margin-bottom: 32px; max-width: 650px; line-height: 1.5; }
    .outro-badges { display: flex; gap: 16px; margin-bottom: 36px; }
    .outro-badge {
      display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 9999px;
      background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12);
      font-size: 14px; font-weight: 700; color: #e2e8f0;
    }
    .outro-cta {
      display: inline-flex; align-items: center; gap: 10px; padding: 14px 32px;
      border-radius: 9999px; background: linear-gradient(135deg, #f97316, #ea580c);
      color: #fff; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;
      box-shadow: 0 12px 35px rgba(249, 115, 22, 0.5);
    }
  </style>
</head>
<body>
  <div class="bg-grid"></div>
  <div class="bg-glow"></div>

  <!-- Cursor -->
  <div id="cursor">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
      <path d="M4 2L20 10L12 12L10 20L4 2Z" fill="#ffffff" stroke="#000000" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>
  </div>

  <!-- Background SaaS Website -->
  <header class="saas-nav">
    <div class="saas-brand">
      <div class="saas-brand-icon">
        <img src="/favicon.png" alt="Chatty" />
      </div>
      <span>Acme Cloud</span>
    </div>
    <div class="saas-links">
      <span>Products</span>
      <span>Solutions</span>
      <span>Integrations</span>
      <span>Pricing</span>
    </div>
    <button class="saas-btn">Start Free Trial</button>
  </header>

  <main class="saas-hero">
    <div class="hero-tag">AI Customer Support Platform</div>
    <h1>Turn Site Visitors Into <span>Booked Meetings</span> 24/7</h1>
    <p>Empower your business with instant grounded answers, interactive in-chat calendar booking, and low-latency real-time voice calls.</p>
    <div class="hero-features">
      <div class="hero-feat-item"><span class="feat-check">✓</span> Zero-Code Setup</div>
      <div class="hero-feat-item"><span class="feat-check">✓</span> WordPress & WooCommerce</div>
      <div class="hero-feat-item"><span class="feat-check">✓</span> Live WebRTC Voice Calls</div>
    </div>
  </main>

  <!-- Floating Launcher -->
  <div id="launcher">
    <div class="launcher-pulse"></div>
    <img src="/favicon.png" alt="Chatty" />
  </div>

  <!-- Widget Container hosting the real Chatty UI captures -->
  <div id="widget-frame">
    <!-- View 1: Real Home Tab -->
    <div id="v-home" class="view-layer active">
      <img src="chatty_home_tab.png" alt="Home Tab" />
    </div>

    <!-- View 2: Real Booking Card Loaded -->
    <div id="v-booking" class="view-layer">
      <img src="chatty_booking_card_loaded.png" alt="Booking Card Loaded" />
    </div>

    <!-- View 3: Real Slot Selected Form -->
    <div id="v-slot-form" class="view-layer">
      <img src="chatty_slot_selected_form.png" alt="Slot Selected Form" />
    </div>

    <!-- View 4: Real Voice Agent Call -->
    <div id="v-voice" class="view-layer">
      <img src="real_voice_widget.png" alt="Real Voice Call Widget" />
    </div>
  </div>

  <!-- Outro -->
  <div id="outro">
    <div class="outro-glow"></div>
    <div class="outro-logo">
      <img src="/favicon.png" alt="Chatty" />
    </div>
    <h1 class="outro-title">Chatty by <span>PersonaliAI</span></h1>
    <p class="outro-sub">The modern AI customer support widget with native calendar booking, real-time voice calls, and zero-code WordPress integration.</p>
    <div class="outro-badges">
      <div class="outro-badge">📅 In-Chat Booking</div>
      <div class="outro-badge">🎙️ WebRTC Voice Calls</div>
      <div class="outro-badge">🔌 Official WordPress.org</div>
      <div class="outro-badge">⚡ WooCommerce Ready</div>
    </div>
    <div class="outro-cta">
      Upvote Us on Product Hunt Today 🚀
    </div>
  </div>

  <script>
    const cursor = document.getElementById('cursor');
    const launcher = document.getElementById('launcher');
    const widgetFrame = document.getElementById('widget-frame');
    const outro = document.getElementById('outro');

    const vHome = document.getElementById('v-home');
    const vBooking = document.getElementById('v-booking');
    const vSlotForm = document.getElementById('v-slot-form');
    const vVoice = document.getElementById('v-voice');

    function moveCursor(x, y, ms = 650) {
      cursor.style.transition = \`transform \${ms}ms cubic-bezier(0.22, 1, 0.36, 1)\`;
      cursor.style.transform = \`translate3d(\${x}px, \${y}px, 0)\`;
      return new Promise(r => setTimeout(r, ms));
    }

    function triggerClick(x, y) {
      const ripple = document.createElement('div');
      ripple.className = 'click-ripple';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    }

    function showView(viewEl) {
      [vHome, vBooking, vSlotForm, vVoice].forEach(v => v.classList.remove('active'));
      viewEl.classList.add('active');
    }

    async function runDemo() {
      // 0s - Wait initially
      await new Promise(r => setTimeout(r, 1000));

      // Move cursor to floating launcher
      await moveCursor(1230, 645, 900);
      triggerClick(1230, 645);
      launcher.classList.add('hidden');
      widgetFrame.classList.add('open');

      // 1.5s - Show Home Tab
      await new Promise(r => setTimeout(r, 2200));

      // Move cursor to "Send us a message" on Home Tab
      await moveCursor(1040, 360, 700);
      triggerClick(1040, 360);

      // Switch to Booking Card
      await new Promise(r => setTimeout(r, 400));
      showView(vBooking);

      // Inspect Booking Card
      await new Promise(r => setTimeout(r, 2600));

      // Move cursor to 10:00 AM slot button
      await moveCursor(1180, 525, 700);
      triggerClick(1180, 525);

      // Switch to Slot Selected Form
      await new Promise(r => setTimeout(r, 400));
      showView(vSlotForm);

      // View attendee form
      await new Promise(r => setTimeout(r, 2600));

      // Move cursor to Header Phone button to start voice call
      await moveCursor(1180, 42, 800);
      triggerClick(1180, 42);

      // Switch to Voice Call Widget
      await new Promise(r => setTimeout(r, 400));
      showView(vVoice);

      // Showcase Voice Call Widget with pulsing audio orb, live transcript, and confirmed booking
      await new Promise(r => setTimeout(r, 4000));

      // Show Outro
      outro.classList.add('show');
    }

    window.addEventListener('DOMContentLoaded', () => {
      runDemo();
    });
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, '../public/product-hunt-assets/demo_stage.html'), demoHtml, 'utf8');
console.log('Saved real demo_stage.html');
