"use client";

import React from "react";
import VoiceCallWidget from "@/components/voice-call-widget";
import { ArrowLeft, AudioWaveform, Bell, RefreshCw, X } from "lucide-react";

export default function VoiceDemoPage() {
  return (
    <div style={{ background: "#060911", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0", margin: "0" }}>
      <div
        id="voice-widget-card"
        style={{
          width: "400px",
          height: "670px",
          borderRadius: "24px",
          overflow: "hidden",
          background: "#ffffff",
          boxShadow: "0 25px 65px -15px rgba(0,0,0,0.85)",
          border: "1px solid rgba(255,255,255,0.14)",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
      >
        {/* Authentic Chatty Widget Header */}
        <div
          style={{
            height: "60px",
            background: "#f97316",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            gap: "10px",
            color: "#fff",
            flexShrink: 0,
          }}
        >
          <button
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.9)",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <ArrowLeft style={{ width: "16px", height: "16px" }} />
          </button>

          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            }}
          >
            <img src="/favicon.png" alt="Chatty" style={{ width: "24px", height: "24px", objectFit: "contain" }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "14px", lineHeight: 1.2 }}>Chatty</div>
            <div style={{ fontSize: "10px", display: "flex", alignItems: "center", gap: "5px", opacity: 0.95 }}>
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: "#10b981",
                  display: "inline-block",
                }}
              />
              Live Voice Call · 00:24
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.22)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
              }}
            >
              <AudioWaveform style={{ width: "13px", height: "13px" }} />
            </div>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              <Bell style={{ width: "14px", height: "14px" }} />
            </div>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              <RefreshCw style={{ width: "13px", height: "13px" }} />
            </div>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              <X style={{ width: "15px", height: "15px" }} />
            </div>
          </div>
        </div>

        {/* Real VoiceCallWidget */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#ffffff" }}>
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
  );
}
