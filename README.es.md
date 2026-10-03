<div align="center">

<img src="https://raw.githubusercontent.com/PersonaliAI/chatty/main/backend/assets/chatty-icon.png" alt="Chatty" width="88" /> <img src="https://raw.githubusercontent.com/PersonaliAI/chatty/main/backend/assets/readme-icon.png" alt="Chatty" width="88" />

# Chatty by PersonaliAI

**Plataforma de soporte al cliente con IA de código abierto: widget de chat + agente de voz en tiempo real + servidor MCP completo, basado en tu propia base de conocimientos.**

Ejecuta los contenedores de la aplicación en tu propia infraestructura mientras mantienes Supabase Auth, Postgres, Storage y Realtime gestionados. El mismo contrato de despliegue funciona en un VPS, Railway, Render u otro host Docker sin modificar tu proyecto activo de Supabase.

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · **Español**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/PersonaliAI/chatty/actions/workflows/ci.yml/badge.svg)](https://github.com/PersonaliAI/chatty/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](frontend)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.11-009688?logo=fastapi&logoColor=white)](backend)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![LiveKit](https://img.shields.io/badge/Voice-LiveKit-FF6600)](https://livekit.io)
[![MCP](https://img.shields.io/badge/Agent%20Control-MCP-8b5cf6)](#servidor-mcp-y-control-de-agentes)
[![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Chatty Cloud (alojado)](https://chatty.personaliai.com) · [Documentación](https://docs.chatty.personaliai.com) · [Inicio Rápido](#-inicio-rápido-docker-compose) · [Guía de despliegue](docs/SELF_HOST_MANAGED_SUPABASE.md) · [Guía de voz](backend/voice-agent/README.md) · [Características](#-características) · [Servidor MCP](#servidor-mcp-y-control-de-agentes) · [Arquitectura](#arquitectura) · [Contribuciones](#-contribuciones)

</div>

---

## Tabla de contenidos

- [¿Por qué Chatty?](#por-qué-chatty)
- [Tarjeta de Rendimiento (Auditoría A-F)](docs/SCORECARD.md)
- [Constructor de Flujos e Integraciones](https://docs.chatty.personaliai.com/guides/flow-integrations)
- [Integración del Widget (3 Líneas)](docs/WIDGET_INTEGRATION.md)
- [Características](#-características)
- [Arquitectura](#arquitectura)
- [Requisitos](#-requisitos)
- [Inicio Rápido (Docker Compose)](#-inicio-rápido-docker-compose)
- [Servidor MCP y Control de Agentes](#servidor-mcp-y-control-de-agentes)
- [Desarrollo Local](#-desarrollo-local-sin-docker)
- [Pruebas e Integración Continua](#-pruebas-e-integración-continua)
- [Seguridad](#-seguridad)
- [Contribuciones](#-contribuciones)
- [Licencia](#-licencia)

## ¿Por qué Chatty?

La mayoría de las plataformas SaaS de chatbots cobran por usuario o por mensaje y retienen tus datos de conversación. Chatty es de código abierto: ejecútalo tú mismo de forma gratuita o utiliza [Chatty Cloud](https://chatty.personaliai.com) —nuestra versión gestionada de este mismo repositorio— si prefieres delegar la infraestructura operativa. En ambos casos dispones del mismo conjunto de funciones: chat en streaming, agente de voz en tiempo real, RAG sobre tus propios documentos, reserva de reuniones, captura de leads, canales de WhatsApp y Slack, y un [servidor MCP](#servidor-mcp-y-control-de-agentes) completo para que un agente de IA administre todo el panel por ti.

|  | Chatbots SaaS de código cerrado | **Chatty** |
|---|---|---|
| **Tus datos de conversación** | Residen en sus servidores de forma permanente | En tu proyecto de Supabase, ya sea autohospedado o en Chatty Cloud |
| **Precios** | Por usuario / por mensaje, sin nivel gratuito | Autohospedaje gratuito o plan gestionado en Chatty Cloud |
| **LLM** | Restringido a su propio modelo | **Trae tu propia clave (BYOK)**: Gemini por defecto, o claves de OpenAI/Anthropic/OpenRouter |
| **Agente de voz** | Generalmente un plan separado y más costoso | Incluido, conectado a la misma base de conocimientos que el chat |
| **Acceso para agentes/automatización** | Generalmente inexistente o complemento de pago | **Servidor MCP completo incluido**: 55 herramientas protegidas por OAuth 2.0 |
| **Código fuente** | Propietario / cerrado | **Licencia MIT**: audítalo, modifícalo, amplíalo y ejecútalo donde prefieras |

## ✨ Características

- 💬 **Widget de chat integrable**: una sola etiqueta `<script>`, respuestas en streaming y compatibilidad con cualquier sitio web.
- 🎙️ **Agente de voz en tiempo real**: conversaciones fluidas estilo llamada telefónica con LiveKit, compartiendo la misma base de conocimiento del chat.
- 📚 **RAG sobre tu propia base de conocimientos**: carga archivos PDF, DOCX, PPTX o XLSX y rastrea URLs, con segmentación automática y generación de embeddings.
- 🛠️ **Llamada a herramientas (Tool-calling)**: agenda reuniones reales (enlaces a Google Meet, Microsoft Teams o Zoom), captura leads y consulta disponibilidad en calendarios.
- 🔌 **Omnicanalidad**: soporte integrado para WhatsApp y Slack, además del widget web.
- 🔑 **BYOK (Bring Your Own Key)**: Gemini por defecto (generoso nivel gratuito); configura tus propias claves de OpenAI, Anthropic u OpenRouter por bot.
- 🤖 **Servidor MCP**: conecta Claude, ChatGPT o cualquier cliente MCP y gestiona todo el panel conversacionalmente (creación de bots, flujos visuales, campañas, leads y voz con 55 herramientas aseguradas mediante OAuth 2.0 + PKCE).
- 📊 **Panel de administración**: control total sobre bots, bandeja de entrada y takeover humano, fuentes de conocimiento, reglas de agenda, campañas y canales.
- 🐳 **Autohospedaje en un comando**: ejecuta `docker compose up`, conecta tu proyecto de Supabase y la solución estará lista.

## Arquitectura

El repositorio cuenta con una estructura canónica: `frontend/` incluye el panel de administración y el widget en Next.js, mientras que `backend/` alberga la API en FastAPI, workers, integraciones y migraciones. La aplicación se ejecuta vinculada a un proyecto gestionado de Supabase (el mismo estándar que utiliza Chatty Cloud). El worker de voz opcional puede operar con LiveKit Cloud o con la infraestructura aislada de LiveKit en `backend/voice-agent`.

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
├── frontend/         Next.js: panel de administración, widget integrable y cargador widget.js
├── backend/          FastAPI: API de chat, RAG, reservas, canales, OAuth y servidor MCP
│   ├── app/          Rutas, módulos core (auth, seguridad, base de datos) y esquemas
│   ├── plugins/      Integraciones (Google, Microsoft), RAG y orquestación del widget
│   ├── supabase/     Esquema de base de datos y migraciones ordenadas
│   ├── scripts/      apply_migrations.py y utilidades operativas
│   ├── voice-agent/  Agente de voz LiveKit + stack Docker para VPS
│   └── tests/        Pruebas unitarias y de integración con pytest
└── docker-compose.yml
```

### Perfiles de despliegue

| Perfil | Servicios de datos e identidad | Cuándo usarlo |
|---|---|---|
| `managed_supabase` (predeterminado) | Supabase Auth, Postgres, Storage, pgvector y RLS | Chatty Cloud y todos los despliegues de aplicación soportados |
| Plano de medios de voz (opcional) | LiveKit + Redis privado en un VPS | Para alojar tráfico de medios y audio en tu VPS mientras los datos persisten en Supabase |

## 📋 Requisitos

| Componente | Versión | Requerido para |
|---|---|---|
| [Docker](https://docs.docker.com/get-docker/) + Docker Compose | 24+ | Inicio rápido y despliegue estándar (método recomendado) |
| [Python](https://www.python.org/downloads/) | 3.11+ | Backend, para desarrollo local sin Docker |
| [Node.js](https://nodejs.org/) | 20+ | Frontend, para desarrollo local sin Docker |
| Cuenta en [Supabase](https://supabase.com) | Nivel gratuito | Base de datos (Postgres + Auth + Storage + Realtime) |
| Clave de API de [Google AI Studio](https://aistudio.google.com/apikey) | Nivel gratuito | LLM predeterminado (Gemini) |

Cualquier otra integración (LiveKit para voz, tokens de WhatsApp/Slack, credenciales de Google/Microsoft OAuth, facturación con Lemon Squeezy, Sentry o Upstash Redis) es **opcional**: las variables de entorno que no configures desactivarán únicamente esa funcionalidad sin afectar al resto del sistema.

## 🚀 Inicio Rápido (Docker Compose)

El camino más rápido para clonar y ejecutar una instancia local completa:

```bash
git clone --recurse-submodules https://github.com/PersonaliAI/chatty.git
cd chatty

# Los plugins opcionales y SDKs son submódulos independientes.
# Para un clon existente, ejecuta: git submodule update --init --recursive

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

- **Panel de control**: `http://localhost:3000` — regístrate, crea tu bot y obtén el código de inserción del widget en la pestaña de configuración.
- **API Backend**: `http://localhost:8000` (documentación interactiva en `http://localhost:8000/docs`).

Para una guía detallada paso a paso y resolución de incidencias, consulta el [Runbook de despliegue gestionado](docs/SELF_HOST_MANAGED_SUPABASE.md).

## Servidor MCP y Control de Agentes

Chatty incluye un servidor conforme a la especificación [Model Context Protocol (MCP)](https://modelcontextprotocol.io). Permite conectar asistentes como Claude Desktop, ChatGPT o cualquier cliente MCP para operar la plataforma de forma autónoma mediante lenguaje natural:

- **Autenticación robusta**: Flujo OAuth 2.0 Authorization Code con PKCE obligatorio (RFC 7636), registro dinámico de clientes (RFC 7591) y descubrimiento RFC 8414.
- **Permisos granulares**: Alcances `read`, `write`, `knowledge`, `voice`, `actions` y `admin`.
- **55 herramientas disponibles**: Operaciones completas para gestionar bots, bases de conocimiento, flujos, campañas, agendas y transferencias a humanos.
- **Datos reales**: Cada invocación de herramienta lee y escribe en las mismas tablas que utiliza el panel de control.

Configura tu cliente MCP agregando el endpoint:

```json
{
  "mcpServers": {
    "chatty": {
      "url": "https://your-backend-domain/mcp"
    }
  }
}
```

*Nota: Al desplegar en producción bajo un dominio propio, define `CHATTY_BACKEND_URL` y `CHATTY_FRONTEND_URL` en `backend/.env` para garantizar el correcto flujo de autorización OAuth.*

## 💻 Desarrollo Local (sin Docker)

**Backend:**
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # o source .venv/bin/activate en macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Worker de voz (opcional):**
```bash
cd backend
python voice-agent/voice_worker.py dev
```

## 🧪 Pruebas e Integración Continua

El flujo de trabajo `.github/workflows/ci.yml` se ejecuta en cada push y PR a la rama `main`:

- **Backend**: validación sintáctica (`python -m compileall`), suite de pruebas completas con pytest (`backend/tests/`) y análisis de vulnerabilidades con `pip-audit`.
- **Frontend**: comprobación de tipos con TypeScript, linter con ESLint, validación de tokens de diseño del widget y compilación de producción.

Para ejecutar las pruebas del backend localmente:

```bash
cd backend
pip install -r requirements.txt pytest
python -m pytest tests/ -q
```

## 🔒 Seguridad

Si descubres una posible vulnerabilidad de seguridad, por favor **no abras un issue público**. Utiliza el mecanismo de reporte confidencial en la pestaña **Security → Report a vulnerability** del repositorio en GitHub. Responderemos a la brevedad.

Nunca confirmes ni subas archivos `.env` con credenciales reales al repositorio.

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Chatty está en constante evolución y agradecemos reportes de bugs, sugerencias y Pull Requests. Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para ver la guía de configuración y las áreas prioritarias de colaboración (nuevos conectores TTS/STT, canales de comunicación, documentación y guías de despliegue).

## 📄 Licencia

Este proyecto se distribuye bajo la [Licencia MIT](LICENSE). Puedes usarlo, bifurcarlo, modificarlo e integrarlo en proyectos comerciales libremente.

---

<div align="center">

⭐ Si Chatty te resulta útil, dale una estrella al repositorio

</div>
