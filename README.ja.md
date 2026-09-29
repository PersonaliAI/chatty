<div align="center">

<img src="https://raw.githubusercontent.com/PersonaliAI/chatty/main/backend/assets/chatty-icon.png" alt="Chatty" width="88" /> <img src="https://raw.githubusercontent.com/PersonaliAI/chatty/main/backend/assets/readme-icon.png" alt="Chatty" width="88" />

# Chatty by PersonaliAI

**Chatty by PersonaliAI — オープンソースAIカスタマーサポート：チャットウィジェット + リアルタイム音声エージェント + 完全なMCPサーバー、独自のナレッジベースに基づいて動作。**

Supabase Auth、Postgres、Storage、Realtime をマネージド環境に保ちながら、独自のホスト上でアプリケーションコンテナを実行できます。VPS、Railway、Render、その他の Docker ホスト環境で、稼働中の Supabase プロジェクトに影響を与えることなく動作します。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/PersonaliAI/chatty/actions/workflows/ci.yml/badge.svg)](https://github.com/PersonaliAI/chatty/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](frontend)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.11-009688?logo=fastapi&logoColor=white)](backend)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![LiveKit](https://img.shields.io/badge/Voice-LiveKit-FF6600)](https://livekit.io)
[![MCP](https://img.shields.io/badge/Agent%20Control-MCP-8b5cf6)](#mcp-サーバーとエージェント制御)
[![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[English](README.md) · [简体中文](README.zh-CN.md) · **日本語** · [Español](README.es.md)

[Chatty Cloud (ホスト型)](https://chatty.personaliai.com) · [ドキュメント](https://docs.chatty.personaliai.com) · [スコアカード (A-F)](docs/SCORECARD.md) · [テンプレート](templates/README.md) · [導入事例](case_studies/README.md) · [埋め込みガイド](docs/WIDGET_INTEGRATION.md) · [クイックスタート](#-クイックスタート-docker-compose) · [MCPサーバー](#mcp-サーバーとエージェント制御) · [コミュニティ動向](docs/traction.md)

</div>

---

## 目次

- [Chattyを選ぶ理由](#chattyを選ぶ理由)
- [パフォーマンス・スコアカード (A-F 評価)](docs/SCORECARD.md)
- [業界別スターターテンプレート](templates/README.md)
- [導入事例と実証ベンチマーク](case_studies/README.md)
- [ウィジェット埋め込みガイド (3行コード)](docs/WIDGET_INTEGRATION.md)
- [✨ 機能](#-機能)
- [アーキテクチャ](#アーキテクチャ)
- [📋 動作要件](#-動作要件)
- [🚀 クイックスタート (Docker Compose)](#-クイックスタート-docker-compose)
- [ステップ別セルフホスト概要](#ステップ別セルフホスト概要)
- [ローカル開発 (Docker を使わない場合)](#-ローカル開発-docker-を使わない場合)
- [MCP サーバーとエージェント制御](#mcp-サーバーとエージェント制御)
- [環境変数リファレンス (概要)](#環境変数リファレンス-概要)
- [🤝 コントリビューション](#-コントリビューション)
- [📄 ライセンス](#-ライセンス)

## Why Chatty (Chattyを選ぶ理由)

ホスト型の商用チャットボットSaaSの多くは、シート単位やメッセージ数に応じた課金を行い、会話データをベンダーのサーバーに囲い込みます。Chattyはオープンコアです。無料で完全にセルフホストすることも、インフラ運用の手間を省きたい場合はこのリポジトリをそのままホストした [Chatty Cloud](https://chatty.personaliai.com) を利用することもできます。

どちらを選んでも、ストリーミングチャット、リアルタイム音声エージェント、独自ドキュメントに基づくRAG、ミーティング予約、リード獲得、WhatsApp/Slack連携、そしてAIエージェントがダッシュボード全体を操作できる完全な [MCPサーバー](#mcp-サーバーとエージェント制御) など、同一の機能を利用可能です。

|  | クローズドソースのSaaSチャットボット | **Chatty** |
|---|---|---|
| **会話データの保管先** | 常にベンダー側のサーバーに保持 | あなた自身の Supabase プロジェクト（セルフホストまたは Chatty Cloud のどちらでも） |
| **料金体系** | シート単位／メッセージ課金、無料枠なし | 無料でセルフホスト可能、または分かりやすい定額の Chatty Cloud ホストプラン |
| **利用可能なLLM** | ベンダー指定のモデルに制限 | **BYOK (Bring Your Own Key)** — デフォルトは Gemini、または OpenAI / Anthropic / OpenRouter などを選択可能 |
| **音声エージェント** | 通常は別料金の高額プラン | 標準搭載。チャットウィジェットと同一のナレッジベースを共有 |
| **エージェント・自動化アクセス** | 通常は利用不可、または有料アドオン | **完全な MCP サーバーを標準同梱** — OAuth 2.0 で保護された 55 種類のツール |
| **ソースコード** | 非公開 (Closed) | **MIT ライセンス** — フォーク、コード監査、カスタマイズ、自由な環境での運用が可能 |

## ✨ 機能

- 💬 **埋め込み可能チャットウィジェット** — `<script>` タグ1行で導入可能。ストリーミング応答に対応し、あらゆるWebサイトで動作
- 🎙️ **リアルタイム音声エージェント** — LiveKit を活用した電話のような双方向音声通話。チャットウィジェットと同一の頭脳・ナレッジベースを共有
- 📚 **独自ナレッジベースによるRAG** — PDF / DOCX / PPTX / XLSX のアップロードやURLクローリングに対応。テキストの自動チャンク分割およびベクトル埋め込み（Embedding）を実行
- 🛠️ **ツール呼び出し (Tool-calling)** — ミーティング予約（Google Meet / Microsoft Teams / Zoom リンクの発行）、リード獲得、カレンダー空き枠の確認を自動化
- 🔌 **オムニチャネル対応** — Webウィジェットに加え、WhatsApp および Slack にも対応
- 🔑 **BYOK (モデル持ち込み)** — デフォルトで Gemini（寛容な無料枠あり）をサポート。ボットごとに OpenAI / Anthropic / OpenRouter の API キーを設定可能
- 🤖 **MCP サーバー** — Claude、ChatGPT、その他の MCP クライアントを接続し、会話からダッシュボード全体を操作可能。ボット作成、フロー編集、キャンペーン実行、リード管理、音声設定など、OAuth 2.0 + PKCE で保護された 55 種類のツールを提供（詳細は [MCP サーバーとエージェント制御](#mcp-サーバーとエージェント制御) を参照）
- 📊 **統合ダッシュボード** — ボット管理、受信トレイ・会話ログ、ナレッジソース、予約ルール、プロアクティブキャンペーン、外部チャネル連携を一元管理
- 🐳 **ワンコマンドでマネージドセルフホスト** — `docker compose up` を実行し、Supabase プロジェクトに接続するだけで即座に起動

## アーキテクチャ

公開リポジトリは標準的なアプリケーション構成を採用しています。`frontend/` には Next.js ダッシュボードとウィジェットが含まれ、`backend/` には FastAPI API、ワーカー、外部連携機能、データベースマイグレーションが含まれます。アプリケーションはマネージド Supabase プロジェクトと連携して動作します（Chatty Cloud と同一の構成です）。オプションの音声ワーカーは、LiveKit Cloud または `backend/voice-agent` 配下の独立したセルフホスト LiveKit メディアプレーンスタックを利用できます。この構成は Supabase、Postgres、Auth、Storage、Chatty API を置き換えるものではありません。

```mermaid
flowchart TB
    classDef actor fill:#f8fafc,stroke:#64748b,color:#0f172a
    classDef edge fill:#eff6ff,stroke:#2563eb,color:#1e3a8a
    classDef app fill:#ecfdf5,stroke:#059669,color:#064e3b
    classDef data fill:#f0fdfa,stroke:#0f766e,color:#134e4a
    classDef integration fill:#fff7ed,stroke:#ea580c,color:#7c2d12
    classDef deploy fill:#f5f3ff,stroke:#7c3aed,color:#4c1d95

    subgraph clients["Clients and channels"]
        direction LR
        visitor(("Website visitor")):::actor
        operator(("Workspace operator")):::actor
        channels["WhatsApp · Slack · MCP"]:::actor
    end
    subgraph edge["Public edge"]
        direction LR
        tls["TLS · domains · rate limits"]:::edge
        web["Next.js frontend"]:::app
    end
    subgraph runtime["Chatty runtime"]
        direction LR
        api["FastAPI API · chat · RAG · webhooks"]:::app
        voice["Voice worker · LiveKit Agents"]:::app
    end
    subgraph managed["Managed Supabase — default profile"]
        direction LR
        auth["Supabase Auth"]:::data
        postgres["Postgres + pgvector · RLS"]:::data
        storage["Supabase Storage"]:::data
        realtime["Supabase Realtime"]:::data
    end
    subgraph integrations["Optional integrations"]
        direction TB
        llm["LLM providers"]:::integration
        calendar["Calendar providers"]:::integration
        channelsApi["WhatsApp / Slack"]:::integration
        livekit["LiveKit Cloud or self-hosted"]:::integration
        billing["Billing + webhooks"]:::integration
    end
    subgraph targets["Deployment targets"]
        direction LR
        docker["Docker Compose / VPS"]:::deploy
        railway["Railway"]:::deploy
        render["Render Blueprint"]:::deploy
        heroku["Heroku-style host"]:::deploy
    end

    visitor --> tls
    operator --> web
    channels --> api
    tls --> web
    web -->|HTTPS| api
    api --> voice
    api --> auth
    api --> postgres
    api --> storage
    api --> realtime
    api --> llm
    api --> calendar
    api --> channelsApi
    voice --> livekit
    api --> billing
    targets -. runs .-> runtime
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
│   ├── voice-agent/  LiveKit 音声ワーカーエージェント + VPS向けセルフホスト Docker スタック
│   └── tests/        pytest スモークテストおよびユニットテスト
└── docker-compose.yml
```

### デプロイプロファイル

| プロファイル | データおよび認証サービス | 使用用途 |
|---|---|---|
| `managed_supabase` (デフォルト) | Supabase Auth、Postgres、Storage、pgvector、RLS | Chatty Cloud およびサポート対象のすべてのアプリケーションデプロイ |
| 音声メディアプレーン (オプション) | VPS 上の LiveKit + プライベート Redis | 音声メディア処理を独自の VPS 上に維持しつつ、アプリケーションデータは Supabase に保持 |

### 対応デプロイプラットフォーム

マネージド Supabase デプロイ構成は、2つの Docker サービス (API + フロントエンド) で構成されます。完全なプラットフォーム運用手順は [docs/SELF_HOST_MANAGED_SUPABASE.md](docs/SELF_HOST_MANAGED_SUPABASE.md) を参照してください。

| プラットフォーム | 公式デプロイガイド | リポジトリの対応状況 |
|---|---|---|
| ![Docker](https://img.shields.io/badge/Docker%20%2F%20VPS-2496ED?logo=docker&logoColor=white) | [Managed-Supabase Docker Compose](docker-compose.yml) | API + フロントエンドを**サポート済み**。前段にTLSリバースプロキシを配置してください。 |
| ![Railway](https://img.shields.io/badge/Railway-0B0D0E?logo=railway&logoColor=white) | [Railway Docker Compose ガイド](https://docs.railway.com/guides/docker-compose) | **2つのサービスとしてサポート済み**。APIとフロントエンドの Dockerfile を個別にマッピングします。 |
| ![Render](https://img.shields.io/badge/Render-46E3B7?logo=render&logoColor=111827) | [`render.yaml`](render.yaml) / [Render Blueprint リファレンス](https://render.com/docs/blueprint-spec) | **Blueprint 同梱**。APIとフロントエンドサービスを自動作成し、シークレットの設定を促します。 |
| ![Heroku](https://img.shields.io/badge/Heroku-430098?logo=heroku&logoColor=white) | [Heroku コンテナランタイム](https://devcenter.heroku.com/articles/container-registry-and-runtime) | **2つのコンテナアプリとしてサポート済み**。 |

## 📋 動作要件

| ツール / サービス | 必要バージョン | 用途 |
|---|---|---|
| [Docker](https://docs.docker.com/get-docker/) + Docker Compose | 24+ | クイックスタート（推奨環境） |
| [Python](https://www.python.org/downloads/) | 3.11+ | Docker を使用しない場合のバックエンド実行 |
| [Node.js](https://nodejs.org/) | 20+ | Docker を使用しない場合のフロントエンド実行 |
| [Supabase](https://supabase.com) アカウント | 無料枠 (Free tier) | データベース (Postgres + Auth + Storage + pgvector) |
| [Google AI Studio](https://aistudio.google.com/apikey) API キー | 無料枠 (Free tier) | デフォルト LLM (Gemini) |

その他（音声通話用の LiveKit、WhatsApp / Slack トークン、Google / Microsoft OAuth、Lemon Squeezy 決済、Sentry、Upstash Redis など）はすべて**任意（オプション）**です。環境変数を空にしておくだけで該当機能が無効化されるだけであり、システム全体の動作に影響はありません。

## 🚀 クイックスタート (Docker Compose)

リポジトリのクローンからインスタンス起動までの最短手順です。

```bash
git clone --recurse-submodules https://github.com/PersonaliAI/chatty.git
cd chatty

# オプションのプラグインやSDKチェックアウトは独立したサブモジュールです。
# 既存のクローンを更新する場合は以下を実行してください:
# git submodule update --init --recursive

# 1. 作成済みの Supabase プロジェクトにデータベーススキーマを適用
cd backend && pip install psycopg2-binary
python scripts/apply_migrations.py "postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres"
cd ..

# 2. 環境変数の設定
cp backend/.env.example backend/.env        # Supabase と Gemini のキーを入力
cp frontend/.env.example frontend/.env      # Supabase URL と anon キーを入力
cp .env.example .env                        # Docker ビルド用の NEXT_PUBLIC_* 値を設定

# 3. コンテナの起動
docker compose up --build backend frontend
```

ダッシュボード: `http://localhost:3000` — サインアップしてボットを作成すると、ボット設定画面からウィジェット埋め込み用スニペットが即座に生成されます。

## ステップ別セルフホスト概要

1. **Supabase の作成と設定**: [supabase.com](https://supabase.com) で無料プロジェクトを作成し、API 設定から Project URL、`anon` キー、`service_role` キーを取得します。
2. **スキーママイグレーションの実行**: `backend/scripts/apply_migrations.py` を実行して SQL マイグレーションを順次適用します（適用済みファイルは自動スキップされます）。
3. **LLM キーの取得**: [Google AI Studio](https://aistudio.google.com/apikey) で Gemini API キーを取得します（ボットごとに OpenAI や Anthropic などの BYOK も利用可能）。
4. **環境変数の編集**: `backend/.env`、`frontend/.env`、`.env` に取得した認証情報を設定します。
5. **起動と検証**: `docker compose up --build backend frontend` を実行し、`http://localhost:3000` でアカウント登録とボット作成をテストします。

詳細な手順、本番環境の構築、トラブルシューティングは [docs/SELF_HOST_MANAGED_SUPABASE.md](docs/SELF_HOST_MANAGED_SUPABASE.md) をご覧ください。

## 💻 ローカル開発 (Docker を使わない場合)

**バックエンド:**
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # macOS/Linux の場合: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**フロントエンド:**
```bash
cd frontend
npm install
npm run dev
```

**音声ワーカー (オプション):**
```bash
cd backend
python voice-agent/voice_worker.py dev
```

## MCP サーバーとエージェント制御

Chatty には完全な [Model Context Protocol](https://modelcontextprotocol.io) (MCP) サーバーが組み込まれています。Claude、ChatGPT、またはその他の MCP 対応クライアントを接続することで、管理画面をポチポチ操作する代わりに、自然な対話からダッシュボード全体の操作を実行できます。

- **認証**: 必須の PKCE（RFC 7636）、動的クライアント登録（RFC 7591）、認可サーバーメタデータ検出（RFC 8414）を備えた OAuth 2.0 認可コードフローを採用。設定ファイルに静的な API キーを貼り付ける必要はありません。
- **スコープ**: `read`, `write`, `knowledge`, `voice`, `actions`, `admin` — クライアントには明示的に付与された権限のみが許可されます。
- **55種類のツール**: ボットのライフサイクル、デザインカスタマイズ、ビジュアルフロービルダー、プロアクティブキャンペーン、音声エージェント、ナレッジベース & RAG、受信トレイと有人引き継ぎ、リード・カレンダー・予約、分析と自己修復、設定・ガードレール・BYOK・チーム RBAC の10カテゴリをカバー。
- **本番データと直接連携**: すべてのツールはダッシュボードと同じテーブルを読み書きし、シミュレーションではない実データを操作します。

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

## 環境変数リファレンス (概要)

すべての環境変数は [`backend/.env.example`](backend/.env.example) および [`frontend/.env.example`](frontend/.env.example) に詳細なコメント付きで記載されています。

- **バックエンド必須**: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_DB_HOST`, `SUPABASE_DB_PASSWORD`, `FUNCTION_SECRET`, `BYOK_ENCRYPTION_KEY`, `GEMINI_API_KEY`
- **バックエンド任意（機能別）**: LiveKit (音声), WhatsApp / Slack (外部連携), Google / Microsoft OAuth (カレンダー予約), Zoom (ミーティング発行), Sentry (エラー監視) など
- **フロントエンド必須**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_BACKEND_URL`

## 🤝 コントリビューション

イシューの起票やプルリクエストを歓迎します。まだ若いプロジェクトであり、改善の余地が多くあります。開発環境のセットアップや注力領域（STT / TTS プロバイダープラグインの追加、新しいチャネル連携、Docker Compose 以外のプラットフォーム向けデプロイガイド、ドキュメントの拡充など）については、[CONTRIBUTING.md](CONTRIBUTING.md) をご覧ください。

## 📄 ライセンス

本プロジェクトは MIT ライセンスの下で公開されています。詳細は [LICENSE](LICENSE) を参照してください。フォーク、商用利用、改変、自社ホストなど自由に利用可能です（クレジット表記は歓迎しますが、必須ではありません）。

---

<div align="center">

⭐ **Chatty が役立つなら、リポジトリにスターをお願いします**

</div>
