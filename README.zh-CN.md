<div align="center">

<img src="https://raw.githubusercontent.com/PersonaliAI/chatty/main/backend/assets/chatty-icon.png" alt="Chatty" width="88" /> <img src="https://raw.githubusercontent.com/PersonaliAI/chatty/main/backend/assets/readme-icon.png" alt="Chatty" width="88" />

# Chatty by PersonaliAI

<p>
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.es.md">Español</a>
</p>

<p align="center">
  <a href="https://render.com/deploy?repo=https://github.com/PersonaliAI/chatty"><img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" /></a>
  &nbsp;
  <a href="https://railway.com/template/chatty-open-source-ai-customer-support-a"><img src="https://railway.com/button.svg" alt="Deploy on Railway" /></a>
</p>

**开源 AI 客户支持与服务平台：Web 聊天组件 + 7 大渠道全渠道接入中心 + 完整 FastMCP 服务器，基于您自己的知识库。**

Chatty 是一款开源、可私有化自托管的 **Zendesk 替代方案** 和 **Intercom 替代方案**，专为需要 AI 聊天组件、可视化对话流自动化以及支持人工一键接管的共享客服团队打造。Chatty 是一个独立开源项目，与 Zendesk 或 Intercom 无隶属或赞助关系。

在您自有的基础设施上运行应用容器，同时享受由 Supabase 托管的 Auth、Postgres、Storage 和 Realtime 服务。同一套部署规范可无缝运行于 VPS、Railway、Render、Cloud Run 或任何标准 Docker 主机上，无需改动正在运行的 Supabase 生产项目。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/PersonaliAI/chatty/actions/workflows/ci.yml/badge.svg)](https://github.com/PersonaliAI/chatty/actions/workflows/ci.yml)
[![GDPR Compliant](https://img.shields.io/badge/GDPR-100%25%20Compliant-003399?logo=shield&logoColor=ffcc00)](#-gdpr--企业级数据隐私合规)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](frontend)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.11%20%2F%203.13-009688?logo=fastapi&logoColor=white)](backend)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![MCP](https://img.shields.io/badge/FastMCP-81%20Tools-8b5cf6)](#mcp-服务器与智能体控制)
[![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Chatty Cloud (官方托管版)](https://chatty.personaliai.com) · [官方文档](https://docs.chatty.personaliai.com) · [数据处理协议 (DPA)](frontend/src/app/(legal)/dpa/page.tsx) · [次级数据处理方清单](frontend/src/app/(legal)/subprocessors/page.tsx) · [性能评分卡](https://docs.chatty.personaliai.com/guides/scorecard) · [流程设计器](https://docs.chatty.personaliai.com/guides/flow-architect) · [组件嵌入指南](https://docs.chatty.personaliai.com/guides/embed-widget) · [客户安全身份验证](https://docs.chatty.personaliai.com/guides/human-takeover) · [快速开始](#-快速开始-docker-compose) · [私有化运维操作指南](https://docs.chatty.personaliai.com/guides/self-hosting) · [MCP 服务器](#mcp-服务器与智能体控制) · [AI 编程插件](https://docs.chatty.personaliai.com/guides/ai-coding-plugins) · [全渠道集成](https://docs.chatty.personaliai.com/guides/omnichannel) · [WooCommerce 商城](https://docs.chatty.personaliai.com/guides/woocommerce)

<br />
<br />

<p align="center">
  <a href="screenshots/real-01-overview.png"><img src="screenshots/real-01-overview.png" alt="Chatty Executive Overview & Live Telemetry" width="100%" style="border-radius: 8px;" /></a>
</p>

</div>

---

## 目录

- [为什么选择 Chatty](#为什么选择-chatty)
- [4K 视网膜高清生产控制台全览](#-4k-视网膜高清生产控制台全览)
- [功能特性](#-功能特性)
- [7 大渠道全渠道集成中心](#-7-大渠道全渠道集成中心)
- [可视化流程构建器引擎与条件运行时](#️-可视化流程构建器引擎与条件运行时)
- [WooCommerce 商城实时同步与多模态 RAG](#-woocommerce-商城实时同步与多模态-rag)
- [LiveKit 实时语音代理与 SDK](#-livekit-实时语音代理与-sdk)
- [架构设计](#架构设计)
- [环境依赖](#-环境依赖)
- [快速开始 (Docker Compose)](#-快速开始-docker-compose)
- [MCP 服务器与智能体控制](#mcp-服务器与智能体控制)
- [本地开发 (不使用 Docker)](#-本地开发-不使用-docker)
- [测试与持续集成](#-测试与持续集成)
- [GDPR & 企业级数据隐私合规](#-gdpr--企业级数据隐私合规)
- [安全策略](#-安全策略)
- [参与贡献](#-参与贡献)
- [开源协议](#-开源协议)

---

## 为什么选择 Chatty

绝大多数闭源客服聊天机器人 SaaS 均按坐席或按消息量收取昂贵费用，并将您的业务与客户对话数据锁在其自有服务器中。Chatty 采用开放核心模式：如果您不想承担任何运维压力，可以直接使用 [Chatty Cloud](https://chatty.personaliai.com)（官方基于本仓库完全一致源码托管的云服务）；如果您看重数据主权与成本效益，则可以完全免费私有化自托管。无论哪种方式，您都将获得完全一致的完整功能矩阵。

| 维度 | 闭源 SaaS 客服机器人 | **Chatty** |
|---|---|---|
| **客户对话数据归属** | 始终存放在厂商服务器上 | 存储在您自有的 Supabase 项目中（自建或 Chatty Cloud 皆是如此） |
| **计费与价格模型** | 按坐席 / 按调用消息计费，无免费层 | 自由免费私有化自托管，或选择透明清晰的 Chatty Cloud 托管订阅 |
| **大语言模型 (LLM)** | 强绑定其指定模型 | **自带模型密钥 (BYOK)** — 默认包含 Gemini 免费层，亦可自由接入 OpenAI / Anthropic / OpenRouter |
| **全渠道覆盖** | 往往属于昂贵增购或仅支持网页 | **原生内置 7 大通信渠道**: WhatsApp, Messenger, IG, TikTok, Telegram, 短信, 邮件 |
| **Agent / 自动化控制** | 通常无开放接口或价格昂贵 | **原生内置完整 FastMCP 服务器** — 81 项工具，支持 OAuth 2.0 与 API 密钥验证 |
| **源码透明度与审计** | 闭源黑盒 | **MIT 开源协议** — 自由审计、代码分支、定制开发与随处部署 |

---

## 🖥️ 4K 视网膜高清生产控制台全览

全部 22 个核心业务模块均直接采集自当前生产线上真实系统（[`chatty.personaliai.com/dashboard`](https://chatty.personaliai.com/dashboard)），分辨率高达 **4K 视网膜清晰度 (3840×2160)**，完整还原真实数据状态：

<table width="100%">
  <tr>
    <td width="50%" align="center">
      <a href="screenshots/real-06-inbox.png"><img src="screenshots/real-06-inbox.png" alt="全渠道工单收件箱与 SLA 管理" width="100%" /></a>
      <br />
      <b>全渠道工单收件箱与 SLA 管理</b>
      <br />
      <sub>实时访客会话流、SLA 超时告警倒计时、一键人工介入接管</sub>
    </td>
    <td width="50%" align="center">
      <a href="screenshots/real-04-knowledge-base.png"><img src="screenshots/real-04-knowledge-base.png" alt="知识库与多格式文档向量检索" width="100%" /></a>
      <br />
      <b>知识库与多格式文档向量检索</b>
      <br />
      <sub>支持多格式摄入、网站递归爬虫索引，已检索超 186k+ 字符</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <a href="screenshots/real-18-voice-agent.png"><img src="screenshots/real-18-voice-agent.png" alt="LiveKit WebRTC 语音工作室" width="100%" /></a>
      <br />
      <b>LiveKit WebRTC 语音工作室</b>
      <br />
      <sub>低于 500ms 超低延迟双向通话、5 种动态可视化波形、跨平台原生 SDK</sub>
    </td>
    <td width="50%" align="center">
      <a href="screenshots/real-08-flow-builder.png"><img src="screenshots/real-08-flow-builder.png" alt="可视化对话流程设计器" width="100%" /></a>
      <br />
      <b>可视化对话流程设计器</b>
      <br />
      <sub>交互式决策树连线画布、AI Flow Copilot 与死循环自动化校验</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <a href="screenshots/real-03-customizer.png"><img src="screenshots/real-03-customizer.png" alt="聊天组件实时样式设计器" width="100%" /></a>
      <br />
      <b>聊天组件实时样式设计器</b>
      <br />
      <sub>所见即所得实时效果预览、WCAG AA/AAA 对比度自动化合规检测</sub>
    </td>
    <td width="50%" align="center">
      <a href="screenshots/real-16-analytics.png"><img src="screenshots/real-16-analytics.png" alt="解决率与机器人拦截率统计" width="100%" /></a>
      <br />
      <b>解决率与机器人拦截率统计</b>
      <br />
      <sub>对话总量趋势、100% 自动解决率与 Token 消耗热力图</sub>
    </td>
  </tr>
</table>

<details>
<summary><b>📸 点击展开全部 22 个 4K 生产控制台高分辨率界面清单</b></summary>
<br />

| # | 功能模块 | 业务说明 | 4K 截图 |
| :---: | :--- | :--- | :---: |
| **01** | **总览驾驶舱** | 5 大健康度评分、机器人问题拦截率、近 30 天核心 KPI 趋势 | [查看 4K 截图](screenshots/real-01-overview.png) |
| **02** | **机器人工作区** | 多机器人统一管理、底层模型热切换 (GPT-4o, Claude, Gemini) | [查看 4K 截图](screenshots/real-02-workspace.png) |
| **03** | **组件设计器** | 6 维度颜色与外观调色板、企业品牌 Logo、WCAG 对比度自动化审计 | [查看 4K 截图](screenshots/real-03-customizer.png) |
| **04** | **知识库中心** | 52+ 数据源、186k 字符索引、HNSW 高性能向量检索召回 | [查看 4K 截图](screenshots/real-04-knowledge-base.png) |
| **05** | **AI 调试沙箱** | 隔离运行沙箱、支持引用来源 (Citation) 抽屉式侧边栏比对 | [查看 4K 截图](screenshots/real-05-playground.png) |
| **06** | **全渠道收件箱** | 统一工单协作台、访客在线状态感知、SLA 违约超时计时器 | [查看 4K 截图](screenshots/real-06-inbox.png) |
| **07** | **主动运营活动** | 访客离开意图挽留弹窗、浏览时长、页面滚动深度智能触发 | [查看 4K 截图](screenshots/real-07-campaigns.png) |
| **08** | **流程构建器** | 拖拽式对话流编排画布、支持 AI Flow Copilot 辅助生成 | [查看 4K 截图](screenshots/real-08-flow-builder.png) |
| **09** | **访客线索 CRM** | 自动提取访客联系方式、GeoIP 国家城市定位、CSV 导出 | [查看 4K 截图](screenshots/real-09-leads.png) |
| **10** | **客户反馈 CSAT** | 对话后客户满意度打分评价、情绪走势分析与摩擦标签分类 | [查看 4K 截图](screenshots/real-10-feedback.png) |
| **11** | **全球访客地图** | 基于 Leaflet 的交互式地理分布地图，实时呈现访客区域密度 | [查看 4K 截图](screenshots/real-11-map.png) |
| **12** | **日程预约管理** | Google Calendar 双向 OAuth 同步与 Google Meet 链接自动分发 | [查看 4K 截图](screenshots/real-12-meetings.png) |
| **13** | **接收邮箱配置** | Resend 邮件入站管道，自动将外部客户来信转化为工单会话 | [查看 4K 截图](screenshots/real-13-mailbox.png) |
| **14** | **团队告警通知** | 异常事件通知策略，支持通过 Slack、邮件和短信多路推送 | [查看 4K 截图](screenshots/real-14-notifications.png) |
| **15** | **审计日志记录** | 仅追加模式不可篡改日志，记录操作 IP、操作人账号及行为 | [查看 4K 截图](screenshots/real-15-audit-log.png) |
| **16** | **数据统计分析** | 自动解决率、工单响应时长、分时 Token 消耗热力图 | [查看 4K 截图](screenshots/real-16-analytics.png) |
| **17** | **嵌入与系统集成** | 支持 React、Next.js、WordPress 嵌入代码生成与域名白名单保护 | [查看 4K 截图](screenshots/real-17-embed-integrate.png) |
| **18** | **语音代理工作室** | LiveKit WebRTC 实时对讲调试、5 种动态波形与多平台 SDK | [查看 4K 截图](screenshots/real-18-voice-agent.png) |
| **19** | **FastMCP 接口枢纽** | 面向 Claude Desktop、Cursor、Antigravity 的 81 项工具与 8 项资源 | [查看 4K 截图](screenshots/real-19-mcp.png) |
| **20** | **开发者 API** | 具备细粒度权限的 API 密钥 (`chatty_sk_...`) 与多语言 SDK 片段 | [查看 4K 截图](screenshots/real-20-developer-api.png) |
| **21** | **账单与配额** | Stripe 计费中心、配额账本以及分销推广伙伴计划 | [查看 4K 截图](screenshots/real-21-billing.png) |
| **22** | **机器人安全设定** | 严格基于向量知识库回答、敏感隐私实时脱敏、BYOK 密钥加密保存 | [查看 4K 截图](screenshots/real-22-agent-settings.png) |

</details>

---

## ✨ 功能特性

- 🔌 **7 大渠道全渠道集成中心** — 覆盖 WhatsApp Cloud API、Facebook Messenger、Instagram Direct、TikTok 商业私信、Telegram Bot、Twilio 双向短信（含自动 TCPA 退订合规拦截）、入站工单邮件（自动剥离历史引用文本）的生产级原生消息流管道。
- 🗺️ **可视化流程构建器引擎** — 基于 `@xyflow/react` 打造的拖拽式连线画布，支持基于时间的条件分支（例如：下午 6:00 前与下午 6:00 后呈现不同限时优惠）、销售线索收集、会议预约、外部 Webhook 触发、访客平台特征识别以及 AI Flow Copilot 智能助推。
- ⚡ **实时人工接管与全渠道收件箱** — 基于 Server-Sent Events (SSE) 的流式统一协作后台。人工客服可一键暂停机器人自动化，直接与来自 WhatsApp、Instagram、TikTok 或短信的访客发起实时对话。
- 🛒 **WooCommerce 商城集成与多模态 RAG** — WooCommerce 官方商店无缝同步（订单发货状态实时查询、商品库存检索、购物车直达链接），结合 PDF、DOCX、CSV、TXT 知识文档切片、网站链接巡检与图像多模态视觉上下文理解。
- 🎙️ **LiveKit 实时语音代理** — 基于 WebRTC 的企业级超低延迟语音交互，支持 5 种动态可视化波形（`wave`, `bar`, `grid`, `radial`, `aura`）、实时语音听写字幕卡片、管道模式与端到端实时音频大模型，以及覆盖 Web、React、iOS、Android、Flutter 和 React Native 的原生 SDK。
- 💬 **轻量级嵌入聊天组件** — 仅需引入一行 `<script>` 标签，支持打字机流式输出，采用 Shadow DOM 物理隔离技术，确保与宿主网站 CSS 绝对无样式污染。
- 📚 **RAG 向量知识库检索** — 基于 PostgreSQL `pgvector` 与 HNSW 向量索引，结合关键词词法与向量语义的混合检索策略。
- 🛠️ **自主工具调用 (Tool-calling)** — 自动预约真实音视频会议（Google Meet、Microsoft Teams、Zoom）、销售线索智能提取、日历空闲时段校验。
- 🔑 **自带密钥架构 (BYOK)** — 默认支持 Google Gemini 免费额度；亦可按机器人为单位自由接入 OpenAI、Anthropic、Groq，凭证均经 AES-128 严格加密存储。
- 🤖 **81 项标准化 FastMCP 工具服务器** — 支持从 Claude Desktop、Cursor、Codex 或 Antigravity 通过 OAuth 2.0 / API 密钥全方位控制控制台（涵盖语音工作室配置、控制台截图遥测与自动化工作流）。
- 📊 **5 维度健康评分卡** — 针对转化率、拦截率、精准度、稳定度与客户满意度进行独立的 A–F 评级与诊断建议。
- 🎯 **主动触发式营销活动** — 基于访客离开意图、停留时长、滚动深度等行为触发器，结合时区感知的定时调度器。
- 🐳 **一行命令极速私有化部署** — `docker compose up` 指向 Supabase 数据库实例，60 秒内完整拉起。

---

## 🔌 7 大渠道全渠道集成中心

Chatty 将全网主流客户沟通触点统一收敛至同一个标准化协作工作区。来自各个平台的外部消息均被实时归一化为内部事件流，确保可视化流程引擎、AI 知识大脑与人工坐席能够无缝协同运作。

| 渠道名称 | 协议 / 服务商 | 支持载荷与交互控件 | Webhook 鉴权机制 | 会话前缀 | 实时人工接管 |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **WhatsApp** | Meta Cloud API | 文本、富媒体、消息模板、交互式按钮 (最多3个)、菜单列表 | `X-Hub-Signature-256` (HMAC-SHA256) | `wa:` | ✅ 实时流式 |
| **Messenger** | Meta Graph API | 文本、文件附件、快速回复 (最多13个)、Postback 回传事件 | `X-Hub-Signature-256` (HMAC-SHA256) | `fb:` | ✅ 实时流式 |
| **Instagram DM** | Meta Graph API | 私信对话、Story 故事提及通知、快速回复按钮 | `X-Hub-Signature-256` (HMAC-SHA256) | `ig:` | ✅ 实时流式 |
| **TikTok** | TikTok 商业私信 | 文本对话、快速回复按钮 (最多3个) | 带时间戳的 HMAC (`t=...,s=...`) | `tt:` | ✅ 实时流式 |
| **Telegram** | Telegram Bot API | 文本、Markdown 排版、多行动态内联键盘网格 | `X-Telegram-Bot-Api-Secret-Token` | `tg:` | ✅ 实时流式 |
| **双向短信** | Twilio 消息平台 | 纯文本、自动 TCPA 退订拦截 (STOP / UNSUBSCRIBE) | Twilio 密码学签名验证 (Base64) | `sms:` | ✅ 实时流式 |
| **支持邮箱** | Resend / SendGrid Inbound | 提取正文、自动剔除带 `>` 符号的历史回复邮件 | Webhook 密钥握手质询 | `email:` | ✅ 实时流式 |

### 核心架构亮点
* **零延迟摄入队列:** Webhook 接收端完成 HMAC 验签后，在 40ms 以内即刻向平台返回 `HTTP 200 OK`，彻底防止 Meta 和 TikTok 因大模型生成耗时超过其 3 秒超时限制而引发指数级重试风暴。
* **跨平台交互按钮自适应:** 互动按钮自动适配不同平台的展示规范（在 Telegram 上呈现为动态内联键盘网格；在 WhatsApp 与 TikTok 上智能裁切为前 3 个快捷按钮；在短信通道中则自动转译为 `回复 [1] 或 [2]` 形式的数字菜单）。
* **24 小时服务窗口自动化管理:** 实时追踪 Meta 渠道的 `last_inbound_at` 时间戳，防止平台因超出客服窗口而拒绝下发（错误码 `131047`）；超出窗口后系统自动优雅降级为预先认证过的 WhatsApp 商业模板。
* **TCPA 法律合规拦截器:** 只要检测到用户回复法定退订关键字（如 `STOP`、`UNSUBSCRIBE`、`CANCEL`、`QUIT`），立即确定性中断任何自动化流程并在系统登记退订标记。
* **无损加密配置隔离 (JSONB):** 各渠道的凭证与验证令牌均安全存放于 PostgreSQL 字段 `omnichannel_config` 中（采用 AES-GCM 保护），更新任一渠道的密钥绝不会影响或意外清空其他渠道的配置。

---

## 🗺️ 可视化流程构建器引擎与条件运行时

Chatty 深度集成了基于 `@xyflow/react` 构建的流程拓扑图执行引擎。您能够针对核心业务链路（如获客留资、资格初筛、预约排期、限时促销）制定确定性的连线规则，同时将开放式的咨询问答交由 AI 知识大脑灵活处理。

* **基于时间的动态条件分支:** 条件分支节点支持 12 小时与 24 小时制的时间比较逻辑（例如 `< 18:00` 对比 `>= 18:00`）。您可以轻松搭建分时营销场景：下午 6:00 前来访的客户将收到“优惠将于 18:30 截止”的限时活动；而晚间咨询的客户则会收到“优惠有效期至 21:00”的专属通知。
* **客户端环境与平台识别:** 节点可直接读取标准化请求元数据（`platform`, `channel`, `device`, `os`），从而依据访客来自 WhatsApp、TikTok、手机端或桌面浏览器分流推送专属内容。
* **常用节点矩阵:**
  * **Trigger (触发器):** 监听事件（`session.started`, `message.user`, `lead.created`）。
  * **Message & Question (消息与单选提问):** 输出富文本 Markdown 内容与多选按钮。
  * **Condition (逻辑条件分支):** 基于用户文本输入、变量、标签或具体时间段进行分支判定。
  * **Lead Capture (线索收集):** 收集客户姓名、邮箱、电话及公司名称并存入 CRM 账本。
  * **Book Meeting (会议预约):** 自动生成 Google Meet、Teams 或 Zoom 实际预约日程。
  * **Webhook (外部调用):** 发起受 SSRF 保护与带重试策略的外部 HTTP POST 请求。
  * **AI Fallback (大模型兜底):** 无缝切换并委托给 RAG 知识库检索模块进行智能回复。

---

## 🛒 WooCommerce 商城实时同步与多模态 RAG

Chatty 直接连通 WooCommerce 官方商城体系，赋能对话式电商体验：

* **实时订单状态追踪:** 访客提供订单编号或账单邮箱后，机器人可直接查询包裹配送进展与物流单号。
* **商品目录与库存即时检索:** 通过 WooCommerce REST API 直连查询最新库存状况、常规价格与促销折扣价格，并动态生成购物车购买链接。
* **多格式知识文档 RAG:** 原生支持 PDF、DOCX、CSV 数据表、TXT 文本以及全站站点地图递归抓取。数据存储于 PostgreSQL `pgvector` 中，通过 HNSW 索引实现极速混合语义检索。
* **图像多模态视觉理解:** 访客可以直接在聊天框上传产品故障照片或屏幕截图，AI 将根据图像细节与知识库进行图文多模态定位与排障。

---

## 🎙️ LiveKit 实时语音代理与 SDK

Chatty 原生搭载了基于 [LiveKit WebRTC](https://livekit.io) 的企业级实时对讲语音引擎，支持超低延迟全双工对话、5 种动态音频可视化波形、实时文字字幕卡片、知识库检索对齐与跨平台原生 SDK。

### 架构模式：模块化管道 (Pipeline) 与 端到端实时多模态 (Multimodal Realtime)

- **模块化管道模式 (Modular Pipeline)**：
  - **语音识别 (STT)**：Google Cloud Speech Chirp、Deepgram Nova-3、OpenAI Whisper、Cartesia、Soniox、AssemblyAI。
  - **语言模型 (LLM)**：Gemini 2.5 Flash、Claude 3.5 Sonnet、GPT-4o-mini、OpenRouter。
  - **语音合成 (TTS)**：Google Gemini TTS、Cartesia Sonic、ElevenLabs、Deepgram Aura、OpenAI Audio、Fish Audio。
- **端到端实时多模态模式 (Multimodal Realtime)**：直连原生音频模型，包括 Gemini Live 2.5 Flash Native Audio、OpenAI Realtime、Azure OpenAI 与 Ultravox。

### 5 种动态音频可视化动画

可在管理控制台直观选用，或在前端 SDK 中通过属性传参：
- `wave` — 经典平滑流体正弦波浪动画。
- `bar` — 频段均衡器频谱跳动柱形图。
- `grid` — 随分贝能量起伏的科技感 LED 点阵矩阵。
- `radial` — 随语调强度扩散的同心圆脉冲光环。
- `aura` — 呼吸律动的环境辉光，支持音高音调微变。

### 全平台 SDK 接入矩阵

| 接入平台 / SDK | UI 组件与嵌入方式 | 编程式控制与令牌 |
| :--- | :--- | :--- |
| **HTML Script** (`widget.js`) | `<script src="..." data-mode="voice" data-display="modal"></script>` | `window.Chatty.openVoice()` |
| **React / Next.js** (`@personaliai/react-widget`) | `<VoiceAgent botId="..." />` 或 `<ChattyWidget mode="voice" />` | `useChatty().openVoice()` |
| **iOS** (SwiftUI) | `ChattyVoiceView(botId: "...")` | `ChattyClient.createVoiceToken(...)` |
| **Android** (Compose) | `ChattyVoiceScreen(botId = "...")` | `ChattyApi.createVoiceToken(...)` |
| **Flutter** | `ChattyVoiceScreen(botId: '...')` | `ChattyClient.createVoiceToken(...)` |
| **React Native** | `<ChattyVoiceView botId="..." />` | `ChattyClient.createVoiceToken(...)` |
| **Iframe 独立嵌入** | `<iframe src="https://chatty.personaliai.com/embed/{botId}?voice=only"></iframe>` | 独立浏览器托管页面 |

### 声学工程与回声抑制

- **硬件级 WebRTC AEC**：客户端浏览器与移动设备底层原生协商回声消除（AEC）、噪声抑制与自动增益控制。
- **杜绝服务端二次滤波梳状效应**：LiveKit 后端 Worker 运行时关闭了多余的服务端 AEC 预热滤镜，避免双重滤波带来的金属颤音、机械感与卡顿。
- **独立会话记忆重置**：提供即时重置接口（`POST /api/widget/voice/reset`），一键清空数据库对话记忆并轮换房间 Nonce，彻底解决跨会话上下文串扰问题。

---

## 架构设计

Chatty 保持了清晰规范的代码结构：`frontend/` 目录存放 Next.js 控制台、网页聊天组件与可视化流程画布；`backend/` 目录存放 FastAPI 服务、各渠道适配层、后台异步工作线程与数据库迁移脚本。

### 全渠道双引擎协同架构

```mermaid
flowchart TB
    subgraph INBOUND["全渠道统一接入与客户端"]
        direction LR
        WIDGET["Web 网页组件 & LiveKit 语音"]
        WA["WhatsApp Cloud API"]
        META["Messenger & Instagram Direct"]
        TT["TikTok 商业私信"]
        TG["Telegram Bot"]
        SMS["Twilio 双向短信"]
        MAIL["支持工单接收邮箱"]
    end

    subgraph GATEWAY["安全校验与 Webhook 接收网关"]
        direction TB
        HMAC["密码学签名鉴权 (HMAC-SHA256 / 令牌)"]
        ACK["40ms 极速 HTTP 200 OK 确认应答"]
        QUEUE["异步去重与内部事件总线"]
        DLP["实时敏感信息脱敏 (PII Scrubber)"]
    end

    subgraph CORE["双引擎协同执行大脑"]
        direction LR
        subgraph FLOW["可视化流程构建运行时"]
            FNODES["流程节点图 (@xyflow/react)"]
            FCOND["时间段与条件逻辑分支"]
            FLEAD["销售线索捕获与 CRM 同步"]
            FBOOK["日历会议日程自动分发"]
        end
        subgraph BRAIN["多模态 RAG 与 AI 深度推理"]
            VECT["pgvector 混合语义检索"]
            KB["知识库文档 (PDF/DOCX/CSV/TXT)"]
            WOO["WooCommerce 商城与订单 API"]
            LLM["BYOK 大模型 (Gemini / Claude / GPT / Groq)"]
        end
    end

    subgraph TAKEOVER["人工坐席协作台"]
        direction TB
        SSE["实时 SSE 流式事件推送"]
        INBOX["统一客服工单与 SLA 收件箱"]
        HUMAN["一键人工接管 (Human Takeover)"]
    end

    subgraph OUTBOUND["渠道 UI 标准化与消息下发"]
        direction LR
        OUT_WA["WhatsApp 24 小时服务窗口与模板"]
        OUT_TT["TikTok 快速回复按钮 (最多 3 个)"]
        OUT_TG["Telegram 动态内联键盘网格"]
        OUT_SMS["短信数字选项与 TCPA 退订拦截"]
        OUT_MAIL["去除引用历史的邮件回复"]
        OUT_WEB["网页组件流式输出与富交互卡片"]
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

### 系统组件与数据架构

```mermaid
flowchart TB
    classDef actor fill:#f8fafc,stroke:#64748b,color:#0f172a
    classDef edge fill:#eff6ff,stroke:#2563eb,color:#1e3a8a
    classDef app fill:#ecfdf5,stroke:#059669,color:#064e3b
    classDef data fill:#f0fdfa,stroke:#0f766e,color:#134e4a
    classDef integration fill:#fff7ed,stroke:#ea580c,color:#7c2d12
    classDef deploy fill:#f5f3ff,stroke:#7c3aed,color:#4c1d95

    subgraph clients["接入客户端与渠道"]
        direction LR
        visitor(("网站访客")):::actor
        operator(("人工客服坐席")):::actor
        omni["WhatsApp · Messenger · IG · TikTok · TG · 短信 · 邮件 · MCP"]:::actor
    end
    subgraph edge["公网边缘网关"]
        direction LR
        tls["TLS · 域名白名单 · 速率限制"]:::edge
        web["Next.js 15+ 前端 (App Router)"]:::app
    end
    subgraph runtime["Chatty 服务运行时"]
        direction LR
        api["FastAPI 后端 · 流程引擎 · RAG · Webhook"]:::app
        mcp["FastMCP 81 工具服务器 (OAuth 2.0 / API 密钥)"]:::app
    end
    subgraph managed["托管 Supabase 数据层"]
        direction LR
        auth["Supabase 身份认证 (Auth)"]:::data
        postgres["Postgres + pgvector · JSONB 配置 · RLS"]:::data
        storage["Supabase 对象存储 (文档与音频)"]:::data
        realtime["Supabase 实时推送 (Realtime)"]:::data
    end
    subgraph integrations["外部第三方服务"]
        direction TB
        llm["大语言模型 (Gemini / OpenAI / Anthropic / Groq)"]:::integration
        calendar["Google Calendar & Microsoft 365"]:::integration
        wooCommerce["WooCommerce 商城 API"]:::integration
        voiceLiveKit["LiveKit WebRTC 音频网格"]:::integration
    end
    subgraph targets["部署目标环境"]
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
    targets -. 运行 .-> runtime
    linkStyle default stroke:#64748b,stroke-width:1.5px
```

```
chatty/
├── frontend/         Next.js - 控制台、可嵌入式聊天组件、widget.js 挂载脚本
├── backend/          FastAPI - 对话/RAG/预约/多渠道网关/OAuth/MCP 服务端
│   ├── app/          路由、核心模块 (认证/安全/数据库封装)、Pydantic Schema
│   ├── plugins/      Google/微软集成、RAG 向量调度、组件交互状态机
│   ├── supabase/     数据库结构与按序执行的 SQL 迁移脚本
│   ├── scripts/      apply_migrations.py 与辅助运维管理脚本
│   └── tests/        pytest 自动化测试套件
└── docker-compose.yml
```

---

## 📋 环境依赖

| 依赖组件 | 推荐版本 | 用途 |
|---|---|---|
| [Docker](https://docs.docker.com/get-docker/) + Docker Compose | 24+ | 快速上手与容器化部署（推荐生产方案） |
| [Python](https://www.python.org/downloads/) | 3.11+ / 3.13+ | 后端服务（不使用 Docker 时的本地开发） |
| [Node.js](https://nodejs.org/) | 20+ | 前端工程（不使用 Docker 时的本地开发） |
| [Supabase](https://supabase.com) 账号 | 免费层即满足要求 | 数据库体系 (Postgres + Auth + Storage + Realtime) |
| [Google AI Studio](https://aistudio.google.com/apikey) API 密钥 | 免费层即满足要求 | 默认大语言模型 (Gemini) |

---

## ⚡ 一键云端部署 (Render 与 Railway)

无需自建服务器，一键直接部署 Chatty 到云端：

<p align="center">
  <a href="https://render.com/deploy?repo=https://github.com/PersonaliAI/chatty"><img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" /></a>
  &nbsp;
  <a href="https://railway.com/template/chatty-open-source-ai-customer-support-a"><img src="https://railway.com/button.svg" alt="Deploy on Railway" /></a>
</p>

Chatty 采用 **托管型 Supabase 架构**（应用容器在 Render/Railway 运行，而用户认证、Postgres 数据库、向量检索与存储托管在 Supabase）。点击部署前后，仅需完成以下 3 步设置：

1. **创建免费 Supabase 项目**：前往 [supabase.com](https://supabase.com) 创建免费项目，在 Project Settings 复制 **Project URL**、**`anon` 公钥**、**`service_role` 密钥** 以及 **数据库连接字符串**。
2. **执行数据库迁移**：运行一次迁移脚本，初始化所有 67+ 张表和向量索引：
   ```bash
   cd backend && pip install psycopg2-binary
   python scripts/apply_migrations.py "postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres"
   ```
   *(或在 Supabase SQL Editor 中直接运行 `backend/supabase/migrations/` 下的 SQL 迁移文件)*。
3. **获取免费 Gemini API 密钥并配置变量**：前往 [aistudio.google.com/apikey](https://aistudio.google.com/apikey) 获取免费密钥。当 Render 或 Railway 提示输入环境变量时，填入 `SUPABASE_URL`、`SUPABASE_SECRET_KEY`、`GEMINI_API_KEY`、`NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 即可完成部署。

---

## 🚀 快速开始 (Docker Compose)

从克隆代码到完整启动的最简操作步骤：

```bash
git clone --recurse-submodules https://github.com/PersonaliAI/chatty.git
cd chatty

# 1. 向您预先创建好的 Supabase 数据库执行初始结构迁移
cd backend && pip install psycopg2-binary
python scripts/apply_migrations.py "postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres"
cd ..

# 2. 配置环境变量文件
cp backend/.env.example backend/.env        # 填入 Supabase 与 Gemini 凭证
cp frontend/.env.example frontend/.env      # 填入 Supabase URL 与 anon key
cp .env.example .env                        # 配置用于 Docker 构建的 NEXT_PUBLIC_* 环境变量

# 3. 构建并启动容器
docker compose up --build backend frontend
```

- **管理控制台**: `http://localhost:3000` — 注册管理员账号，创建机器人后即可在设置中提取网页嵌入代码。
- **后端服务 API**: `http://localhost:8000`（交互式接口文档：`http://localhost:8000/docs`）。

---

## MCP 服务器与智能体控制

Chatty 完整内置了符合 [Model Context Protocol (FastMCP)](https://modelcontextprotocol.io) 官方协议规范的服务器。您可以将 Claude Desktop、Cursor、Codex 或 Antigravity 与其相连，仅通过自然语言对话即可直接管理整个业务系统：

- **权限认证**: 严格遵循带 PKCE（RFC 7636）的 OAuth 2.0 授权码流，并支持 Scoped API 密钥鉴权 (`chatty_sk_...`)。
- **81 项标准化工具**（涵盖 12 大分类）：机器人全生命周期、视觉设计定制、流程图设计器、主动营销活动、知识库 RAG、收件箱与人工接管、会议日历预约、拦截分析统计、BYOK 与安全护栏，以及 LiveKit 语音工作室。
- **实时资源与引导提示**: 通过 `chatty://bots/{bot_id}/voice-config` 实时读取语音代理运行时状态，并通过 `chatty://dashboard/screenshots` 获取控制台真实界面截图。

MCP 客户端通用配置示例：

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

## 💻 本地开发 (不使用 Docker)

**后端服务:**
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**前端服务:**
```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 测试与持续集成

项目配置了完整的 `.github/workflows/ci.yml` 自动化流水线，在每次推送到 `main` 分支或提交 Pull Request 时自动触发：
- **后端**: 执行 `python -m compileall` 语法编译检测，并完整运行 `pytest` 测试套件 (`backend/tests/`)。
- **前端**: TypeScript 严格类型检查、ESLint 代码规范校验与 Next.js 生产打包测试。

---

## 🇪🇺 GDPR & 企业级数据隐私合规

Chatty 严格遵循 **欧盟通用数据保护条例 (GDPR / Regulation (EU) 2016/679)** 与 **ePrivacy 隐私指令 (2002/58/EC)**：

* **自动化数据防泄漏 (DLP):** 实时敏感信息脱敏器 (`backend/app/services/pii_service.py`) 自动识别并掩码通过 Luhn 算法校验的信用卡号、美国社会安全码 (SSN)、泄露的 Bearer 令牌以及欧洲 IBAN 银行账号 (ISO 7064)，全面覆盖 Web 聊天与全渠道（WhatsApp、Instagram、Telegram、短信、邮件）。
* **被遗忘权与数据删除 (第 17 条):**
  - 管理端接口 `DELETE /api/admin/inbox/contacts/{id}` 触发 PostgreSQL 存储过程 `chatty_erase_contact()`，干净彻底级联抹除指定客户的历史会话记录、线索及会话上下文。
  - 网站访客可随时在 Web 聊天组件内点击垃圾桶图标，自主销毁当前会话及本地缓存。
* **数据加密与多租户隔离 (第 32 条):**
  - 核心敏感资产（如用户配置的 BYOK API 密钥和 OAuth 令牌）采用 Fernet (AES-128-CBC + HMAC-SHA256) 算法在落盘时进行强加密。
  - 全链路网络请求均通过 TLS 1.3 传输，Supabase 行级安全策略 (RLS) 在数据库层面强制隔离各个租户的工作区数据。
* **绝不使用客户数据训练公有 AI 模型的承诺:** 客户产生的所有对话与上传的知识文档仅在临时内存中参与单次推理召回，绝不会被回流用于任何公共基础模型的二次训练。
* **完备的法律合规文件:**
  - 包含欧盟标准合同条款 (SCC) 的 [数据处理协议 (DPA)](frontend/src/app/(legal)/dpa/page.tsx)。
  - 列明国际跨境传输安全措施与 SOC 2 / ISO 27001 认证情况的公开 [次级处理方清单](frontend/src/app/(legal)/subprocessors/page.tsx)。

---

## 🔒 安全策略

若您在项目中发现潜在的安全漏洞，请**切勿在公开 Issue 中讨论**。请直接通过 GitHub 仓库的 **Security** 标签页中的 **Report a vulnerability** 提交私密报告，我们将第一时间响应并处理。

---

## 🤝 参与贡献

我们非常欢迎来自开源社区的 Pull Request 与改进建议！请参阅 [CONTRIBUTING.md](CONTRIBUTING.md) 了解开发指引及当前优先的协作方向（如新增 STT/TTS 厂商插件、新渠道适配、更多部署模版及文档完善等）。

---

## 📄 开源协议

本项目基于宽松的 [MIT 许可证](LICENSE) 开源。您可以自由进行商用、代码分支或定制化二次开发。

---

<div align="center">

⭐ **如果 Chatty 对您有所帮助，欢迎为本仓库点亮一颗 Star**

</div>
