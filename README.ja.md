<div align="center">

<img src="https://raw.githubusercontent.com/PersonaliAI/chatty/main/backend/assets/chatty-icon.png" alt="Chatty" width="88" /> <img src="https://raw.githubusercontent.com/PersonaliAI/chatty/main/backend/assets/readme-icon.png" alt="Chatty" width="88" />

# Chatty by PersonaliAI

<p>
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.es.md">Español</a>
</p>

**オープンソース AI カスタマーサポート：Web チャットウィジェット + 7 チャネル・オムニチャネルハブ + 完全な FastMCP サーバー、独自のナレッジベースに基づいて動作。**

Chatty は、AI チャットウィジェット、ビジュアル会話フロー自動化、および有人オペレーター引き継ぎ（ヒューマンテイクオーバー）対応の共有受信トレイを必要とするチームのための、オープンソースかつセルフホスト可能な **Zendesk 代替** および **Intercom 代替** プラットフォームです。Chatty は独立したプロジェクトであり、Zendesk や Intercom との提携・推奨関係はありません。

Supabase Auth、Postgres、Storage、Realtime をマネージド環境に保ちながら、独自のホスト上でアプリケーションコンテナを実行できます。VPS、Railway、Render、その他の Docker ホスト環境で、稼働中の Supabase プロジェクトに影響を与えることなく動作します。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/PersonaliAI/chatty/actions/workflows/ci.yml/badge.svg)](https://github.com/PersonaliAI/chatty/actions/workflows/ci.yml)
[![GDPR Compliant](https://img.shields.io/badge/GDPR-100%25%20Compliant-003399?logo=shield&logoColor=ffcc00)](#-gdpr--エンタープライズデータプライバシー)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](frontend)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.11%20%2F%203.13-009688?logo=fastapi&logoColor=white)](backend)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![MCP](https://img.shields.io/badge/FastMCP-65%20Tools-8b5cf6)](#mcp-サーバーとエージェント制御)
[![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Chatty Cloud (ホスト版)](https://chatty.personaliai.com) · [ドキュメント](https://docs.chatty.personaliai.com) · [データ処理契約 (DPA)](frontend/src/app/(legal)/dpa/page.tsx) · [再委託先リスト](frontend/src/app/(legal)/subprocessors/page.tsx) · [パフォーマンス・スコアカード](https://docs.chatty.personaliai.com/guides/scorecard) · [フロービルダー](https://docs.chatty.personaliai.com/guides/flow-architect) · [ウィジェット埋め込み](https://docs.chatty.personaliai.com/guides/embed-widget) · [安全な顧客アイデンティティ](https://docs.chatty.personaliai.com/guides/human-takeover) · [クイックスタート](#-クイックスタート-docker-compose) · [セルフホスト運用手順書](https://docs.chatty.personaliai.com/guides/self-hosting) · [MCP サーバー](#mcp-サーバーとエージェント制御) · [AI プラグイン](https://docs.chatty.personaliai.com/guides/ai-coding-plugins) · [オムニチャネル](https://docs.chatty.personaliai.com/guides/omnichannel) · [WooCommerce](https://docs.chatty.personaliai.com/guides/woocommerce)

<br />
<br />

<p align="center">
  <a href="screenshots/real-01-overview.png"><img src="screenshots/real-01-overview.png" alt="Chatty Executive Overview & Live Telemetry" width="100%" style="border-radius: 8px;" /></a>
</p>

</div>

---

## 目次

- [Chatty を選ぶ理由](#chatty-を選ぶ理由)
- [本番ダッシュボード 4K 高解像度プレビュー](#-本番ダッシュボード-4k-高解像度プレビュー)
- [機能](#-機能)
- [7 チャネル・オムニチャネルハブ](#-7-チャネルオムニチャネルハブ)
- [ビジュアル会話フロービルダー & 条件付きランタイム](#️-ビジュアル会話フロービルダー--条件付きランタイム)
- [WooCommerce ストア連携 & マルチモーダル RAG](#-woocommerce-ストア連携--マルチモーダル-rag)
- [LiveKit リアルタイム音声エージェント & SDK](#-livekit-リアルタイム音声エージェント--sdk)
- [アーキテクチャ](#アーキテクチャ)
- [動作要件](#-動作要件)
- [クイックスタート (Docker Compose)](#-クイックスタート-docker-compose)
- [MCP サーバーとエージェント制御](#mcp-サーバーとエージェント制御)
- [ローカル開発 (Docker を使わない場合)](#-ローカル開発-docker-を使わない場合)
- [テストと CI](#-テストと-ci)
- [GDPR & エンタープライズデータプライバシー](#-gdpr--エンタープライズデータプライバシー)
- [セキュリティ](#-セキュリティ)
- [コントリビューション](#-コントリビューション)
- [ライセンス](#-ライセンス)

---

## Chatty を選ぶ理由

多くの商用チャットボット SaaS は、シート単位やメッセージ数に応じた高額な課金を行い、顧客との会話データを自社サーバーに囲い込みます。Chatty はオープンコアです。インフラ運用の手間をかけずに即座に利用したい場合は [Chatty Cloud](https://chatty.personaliai.com) を選び、自社のセキュリティ要件やコスト削減を重視する場合は無料で完全にセルフホストできます。どちらを選んでも、同一のエンタープライズ機能を利用できます。

| 項目 | クローズドソースの SaaS チャットボット | **Chatty** |
|---|---|---|
| **会話データの保管先** | 常にベンダー側のサーバーに保持 | あなた自身の Supabase プロジェクト（セルフホストまたは Chatty Cloud のどちらでも） |
| **料金体系** | シート単位／メッセージ課金、無料枠なし | 無料でセルフホスト可能、または分かりやすい定額の Chatty Cloud ホストプラン |
| **利用可能な LLM** | ベンダー指定のモデルに固定 | **BYOK (モデル持ち込み)** — デフォルトは Gemini、または OpenAI / Anthropic / OpenRouter を選択可能 |
| **オムニチャネル統合** | 高額な追加料金または Web のみ | **7つの主要チャネルを標準統合**: WhatsApp, Messenger, IG, TikTok, Telegram, SMS, Email |
| **自動化・AI エージェント連携** | 通常は利用不可、または高額な追加機能 | **完全な FastMCP サーバーを標準同梱** — 65 種類のツール、OAuth 2.0 & API キー保護 |
| **ソースコードの透明性** | 非公開 (Closed) | **MIT ライセンス** — 監査、フォーク、カスタマイズ、自由な環境での運用が可能 |

---

## 🖥️ 本番ダッシュボード 4K 高解像度プレビュー

主要な 22 モジュールすべてが本番稼働中の環境 ([`chatty.personaliai.com/dashboard`](https://chatty.personaliai.com/dashboard)) から鮮明な **4K Retina (3840×2160)** 解像度で収録されており、実際のデータ状態を確認できます。

<table width="100%">
  <tr>
    <td width="50%" align="center">
      <a href="screenshots/real-06-inbox.png"><img src="screenshots/real-06-inbox.png" alt="オムニチャネル受信トレイ & SLA 管理" width="100%" /></a>
      <br />
      <b>オムニチャネル受信トレイ & SLA 管理</b>
      <br />
      <sub>リアルタイム訪問者スレッド、SLA 違反警告、ワンクリック有人引き継ぎ</sub>
    </td>
    <td width="50%" align="center">
      <a href="screenshots/real-04-knowledge-base.png"><img src="screenshots/real-04-knowledge-base.png" alt="ナレッジベース & ベクトル検索" width="100%" /></a>
      <br />
      <b>ナレッジベース & ベクトル検索</b>
      <br />
      <sub>マルチフォーマット文書取り込み、Web クローラー、186k+ 文字をインデックス化</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <a href="screenshots/real-18-voice-agent.png"><img src="screenshots/real-18-voice-agent.png" alt="LiveKit WebRTC 音声スタジオ" width="100%" /></a>
      <br />
      <b>LiveKit WebRTC 音声スタジオ</b>
      <br />
      <sub>500ms 未満の超低遅延双方向音声、動的ビジュアライザー、マルチプラットフォーム SDK</sub>
    </td>
    <td width="50%" align="center">
      <a href="screenshots/real-08-flow-builder.png"><img src="screenshots/real-08-flow-builder.png" alt="ビジュアル会話フロービルダー" width="100%" /></a>
      <br />
      <b>ビジュアル会話フロービルダー</b>
      <br />
      <sub>対話型デシジョンツリー、AI Flow Copilot、循環検出バリデーション</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <a href="screenshots/real-03-customizer.png"><img src="screenshots/real-03-customizer.png" alt="ライブウィジェット・カスタマイザー" width="100%" /></a>
      <br />
      <b>ライブウィジェット・カスタマイザー</b>
      <br />
      <sub>WYSIWYG リアルタイムプレビュー、WCAG AA/AAA 自動コントラスト判定エンジン</sub>
    </td>
    <td width="50%" align="center">
      <a href="screenshots/real-16-analytics.png"><img src="screenshots/real-16-analytics.png" alt="解決率 & deflection 分析" width="100%" /></a>
      <br />
      <b>解決率 & deflection 分析</b>
      <br />
      <sub>会話ボリューム推移、100% の自己解決率、トークン消費ヒートマップ</sub>
    </td>
  </tr>
</table>

<details>
<summary><b>📸 全 22 種類の高解像度本番ダッシュボード画面一覧を展開</b></summary>
<br />

| # | モジュール | 説明 | 4K 画像 |
| :---: | :--- | :--- | :--- :|
| **01** | **エグゼクティブ概要** | 5 つの柱の健全性スコア、自己解決率、30 日間リアルタイム KPI | [4K 画像を表示](screenshots/real-01-overview.png) |
| **02** | **チャットボット・ワークスペース** | 複数ボットの一括管理、LLM モデル切り替え (GPT-4o, Claude, Gemini) | [4K 画像を表示](screenshots/real-02-workspace.png) |
| **03** | **ウィジェット・カスタマイザー** | 6 部構成のスタイルパレット、ブランドロゴ、WCAG コントラスト判定 | [4K 画像を表示](screenshots/real-03-customizer.png) |
| **04** | **ナレッジベース** | 52 以上のソース、186k 文字のインデックス化、HNSW ベクトル検索 | [4K 画像を表示](screenshots/real-04-knowledge-base.png) |
| **05** | **AI プレイグラウンド** | 出典（引用）検証ドロワーを備えたサンドボックス・シミュレーター | [4K 画像を表示](screenshots/real-05-playground.png) |
| **06** | **オムニチャネル受信トレイ** | 統合ヘルプデスク、訪問者の在席状況、SLA 違反カウントダウンタイマー | [4K 画像を表示](screenshots/real-06-inbox.png) |
| **07** | **プロアクティブ・キャンペーン** | ポップアップ案内、離脱検知 (Exit-Intent)、スクロール連動トリガー | [4K 画像を表示](screenshots/real-07-campaigns.png) |
| **08** | **フロービルダー** | ドラッグ＆ドロップ式の会話設計キャンバス、AI Flow Copilot | [4K 画像を表示](screenshots/real-08-flow-builder.png) |
| **09** | **訪問者リード CRM** | 自動リード抽出、GeoIP による国・都市の判定、CSV エクスポート | [4K 画像を表示](screenshots/real-09-leads.png) |
| **10** | **フィードバック & CSAT** | チャット後の満足度評価、センチメント分析、不満タグ分類 | [4K 画像を表示](screenshots/real-10-feedback.png) |
| **11** | **訪問者マップ** | 地域別アクセス状況を可視化する Leaflet インタラクティブ世界地図 | [4K 画像を表示](screenshots/real-11-map.png) |
| **12** | **ミーティング予約** | Google Calendar との双方向 OAuth 同期 & Google Meet リンク自動発行 | [4K 画像を表示](screenshots/real-12-meetings.png) |
| **13** | **受信専用メールボックス** | Resend による受信メールのチケット自動変換ルーティング | [4K 画像を表示](screenshots/real-13-mailbox.png) |
| **14** | **チーム通知** | Slack、Email、SMS へのインシデント・アラート通知ポリシー | [4K 画像を表示](screenshots/real-14-notifications.png) |
| **15** | **監査ログ** | IP アドレスと操作者メールを記録する追記専用の監査トレイル | [4K 画像を表示](screenshots/real-15-audit-log.png) |
| **16** | **アナリティクス** | チケット自己解決率、応答速度、トークン消費ヒートマップ | [4K 画像を表示](screenshots/real-16-analytics.png) |
| **17** | **埋め込み & 連携** | React、Next.js、WordPress 向け埋め込みコード & 許可ドメイン設定 | [4K 画像を表示](screenshots/real-17-embed-integrate.png) |
| **18** | **音声エージェント** | LiveKit WebRTC スタジオ、動的ビジュアライザー & 各種 SDK コード | [4K 画像を表示](screenshots/real-18-voice-agent.png) |
| **19** | **FastMCP サーバーハブ** | Claude Desktop、Cursor、Antigravity 向けの 65 ツール & 8 リソース | [4K 画像を表示](screenshots/real-19-mcp.png) |
| **20** | **開発者 API** | スコープ付き API キー (`chatty_sk_...`) & 多言語 SDK スニペット | [4K 画像を表示](screenshots/real-20-developer-api.png) |
| **21** | **請求 & クォータ** | Stripe ポータル、クォータ台帳、アフィリエイト・紹介プログラム | [4K 画像を表示](screenshots/real-21-billing.png) |
| **22** | **エージェント設定** | 厳格なベクトル回答制限、PII 自動マスキング、BYOK 暗号化保管 | [4K 画像を表示](screenshots/real-22-agent-settings.png) |

</details>

---

## ✨ 機能

- 🔌 **7 チャネル・オムニチャネルハブ** — WhatsApp Cloud API、Facebook Messenger、Instagram Direct、TikTok ビジネスメッセージ、Telegram Bot、Twilio 双方向 SMS（TCPA 配信停止自動処理付き）、サポート受信用メール（引用履歴自動トリミング付き）による実用レベルのネイティブメッセージング。
- 🗺️ **ビジュアル会話フロービルダー** — ドラッグ＆ドロップ対応キャンバス（`@xyflow/react`）による時間帯条件分岐（例：午後 6:00 前と午後 6:00 以降で動的にオファーを変更）、リード獲得、カレンダー予約、HTTP Webhook、プラットフォーム判定、および AI Flow Copilot。
- ⚡ **リアルタイム有人引き継ぎ (ヒューマンテイクオーバー) & 受信トレイ** — Server-Sent Events (SSE) によるリアルタイムストリーミング受信トレイ。オペレーターはワンクリックで AI ボットを停止し、WhatsApp、Instagram、TikTok、SMS へ直接チャット返信可能。
- 🛒 **WooCommerce & マルチモーダル RAG** — WooCommerce ストアとの直接同期（注文状況照会、在庫リアルタイム確認、カートリンク生成）に加えて、PDF、DOCX、CSV、TXT の取り込み、Web クローリング、画像のマルチモーダルコンテキスト解釈に対応。
- 🎙️ **LiveKit リアルタイム音声エージェント** — WebRTC による超低遅延双方向音声会話、5 種類の動的オーディオビジュアライザー（`wave`, `bar`, `grid`, `radial`, `aura`）、リアルタイム文字起こし、パイプラインおよびリアルタイム直接音声モデル、全プラットフォーム向けネイティブ SDK（Web, React, iOS, Android, Flutter, React Native）。
- 💬 **埋め込み可能チャットウィジェット** — `<script>` タグ 1 行で導入可能。SSE ストリーミング返答、Shadow DOM による CSS 干渉ゼロの高品質レンダリング。
- 📚 **RAG ナレッジハブ** — PostgreSQL `pgvector`、HNSW インデックス、ハイブリッド検索（語彙 + ベクトル）による高度な意味検索。
- 🛠️ **自律型ツール呼び出し (Tool-calling)** — ミーティング予約（Google Meet, Microsoft Teams, Zoom）、リード情報の自動抽出、カレンダー空き枠確認を自動実行。
- 🔑 **Bring Your Own Key (BYOK)** — デフォルトで Gemini 無料枠を利用可能。ボット単位で OpenAI / Anthropic / Groq の API キーを AES-128 暗号化して設定可能。
- 🤖 **65 ツール FastMCP サーバー** — Claude Desktop、Cursor、Codex、Antigravity から OAuth 2.0 / API キー認証を介してダッシュボード全体をプログラム制御（音声スタジオ設定、スクリーンショットテレメトリ、自律ワークフローを含む）。
- 📊 **5 つの柱のスコアカード** — コンバージョン、自己解決率、回答精度、信頼性、CSAT を A〜F で独立監査。
- 🎯 **プロアクティブ・キャンペーン** — ユーザーの行動トリガー（離脱意図、滞在時間、スクロール率）に基づくタイムゾーン連動の配信計画。
- 🐳 **ワンコマンド・セルフホスト** — `docker compose up` を実行して Supabase に接続するだけで 60 秒で起動。

---

## 🔌 7 チャネル・オムニチャネルハブ

Chatty は、主要な顧客コミュニケーションプラットフォームすべてを単一の統合ワークスペースに集約します。各チャネルからのメッセージは即座に共通の内部イベント形式に正規化され、ビジュアルフロー、AI ブレイン、有人オペレーターがシームレスに対話可能です。

| チャネル | プロトコル / プロバイダー | ペイロード & UI コントロール | Webhook 認証方式 | セッション接頭辞 | 有人引き継ぎ |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **WhatsApp** | Meta Cloud API | テキスト、メディア、テンプレート、ボタン（最大3件）、リスト | `X-Hub-Signature-256` (HMAC-SHA256) | `wa:` | ✅ リアルタイム |
| **Messenger** | Meta Graph API | テキスト、添付ファイル、クイックリプライ、ポストバック | `X-Hub-Signature-256` (HMAC-SHA256) | `fb:` | ✅ リアルタイム |
| **Instagram DM** | Meta Graph API | ダイレクトメッセージ、ストーリーズメンション、クイックリプライ | `X-Hub-Signature-256` (HMAC-SHA256) | `ig:` | ✅ リアルタイム |
| **TikTok** | TikTok Business Messaging | テキスト、クイックリプライボタン（最大3件） | タイムスタンプ付き HMAC (`t=...,s=...`) | `tt:` | ✅ リアルタイム |
| **Telegram** | Telegram Bot API | テキスト、Markdown、動的複数行インラインキーボード | `X-Telegram-Bot-Api-Secret-Token` | `tg:` | ✅ リアルタイム |
| **双方向 SMS** | Twilio Messaging | プレーンテキスト、TCPA 配信停止 (STOP/UNSUBSCRIBE) 自動処理 | Twilio 暗号署名 (Base64) | `sms:` | ✅ リアルタイム |
| **サポート受信用メール** | Resend / SendGrid Inbound | クリーン本文抽出、過去の引用メール自動除去 | Webhook Secret チャレンジ | `email:` | ✅ リアルタイム |

### アーキテクチャの要点
* **ゼロレイテンシ受信キュー:** Webhook 受信エンドポイントは暗号署名を検証し、40ms 未満で `HTTP 200 OK` を即座に返します。これにより、AI が推論を行っている間に Meta や TikTok がタイムアウト（3秒）と判定して引き起こすリトライの嵐を防止します。
* **UI ボタンの自動正規化:** インタラクティブボタンはチャネルの特性に合わせて自動適応されます（Telegram ではインラインキーボードグリッド、WhatsApp や TikTok では先頭3件のクイックリプライボタン、SMS では「返信 [1] または [2]」のような番号形式テキストに自動変換）。
* **24 時間メッセージングウィンドウの管理:** Meta 系チャネルにおける `last_inbound_at` を追跡し、有効期限切れエラー (`131047`) を未然に防止。ウィンドウ終了後は自動的に事前承認済み WhatsApp テンプレートへフォールバックします。
* **TCPA コンプライアンス・インターセプター:** 規制対象キーワード（`STOP`, `UNSUBSCRIBE`, `CANCEL`, `QUIT`）を検知すると、自動化を確実に停止し配信停止登録を完了します。
* **非破壊的シークレット保管:** 認証情報と検証トークンは暗号化された JSONB カラム（`omnichannel_config`）に安全に保持され、特定チャネルの更新時に他チャネルの設定を上書き・消去しません。

---

## 🗺️ ビジュアル会話フロービルダー & 条件付きランタイム

Chatty には `@xyflow/react` をベースにしたノードベースの会話設計エンジンが組み込まれています。ビジネス上重要な厳密なフロー（リード獲得、商談予約、限定キャンペーン）を決定論的に定義しつつ、自由な質問には AI に自律回答させることができます。

* **時間帯に応じた動的条件分岐:** 条件ノードは 12 時間および 24 時間形式の時間比較をサポート（例：`< 18:00` vs `>= 18:00`）。午後 6:00 前に問い合わせた訪問者には「午後 6:30 まで有効な早期割引」を提示し、夜間の訪問者には「午後 9:00 まで有効」とするような時間連動型マーケティングを容易に構築できます。
* **プラットフォーム & デバイス判定:** ノードは受信リクエストのメタデータ（`platform`, `channel`, `device`, `os`）を判別し、チャネル別の回答やルーティングを実施できます。
* **豊富なフローノード一覧:**
  * **Trigger:** イベント発火（`session.started`, `message.user`, `lead.created`）。
  * **Message & Question:** リッチ Markdown と選択肢ボタンの表示。
  * **Condition:** 入力テキスト、変数、タグ、時間帯に基づく条件分岐。
  * **Lead Capture:** 氏名、メールアドレス、電話番号、会社名を CRM 台帳に登録。
  * **Book Meeting:** Google Meet、Microsoft Teams、Zoom の予約リンクを自動生成。
  * **Webhook:** SSRF 保護とリトライ制御を備えたセキュアな外部 HTTP 通信。
  * **AI Fallback:** ナレッジベースの RAG 検索へスムーズに会話を委譲。

---

## 🛒 WooCommerce ストア連携 & マルチモーダル RAG

Chatty は WooCommerce ストアと直接連携し、対話型コマース体験を提供します：

* **リアルタイム注文追跡:** 注文 ID または請求先メールアドレスを入力することで、配送状況や追跡番号を即座に回答します。
* **在庫 & 商品のリアルタイム検索:** WooCommerce REST API を介して、在庫の有無、通常価格・セール価格、商品概要を直接照会します。
* **マルチフォーマット文書 RAG:** PDF、DOCX、CSV 表データ、プレーンテキスト、Web サイトのサイトマップ巡回取り込みに対応。PostgreSQL `pgvector` と HNSW インデックスによるハイブリッド意味検索を実行します。
* **画像マルチモーダル認識:** 訪問者が商品の写真やトラブル画面のスクリーンショットをアップロードして視覚的な問い合わせを行うことができます。

---

## 🎙️ LiveKit リアルタイム音声エージェント & SDK

Chatty は、[LiveKit WebRTC](https://livekit.io) を活用した超低遅延リアルタイム音声エージェントを標準搭載しています。全二重双方向会話、5 種類の動的オーディオビジュアライザー、リアルタイム文字起こし字幕カード、ナレッジベース検索連携、カレンダー予約、セッションメモリ分離に対応しています。

### アーキテクチャ構成：モジュラーパイプライン vs マルチモーダルリアルタイム

- **モジュラーパイプラインモード (Modular Pipeline)**：
  - **音声認識 (STT)**：Google Cloud Speech Chirp、Deepgram Nova-3、OpenAI Whisper、Cartesia、Soniox、AssemblyAI。
  - **推論言語モデル (LLM)**：Gemini 2.5 Flash、Claude 3.5 Sonnet、GPT-4o-mini、OpenRouter。
  - **音声合成 (TTS)**：Google Gemini TTS、Cartesia Sonic、ElevenLabs、Deepgram Aura、OpenAI Audio、Fish Audio。
- **マルチモーダルリアルタイムモード (Multimodal Realtime)**：Gemini Live 2.5 Flash Native Audio、OpenAI Realtime、Azure OpenAI、Ultravox などによるエンドツーエンド直接音声通信。

### 5 種類の動的オーディオビジュアライザー

ダッシュボード設定または SDK プロパティから選択可能：
- `wave` — 滑らかな正弦波アニメーション。
- `bar` — 周波数イコライザースペクトラムバー。
- `grid` — 音声エネルギーに反応する LED マトリクスグリッド。
- `radial` — 音量に応じて同心円状に広がるパルスリング。
- `aura` — 呼吸するように輝く大気オーラ（ピッチ反応対応）。

### マルチプラットフォーム SDK マトリックス

| プラットフォーム / SDK | コンポーネント / 埋め込みタグ | プログラム制御・トークン |
| :--- | :--- | :--- |
| **HTML Script** (`widget.js`) | `<script src="..." data-mode="voice" data-display="modal"></script>` | `window.Chatty.openVoice()` |
| **React / Next.js** (`@personaliai/react-widget`) | `<VoiceAgent botId="..." />` または `<ChattyWidget mode="voice" />` | `useChatty().openVoice()` |
| **iOS** (SwiftUI) | `ChattyVoiceView(botId: "...")` | `ChattyClient.createVoiceToken(...)` |
| **Android** (Compose) | `ChattyVoiceScreen(botId = "...")` | `ChattyApi.createVoiceToken(...)` |
| **Flutter** | `ChattyVoiceScreen(botId: '...')` | `ChattyClient.createVoiceToken(...)` |
| **React Native** | `<ChattyVoiceView botId="..." />` | `ChattyClient.createVoiceToken(...)` |
| **Iframe 埋め込み** | `<iframe src="https://chatty.personaliai.com/embed/{botId}?voice=only"></iframe>` | 独立したブラウザホスト画面 |

### 音響エンジニアリングとエコー抑制

- **ハードウェア加速 WebRTC AEC**：ブラウザおよびモバイルクライアント側で音響エコーキャンセラー（AEC）、ノイズ抑制、自動ゲイン制御を最適化ネゴシエーション。
- **サーバー側二重フィルタリングの排除**：LiveKit ワーカーランタイムから不要なサーバー側 AEC フィルターを削除し、不快な金属音、コムフィルタリング、ロボット声アーティファクトを完全に防止。
- **セッションメモリのリセット**：専用リセットエンドポイント（`POST /api/widget/voice/reset`）により、過去の会話履歴を DB から消去し、ルーム Nonce を再生成してコンテキスト汚染を完全に遮断。

---

## アーキテクチャ

公開リポジトリは標準的な構成を採用しています。`frontend/` には Next.js による管理ダッシュボード、埋め込みウィジェット、ビジュアルフロービルダーが含まれ、`backend/` には FastAPI API、オムニチャネルアダプター、バックグラウンドワーカー、およびデータベースマイグレーションが含まれます。

### 全チャネル統合・デュアルエンジンアーキテクチャ

```mermaid
flowchart TB
    subgraph INBOUND["オムニチャネル受信 & クライアント"]
        direction LR
        WIDGET["Web ウィジェット & LiveKit 音声"]
        WA["WhatsApp Cloud API"]
        META["Messenger & Instagram Direct"]
        TT["TikTok ビジネスメッセージ"]
        TG["Telegram Bot"]
        SMS["Twilio 双方向 SMS"]
        MAIL["サポート受信用メール"]
    end

    subgraph GATEWAY["セキュリティ & Webhook 受信ゲートウェイ"]
        direction TB
        HMAC["暗号署名検証 (HMAC-SHA256 / トークン)"]
        ACK["40ms 未満の HTTP 200 OK 即時応答"]
        QUEUE["非同期重複排除 & イベントパイプライン"]
        DLP["リアルタイム PII / 機密データ自動マスキング"]
    end

    subgraph CORE["デュアルエンジン実行コア"]
        direction LR
        subgraph FLOW["ビジュアルフロービルダー・ランタイム"]
            FNODES["フローノード (@xyflow/react)"]
            FCOND["時間帯 & 条件付き分岐"]
            FLEAD["リード獲得 & CRM 同期"]
            FBOOK["カレンダー予約リンク発行"]
        end
        subgraph BRAIN["マルチモーダル RAG & AI 推論"]
            VECT["pgvector ハイブリッドセマンティック検索"]
            KB["ナレッジドキュメント (PDF/DOCX/CSV/TXT)"]
            WOO["WooCommerce ストア & 注文 API"]
            LLM["BYOK LLM (Gemini / Claude / GPT / Groq)"]
        end
    end

    subgraph TAKEOVER["有人オペレーター管理デスク"]
        direction TB
        SSE["リアルタイム SSE イベントストリーム"]
        INBOX["統合ヘルプデスク & SLA 受信トレイ"]
        HUMAN["ワンクリック有人エージェント引き継ぎ"]
    end

    subgraph OUTBOUND["チャネル UI 正規化 & 配信"]
        direction LR
        OUT_WA["WhatsApp 24h ウィンドウ & テンプレート"]
        OUT_TT["TikTok クイックリプライ (最大3件)"]
        OUT_TG["Telegram 動的インラインキーボード"]
        OUT_SMS["SMS 番号選択肢 & TCPA 配信停止処理"]
        OUT_MAIL["引用文自動除去・スレッドメール返信"]
        OUT_WEB["ウィジェット・ストリーム表示 & リッチカード"]
    end

    INBOUND --> GATEWAY
    HMAC --> ACK
    ACK --> QUEUE
    QUEUE --> DLP
    DLP --> CORE

    CORE <--> TAKEOVER
    CORE --> OUTBOUND
    TAKEOVER --> OUTBOUND
```

### コンポーネント & データアーキテクチャ

```mermaid
flowchart TB
    classDef actor fill:#f8fafc,stroke:#64748b,color:#0f172a
    classDef edge fill:#eff6ff,stroke:#2563eb,color:#1e3a8a
    classDef app fill:#ecfdf5,stroke:#059669,color:#064e3b
    classDef data fill:#f0fdfa,stroke:#0f766e,color:#134e4a
    classDef integration fill:#fff7ed,stroke:#ea580c,color:#7c2d12
    classDef deploy fill:#f5f3ff,stroke:#7c3aed,color:#4c1d95

    subgraph clients["クライアント & チャネル"]
        direction LR
        visitor(("Web サイト訪問者")):::actor
        operator(("サポートオペレーター")):::actor
        omni["WhatsApp · Messenger · IG · TikTok · TG · SMS · Email · MCP"]:::actor
    end
    subgraph edge["パブリックエッジ"]
        direction LR
        tls["TLS · ドメイン許可リスト · レートリミット"]:::edge
        web["Next.js 15+ フロントエンド (App Router)"]:::app
    end
    subgraph runtime["Chatty ランタイム"]
        direction LR
        api["FastAPI バックエンド · フローエンジン · RAG · Webhook"]:::app
        mcp["FastMCP 65ツール サーバー (OAuth 2.0 / API キー)"]:::app
    end
    subgraph managed["マネージド Supabase レイヤー"]
        direction LR
        auth["Supabase Auth"]:::data
        postgres["Postgres + pgvector · JSONB 設定 · RLS"]:::data
        storage["Supabase Storage (ドキュメント & 音声)"]:::data
        realtime["Supabase Realtime"]:::data
    end
    subgraph integrations["外部サービス連携"]
        direction TB
        llm["LLM プロバイダー (Gemini / OpenAI / Anthropic / Groq)"]:::integration
        calendar["Google Calendar & Microsoft 365"]:::integration
        wooCommerce["WooCommerce ストア API"]:::integration
        voiceLiveKit["LiveKit WebRTC 音声メッシュ"]:::integration
    end
    subgraph targets["デプロイ先ターゲット"]
        direction LR
        docker["Docker Compose / VPS"]:::deploy
        railway["Railway"]:::deploy
        render["Render Blueprint"]:::deploy
        cloudrun["Google Cloud Run"]:::deploy
    end

    visitor --> tls
    operator --> web
    omni --> api
    tls --> web
    web -->|HTTPS| api
    api --> auth
    api --> postgres
    api --> storage
    api --> realtime
    api --> llm
    api --> calendar
    api --> wooCommerce
    api --> voiceLiveKit
    targets -. 実行 .-> runtime
    linkStyle default stroke:#64748b,stroke-width:1.5px
```

```
chatty/
├── frontend/         Next.js - ダッシュボード、埋め込みウィジェット、widget.js ローダー
├── backend/          FastAPI - チャット/RAG/予約/チャネル連携/OAuth/MCP API
│   ├── app/          ルーター、コアモジュール (認証/セキュリティ/DBヘルパー)、スキーマ
│   ├── plugins/      Google/Microsoft連携、RAG、ウィジェットオーケストレーション
│   ├── supabase/     データベーススキーマおよびマイグレーション (順次適用)
│   ├── scripts/      apply_migrations.py などの運用スクリプト
│   └── tests/        pytest スモークテストおよびユニットテスト
└── docker-compose.yml
```

---

## 📋 動作要件

| ツール / サービス | 必要バージョン | 用途 |
|---|---|---|
| [Docker](https://docs.docker.com/get-docker/) + Docker Compose | 24+ | クイックスタートおよび標準デプロイ（推奨環境） |
| [Python](https://www.python.org/downloads/) | 3.11+ / 3.13+ | Docker を使用しない場合のバックエンド開発環境 |
| [Node.js](https://nodejs.org/) | 20+ | Docker を使用しない場合のフロントエンド開発環境 |
| [Supabase](https://supabase.com) アカウント | 無料枠 (Free tier) | データベース (Postgres + Auth + Storage + Realtime) |
| [Google AI Studio](https://aistudio.google.com/apikey) API キー | 無料枠 (Free tier) | デフォルト LLM (Gemini) |

---

## 🚀 クイックスタート (Docker Compose)

リポジトリのクローンからインスタンス起動までの最短手順です。

```bash
git clone --recurse-submodules https://github.com/PersonaliAI/chatty.git
cd chatty

# 1. 作成済みの Supabase プロジェクトにデータベースマイグレーションを適用
cd backend && pip install psycopg2-binary
python scripts/apply_migrations.py "postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres"
cd ..

# 2. 環境変数の設定
cp backend/.env.example backend/.env        # Supabase と Gemini の認証情報を入力
cp frontend/.env.example frontend/.env      # Supabase URL と anon キーを入力
cp .env.example .env                        # Docker ビルド用の NEXT_PUBLIC_* 値を設定

# 3. コンテナの起動
docker compose up --build backend frontend
```

- **管理ダッシュボード**: `http://localhost:3000` — アカウント登録してボットを作成すると、ウィジェット埋め込みコードが即時発行されます。
- **バックエンド API**: `http://localhost:8000`（対話型ドキュメント: `http://localhost:8000/docs`）。

---

## MCP サーバーとエージェント制御

Chatty には [Model Context Protocol (FastMCP)](https://modelcontextprotocol.io) 仕様に完全準拠した公式サーバーが組み込まれており、Claude Desktop、Cursor、Codex、Antigravity から自然言語の対話のみでシステム全体を自律運用可能です。

- **認証**: PKCE（RFC 7636）必須の OAuth 2.0 認可コードフローおよび Scoped API キー (`chatty_sk_...`) に対応。
- **65 種類のツール**（12 カテゴリ）：ボットライフサイクル、デザインカスタマイズ、ビジュアルフロービルダー、プロアクティブキャンペーン、ナレッジベース & RAG、受信トレイ & 有人引き継ぎ、カレンダー予約、分析、BYOK ガードレール設定、および LiveKit 音声スタジオ。
- **リアルタイムリソース & プロンプト**: `chatty://bots/{bot_id}/voice-config` でリアルタイムな音声設定状態を取得し、`chatty://dashboard/screenshots` でダッシュボード画面を取得可能。

MCP クライアントの設定例:

```json
{
  "mcpServers": {
    "chatty": {
      "url": "https://your-backend-domain/mcp"
    }
  }
}
```

---

## 💻 ローカル開発 (Docker を使わない場合)

**バックエンド:**
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**フロントエンド:**
```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 テストと CI

`.github/workflows/ci.yml` が `main` ブランチへのプッシュおよびプルリクエストごとに自動実行されます：
- **バックエンド**: `python -m compileall` による構文チェック、`pytest` による全テストケース実行 (`backend/tests/`)。
- **フロントエンド**: TypeScript 型検査、ESLint、ビルドチェック。

---

## 🇪🇺 GDPR & エンタープライズデータプライバシー

Chatty は **EU 一般データ保護規則 (GDPR / Regulation (EU) 2016/679)** および **ePrivacy 指令 (2002/58/EC)** に厳格に準拠して設計されています：

* **リアルタイム個人情報保護 (DLP):** PII スクラバー (`backend/app/services/pii_service.py`) が、Luhn アルゴリズム検証済みクレジットカード番号、米社会保障番号 (SSN)、漏洩 Bearer トークン、欧州 IBAN 銀行口座番号 (ISO 7064) を自動検知し、Web ウィジェットおよび全オムニチャネル（WhatsApp、Instagram、Telegram、SMS、Email）上で即座にマスキングします。
* **忘れられる権利 (削除権 / 第17条):**
  - 管理者エンドポイント `DELETE /api/admin/inbox/contacts/{id}` により、PostgreSQL ストアドプロシージャ `chatty_erase_contact()` を実行し、会話履歴、リード、セッション情報を安全に完全消去します。
  - Web サイト訪問者は、チャットウィジェット内のゴミ箱アイコンから自身のセッションとローカルストレージをいつでも自主消去可能です。
* **暗号化とテナント分離 (第32条):**
  - 機密性の高い BYOK API キーや OAuth トークンは、Fernet (AES-128-CBC + HMAC-SHA256) により保管時に暗号化されます。
  - すべての通信は TLS 1.3 で保護され、Supabase の Row-Level Security (RLS) によりテナントデータが厳密に分離されます。
* **AI 基盤モデル学習不使用の保証:** 顧客の会話やアップロードされた文書データは、リアルタイム推論のためだけに一時メモリ内で処理され、パブリックな AI 基盤モデルの再学習に利用されることは一切ありません。
* **法的合意文書:**
  - 欧州委員会標準契約条項 (SCC) を組み込んだ [データ処理契約 (DPA)](frontend/src/app/(legal)/dpa/page.tsx)。
  - 国際転送セーフガードと SOC 2 / ISO 27001 認証を明記した公開 [再委託先レジストリ](frontend/src/app/(legal)/subprocessors/page.tsx)。

---

## 🔒 セキュリティ

セキュリティ上の脆弱性を発見された場合は、**公開の Issue を作成しないでください**。GitHub の脆弱性非公開報告窓口（リポジトリの **Security** タブ → **Report a vulnerability**）をご利用ください。迅速に対応いたします。

---

## 🤝 コントリビューション

イシューの起票やプルリクエストを歓迎します。[CONTRIBUTING.md](CONTRIBUTING.md) を参照して、開発環境のセットアップや注力領域（STT / TTS プロバイダー、新しい外部チャネル連携、ドキュメント改善など）をご確認ください。

---

## 📄 ライセンス

本プロジェクトは [MIT ライセンス](LICENSE) の下で公開されています。商用利用、フォーク、改変、自社ホストなど自由に利用可能です。

---

<div align="center">

⭐ **Chatty がお役に立ちましたら、GitHub リポジトリのスターをお願いいたします**

</div>
