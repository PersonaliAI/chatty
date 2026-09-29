<div align="center">

<img src="https://raw.githubusercontent.com/PersonaliAI/chatty/main/backend/assets/chatty-icon.png" alt="Chatty" width="88" /> <img src="https://raw.githubusercontent.com/PersonaliAI/chatty/main/backend/assets/readme-icon.png" alt="Chatty" width="88" />

# Chatty by PersonaliAI

**Chatty by PersonaliAI — 开源AI客户支持平台：聊天组件 + 实时语音代理 + 完整MCP服务器，基于您自己的知识库。**

在您自有的主机上运行应用程序容器，同时享受由 Supabase 托管的 Auth、Postgres、Storage 和 Realtime 服务。同样的部署标准适用于 VPS、Railway、Render 或其他 Docker 主机，且无需改动已有的 Supabase 生产项目。

[English](README.md) · **简体中文** · [日本語](README.ja.md) · [Español](README.es.md)

<br />

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/PersonaliAI/chatty/actions/workflows/ci.yml/badge.svg)](https://github.com/PersonaliAI/chatty/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](frontend)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.11-009688?logo=fastapi&logoColor=white)](backend)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![LiveKit](https://img.shields.io/badge/Voice-LiveKit-FF6600)](https://livekit.io)
[![MCP](https://img.shields.io/badge/Agent%20Control-MCP-8b5cf6)](#mcp-服务器与智能体控制)
[![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Chatty Cloud (官方托管版)](https://chatty.personaliai.com) · [官方文档](https://docs.chatty.personaliai.com) · [性能评分卡](docs/SCORECARD.md) · [行业模版库](templates/README.md) · [案例研究](case_studies/README.md) · [组件嵌入](docs/WIDGET_INTEGRATION.md) · [快速开始](#-快速开始-docker-compose) · [MCP 服务器](#mcp-服务器与智能体控制) · [社区动态](docs/traction.md)

</div>

---

<p align="center">
  <img src="docs/assets/chatty-dashboard-overview.png" alt="Chatty Dashboard Overview" width="100%" />
</p>


## 目录

- [为什么选择 Chatty](#为什么选择-chatty)
- [性能评分卡 (A-F 审计)](docs/SCORECARD.md)
- [行业模版库与起步套件](templates/README.md)
- [企业案例研究与基准测试](case_studies/README.md)
- [三行代码组件嵌入指南](docs/WIDGET_INTEGRATION.md)
- [功能特性](#-功能特性)
- [架构](#架构)
- [环境依赖](#-环境依赖)
- [快速开始 (Docker Compose)](#-快速开始-docker-compose)
- [MCP 服务器与智能体控制](#mcp-服务器与智能体控制)
- [环境变量概览](#环境变量概览)
- [测试与持续集成](#-测试与持续集成)
- [安全策略](#-安全策略)
- [参与贡献](#-参与贡献)
- [开源协议](#-开源协议)

## 为什么选择 Chatty

绝大多数闭源客服聊天机器人 SaaS 均按席位或按消息量收费，并将对话数据封存在其自有服务器中。Chatty 采用开源核心模式：您可以完全自主免费私有化部署，或者在不想处理运维时选用 [Chatty Cloud](https://chatty.personaliai.com)（基于本仓库源码构建的官方托管服务）。无论选择哪种方式，您都将拥有同样强大的功能——流式对话、实时语音代理、基于自有文档的 RAG 检索增强、日程预约会议、销售线索捕获、WhatsApp/Slack 多渠道集成，以及一套完整的 [MCP 服务器](#mcp-服务器与智能体控制)，允许 AI 智能体直接替您操作整个后台管理仪表盘。

| 维度 | 闭源 SaaS 聊天机器人 | **Chatty** |
|---|---|---|
| **对话数据归属** | 始终存储在厂商的服务器上 | 存储在您自有的 Supabase 项目中（无论是自建还是使用 Chatty Cloud） |
| **收费模式** | 按坐席 / 按消息计费，通常无免费层 | 自由免费自托管，或选择透明清晰的 Chatty Cloud 托管方案 |
| **大语言模型 (LLM)** | 强绑定其特定模型 | **自带模型密钥 (BYOK)** —— 默认内置 Gemini，亦支持配置 OpenAI、Anthropic、OpenRouter |
| **语音代理** | 通常作为更昂贵的高级套餐提供 | 原生包含，与文本聊天共享同一知识库 |
| **Agent / 自动化集成** | 通常无开放接口或属于高价增购 | **原生内置完整 MCP 服务器** —— 55 项工具，OAuth 2.0 认证保护 |
| **代码与可控性** | 闭源黑盒 | **MIT 开源协议** —— 自由 Fork、安全审计、二次扩展，随处部署运行 |

## ✨ 功能特性

- 💬 **可嵌入式聊天组件** - 仅需一行 `<script>` 标签，支持流式打字机回复，兼容任何网站。
- 🎙️ **实时语音代理** - 基于 LiveKit 实现低延迟电话级双向语音互动，与聊天组件共享同等上下文认知。
- 📚 **基于自有知识库的 RAG** - 支持上传 PDF、DOCX、PPTX、XLSX 或抓取 URL 网页，自动切片、向量化并检索召回。
- 🛠️ **工具调用 (Tool-calling)** - 自动预约会议（生成 Google Meet / Microsoft Teams / Zoom 链接）、捕获销售线索与核对日历冲突。
- 🔌 **全渠道触达 (Omnichannel)** - 除了网页组件，原生支持 WhatsApp 与 Slack 渠道接入。
- 🔑 **自带密钥 (BYOK)** - 默认采用 Google Gemini（提供慷慨的免费配额）；每个机器人均可单独换用专属的 OpenAI / Anthropic / OpenRouter API 密钥。
- 🤖 **MCP 服务器** - 无缝接入 Claude、ChatGPT 或任何兼容 MCP 的客户端，仅凭自然语言对话即可操作整个仪表盘：创建机器人、调整工作流、发布运营活动、线索管理、配置语音等（包含 55 个通过 OAuth 2.0 + PKCE 鉴权的标准化工具）。
- 📊 **统一管理仪表盘** - 集中管理机器人矩阵、收件箱/人工接管、知识库源、预约规则、运营活动以及渠道连接。
- 🐳 **一键式自托管** - `docker compose up` 结合 Supabase 项目即可秒级拉起完整生产可用环境。

## 架构

代码仓库采用标准的统一应用结构：`frontend/` 包含 Next.js 仪表盘、内嵌组件与 `widget.js` 加载器；`backend/` 包含基于 FastAPI 的 API 服务、后台 Worker 任务、第三方集成以及数据库迁移脚本。系统通过托管的 Supabase 项目运行（与 Chatty Cloud 架构标准完全一致）。可选的语音 Worker 服务可以使用 LiveKit Cloud，也可使用 `backend/voice-agent` 下独立的自建 LiveKit 媒体面；该媒体层不会替代 Supabase Postgres、Auth、Storage 或 Chatty API。

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
├── frontend/         Next.js - 控制台仪表盘、可嵌入挂件、widget.js 加载器
├── backend/          FastAPI - 聊天/RAG/预约/渠道/OAuth/MCP API 服务
│   ├── app/          路由、核心模块 (Auth/安全/数据库)、数据模型
│   ├── plugins/      Google/Microsoft 集成、RAG、挂件编排
│   ├── supabase/     数据库 Schema 与迁移文件 (按序执行)
│   ├── scripts/      apply_migrations.py 与运维脚本
│   ├── voice-agent/  LiveKit 语音 Worker 与自托管 Docker 编排
│   └── tests/        pytest 冒烟与单元测试
└── docker-compose.yml
```

### 部署配置概览

| 配置文件 | 数据与身份认证服务 | 适用场景 |
|---|---|---|
| `managed_supabase`（默认） | Supabase Auth、Postgres、Storage、pgvector 与 RLS | Chatty Cloud 以及所有官方支持的应用部署方式 |
| 语音媒体面（可选） | VPS 上的 LiveKit + 私有 Redis | 音视频流运行在自己的 VPS 上，业务数据仍保留在 Supabase |

语音服务的独立部署说明请查阅 [`backend/voice-agent/README.md`](backend/voice-agent/README.md)。

## 📋 环境依赖

| 组件 | 推荐版本 | 说明 |
|---|---|---|
| [Docker](https://docs.docker.com/get-docker/) + Docker Compose | 24+ | 快速开始及推荐部署途径 |
| [Python](https://www.python.org/downloads/) | 3.11+ | 后端本地开发（不使用 Docker 时） |
| [Node.js](https://nodejs.org/) | 20+ | 前端本地开发（不使用 Docker 时） |
| [Supabase](https://supabase.com) 账号 | 免费层即可 | 核心数据库 (Postgres + Auth + Storage) |
| [Google AI Studio](https://aistudio.google.com/apikey) API 密钥 | 免费层即可 | 默认大语言模型 (Gemini) |

其余集成（用于语音的 LiveKit、WhatsApp/Slack 令牌、Google/Microsoft OAuth、Lemon Squeezy 支付、Sentry 异常监控、Upstash Redis 限流等）均为**完全可选**配置——未填写的环境变量将仅停用对应单个功能，不会影响系统主体正常运行。

## 🚀 快速开始 (Docker Compose)

克隆仓库并启动实例的最快步骤：

```bash
git clone --recurse-submodules https://github.com/PersonaliAI/chatty.git
cd chatty

# 可选的插件与 SDK 源码属于独立子模块。
# 如果已克隆过仓库，执行：git submodule update --init --recursive

# 1. 向已创建的 Supabase 项目执行数据库迁移
cd backend && pip install psycopg2-binary
python scripts/apply_migrations.py "postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres"
cd ..

# 2. 配置环境变量
cp backend/.env.example backend/.env        # 填入 Supabase 与 Gemini 密钥
cp frontend/.env.example frontend/.env      # 填入 Supabase URL 与 anon key
cp .env.example .env                        # 填入相同的 NEXT_PUBLIC_* 值 (供 Docker 构建时注入)

# 3. 启动服务
docker compose up --build backend frontend
```

服务就绪后访问：
- **控制台仪表盘**: `http://localhost:3000` —— 注册账号、创建机器人，即可在机器人设置中获取网页嵌入脚本。
- **后端 API 文档**: `http://localhost:8000/docs` —— 交互式 Swagger API 文档。

详细的逐步部署手册与常见问题排查请参考英文主文档中的 [Self-Hosting, Step by Step](README.md#-self-hosting-step-by-step)。

## MCP 服务器与智能体控制

Chatty 内置了完整的 [Model Context Protocol (MCP)](https://modelcontextprotocol.io) 服务器——支持直接接入 Claude、ChatGPT 或任何兼容 MCP 的客户端，无需在界面点选，通过自然语言对话即可直接管理与调度整个平台。

- **身份认证**：采用 OAuth 2.0 授权码模式配合强制 PKCE (RFC 7636)、动态客户端注册 (RFC 7591) 与授权元数据发现 (RFC 8414)，无需手动复制黏贴静态 API Key。
- **权限范围 (Scopes)**：`read`、`write`、`knowledge`、`voice`、`actions`、`admin`，客户端仅可执行明确授权的范围。
- **55 个标准化工具**：涵盖机器人生命周期、外观定制、可视化流程构建、主动营销、语音代理、知识库 RAG、收件箱人工介入、线索与日程管理、分析报表与 RBAC 权限等。
- **真实数据协同**：每个工具直接读写与控制台完全相同的底层数据表，杜绝模拟数据。

客户端连接配置示例：

```json
{
  "mcpServers": {
    "chatty": {
      "url": "https://your-backend-domain/mcp"
    }
  }
}
```

客户端在初次连接时会自动拉起 OAuth 授权同意界面。如果您在生产域名下自建部署，请在 `backend/.env` 中将 `CHATTY_BACKEND_URL` 和 `CHATTY_FRONTEND_URL` 设为您的实际域名。

## 环境变量概览

所有环境变量均在 [`backend/.env.example`](backend/.env.example) 与 [`frontend/.env.example`](frontend/.env.example) 中附有详细行内注释。

**后端核心必填：**
- `SUPABASE_URL`, `SUPABASE_SECRET_KEY`: 数据库与 Auth 连接；Secret Key 仅存放在服务端。
- `SUPABASE_DB_HOST`, `SUPABASE_DB_PASSWORD`: 数据库直连配置，用于部分底层 SQL 执行与迁移。
- `FUNCTION_SECRET`: 用于为组件来源签名令牌及 OAuth 状态 JWT 加密。
- `BYOK_ENCRYPTION_KEY`: 用于对租户自定义的 API Key 进行静态加密。
- `GEMINI_API_KEY`: 默认大语言模型密钥。

**前端核心必填：**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 需与后端连接的同一 Supabase 项目保持一致。
- `NEXT_PUBLIC_BACKEND_URL`: 前端调用后端的 API 地址（本地开发为 `http://localhost:8000`，生产环境为真实域名）。

**可选功能变量**：包括语音（LiveKit）、WhatsApp、Slack、Google/Microsoft 日历预约、Zoom 会议、Lemon Squeezy 支付、Upstash Redis、Sentry 异常监控等。

## 🧪 测试与持续集成

项目配置了完整的自动化 CI 流水线（`.github/workflows/ci.yml`）：
- **后端**：编译验证 (`python -m compileall`)、`pytest` 全套测试以及依赖安全性审计。
- **前端**：TypeScript 类型检查、ESLint 代码规范校验、挂件设计 Token 一致性校验及生产编译打包。

本地运行后端测试：

```bash
cd backend
pip install -r requirements.txt pytest
python -m pytest tests/ -q
```

## 🔒 安全策略

如发现安全漏洞，请**切勿**公开发布 Issue。请通过 GitHub 仓库的 **Security** 标签页 → **Report a vulnerability** 提交私密报告，我们将第一时间响应并处理。

请妥善保管 `SUPABASE_SECRET_KEY`、`FUNCTION_SECRET`、`BYOK_ENCRYPTION_KEY` 以及各类 OAuth 客户端私钥，切勿将其提交至公共代码仓库。

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request！Chatty 是一个充满活力的开源项目，非常期待社区开发者的参与。欢迎参与的领域包括：
- 拓展新的 STT / TTS 语音合成与识别插件
- 接入新的即时通讯渠道（如 Telegram、飞书、企业微信等）
- 完善除 Docker Compose 外的多平台部署方案
- 补充多语言文档与使用教程

详情请查阅 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 📄 开源协议

本项目基于 [MIT 许可证](LICENSE) 开源。自由使用、自由修改、允许商业分发。

---

<div align="center">

⭐ **如果 Chatty 对您有帮助，请给我们 Star** —— 这能让更多开发者发现并受益于该项目。

</div>
