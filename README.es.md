<div align="center">

<img src="https://raw.githubusercontent.com/PersonaliAI/chatty/main/backend/assets/chatty-icon.png" alt="Chatty" width="88" /> <img src="https://raw.githubusercontent.com/PersonaliAI/chatty/main/backend/assets/readme-icon.png" alt="Chatty" width="88" />

# Chatty by PersonaliAI

<p>
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.es.md">Español</a>
</p>

**Plataforma de soporte y atención al cliente con IA de código abierto: widget de chat web + hub omnicanal de 7 canales + servidor MCP completo, fundamentado en tu propia base de conocimiento.**

Chatty es una alternativa de código abierto y autoalojable a **Zendesk** e **Intercom** para equipos que necesitan un widget con IA, automatización visual de flujos y una bandeja de entrada compartida con takeover humano. Chatty es un proyecto independiente no afiliado con Zendesk ni Intercom.

Ejecuta los contenedores de la aplicación en tu propia infraestructura mientras mantienes Supabase Auth, Postgres, Storage y Realtime gestionados. El mismo contrato de despliegue funciona en un VPS, Railway, Render, Cloud Run u otro host Docker sin modificar tu proyecto activo de Supabase.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/PersonaliAI/chatty/actions/workflows/ci.yml/badge.svg)](https://github.com/PersonaliAI/chatty/actions/workflows/ci.yml)
[![GDPR Compliant](https://img.shields.io/badge/GDPR-100%25%20Compliant-003399?logo=shield&logoColor=ffcc00)](#-gdpr-y-privacidad-de-datos-empresarial)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](frontend)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.11%20%2F%203.13-009688?logo=fastapi&logoColor=white)](backend)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![MCP](https://img.shields.io/badge/FastMCP-65%20Herramientas-8b5cf6)](#servidor-mcp-y-control-de-agentes)
[![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Chatty Cloud (Alojado)](https://chatty.personaliai.com) · [Documentación](https://docs.chatty.personaliai.com) · [Acuerdo de Procesamiento de Datos (DPA)](frontend/src/app/(legal)/dpa/page.tsx) · [Subencargados del Tratamiento](frontend/src/app/(legal)/subprocessors/page.tsx) · [Tarjeta de Rendimiento](https://docs.chatty.personaliai.com/guides/scorecard) · [Constructor de Flujos](https://docs.chatty.personaliai.com/guides/flow-architect) · [Inserción del Widget](https://docs.chatty.personaliai.com/guides/embed-widget) · [Inicio Rápido](#-inicio-rápido-docker-compose) · [Guía de Autoalojamiento](https://docs.chatty.personaliai.com/guides/self-hosting) · [Servidor MCP](#servidor-mcp-y-control-de-agentes) · [Plugins de IA](https://docs.chatty.personaliai.com/guides/ai-coding-plugins) · [Hub Omnicanal](https://docs.chatty.personaliai.com/guides/omnichannel) · [WooCommerce](https://docs.chatty.personaliai.com/guides/woocommerce)

<br />
<br />

<p align="center">
  <a href="screenshots/real-01-overview.png"><img src="screenshots/real-01-overview.png" alt="Chatty Executive Overview & Live Telemetry" width="100%" style="border-radius: 8px;" /></a>
</p>

</div>

---

## Tabla de contenidos

- [¿Por qué Chatty?](#por-qué-chatty)
- [Muestra del Panel de Control en Vivo (4K Retina)](#-muestra-del-panel-de-control-en-vivo-4k-retina)
- [Características](#-características)
- [Hub Omnicanal de 7 Canales](#-hub-omnicanal-de-7-canales)
- [Motor Visual de Flujos y Runtime Condicional](#️-motor-visual-de-flujos-y-runtime-condicional)
- [Integración con WooCommerce y RAG Multimodal](#-integración-con-woocommerce-y-rag-multimodal)
- [Agente de Voz LiveKit y SDKs](#-agente-de-voz-livekit-y-sdks)
- [Arquitectura](#arquitectura)
- [Requisitos](#-requisitos)
- [Inicio Rápido (Docker Compose)](#-inicio-rápido-docker-compose)
- [Servidor MCP y Control de Agentes](#servidor-mcp-y-control-de-agentes)
- [Desarrollo Local (sin Docker)](#-desarrollo-local-sin-docker)
- [Pruebas e Integración Continua](#-pruebas-e-integración-continua)
- [GDPR y Privacidad de Datos Empresarial](#-gdpr-y-privacidad-de-datos-empresarial)
- [Seguridad](#-seguridad)
- [Contribuciones](#-contribuciones)
- [Licencia](#-licencia)

## ¿Por qué Chatty?

La mayoría de plataformas de chatbots comerciales cobran suscripciones elevadas por usuario o por mensaje y custodian tus conversaciones en sus servidores. Chatty es de código abierto (open-core): puedes autoalojarlo gratuitamente en tu propia infraestructura o usar [Chatty Cloud](https://chatty.personaliai.com) si prefieres delegar el mantenimiento técnico. En ambas modalidades cuentas con el mismo conjunto de funciones avanzadas.

|  | Chatbots SaaS de código cerrado | **Chatty** |
|---|---|---|
| **Tus datos de conversación** | Residen permanentemente en sus servidores | En tu proyecto de Supabase (autoalojado o en Chatty Cloud) |
| **Precios** | Por usuario / por mensaje, sin nivel gratuito | Autoalojamiento gratuito o planes transparentes en Chatty Cloud |
| **Modelos de Lenguaje (LLM)** | Bloqueado a su proveedor específico | **BYOK (Trae tu propia clave)**: Gemini por defecto, o OpenAI, Anthropic, OpenRouter |
| **Hub Omnicanal** | Costoso o limitado al chat web | **7 canales integrados nativamente**: WhatsApp, Messenger, IG, TikTok, Telegram, SMS, Email |
| **Automatización / Agentes** | Generalmente inexistente o complemento de pago | **Servidor FastMCP completo incluido**: 65 herramientas con OAuth 2.0 y API Keys |
| **Código fuente** | Privado / cerrado | **Licencia MIT**: audítalo, modifícalo, haz fork y ejecútalo donde quieras |

## 🖥️ Muestra del Panel de Control en Vivo (4K Retina)

Los 22 módulos principales han sido capturados directamente del entorno de producción real ([`chatty.personaliai.com/dashboard`](https://chatty.personaliai.com/dashboard)) en resolución **4K Retina (3840×2160)** con datos reales en vivo:

<table width="100%">
  <tr>
    <td width="50%" align="center">
      <a href="screenshots/real-06-inbox.png"><img src="screenshots/real-06-inbox.png" alt="Bandeja de Entrada Omnicanal y SLA" width="100%" /></a>
      <br />
      <b>Bandeja de Entrada Omnicanal y SLA</b>
      <br />
      <sub>Hilos de visitantes en tiempo real, alertas de vencimiento de SLA y takeover humano en 1 clic</sub>
    </td>
    <td width="50%" align="center">
      <a href="screenshots/real-04-knowledge-base.png"><img src="screenshots/real-04-knowledge-base.png" alt="Base de Conocimiento y Documentos Vectoriales" width="100%" /></a>
      <br />
      <b>Base de Conocimiento y Documentos Vectoriales</b>
      <br />
      <sub>Ingestión multiformato, rastreador web recursivo y más de 186k caracteres indexados</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <a href="screenshots/real-18-voice-agent.png"><img src="screenshots/real-18-voice-agent.png" alt="Estudio de Voz WebRTC LiveKit" width="100%" /></a>
      <br />
      <b>Estudio de Voz WebRTC LiveKit</b>
      <br />
      <sub>Audio bidireccional sub-500ms, visualizadores dinámicos y SDKs multiplataforma</sub>
    </td>
    <td width="50%" align="center">
      <a href="screenshots/real-08-flow-builder.png"><img src="screenshots/real-08-flow-builder.png" alt="Arquitecto Visual de Flujos de Conversación" width="100%" /></a>
      <br />
      <b>Arquitecto Visual de Flujos de Conversación</b>
      <br />
      <sub>Grafo interactivo de árbol de decisiones con AI Flow Copilot y validación de ciclos</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <a href="screenshots/real-03-customizer.png"><img src="screenshots/real-03-customizer.png" alt="Personalizador de Widget en Vivo" width="100%" /></a>
      <br />
      <b>Personalizador de Widget en Vivo</b>
      <br />
      <sub>Previsualización en tiempo real WYSIWYG con motor automatizado de contraste WCAG AA/AAA</sub>
    </td>
    <td width="50%" align="center">
      <a href="screenshots/real-16-analytics.png"><img src="screenshots/real-16-analytics.png" alt="Tasas de Resolución y Desviación de Tickets" width="100%" /></a>
      <br />
      <b>Tasas de Resolución y Desviación de Tickets</b>
      <br />
      <sub>Volumen de conversación, tasa de desviación del 100% y mapas de calor de tokens</sub>
    </td>
  </tr>
</table>

<details>
<summary><b>📸 Haz clic para explorar las 22 vistas del panel de control de producción en alta resolución</b></summary>
<br />

| # | Módulo | Descripción | Captura 4K |
| :---: | :--- | :--- | :---: |
| **01** | **Resumen Ejecutivo** | Puntuación de salud de 5 pilares, tasa de desviación y KPIs en vivo a 30 días | [Ver imagen 4K](screenshots/real-01-overview.png) |
| **02** | **Espacio de Chatbots** | Gestión multirrobot, cambio de modelo (GPT-4o, Claude, Gemini) | [Ver imagen 4K](screenshots/real-02-workspace.png) |
| **03** | **Personalizador de Widget** | Paleta de diseño de 6 partes, logotipo de marca, contraste WCAG | [Ver imagen 4K](screenshots/real-03-customizer.png) |
| **04** | **Base de Conocimiento** | 52+ fuentes, 186k caracteres indexados, búsqueda vectorial HNSW | [Ver imagen 4K](screenshots/real-04-knowledge-base.png) |
| **05** | **AI Playground** | Simulador en entorno aislado con panel de inspección de citas | [Ver imagen 4K](screenshots/real-05-playground.png) |
| **06** | **Bandeja Omnicanal** | Helpdesk unificado, presencia en vivo del visitante, temporizadores de SLA | [Ver imagen 4K](screenshots/real-06-inbox.png) |
| **07** | **Campañas Proactivas** | Modales de anuncio proactivos, intención de salida y activación por scroll | [Ver imagen 4K](screenshots/real-07-campaigns.png) |
| **08** | **Constructor de Flujos** | Lienzo de conversación drag-and-drop con AI Flow Copilot | [Ver imagen 4K](screenshots/real-08-flow-builder.png) |
| **09** | **CRM de Leads** | Extracción automática de leads, telemetría GeoIP por país/ciudad, exportación CSV | [Ver imagen 4K](screenshots/real-09-leads.png) |
| **10** | **Feedback y CSAT** | Calificaciones post-chat, análisis de sentimiento y etiquetas de fricción | [Ver imagen 4K](screenshots/real-10-feedback.png) |
| **11** | **Mapa de Visitantes** | Mapa interactivo Leaflet de geolocalización que muestra tráfico regional | [Ver imagen 4K](screenshots/real-11-map.png) |
| **12** | **Planificador de Citas** | Sincronización bidireccional Google Calendar OAuth y enlaces automáticos | [Ver imagen 4K](screenshots/real-12-meetings.png) |
| **13** | **Buzón Entrante** | Enrutamiento de emails vía Resend que convierte correos en tickets | [Ver imagen 4K](screenshots/real-13-mailbox.png) |
| **14** | **Notificaciones** | Políticas de alerta de incidentes enviadas por Slack, Email y SMS | [Ver imagen 4K](screenshots/real-14-notifications.png) |
| **15** | **Registro de Auditoría** | Registro inmutable de solo adición con IP y correo del actor | [Ver imagen 4K](screenshots/real-15-audit-log.png) |
| **16** | **Analítica** | Métricas de desviación, velocidad de resolución y mapas de calor de tokens | [Ver imagen 4K](screenshots/real-16-analytics.png) |
| **17** | **Incrustación e Integración** | Generador de incrustación para React, Next.js, WordPress y lista blanca | [Ver imagen 4K](screenshots/real-17-embed-integrate.png) |
| **18** | **Agente de Voz** | Estudio WebRTC LiveKit con visualizador activo y código multi-SDK | [Ver imagen 4K](screenshots/real-18-voice-agent.png) |
| **19** | **Centro FastMCP** | 65 herramientas y 8 recursos para Claude Desktop, Cursor, Antigravity | [Ver imagen 4K](screenshots/real-19-mcp.png) |
| **20** | **API para Desarrolladores** | Claves de API con ámbito (`chatty_sk_...`) y fragmentos en varios lenguajes | [Ver imagen 4K](screenshots/real-20-developer-api.png) |
| **21** | **Facturación y Cuotas** | Portal Stripe, libro de cuotas y programa de referidos | [Ver imagen 4K](screenshots/real-21-billing.png) |
| **22** | **Ajustes del Agente** | Respuestas fundamentadas en vectores, depuración de PII y cifrado BYOK | [Ver imagen 4K](screenshots/real-22-agent-settings.png) |

</details>

---


## ✨ Características

- 🔌 **Hub Omnicanal de 7 Canales** — Mensajería bidireccional estándar con WhatsApp Cloud API, Facebook Messenger, Instagram Direct, TikTok Business Messaging, Telegram Bot, Twilio SMS (con opt-out TCPA automático) y correo electrónico de soporte con limpieza de respuestas citadas.
- 🗺️ **Motor Visual de Flujos** — Diseñador interactivo (`@xyflow/react`) con ramificaciones horarias declarativas (p. ej., ofertas dinámicas antes de las 6:00 PM vs. después de las 6:00 PM), captura de leads, reserva de citas, webhooks HTTP y detección de plataforma.
- ⚡ **Bandeja de Entrada y Takeover Humano en Vivo** — Interfaz de soporte en tiempo real vía Server-Sent Events (SSE) que permite a los agentes pausar al bot con un solo clic y responder directamente a chats de WhatsApp, Instagram, TikTok o SMS.
- 🛒 **WooCommerce y RAG Multimodal** — Sincronización en tiempo real con tiendas WooCommerce (consulta de pedidos, inventario en vivo, enlaces al carrito) junto con ingestión de PDF, DOCX, CSV, TXT, rastreo web e imágenes.
- 🎙️ **Agente de Voz LiveKit** — Conversaciones de voz bidireccionales en tiempo real mediante WebRTC con 5 visualizadores dinámicos (`wave`, `bar`, `grid`, `radial`, `aura`), transcripción de voz en vivo, modelos modulares y multimodales directos, y SDKs para Web, React, iOS, Android, Flutter y React Native.
- 💬 **Widget de Chat Integrable** — Una sola etiqueta `<script>`, respuestas en streaming vía SSE y encapsulamiento en Shadow DOM para garantizar cero conflictos de CSS.
- 📚 **Base de Conocimiento RAG** — Búsqueda semántica híbrida optimizada con PostgreSQL `pgvector`, índices HNSW y segmentación contextual.
- 🛠️ **Invocación Autónoma de Herramientas** — Agendamiento directo de reuniones (Google Meet, Microsoft Teams, Zoom), calificación de leads y comprobación de calendarios.
- 🔑 **Bring Your Own Key (BYOK)** — Nivel gratuito de Gemini predeterminado, o claves por bot de OpenAI, Anthropic o Groq con cifrado AES-128.
- 🤖 **Servidor FastMCP de 65 Herramientas** — Controla todo el panel de control programáticamente desde Claude Desktop, Cursor o Codex con autenticación OAuth 2.0 y claves de API.
- 📊 **Auditoría de Rendimiento en 5 Pilares** — Evaluación independiente de grado A-F en Conversión, Desviación de tickets, Precisión, Fiabilidad y CSAT.
- 🎯 **Campañas Proactivas** — Disparadores de comportamiento (intención de salida, tiempo en página, scroll) con programación adaptada a zonas horarias.
- 🐳 **Autoalojamiento en un Comando** — `docker compose up`, conecta tu proyecto de Supabase y arranca en 60 segundos.

---

## 🔌 Hub Omnicanal de 7 Canales

Chatty unifica los principales canales de mensajería comercial en una única bandeja de entrada. Cada mensaje se normaliza inmediatamente en una estructura de eventos común, permitiendo que los flujos visuales, la IA y los operadores humanos colaboren sin fricción.

| Canal | Protocolo / Proveedor | Controles de UI y Carga | Autenticación de Webhook | Prefijo de Sesión | Takeover Humano |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **WhatsApp** | Meta Cloud API | Texto, Multimedia, Plantillas, Botones Rápidos (Máx. 3), Listas | `X-Hub-Signature-256` (HMAC-SHA256) | `wa:` | ✅ Tiempo Real |
| **Messenger** | Meta Graph API | Texto, Adjuntos, Respuestas Rápidas, Postbacks | `X-Hub-Signature-256` (HMAC-SHA256) | `fb:` | ✅ Tiempo Real |
| **Instagram DM** | Meta Graph API | Mensajes Directos, Menciones en Stories, Respuestas Rápidas | `X-Hub-Signature-256` (HMAC-SHA256) | `ig:` | ✅ Tiempo Real |
| **TikTok** | TikTok Business Messaging | Texto, Botones de Respuesta Rápida (Máx. 3) | HMAC con marca de tiempo (`t=...,s=...`) | `tt:` | ✅ Tiempo Real |
| **Telegram** | Telegram Bot API | Texto, Markdown, Teclados Inline Dinámicos | `X-Telegram-Bot-Api-Secret-Token` | `tg:` | ✅ Tiempo Real |
| **SMS Bidireccional** | Twilio Messaging | Texto Plano, Opt-out Automático TCPA (STOP/UNSUBSCRIBE) | Firma Criptográfica de Twilio (Base64) | `sms:` | ✅ Tiempo Real |
| **Email de Soporte** | Resend / SendGrid Inbound | Cuerpo Limpio, Eliminación de Citas Históricas | Webhook Secret Challenge | `email:` | ✅ Tiempo Real |

### Aspectos Clave de Arquitectura
* **Cola de Ingestión de Latencia Cero:** Las rutas de webhook verifican la firma criptográfica y responden con `HTTP 200 OK` en menos de 40 ms. Esto evita que Meta y TikTok reintenten las peticiones (tormenta de reintentos por timeout de 3 segundos) mientras el LLM razona.
* **Normalización Inteligente de Botones:** Los botones interactivos se adaptan automáticamente según el canal (teclados inline en Telegram, recorte a los primeros 3 botones en WhatsApp y TikTok, y transpilación a opciones numéricas como `Responde [1] o [2]` en SMS).
* **Control de la Ventana de 24 Horas:** Rastrea `last_inbound_at` en canales de Meta para evitar errores por ventana expirada (`131047`), alternando automáticamente a plantillas comerciales aprobadas de WhatsApp cuando expira la ventana.
* **Interceptor de Cumplimiento TCPA:** Detecta palabras clave regulatorias (`STOP`, `UNSUBSCRIBE`, `CANCEL`, `QUIT`) para pausar cualquier automatización y confirmar la baja del usuario de forma inmediata.
* **Cifrado No Destructivo en JSONB:** Las credenciales y tokens de verificación se almacenan en una columna JSONB (`omnichannel_config`) cifrada con AES-GCM, evitando que guardar cambios en un canal borre las credenciales de los demás.

---

## 🗺️ Motor Visual de Flujos y Runtime Condicional

Chatty integra un motor de ejecución de grafos conversacionales desarrollado sobre `@xyflow/react`. Permite definir rutas conversacionales deterministas para procesos críticos y dejar que la IA resuelva dudas libres.

* **Condiciones Horarias y de Tiempo:** Los nodos de condición admiten comparaciones de tiempo en formato de 12 y 24 horas (p. ej., `< 18:00` vs. `>= 18:00`). Permite crear campañas con ofertas variables según la hora: si el cliente escribe antes de las 6:00 PM, se le informa que la promoción finaliza a las 6:30 PM; si escribe a las 7:00 PM, la oferta se extiende hasta las 9:00 PM.
* **Filtros por Metadatos de Plataforma:** Los nodos evalúan el canal de origen (`platform`, `channel`, `device`, `os`), adaptando el contenido para usuarios de WhatsApp, TikTok, web móvil o escritorio.
* **Catálogo de Nodos:**
  * **Trigger:** Activación por eventos (`session.started`, `message.user`, `lead.created`).
  * **Mensaje y Pregunta:** Respuestas con formato Markdown y botones de opción múltiple.
  * **Condición:** Ramificaciones por variables, coincidencia de texto, etiquetas o franja horaria.
  * **Captura de Leads:** Registro de nombre, email, teléfono y empresa en el CRM.
  * **Reserva de Citas:** Enlaces automáticos a Google Meet, Microsoft Teams o Zoom.
  * **Webhook:** Peticiones HTTP salientes protegidas contra SSRF con reintentos configurables.
  * **Fallback a IA:** Derivación fluida al motor RAG de la base de conocimiento.

---

## 🛒 Integración con WooCommerce y RAG Multimodal

* **Seguimiento de Pedidos en Vivo:** Los clientes pueden consultar el estado de envío y los números de seguimiento indicando su ID de pedido o correo de facturación.
* **Búsqueda de Productos e Inventario en Tiempo Real:** Consulta de stock, precios regulares y rebajados, y enlaces directos de compra mediante la API REST de WooCommerce.
* **RAG de Documentos Multiformato:** Indexación de archivos PDF, DOCX, tablas CSV, texto plano y rastreo recursivo de sitios web con `pgvector` y búsqueda semántica híbrida.
* **Comprensión Visual de Imágenes:** Procesamiento multimodal para que los clientes puedan enviar capturas de pantalla o fotografías de productos con el fin de resolver incidencias.

---

## 🎙️ Agente de Voz LiveKit y SDKs

Chatty integra un agente de voz en tiempo real de nivel empresarial impulsado por [LiveKit WebRTC](https://livekit.io), con audio bidireccional de baja latencia, 5 visualizadores dinámicos, subtítulos transcritos en vivo, alineación con la base de conocimientos y reserva de citas.

### Modos de Arquitectura: Pipeline Modular vs Multimodal en Tiempo Real

- **Modo Pipeline Modular**:
  - **Reconocimiento de Voz (STT)**: Google Cloud Speech Chirp, Deepgram Nova-3, OpenAI Whisper, Cartesia, Soniox, AssemblyAI.
  - **Razonamiento (LLM)**: Gemini 2.5 Flash, Claude 3.5 Sonnet, GPT-4o-mini, OpenRouter.
  - **Síntesis de Voz (TTS)**: Google Gemini TTS, Cartesia Sonic, ElevenLabs, Deepgram Aura, OpenAI Audio, Fish Audio.
- **Modo Multimodal en Tiempo Real**: Conexión directa de audio nativo con Gemini Live 2.5 Flash Native Audio, OpenAI Realtime, Azure OpenAI y Ultravox.

### 5 Visualizadores Dinámicos de Audio

- `wave` — Onda senoidal fluida clásica con picos armónicos.
- `bar` — Barras de espectro de ecualizador de frecuencia en movimiento.
- `grid` — Matriz LED interactiva que reacciona a los decibelios de la voz.
- `radial` — Anillos concéntricos expansivos sincronizados con la intensidad sonora.
- `aura` — Resplandor atmosférico reactivo con modulación de tono.

### Matriz de SDKs Multiplataforma

| Plataforma / SDK | Componente de Voz / Integración | Control Programático y Tokens |
| :--- | :--- | :--- |
| **HTML Script** (`widget.js`) | `<script src="..." data-mode="voice" data-display="modal"></script>` | `window.Chatty.openVoice()` |
| **React / Next.js** (`@personaliai/react-widget`) | `<VoiceAgent botId="..." />` o `<ChattyWidget mode="voice" />` | `useChatty().openVoice()` |
| **iOS** (SwiftUI) | `ChattyVoiceView(botId: "...")` | `ChattyClient.createVoiceToken(...)` |
| **Android** (Compose) | `ChattyVoiceScreen(botId = "...")` | `ChattyApi.createVoiceToken(...)` |
| **Flutter** | `ChattyVoiceScreen(botId: '...')` | `ChattyClient.createVoiceToken(...)` |
| **React Native** | `<ChattyVoiceView botId="..." />` | `ChattyClient.createVoiceToken(...)` |
| **Iframe Embebido** | `<iframe src="https://chatty.personaliai.com/embed/{botId}?voice=only"></iframe>` | Vista de navegador aislada |

---

## Arquitectura

El repositorio cuenta con una distribución estructurada: `frontend/` aloja la aplicación Next.js, el widget web y el lienzo de flujos visuales; `backend/` contiene la API FastAPI, los adaptadores omnicanal, los workers en segundo plano y las migraciones de base de datos.

### Arquitectura Dual-Engine Omnicanal

```mermaid
flowchart TB
    subgraph INBOUND["Ingreso Omnicanal y Clientes"]
        direction LR
        WIDGET["Widget Web y Voz LiveKit"]
        WA["WhatsApp Cloud API"]
        META["Messenger e Instagram DM"]
        TT["TikTok Business Messaging"]
        TG["Telegram Bot"]
        SMS["Twilio SMS Bidireccional"]
        MAIL["Email de Soporte Entrante"]
    end

    subgraph GATEWAY["Pasarela de Ingestión y Seguridad"]
        direction TB
        HMAC["Autenticación Criptográfica (HMAC-SHA256 / Tokens)"]
        ACK["Respuesta Inmediata HTTP 200 OK (<40ms)"]
        QUEUE["Cola Asíncrona de Deduplicación y Eventos"]
        DLP["Depuración de PII y Datos Sensibles en Tiempo Real"]
    end

    subgraph CORE["Cerebro de Ejecución Dual"]
        direction LR
        subgraph FLOW["Runtime del Constructor de Flujos"]
            FNODES["Nodos de Flujo (@xyflow/react)"]
            FCOND["Enrutamiento por Tiempo y Condiciones"]
            FLEAD["Captura de Leads y Sincronización CRM"]
            FBOOK["Despacho de Citas de Calendario"]
        end
        subgraph BRAIN["RAG Multimodal y Razonamiento IA"]
            VECT["Búsqueda Semántica Híbrida pgvector"]
            KB["Documentos de Conocimiento (PDF/DOCX/CSV/TXT)"]
            WOO["API de Tienda y Pedidos WooCommerce"]
            LLM["LLMs BYOK (Gemini / Claude / GPT / Groq)"]
        end
    end

    subgraph TAKEOVER["Mesa de Operadores en Vivo"]
        direction TB
        SSE["Flujo de Eventos SSE en Tiempo Real"]
        INBOX["Bandeja de Entrada Unificada y SLAs"]
        HUMAN["Takeover por Agentes Humanos con 1 Clic"]
    end

    subgraph OUTBOUND["Normalizador de Canales y Salida"]
        direction LR
        OUT_WA["WhatsApp: Ventana 24h y Plantillas"]
        OUT_TT["TikTok: Botones Rápidos (Máx 3)"]
        OUT_TG["Telegram: Teclados Inline Dinámicos"]
        OUT_SMS["SMS: Opciones Numéricas y Opt-out TCPA"]
        OUT_MAIL["Email: Respuestas Limpias en Hilo"]
        OUT_WEB["Widget: Markdown Streamdown y Tarjetas"]
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

### Arquitectura de Componentes y Datos

```mermaid
flowchart TB
    classDef actor fill:#f8fafc,stroke:#64748b,color:#0f172a
    classDef edge fill:#eff6ff,stroke:#2563eb,color:#1e3a8a
    classDef app fill:#ecfdf5,stroke:#059669,color:#064e3b
    classDef data fill:#f0fdfa,stroke:#0f766e,color:#134e4a
    classDef integration fill:#fff7ed,stroke:#ea580c,color:#7c2d12
    classDef deploy fill:#f5f3ff,stroke:#7c3aed,color:#4c1d95

    subgraph clients["Clientes y Canales"]
        direction LR
        visitor(("Visitante Web")):::actor
        operator(("Agente de Soporte")):::actor
        omni["WhatsApp · Messenger · IG · TikTok · TG · SMS · Email · MCP"]:::actor
    end
    subgraph edge["Borde Público"]
        direction LR
        tls["TLS · Lista de Dominios Permitidos · Rate Limits"]:::edge
        web["Frontend Next.js 15+ (App Router)"]:::app
    end
    subgraph runtime["Runtime de Chatty"]
        direction LR
        api["Backend FastAPI · Motor de Flujos · RAG · Webhooks"]:::app
        mcp["Servidor FastMCP 65 Herramientas (OAuth 2.0 / API Keys)"]:::app
    end
    subgraph managed["Capa Gestionada de Supabase"]
        direction LR
        auth["Supabase Auth"]:::data
        postgres["Postgres + pgvector · Configs JSONB · RLS"]:::data
        storage["Supabase Storage (Documentos y Audio)"]:::data
        realtime["Supabase Realtime"]:::data
    end
    subgraph integrations["Servicios Externos"]
        direction TB
        llm["Proveedores LLM (Gemini / OpenAI / Anthropic / Groq)"]:::integration
        calendar["Google Calendar y Microsoft 365"]:::integration
        wooCommerce["API de Tienda WooCommerce"]:::integration
        voiceLiveKit["Malla de Audio WebRTC LiveKit"]:::integration
    end
    subgraph targets["Entornos de Despliegue"]
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
    targets -. runs .-> runtime
    linkStyle default stroke:#64748b,stroke-width:1.5px
```

```
chatty/
├── frontend/         Next.js: panel de administración, widget integrable y cargador widget.js
├── backend/          FastAPI: API de chat, RAG, reservas, canales, OAuth y servidor MCP
│   ├── app/          Rutas, módulos core (auth, seguridad, base de datos) y esquemas
│   ├── plugins/      Integraciones (Google, Microsoft), RAG y orquestación del widget
│   ├── supabase/     Esquema de base de datos y migraciones ordenadas
│   ├── scripts/      apply_migrations.py y utilidades operativas
│   └── tests/        Pruebas unitarias y de integración con pytest
└── docker-compose.yml
```

---

## 📋 Requisitos

| Componente | Versión | Requerido para |
|---|---|---|
| [Docker](https://docs.docker.com/get-docker/) + Docker Compose | 24+ | Inicio rápido y despliegue estándar (método recomendado) |
| [Python](https://www.python.org/downloads/) | 3.11+ / 3.13+ | Backend, para desarrollo local sin Docker |
| [Node.js](https://nodejs.org/) | 20+ | Frontend, para desarrollo local sin Docker |
| Cuenta en [Supabase](https://supabase.com) | Nivel gratuito | Base de datos (Postgres + Auth + Storage + Realtime) |
| Clave de API de [Google AI Studio](https://aistudio.google.com/apikey) | Nivel gratuito | LLM predeterminado (Gemini) |

---

## 🚀 Inicio Rápido (Docker Compose)

```bash
git clone --recurse-submodules https://github.com/PersonaliAI/chatty.git
cd chatty

# 1. Aplica las migraciones a tu proyecto de Supabase previamente creado
cd backend && pip install psycopg2-binary
python scripts/apply_migrations.py "postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres"
cd ..

# 2. Configura las variables de entorno
cp backend/.env.example backend/.env        # completa las credenciales de Supabase y Gemini
cp frontend/.env.example frontend/.env      # completa la URL de Supabase y anon key
cp .env.example .env                        # mismos valores NEXT_PUBLIC_* (usados durante el build)

# 3. Inicia los contenedores
docker compose up --build backend frontend
```

- **Panel de control**: `http://localhost:3000` — regístrate, crea tu bot y obtén el código de inserción del widget.
- **API Backend**: `http://localhost:8000` (documentación interactiva en `http://localhost:8000/docs`).

---

## Servidor MCP y Control de Agentes

Chatty incluye un servidor oficial compatible con la especificación [Model Context Protocol (FastMCP)](https://modelcontextprotocol.io), permitiendo controlar toda la plataforma conversacionalmente desde Claude Desktop, Cursor, Codex o Antigravity:

- **Autenticación**: Flujo OAuth 2.0 con PKCE (RFC 7636) y compatibilidad con API Keys (`chatty_sk_...`).
- **65 herramientas** distribuidas en 12 categorías: ciclo de vida de bots, personalización visual, constructor de flujos, campañas proactivas, base de conocimientos RAG, bandeja de entrada omnicanal y takeover, reservas de reuniones, analítica de desviación, configuración BYOK y Voice Studio.
- **Recursos en vivo**: Configuración de voz vía `chatty://bots/{bot_id}/voice-config` y capturas del panel vía `chatty://dashboard/screenshots`.

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

## 🇪🇺 GDPR y Privacidad de Datos Empresarial

Chatty está diseñado para cumplir de forma estricta con el **Reglamento General de Protección de Datos de la UE (RGPD / GDPR)**:

* **Depuración Automática de PII (DLP):** Filtra y enmascara en tiempo real números de tarjetas de crédito validados con Luhn, números de Seguro Social (SSN), tokens Bearer y cuentas bancarias europeas IBAN (ISO 7064) en el widget web y en todos los canales omnicanal.
* **Derecho al Olvido (Art. 17):** Endpoint administrativo `DELETE /api/admin/inbox/contacts/{id}` con procedimiento almacenado `chatty_erase_contact()`, y botón de autoeliminación de sesión directamente dentro del widget para el visitante.
* **Aislamiento Criptográfico:** Credenciales BYOK y tokens cifrados en reposo mediante Fernet (AES-128-CBC + HMAC-SHA256).
* **Garantía Cero Entrenamiento:** Las conversaciones y documentos de los usuarios nunca se utilizan para entrenar modelos base de IA públicos.

---

## 🔒 Seguridad

Si descubres una posible vulnerabilidad de seguridad, por favor **no abras un issue público**. Utiliza el mecanismo confidencial en la pestaña **Security → Report a vulnerability** del repositorio en GitHub.

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para ver la guía de desarrollo local y las áreas prioritarias de colaboración.

## 📄 Licencia

Este proyecto se distribuye bajo la [Licencia MIT](LICENSE). Puedes usarlo, modificarlo e integrarlo libremente.

---

<div align="center">

⭐ Si Chatty te resulta útil, dale una estrella al repositorio en GitHub

</div>