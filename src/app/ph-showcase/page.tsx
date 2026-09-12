"use client";

import React from "react";
import VoiceCallWidget from "@/components/voice-call-widget";

export default function ProductHuntShowcasePage() {
  return (
    <div style={{ background: "#07090e", minHeight: "100vh", color: "#fff", fontFamily: "var(--font-sans), sans-serif", padding: "40px 0" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "60px", alignItems: "center" }}>
        
        {/* Slide 1: Hero Overview */}
        <div id="slide-1" className="slide-frame" style={{ width: "1270px", height: "760px", background: "#0b0f17", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 70px", border: "1px solid #1e293b" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundImage: "radial-gradient(#1e293b 1px, transparent 1px)", backgroundSize: "28px 28px", opacity: 0.25, pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: "-100px", left: "100px", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
          
          <div style={{ maxWidth: "540px", zIndex: 2 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.35)", padding: "5px 14px", borderRadius: "100px", fontSize: "11px", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "22px" }}>
              Next-Gen AI Customer Support
            </div>
            <h1 style={{ fontSize: "46px", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.03em", color: "#fff", marginBottom: "18px" }}>
              Omnichannel <span style={{ color: "#f97316" }}>AI Support</span> & Voice Agent
            </h1>
            <p style={{ fontSize: "16px", lineHeight: 1.6, color: "#94a3b8", marginBottom: "30px" }}>
              Turn website visitors into qualified sales meetings and revenue. Trained on your content, books calendar slots natively in chat, and handles real-time WebRTC voice calls.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#e2e8f0" }}>
                <span style={{ color: "#f97316", fontWeight: "bold" }}>?</span> Interactive In-Chat Calendar Booking
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#e2e8f0" }}>
                <span style={{ color: "#f97316", fontWeight: "bold" }}>?</span> Low-Latency WebRTC Voice Calling
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#e2e8f0" }}>
                <span style={{ color: "#f97316", fontWeight: "bold" }}>?</span> Grounded Answers with Real Citations
              </div>
            </div>
          </div>

          <div style={{ width: "420px", height: "660px", borderRadius: "24px", overflow: "hidden", boxShadow: "0 30px 70px -15px rgba(0,0,0,0.9), 0 0 50px rgba(249,115,22,0.2)", border: "1px solid rgba(255,255,255,0.12)", zIndex: 2 }}>
            <img src="/product-hunt-assets/chatty_home_tab.png" alt="Chatty Assistant" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </div>

        {/* Slide 2: In-Chat Calendar Booking */}
        <div id="slide-2" className="slide-frame" style={{ width: "1270px", height: "760px", background: "#0b0f17", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 70px", border: "1px solid #1e293b" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundImage: "radial-gradient(#1e293b 1px, transparent 1px)", backgroundSize: "28px 28px", opacity: 0.25, pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: "-100px", left: "100px", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

          <div style={{ maxWidth: "540px", zIndex: 2 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.35)", padding: "5px 14px", borderRadius: "100px", fontSize: "11px", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "22px" }}>
              Native In-Chat Scheduling
            </div>
            <h1 style={{ fontSize: "46px", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.03em", color: "#fff", marginBottom: "18px" }}>
              In-Chat <span style={{ color: "#f97316" }}>Calendar Booking</span>
            </h1>
            <p style={{ fontSize: "16px", lineHeight: 1.6, color: "#94a3b8", marginBottom: "30px" }}>
              Never lose a lead to an external Calendly redirect. Visitors select dates, pick live available slots, and confirm appointments right inside the conversation stream.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#e2e8f0" }}>
                <span style={{ color: "#f97316", fontWeight: "bold" }}>?</span> Direct Google Calendar & Microsoft Outlook Sync
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#e2e8f0" }}>
                <span style={{ color: "#f97316", fontWeight: "bold" }}>?</span> Automated Google Meet & Teams Video Links
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#e2e8f0" }}>
                <span style={{ color: "#f97316", fontWeight: "bold" }}>?</span> Instant In-Chat Confirmation & 1-Click Reschedule
              </div>
            </div>
          </div>

          <div style={{ width: "420px", height: "660px", borderRadius: "24px", overflow: "hidden", boxShadow: "0 30px 70px -15px rgba(0,0,0,0.9), 0 0 50px rgba(249,115,22,0.2)", border: "1px solid rgba(255,255,255,0.12)", zIndex: 2 }}>
            <img src="/product-hunt-assets/chatty_booking_card_loaded.png" alt="In-Chat Booking Slots" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </div>

        {/* Slide 3: Real Voice Agent */}
        <div id="slide-3" className="slide-frame" style={{ width: "1270px", height: "760px", background: "#0b0f17", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 70px", border: "1px solid #1e293b" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundImage: "radial-gradient(#1e293b 1px, transparent 1px)", backgroundSize: "28px 28px", opacity: 0.25, pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: "-100px", left: "100px", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

          <div style={{ maxWidth: "540px", zIndex: 2 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.35)", padding: "5px 14px", borderRadius: "100px", fontSize: "11px", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "22px" }}>
              LiveKit WebRTC Audio
            </div>
            <h1 style={{ fontSize: "46px", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.03em", color: "#fff", marginBottom: "18px" }}>
              Human-Like <span style={{ color: "#f97316" }}>Voice Agent</span>
            </h1>
            <p style={{ fontSize: "16px", lineHeight: 1.6, color: "#94a3b8", marginBottom: "30px" }}>
              Speak naturally directly in your browser. Powered by low-latency WebRTC, pulsing animated audio orb, live speech-to-text transcript, and interactive in-call calendar booking.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#e2e8f0" }}>
                <span style={{ color: "#f97316", fontWeight: "bold" }}>?</span> Real-Time WebRTC Audio with Sub-Second Latency
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#e2e8f0" }}>
                <span style={{ color: "#f97316", fontWeight: "bold" }}>?</span> Live Transcript Bubbles & Audio Waveform Visualizer
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#e2e8f0" }}>
                <span style={{ color: "#f97316", fontWeight: "bold" }}>?</span> In-Call Interactive Booking & Lead Capture
              </div>
            </div>
          </div>

          <div style={{ width: "420px", height: "660px", borderRadius: "24px", overflow: "hidden", background: "#ffffff", boxShadow: "0 30px 70px -15px rgba(0,0,0,0.9), 0 0 50px rgba(249,115,22,0.2)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", flexDirection: "column", zIndex: 2 }}>
            <div style={{ height: "64px", background: "#f97316", display: "flex", alignItems: "center", padding: "0 20px", gap: "12px", color: "#fff" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img src="/favicon.png" alt="Chatty" style={{ width: "26px", height: "26px", objectFit: "contain" }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "15px" }}>Chatty Voice Agent</div>
                <div style={{ fontSize: "11px", opacity: 0.9 }}>• Live WebRTC Call • 00:24</div>
              </div>
            </div>
            <div style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column" }}>
              <VoiceCallWidget
                botId="ad32f373-7694-43f4-9465-f8d65ce291e3"
                sessionId="demo-session-voice"
                backendUrl="https://api.chatty.personaliai.com"
                originToken={null}
                visitorTimezone="America/New_York"
                primaryColor="#f97316"
                onClose={() => {}}
                previewMode={true}
              />
            </div>
          </div>
        </div>

        {/* Slide 4: Trained on Your Content */}
        <div id="slide-4" className="slide-frame" style={{ width: "1270px", height: "760px", background: "#0b0f17", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 70px", border: "1px solid #1e293b" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundImage: "radial-gradient(#1e293b 1px, transparent 1px)", backgroundSize: "28px 28px", opacity: 0.25, pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: "-100px", left: "100px", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

          <div style={{ maxWidth: "540px", zIndex: 2 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.35)", padding: "5px 14px", borderRadius: "100px", fontSize: "11px", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "22px" }}>
              Accurate & Grounded
            </div>
            <h1 style={{ fontSize: "46px", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.03em", color: "#fff", marginBottom: "18px" }}>
              Trained on <span style={{ color: "#f97316" }}>Your Content</span>
            </h1>
            <p style={{ fontSize: "16px", lineHeight: 1.6, color: "#94a3b8", marginBottom: "30px" }}>
              Zero hallucinations. Chatty strictly grounds every response in your website pages, documentation, PDFs, and WooCommerce product catalog with clickable citations.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#e2e8f0" }}>
                <span style={{ color: "#f97316", fontWeight: "bold" }}>?</span> Automated Website Crawling & Sitemaps
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#e2e8f0" }}>
                <span style={{ color: "#f97316", fontWeight: "bold" }}>?</span> PDF, DOCX, & Markdown Knowledge Uploads
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#e2e8f0" }}>
                <span style={{ color: "#f97316", fontWeight: "bold" }}>?</span> Real-Time Source Citations on Every Answer
              </div>
            </div>
          </div>

          <div style={{ width: "420px", height: "660px", borderRadius: "24px", overflow: "hidden", boxShadow: "0 30px 70px -15px rgba(0,0,0,0.9), 0 0 50px rgba(249,115,22,0.2)", border: "1px solid rgba(255,255,255,0.12)", zIndex: 2 }}>
            <img src="/product-hunt-assets/chatty_full_reply.png" alt="Trained on Content" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </div>

        {/* Slide 5: Official WordPress Plugin */}
        <div id="slide-5" className="slide-frame" style={{ width: "1270px", height: "760px", background: "#0b0f17", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 70px", border: "1px solid #1e293b" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundImage: "radial-gradient(#1e293b 1px, transparent 1px)", backgroundSize: "28px 28px", opacity: 0.25, pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: "-100px", left: "100px", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

          <div style={{ maxWidth: "520px", zIndex: 2 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.35)", padding: "5px 14px", borderRadius: "100px", fontSize: "11px", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "22px" }}>
              Instant Deployment
            </div>
            <h1 style={{ fontSize: "46px", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.03em", color: "#fff", marginBottom: "18px" }}>
              Official <span style={{ color: "#f97316" }}>WordPress Plugin</span>
            </h1>
            <p style={{ fontSize: "16px", lineHeight: 1.6, color: "#94a3b8", marginBottom: "30px" }}>
              Install directly from the official WordPress.org Plugin Directory in under 60 seconds. Zero coding required, WooCommerce ready, and fully customizable.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#e2e8f0" }}>
                <span style={{ color: "#f97316", fontWeight: "bold" }}>?</span> Verified on WordPress.org Plugin Directory
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#e2e8f0" }}>
                <span style={{ color: "#f97316", fontWeight: "bold" }}>?</span> 1-Click Bot ID Setup in WP Admin
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#e2e8f0" }}>
                <span style={{ color: "#f97316", fontWeight: "bold" }}>?</span> Compatible with Elementor, Divi, Gutenberg & FSE
              </div>
            </div>
          </div>

          <div style={{ width: "580px", height: "490px", borderRadius: "20px", overflow: "hidden", boxShadow: "0 30px 70px -15px rgba(0,0,0,0.9), 0 0 50px rgba(249,115,22,0.2)", border: "1px solid rgba(255,255,255,0.12)", zIndex: 2 }}>
            <img src="/product-hunt-assets/live_wordpress_directory.png" alt="WordPress Plugin Directory" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
          </div>
        </div>

      </div>
    </div>
  );
}
