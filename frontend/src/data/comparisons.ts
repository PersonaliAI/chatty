export interface ComparisonFeature {
  name: string;
  category: "Core AI & Grounding" | "Autonomous Capabilities" | "Developer & Agentic (MCP)" | "Operations & Team" | "Pricing & Value";
  chatty: string;
  competitor: string;
  advantage: "chatty" | "competitor" | "tie";
  details: string;
}

export interface ComparisonItem {
  slug: string;
  competitorSlug: string;
  competitorName: string;
  competitorLogoUrl?: string;
  competitorProduct: string;
  competitorTagline: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  agenticSummary: string; // Structured TL;DR for LLMs / Perplexity / ChatGPT Search
  publishedAt: string;
  updatedAt: string;
  verdict: string;
  pricingOverview: {
    chattyModel: string;
    chattyStartingPrice: string;
    competitorModel: string;
    competitorStartingPrice: string;
    annualSavingsHighlight: string;
    calculationNote: string;
  };
  scenarios: {
    whenToChooseChatty: string[];
    whenToChooseCompetitor: string[];
  };
  features: ComparisonFeature[];
  pricingBreakdown: {
    tier: string;
    volume: string;
    chattyCost: string;
    competitorCost: string;
    difference: string;
  }[];
  deepDives: {
    heading: string;
    content: string;
  }[];
  faqs: {
    question: string;
    answer: string;
  }[];
}

export const COMPARISONS: Record<string, ComparisonItem> = {
  "chatty-vs-intercom": {
    slug: "chatty-vs-intercom",
    competitorSlug: "intercom",
    competitorName: "Intercom",
    competitorProduct: "Fin AI Agent & Help Desk",
    competitorTagline: "Legacy enterprise ticketing with usage-metered AI add-ons",
    title: "Chatty vs Intercom Fin AI: Honest 2026 Comparison",
    metaTitle: "Chatty vs Intercom (2026): Honest Feature & Pricing Comparison",
    metaDescription: "An in-depth, honest comparison between Chatty and Intercom Fin. Compare pricing math ($0.99/resolution vs flat pricing), MCP tool access, voice agents, and self-hosting.",
    agenticSummary:
      "Chatty and Intercom differ fundamentally in pricing structure and AI autonomy. Intercom charges a base per-seat fee ($39–$99/agent/mo) plus an incremental $0.99 fee per Fin AI resolution, creating unpredictable costs for high-traffic sites. Chatty provides flat-rate pricing ($19–$399/mo) with unlimited team seats, an official 81-tool Model Context Protocol (MCP) server for external AI agents, native WebRTC voice calling, and open-source self-hosting options.",
    publishedAt: "2026-10-15",
    updatedAt: "2026-10-19",
    verdict:
      "Choose Intercom if you are a large enterprise requiring complex human help desk SLAs, outbound product tours, and legacy Salesforce ticketing workflows. Choose Chatty if you want modern autonomous AI agents with predictable flat pricing, native calendar scheduling, zero per-seat fees, real-time voice calls, and full programmatic control through the Model Context Protocol (MCP).",
    pricingOverview: {
      chattyModel: "Flat predictable tiers (Unlimited team seats, zero resolution tax)",
      chattyStartingPrice: "$19/mo (or $99/mo for Standard with 10k credits)",
      competitorModel: "Per-seat base ($39–$99/agent) + $0.99 per Fin AI resolution",
      competitorStartingPrice: "$39/seat/mo + variable AI resolution fees",
      annualSavingsHighlight: "Save between $15,000 and $35,000+ per year at moderate volume",
      calculationNote: "Based on 2,000 customer resolutions/mo with a 3-person support team.",
    },
    scenarios: {
      whenToChooseChatty: [
        "You want predictable monthly billing without a $0.99 penalty every time your AI successfully answers a customer.",
        "You want external AI coding agents (Claude, Codex, Antigravity, Cursor) to manage, crawl, and configure your chatbots via Model Context Protocol (MCP).",
        "You need native in-chat Google Meet or Outlook calendar booking without paying for Calendly or third-party Intercom apps.",
        "You require bidirectional real-time WebRTC voice calling inside the widget for phone-free voice assistance.",
        "You value open-source autonomy, Docker deployment, and zero-markup Bring Your Own Key (BYOK) privacy.",
      ],
      whenToChooseCompetitor: [
        "You need complex enterprise IT ticketing with multi-department escalation queues, granular SLAs, and shift schedules.",
        "Your marketing team relies heavily on in-app walkthrough product tours and proactive mobile push banners.",
        "You have an established 50+ agent human contact center already trained on Intercom's inbox shortcuts.",
        "You require deeply embedded legacy bidirectional sync with Salesforce Service Cloud or Marketo enterprise instances.",
      ],
    },
    features: [
      {
        name: "Pricing Structure",
        category: "Pricing & Value",
        chatty: "Flat subscription ($19–$399/mo) or Self-Host Free. Zero per-seat fee, zero per-resolution tax.",
        competitor: "$39–$99/seat/mo + $0.99 per Fin resolution. Costs escalate sharply with volume.",
        advantage: "chatty",
        details: "Intercom's metered resolution model penalizes businesses whose deflection rate improves.",
      },
      {
        name: "Model Context Protocol (MCP)",
        category: "Developer & Agentic (MCP)",
        chatty: "Official FastMCP Server with 81 production tools & OAuth 2.0 PKCE for Claude, Codex, Cursor.",
        competitor: "No Model Context Protocol support. Closed proprietary APIs.",
        advantage: "chatty",
        details: "Chatty allows AI developer assistants to crawl docs, build bots, tweak CSS, and manage leads programmatically.",
      },
      {
        name: "In-Chat Calendar Booking",
        category: "Autonomous Capabilities",
        chatty: "Native Google & Outlook calendar integration with slot hold, buffer time, and meeting links.",
        competitor: "Requires external app integrations or third-party Calendly redirects.",
        advantage: "chatty",
        details: "Visitors book demos directly inside Chatty without leaving the conversation tab.",
      },
      {
        name: "Real-Time Voice Agent",
        category: "Autonomous Capabilities",
        chatty: "WebRTC LiveKit bidirectional audio calling directly inside the widget with audio visualizers.",
        competitor: "Not supported. Text and pre-recorded audio attachments only.",
        advantage: "chatty",
        details: "Chatty provides phone-like voice conversations right from browser or mobile web.",
      },
      {
        name: "Hallucination Protection",
        category: "Core AI & Grounding",
        chatty: "Strict pgvector cosine similarity thresholding with URL deep citations & fallback lead capture.",
        competitor: "Fin summarization engine with custom article links.",
        advantage: "tie",
        details: "Both platforms offer strong grounding, though Chatty allows direct vector threshold configuration.",
      },
      {
        name: "E-Commerce & WooCommerce",
        category: "Autonomous Capabilities",
        chatty: "Native 1-click WooCommerce store sync, dynamic product inventory knowledge, and order lookup.",
        competitor: "Requires third-party Shopify / WooCommerce marketplace connectors.",
        advantage: "chatty",
        details: "Chatty synchronizes product catalogs directly into vector search for instant sales recommendations.",
      },
      {
        name: "Visual Flow Builder",
        category: "Autonomous Capabilities",
        chatty: "Multi-branch decision tree canvas for conditional triggers, surveys, and multi-step actions.",
        competitor: "Series & Custom Bots flow engine (available on higher tiers).",
        advantage: "tie",
        details: "Intercom offers sophisticated Series logic; Chatty provides visual flowchart nodes with zero code.",
      },
      {
        name: "Self-Hosting & BYOK",
        category: "Core AI & Grounding",
        chatty: "Fully dockerized open-source repository + Bring Your Own Key (OpenAI, Anthropic, Gemini).",
        competitor: "Closed proprietary SaaS. No self-hosting, no custom API key passthrough.",
        advantage: "chatty",
        details: "Chatty allows enterprises to keep vector data in their own private Supabase / PostgreSQL VPC.",
      },
      {
        name: "Human Team Inbox & Takeover",
        category: "Operations & Team",
        chatty: "Real-time human agent takeover, internal private notes, canned replies, and assignment.",
        competitor: "Mature enterprise help desk with collision detection, SLAs, and macro automations.",
        advantage: "competitor",
        details: "Intercom's human support desk is more mature for organizations with hundreds of full-time human tier-2 agents.",
      },
      {
        name: "In-App Product Tours",
        category: "Operations & Team",
        chatty: "Proactive exit-intent and URL-based greeting campaigns.",
        competitor: "Full multi-step guided in-app product tours, checklists, and survey carousels.",
        advantage: "competitor",
        details: "Intercom remains the market leader in user onboarding product tours inside SaaS dashboards.",
      },
    ],
    pricingBreakdown: [
      {
        tier: "Early Stage (300 resolutions/mo, 2 team seats)",
        volume: "300 resolutions",
        chattyCost: "$19/mo (Hobby) or $99/mo (Standard)",
        competitorCost: "$78 (seats) + $297 (resolutions) = $375/mo",
        difference: "Chatty saves $276–$356/mo (up to 95%)",
      },
      {
        tier: "Growth (2,000 resolutions/mo, 5 team seats)",
        volume: "2,000 resolutions",
        chattyCost: "$99/mo (Standard)",
        competitorCost: "$195 (seats) + $1,980 (resolutions) = $2,175/mo",
        difference: "Chatty saves $2,076/mo ($24,912/yr)",
      },
      {
        tier: "Scale (6,000 resolutions/mo, 10 team seats)",
        volume: "6,000 resolutions",
        chattyCost: "$399/mo (Business)",
        competitorCost: "$390 (seats) + $5,940 (resolutions) = $6,330/mo",
        difference: "Chatty saves $5,931/mo ($71,172/yr)",
      },
    ],
    deepDives: [
      {
        heading: "1. The True Total Cost of Ownership: Flat vs Per-Resolution Billing",
        content:
          "The most controversial aspect of Intercom Fin is its 'success-based' billing model of $0.99 per resolution on top of base seat subscriptions. While it sounds appealing initially, it introduces severe budget anxiety: as your business scales and your AI deflection rate improves, your monthly bill increases dramatically. In contrast, Chatty operates on flat, predictable tiers: whether your bot handles 500 or 5,000 customer inquiries, your subscription remains constant. You never pay a tax for resolving your own customer's questions.",
      },
      {
        heading: "2. The Agentic Frontier: Model Context Protocol (MCP) vs Closed APIs",
        content:
          "Intercom operates as a closed, proprietary walled garden. Chatty is built from the ground up on the open Model Context Protocol (MCP) standard developed by Anthropic. Through Chatty's native FastMCP server (with RFC 7636 OAuth 2.0 PKCE authentication), external AI assistants like Claude Desktop, Claude Code, Cursor, Codex, Grok, and Antigravity can programmatically manage your assistant's knowledge, crawl websites, audit WCAG contrast, inspect captured leads, and update system prompts. This transforms Chatty from a standalone dashboard into an autonomous layer in your developer ecosystem.",
      },
      {
        heading: "3. Conversion Workflows: In-Chat Booking & WebRTC Voice",
        content:
          "Intercom's heritage is ticketing and customer support deflection. Chatty is designed for revenue conversion: when a high-intent prospect asks about pricing or integrations, Chatty doesn't just display a help article—it offers direct, in-chat Google Meet or Outlook calendar booking with live slot reservation and timezone normalization. Furthermore, Chatty includes ultra-low-latency bidirectional WebRTC voice agents powered by LiveKit, allowing visitors to talk directly to your AI assistant with their microphone on desktop or mobile.",
      },
    ],
    faqs: [
      {
        question: "Can Chatty replace Intercom for my entire customer support team?",
        answer:
          "Yes, if your primary goal is automated AI resolution, qualified lead capture, calendar scheduling, and live chat human takeover. However, if your enterprise relies heavily on complex multi-tiered ticketing SLAs, macro triggers across 50+ human staff, or in-app product tour carousels, keeping Intercom for human ticketing while using Chatty for autonomous conversion and AI automation is also a common setup.",
      },
      {
        question: "How does Chatty avoid charging $0.99 per AI resolution?",
        answer:
          "Chatty uses efficient, high-performance RAG indexing with PostgreSQL pgvector and direct API connections to leading frontier models (Gemini 2.5 Flash, Claude 3.5 Sonnet, GPT-4o-mini). By avoiding proprietary markup and selling predictable capacity tiers rather than metered penalty taxes, we pass the raw infrastructure efficiency directly to our users.",
      },
      {
        question: "Can I migrate my existing Intercom help articles to Chatty?",
        answer:
          "Yes. Simply input your public Intercom Help Center URL (e.g. https://intercom.help/yourbrand) into Chatty's knowledge crawler. Chatty will automatically parse, clean, and vectorize all existing articles in under 3 minutes.",
      },
      {
        question: "Does Chatty support human agent takeover like Intercom?",
        answer:
          "Yes. Chatty includes a complete real-time live chat inbox. When a human teammate takes over a conversation, AI responses are immediately paused, allowing your team to exchange messages, leave private internal notes, and collect customer contact details seamlessly.",
      },
    ],
  },

  "chatty-vs-zendesk": {
    slug: "chatty-vs-zendesk",
    competitorSlug: "zendesk",
    competitorName: "Zendesk",
    competitorProduct: "Zendesk AI & Support Suite",
    competitorTagline: "Legacy IT enterprise ticketing with bolted-on AI add-ons",
    title: "Chatty vs Zendesk AI: Enterprise Help Desk vs Modern AI Agent",
    metaTitle: "Chatty vs Zendesk AI (2026): Honest Feature & Pricing Comparison",
    metaDescription: "Detailed comparison of Chatty vs Zendesk AI. Compare setup time (3 minutes vs 3 months), per-agent seat costs, Model Context Protocol support, and autonomous lead capture.",
    agenticSummary:
      "Zendesk is a legacy enterprise ITIL ticketing and multi-channel call center platform that charges $55 to $115 per agent per month, plus an additional $50/agent/mo for its Advanced AI add-on. Chatty is a lightweight, modern autonomous AI agent platform designed for fast 3-minute deployment, flat monthly pricing with zero per-seat fees, direct calendar scheduling, WebRTC voice agents, and open Model Context Protocol (MCP) integrations.",
    publishedAt: "2026-10-15",
    updatedAt: "2026-10-19",
    verdict:
      "Choose Zendesk if you operate a 100+ agent call center with legacy PBX telephony, complex IT service management (ITSM) workflows, and deep SAP/Salesforce enterprise pipelines. Choose Chatty if you want to deploy a modern, high-converting AI assistant in minutes with flat pricing, autonomous meeting scheduling, and direct AI agent programmatic control.",
    pricingOverview: {
      chattyModel: "Flat subscription ($19–$399/mo) with unlimited team seats",
      chattyStartingPrice: "$19/mo (Hobby) or $99/mo (Standard)",
      competitorModel: "Per-seat billing ($55–$115/agent/mo) + $50/agent AI add-on",
      competitorStartingPrice: "$55/agent/mo (Suite Team) + $50/agent for Advanced AI",
      annualSavingsHighlight: "Save over $10,000/year for a small 5-person support team",
      calculationNote: "Based on 5 human agents using Zendesk Suite Growth with Advanced AI.",
    },
    scenarios: {
      whenToChooseChatty: [
        "You want an AI agent deployed today without hiring certified Zendesk implementation consultants.",
        "You refuse to pay $105–$165 per user seat just so collaborators can monitor incoming customer inquiries.",
        "You want in-chat calendar booking that connects directly to your team's Google or Outlook calendars.",
        "You want your AI assistant to handle bidirectional voice conversations with WebRTC.",
        "You want AI developer tools like Claude, Codex, or Cursor to configure your bots via Model Context Protocol (MCP).",
      ],
      whenToChooseCompetitor: [
        "You require a traditional enterprise phone switchboard with physical PBX hardware integration and call recording compliance.",
        "Your organization enforces strict ITIL change management processes and multi-department service catalog ticketing.",
        "You need dedicated HIPAA BAA enterprise agreements for a massive enterprise healthcare organization.",
        "Your support team already relies on Zendesk's legacy macro ecosystem and custom triggers developed over years.",
      ],
    },
    features: [
      {
        name: "Time to Deployment",
        category: "Operations & Team",
        chatty: "Under 3 minutes. Enter your URL, crawl pages, and paste one script snippet.",
        competitor: "2 to 8 weeks. Typically requires certified implementation partners.",
        advantage: "chatty",
        details: "Chatty requires zero code, zero schema setup, and trains automatically from your public site.",
      },
      {
        name: "Per-Seat License Cost",
        category: "Pricing & Value",
        chatty: "$0. All plans include unlimited team seats (Admins, Editors, Agents, Viewers).",
        competitor: "$55 to $115/seat/month + $50/seat for Advanced AI.",
        advantage: "chatty",
        details: "Zendesk bills every teammate who touches the dashboard; Chatty allows your entire team in for free.",
      },
      {
        name: "Model Context Protocol (MCP)",
        category: "Developer & Agentic (MCP)",
        chatty: "Official 81-tool FastMCP server with OAuth 2.0 PKCE authentication.",
        competitor: "No MCP support. Traditional REST webhook APIs only.",
        advantage: "chatty",
        details: "Chatty enables AI coding assistants to manage, test, and tune customer assistants programmatically.",
      },
      {
        name: "Voice Capabilities",
        category: "Autonomous Capabilities",
        chatty: "Native WebRTC bidirectional voice agents powered by LiveKit inside the widget.",
        competitor: "Traditional VoIP / PBX phone call routing with human operators.",
        advantage: "tie",
        details: "Zendesk wins on traditional human call center routing; Chatty wins on autonomous real-time AI voice agents.",
      },
      {
        name: "Calendar & Meeting Booking",
        category: "Autonomous Capabilities",
        chatty: "In-chat direct scheduling with Google Meet & Outlook integration.",
        competitor: "Not native. Requires external third-party marketplace apps.",
        advantage: "chatty",
        details: "Chatty automatically detects booking intent and offers interactive slot reservation inside the conversation.",
      },
      {
        name: "Enterprise Ticketing & SLAs",
        category: "Operations & Team",
        chatty: "Clean conversation inbox, human agent takeover, private notes, and CSAT ratings.",
        competitor: "Deep ITIL enterprise ticketing, custom business rules, SLA timers, and trigger macros.",
        advantage: "competitor",
        details: "Zendesk is built for large multi-tier human support teams handling hundreds of thousands of tickets.",
      },
    ],
    pricingBreakdown: [
      {
        tier: "Small Team (3 agents)",
        volume: "Standard support volume",
        chattyCost: "$99/mo (Standard, unlimited seats)",
        competitorCost: "3 × ($89 + $50) = $417/mo ($5,004/yr)",
        difference: "Chatty saves $3,816/yr (76%)",
      },
      {
        tier: "Growing Business (8 agents)",
        volume: "Moderate support volume",
        chattyCost: "$99/mo (Standard, unlimited seats)",
        competitorCost: "8 × ($89 + $50) = $1,112/mo ($13,344/yr)",
        difference: "Chatty saves $12,156/yr (91%)",
      },
      {
        tier: "Mid-Market (20 agents)",
        volume: "High support volume",
        chattyCost: "$399/mo (Business, unlimited seats)",
        competitorCost: "20 × ($115 + $50) = $3,300/mo ($39,600/yr)",
        difference: "Chatty saves $34,812/yr (88%)",
      },
    ],
    deepDives: [
      {
        heading: "1. The AI-Native Advantage: Ground-Up RAG vs Bolted-On Legacy",
        content:
          "Zendesk was architected over 15 years ago around the relational concept of a 'ticket'. When generative AI arrived, Zendesk bolted an AI summarization and answer engine on top of legacy ticket tables. Chatty was created natively for the LLM era: our core pipeline revolves around vector embeddings (PostgreSQL pgvector), semantic chunking, cosine distance thresholds, and autonomous agentic workflows. This results in dramatically faster response latency, higher citation accuracy, and effortless knowledge maintenance.",
      },
      {
        heading: "2. Zero-Cost Collaboration vs The Per-Seat Tax",
        content:
          "In traditional software like Zendesk, inviting your product manager, marketing lead, or sales rep into the support portal incurs an extra $55–$165/month charge. This leads organizations to share login credentials or isolate teams from customer feedback. Chatty eliminates per-seat licensing entirely: every plan includes unlimited team members with granular Role-Based Access Control (Admin, Editor, Agent, Viewer, Billing Manager) so your entire company can stay aligned with customer conversations.",
      },
    ],
    faqs: [
      {
        question: "Can I use Chatty alongside my existing Zendesk setup?",
        answer:
          "Yes. Many organizations place Chatty on their front-facing website to handle tier-1 inquiries, capture qualified sales leads, and book calendar meetings, while routing escalated support tickets to their existing Zendesk queue via Chatty's webhook or Slack integrations.",
      },
      {
        question: "Does Chatty support human agent takeover like Zendesk?",
        answer:
          "Yes. Chatty provides a full live-chat inbox where human teammates can view live visitor sessions, take over the conversation instantly, send replies, and add private notes.",
      },
    ],
  },

  "chatty-vs-crisp": {
    slug: "chatty-vs-crisp",
    competitorSlug: "crisp",
    competitorName: "Crisp",
    competitorProduct: "Crisp Chat & Bot",
    competitorTagline: "Lightweight live chat inbox with basic rule-based automations",
    title: "Chatty vs Crisp: Lightweight Chat vs Autonomous AI Agent",
    metaTitle: "Chatty vs Crisp (2026): Honest Comparison & Feature Review",
    metaDescription: "Comparing Chatty and Crisp: see why teams upgrade from simple live chat to autonomous AI agents with vector RAG, calendar booking, and Model Context Protocol (MCP).",
    agenticSummary:
      "Crisp is an affordable live chat tool built primarily for human customer messaging with optional rule-based bot triggers. Chatty is a dedicated autonomous AI agent platform with high-precision vector RAG, automated website crawling, native in-chat calendar booking, WebRTC voice agents, and full Model Context Protocol (MCP) server integration.",
    publishedAt: "2026-10-15",
    updatedAt: "2026-10-19",
    verdict:
      "Choose Crisp if you are a solo founder or small team whose main need is a low-cost human shared inbox ($25–$95/mo) with simple canned auto-responders. Choose Chatty if you need autonomous AI customer resolution, anti-hallucination vector citations, direct calendar scheduling, and programmatic AI agent control via MCP.",
    pricingOverview: {
      chattyModel: "Flat subscription ($19–$399/mo) or Self-Host Free",
      chattyStartingPrice: "$19/mo (Hobby) or $99/mo (Standard)",
      competitorModel: "Tiered by inbox size (Free, $25/mo Pro, $95/mo Unlimited)",
      competitorStartingPrice: "Free (2 seats) / $25/mo (Pro, 4 seats)",
      annualSavingsHighlight: "Comparable base price, but Chatty includes advanced RAG & Voice",
      calculationNote: "Comparing full autonomous AI capabilities with Crisp's Unlimited plan ($95/mo).",
    },
    scenarios: {
      whenToChooseChatty: [
        "You want autonomous AI to accurately resolve 60–80% of customer questions without human intervention.",
        "You need direct in-chat calendar scheduling with Google Meet or Outlook.",
        "You need real-time WebRTC voice calling inside your chat widget.",
        "You want external AI assistants (Claude, Codex, Cursor) to manage your assistants via Model Context Protocol (MCP).",
        "You need deep e-commerce WooCommerce product catalog synchronization.",
      ],
      whenToChooseCompetitor: [
        "Your team primarily wants to chat with customers manually in real time via slick mobile apps.",
        "You need built-in co-browsing / screen-sharing with visitors without third-party tools.",
        "You want a simple $25/month shared inbox for human-driven email and live chat support.",
      ],
    },
    features: [
      {
        name: "Core Focus",
        category: "Core AI & Grounding",
        chatty: "Autonomous AI agents that resolve questions, book meetings, and convert leads.",
        competitor: "Human-to-human shared live chat inbox with rule-based bots.",
        advantage: "chatty",
        details: "Chatty is built for autonomous resolution; Crisp is built for human chat support.",
      },
      {
        name: "Vector RAG & Hallucination Guardrails",
        category: "Core AI & Grounding",
        chatty: "PostgreSQL pgvector cosine similarity with strict confidence thresholding & source citations.",
        competitor: "Basic keyword match or third-party OpenAI plugins with limited citation depth.",
        advantage: "chatty",
        details: "Chatty guarantees answers are strictly grounded in your actual website and documentation.",
      },
      {
        name: "Calendar Booking",
        category: "Autonomous Capabilities",
        chatty: "Native interactive slot selection with Google & Outlook calendar integration.",
        competitor: "Not native. Requires external link sharing.",
        advantage: "chatty",
        details: "Chatty turns support conversations directly into scheduled sales demos.",
      },
      {
        name: "Voice Agent Calling",
        category: "Autonomous Capabilities",
        chatty: "Native WebRTC bidirectional voice agents powered by LiveKit inside the widget.",
        competitor: "Not supported. Voice messages as audio files only.",
        advantage: "chatty",
        details: "Chatty allows visitors to talk directly to an AI agent via microphone.",
      },
      {
        name: "Live Co-Browsing / Crisis Screen",
        category: "Operations & Team",
        chatty: "Dashboard screenshot verification & multimodal visual tools.",
        competitor: "Native Crisp LiveTranslate and Crisp Crisis / Live Co-browsing.",
        advantage: "competitor",
        details: "Crisp includes excellent live screen-viewing tools for human agents assisting desktop users.",
      },
    ],
    pricingBreakdown: [
      {
        tier: "Basic Human Live Chat",
        volume: "Low volume",
        chattyCost: "$19/mo (Hobby) or Free Self-Hosted",
        competitorCost: "$25/mo (Pro, 4 seats)",
        difference: "Crisp is very cost-effective for pure human chat",
      },
      {
        tier: "Autonomous AI & High Deflection",
        volume: "Standard volume (10k credits)",
        chattyCost: "$99/mo (Standard, full RAG & Voice)",
        competitorCost: "$95/mo (Unlimited) + extra AI plugin costs",
        difference: "Roughly equivalent cost, but Chatty delivers true autonomous RAG",
      },
    ],
    deepDives: [
      {
        heading: "1. Rule-Based Bots vs Autonomous RAG Agents",
        content:
          "Crisp provides a reliable, clean shared inbox, but its native chatbot features rely primarily on decision-tree routing and keyword heuristics. When customers ask complex, nuanced questions spanning multiple documentation pages, rule-based systems break down. Chatty uses semantic vector search with cosine thresholding across your full documentation, generating accurate answers with clickable article source citations.",
      },
    ],
    faqs: [
      {
        question: "Can I switch from Crisp to Chatty easily?",
        answer:
          "Yes. Simply create a Chatty bot, point it at your website URL to ingest your content, and replace the Crisp script tag on your site with Chatty's 1-line embed script. The entire migration takes under 5 minutes.",
      },
    ],
  },

  "chatty-vs-chatbase": {
    slug: "chatty-vs-chatbase",
    competitorSlug: "chatbase",
    competitorName: "Chatbase",
    competitorProduct: "Custom GPT Builder",
    competitorTagline: "Simple document-to-chatbot wrapper without live operations",
    title: "Chatty vs Chatbase: Document Wrapper vs Autonomous Agent Platform",
    metaTitle: "Chatty vs Chatbase (2026): In-Depth Comparison & Review",
    metaDescription: "Compare Chatty vs Chatbase: see why businesses choose Chatty for full operational live chat, visual flow builder, calendar booking, and 81 MCP tools.",
    agenticSummary:
      "Chatbase is a lightweight RAG wrapper designed to quickly convert PDF documents into simple Q&A chat widgets. Chatty is a full-stack autonomous AI customer platform featuring human agent live takeover, visual flow builder, in-chat calendar scheduling, WooCommerce synchronization, WebRTC voice agents, and an official 81-tool Model Context Protocol (MCP) server.",
    publishedAt: "2026-10-15",
    updatedAt: "2026-10-19",
    verdict:
      "Choose Chatbase if you only need a quick, simple bot to answer internal questions from a PDF and do not need live chat takeover, lead qualification maps, calendar booking, or developer MCP tools. Choose Chatty if you want a complete production customer operations platform with visual flows, calendar scheduling, e-commerce sync, and voice calling.",
    pricingOverview: {
      chattyModel: "Flat subscription ($19–$399/mo) or Self-Host Free",
      chattyStartingPrice: "$19/mo (Hobby) or $99/mo (Standard)",
      competitorModel: "Tiered credits ($19 Hobby, $99 Standard, $399 Unlimited)",
      competitorStartingPrice: "$19/mo (Hobby with 2,000 messages)",
      annualSavingsHighlight: "Identical price points, but Chatty includes 5x more capabilities",
      calculationNote: "Comparing Standard tiers ($99/mo) on both platforms.",
    },
    scenarios: {
      whenToChooseChatty: [
        "You need live human agent takeover and team inbox tools when AI escalates.",
        "You want in-chat calendar booking directly synced to Google Meet or Outlook.",
        "You need a visual multi-branch flow builder for complex customer journeys.",
        "You want an official 81-tool Model Context Protocol (MCP) server for external AI agents.",
        "You need WooCommerce product catalog synchronization for e-commerce sales.",
        "You want real-time WebRTC voice calling inside the widget.",
      ],
      whenToChooseCompetitor: [
        "You have a single PDF file and just want a quick, dead-simple chatbot in 60 seconds with no live chat features.",
        "You don't need lead routing, calendar booking, or team members.",
      ],
    },
    features: [
      {
        name: "Human Agent Live Takeover",
        category: "Operations & Team",
        chatty: "Built-in live chat inbox with real-time takeover, typing indicators, and notes.",
        competitor: "Limited or absent. Primarily designed as an unmonitored automated bot.",
        advantage: "chatty",
        details: "Chatty allows human team members to intervene immediately when a high-value customer needs assistance.",
      },
      {
        name: "Visual Flow Builder",
        category: "Autonomous Capabilities",
        chatty: "Complete drag-and-drop visual flowchart canvas for conditional logic and buttons.",
        competitor: "Not supported. Free-form text prompting only.",
        advantage: "chatty",
        details: "Chatty lets you design structured onboarding and triage flows alongside open LLM conversation.",
      },
      {
        name: "Model Context Protocol (MCP)",
        category: "Developer & Agentic (MCP)",
        chatty: "Official 81-tool FastMCP server with OAuth 2.0 PKCE authentication.",
        competitor: "No MCP support.",
        advantage: "chatty",
        details: "Chatty integrates directly into modern agentic workflows (Claude Code, Cursor, Codex).",
      },
      {
        name: "Calendar Booking",
        category: "Autonomous Capabilities",
        chatty: "Native Google Meet & Outlook scheduling with real-time slot checking.",
        competitor: "Not supported.",
        advantage: "chatty",
        details: "Chatty books sales and support meetings directly within the chat widget.",
      },
      {
        name: "Voice Calling Agent",
        category: "Autonomous Capabilities",
        chatty: "Native WebRTC bidirectional voice agents powered by LiveKit inside the widget.",
        competitor: "Not supported.",
        advantage: "chatty",
        details: "Chatty allows visitors to talk with voice avatars directly in their browser.",
      },
    ],
    pricingBreakdown: [
      {
        tier: "Hobby Tier ($19/mo)",
        volume: "1,000–2,000 queries",
        chattyCost: "$19/mo (Includes Leads, CRM, Multi-model, Allowlist)",
        competitorCost: "$19/mo (Basic document Q&A only)",
        difference: "Same price, but Chatty includes full CRM and lead forms",
      },
      {
        tier: "Standard Tier ($99/mo)",
        volume: "10,000 queries",
        chattyCost: "$99/mo (Visual flows, Auto-Train, Calendar, Whitelabel)",
        competitorCost: "$99/mo (Document bot only)",
        difference: "Chatty provides an entire operational support suite for the same price",
      },
    ],
    deepDives: [
      {
        heading: "1. Moving Beyond Simple PDF Wrappers",
        content:
          "Many first-generation AI tools were simple wrappers over the OpenAI completions API with a vector index. Chatbase popularized this concept for simple document Q&A. However, modern businesses quickly discover that static Q&A is not enough: customers want to book calls, query live product inventory, and escalate to human agents when edge cases arise. Chatty bridges this gap by unifying autonomous RAG, visual flows, live chat takeover, and calendar booking into one coherent platform.",
      },
    ],
    faqs: [
      {
        question: "Can Chatty read my PDF and Word documents like Chatbase?",
        answer:
          "Yes. Chatty supports PDF, DOCX, TXT, CSV, full website URL crawling, and Google Drive syncing, with automatic text chunking and vector embedding.",
      },
      {
        question: "Is Chatty self-hostable unlike Chatbase?",
        answer:
          "Yes. Chatty provides a full open-source codebase on GitHub that you can self-host via Docker on your own cloud infrastructure (GCP, AWS, Supabase, DigitalOcean).",
      },
    ],
  },

  "chatty-vs-tidio": {
    slug: "chatty-vs-tidio",
    competitorSlug: "tidio",
    competitorName: "Tidio",
    competitorProduct: "Lyro AI & Tidio Live Chat",
    competitorTagline: "Popular SMB live chat with restrictive conversation quotas",
    title: "Chatty vs Tidio (Lyro AI): 2026 Honest Comparison",
    metaTitle: "Chatty vs Tidio Lyro AI (2026): Honest Feature & Pricing Review",
    metaDescription: "An in-depth, honest comparison between Chatty and Tidio Lyro AI. Compare conversation quotas, AI hallucination guardrails, MCP agent tools, voice calling, and pricing.",
    agenticSummary:
      "Tidio Lyro AI and Chatty cater to different scale requirements. Tidio bundles basic live chat with Lyro AI, but restricts AI usage to tight conversation quotas (only 50 Lyro conversations included on Starter plans, requiring costly add-on packs of $39+ for every 50 additional conversations). Chatty provides 10,000 queries per month on its $99 Standard tier with zero per-conversation penalties, an 81-tool Model Context Protocol (MCP) server for external AI agents, native WebRTC voice calling, and open-source self-hosting.",
    publishedAt: "2026-10-15",
    updatedAt: "2026-10-19",
    verdict:
      "Choose Tidio if you run a small Shopify boutique that wants simple visual drag-and-drop cart abandonment popups and requires fewer than 100 AI conversations per month. Choose Chatty if you want autonomous, high-volume AI customer service without punitive conversation caps, direct calendar booking, native WebRTC voice agents, and programmatic developer control via MCP.",
    pricingOverview: {
      chattyModel: "Flat predictable monthly pricing (10,000 queries on Standard, no per-conversation limits)",
      chattyStartingPrice: "$19/mo (Hobby) or $99/mo (Standard)",
      competitorModel: "Base subscription ($29–$59/mo) + metered Lyro AI packs ($39+ per 50 conversations)",
      competitorStartingPrice: "$29/mo (includes only 50 Lyro AI conversations)",
      annualSavingsHighlight: "Save $2,400 to $6,000+ per year on mid-to-high inquiry volumes",
      calculationNote:
        "Based on 1,000 monthly AI customer conversations. Tidio charges $29 base + $390/mo for 19 Lyro add-on packs = $419/mo, compared to Chatty's $99/mo flat Standard plan.",
    },
    scenarios: {
      whenToChooseChatty: [
        "You receive hundreds or thousands of customer questions monthly and don't want to get billed $39 for every 50 conversations.",
        "You want visitors to book sales calls directly in the chat widget using Google Meet or Outlook.",
        "You need an 81-tool Model Context Protocol (MCP) server so coding assistants (Claude, Cursor, Codex) can manage your bot.",
        "You want native WebRTC voice agents inside the chat bubble so visitors can speak aloud.",
        "You need self-hosting on your own cloud infrastructure.",
      ],
      whenToChooseCompetitor: [
        "You want pre-made Shopify popup templates for cart recovery and spin-to-win discount wheels.",
        "Your inquiry volume is under 50 questions a month and you primarily do human manual chat.",
        "You want an established iOS/Android mobile app for answering live chat on the go.",
      ],
    },
    features: [
      {
        name: "AI Conversation Limits",
        category: "Pricing & Value",
        chatty: "Generous query allowances (10,000 queries on Standard). No per-conversation penalties.",
        competitor: "50 Lyro conversations included; additional packs cost $39 for every 50 conversations.",
        advantage: "chatty",
        details: "Tidio's Lyro AI gets prohibitively expensive as your site traffic and customer questions scale.",
      },
      {
        name: "Calendar Meeting Scheduling",
        category: "Autonomous Capabilities",
        chatty: "Native in-chat slot picker with automatic Google & Outlook Calendar synchronization.",
        competitor: "Not native. Requires manually pasting Calendly links into messages.",
        advantage: "chatty",
        details: "Chatty enables visitors to complete sales booking without leaving the chat interface.",
      },
      {
        name: "Model Context Protocol (MCP)",
        category: "Developer & Agentic (MCP)",
        chatty: "Official 81-tool MCP server supporting Anthropic Claude, Codex, Cursor, and Open WebUI.",
        competitor: "Proprietary closed ecosystem with standard REST webhooks only.",
        advantage: "chatty",
        details: "Chatty lets external AI agents inspect conversations, crawl pages, and update bot settings.",
      },
      {
        name: "WebRTC Voice Agent",
        category: "Autonomous Capabilities",
        chatty: "Built-in real-time browser voice calling via LiveKit.",
        competitor: "Not supported.",
        advantage: "chatty",
        details: "Chatty visitors can switch instantly between typing and spoken conversational voice.",
      },
      {
        name: "Pre-Built E-Commerce Popups",
        category: "Operations & Team",
        chatty: "Visual trigger flow builder with custom condition triggers and proactive greetings.",
        competitor: "Rich library of ready-to-deploy Shopify popups, cart rescue banners, and spin wheels.",
        advantage: "competitor",
        details: "Tidio provides out-of-the-box marketing widgets designed specifically for Shopify store marketing.",
      },
    ],
    pricingBreakdown: [
      {
        tier: "Starter Volume (50 conversations)",
        volume: "50 AI conversations",
        chattyCost: "$19/mo (Hobby)",
        competitorCost: "$29/mo (Starter)",
        difference: "Chatty is $10/mo less with more included queries",
      },
      {
        tier: "Growth Volume (500 conversations)",
        volume: "500 AI conversations",
        chattyCost: "$99/mo (Standard with 10k queries)",
        competitorCost: "$380/mo (Base $29 + 9 Lyro packs @ $39)",
        difference: "Chatty saves $281/month ($3,372/year)",
      },
      {
        tier: "Scale Volume (2,000 conversations)",
        volume: "2,000 AI conversations",
        chattyCost: "$99/mo (Standard)",
        competitorCost: "$1,550/mo (Base + 39 Lyro packs)",
        difference: "Chatty saves $1,451/month ($17,412/year)",
      },
    ],
    deepDives: [
      {
        heading: "1. The Hidden Cost of Lyro AI Conversation Packs",
        content:
          "Tidio markets an attractive starting price, but merchants are often surprised by the pricing cliff of Lyro AI. Because Lyro counts any back-and-forth session as a billable conversation, a customer asking 'Where is my order?' and follow-up shipping questions burns a conversation unit. At $39 for just 50 conversations ($0.78 per session), high-traffic businesses face escalating monthly bills. Chatty uses a predictable credit model (10,000 credits on Standard) with zero per-session penalties.",
      },
    ],
    faqs: [
      {
        question: "Can I connect Chatty to WooCommerce or Shopify?",
        answer:
          "Yes. Chatty provides deep native two-way synchronization for WooCommerce product catalogs, inventory levels, and order tracking, plus universal webhooks for Shopify.",
      },
      {
        question: "Does Tidio offer open-source self-hosting?",
        answer:
          "No. Tidio is a 100% proprietary SaaS service. Chatty is open source and can be self-hosted with Docker, Supabase, and PostgreSQL.",
      },
    ],
  },

  "chatty-vs-gorgias": {
    slug: "chatty-vs-gorgias",
    competitorSlug: "gorgias",
    competitorName: "Gorgias",
    competitorProduct: "Gorgias E-Commerce Helpdesk & AI",
    competitorTagline: "Shopify-focused ticketing helpdesk with steep billable ticket volume tiers",
    title: "Chatty vs Gorgias: E-Commerce AI & Customer Support Compared",
    metaTitle: "Chatty vs Gorgias (2026): Honest Feature & Pricing Comparison",
    metaDescription: "An in-depth, honest comparison between Chatty and Gorgias. Compare ticket-based billing ($50–$900+/mo), WooCommerce sync, AI agent autonomy, and voice calling.",
    agenticSummary:
      "Chatty and Gorgias take different approaches to e-commerce customer support. Gorgias is a human-first ticketing helpdesk built specifically for Shopify stores that bills based on monthly 'billable ticket' tiers ($10 for 50 tickets up to $900+/mo for 5,000 tickets, with costly overages). Chatty is an autonomous AI customer operations platform with flat-rate pricing ($19–$99/mo), native WooCommerce bidirectional product syncing, calendar meeting booking, WebRTC voice agents, and 81 MCP tools with no ticket overage penalties.",
    publishedAt: "2026-10-15",
    updatedAt: "2026-10-19",
    verdict:
      "Choose Gorgias if you are an enterprise Shopify Plus merchant whose primary requirement is a human customer support team that needs native Shopify refund buttons, order edits, and delivery tracking inside a unified multi-channel inbox. Choose Chatty if you want autonomous AI deflection, native WooCommerce product sync, zero ticket overage stress, WebRTC voice calling, and 90% lower operational costs.",
    pricingOverview: {
      chattyModel: "Flat predictable monthly tiers ($19–$99/mo) with unlimited human seats",
      chattyStartingPrice: "$19/mo (Hobby) or $99/mo (Standard)",
      competitorModel: "Ticket-based tiered pricing ($10 to $900+/mo) based on customer inquiry volume",
      competitorStartingPrice: "$10/mo (Starter: 50 tickets) / $60/mo (Basic: 300 tickets)",
      annualSavingsHighlight: "Save $4,000 to $10,000+ per year by eliminating billable ticket overages",
      calculationNote:
        "Based on 2,000 customer inquiries/month. Gorgias Pro costs $360/month ($4,320/yr); Chatty Standard costs $99/month ($1,188/yr).",
    },
    scenarios: {
      whenToChooseChatty: [
        "You run a growing WooCommerce or multi-platform online store and want flat, predictable monthly software costs.",
        "You want an AI agent that automatically resolves product inquiries, checks inventory, and captures qualified leads.",
        "You want visitors to book consultations or VIP sales calls directly inside the chat window.",
        "You want voice customer support via WebRTC directly in the browser.",
        "You want full data ownership and the option to self-host.",
      ],
      whenToChooseCompetitor: [
        "Your business operates 100% on Shopify Plus and requires deep integration with Shopify backend actions (cancelling orders, issuing partial refunds, updating shipping addresses directly from ticket view).",
        "You have a large team of human agents handling multi-channel phone, SMS, Instagram DMs, and Facebook comments.",
        "You need built-in customer satisfaction (CSAT) survey distribution natively tied to Shopify orders.",
      ],
    },
    features: [
      {
        name: "Pricing Structure",
        category: "Pricing & Value",
        chatty: "Flat monthly pricing ($19–$99/mo). No billable ticket penalties or holiday season overage fees.",
        competitor: "Ticket-based tiers ($60/mo for 300 tickets, $360/mo for 2k, $900/mo for 5k). Overages cost $36/100 tickets.",
        advantage: "chatty",
        details: "Chatty stores are never penalized when customer traffic spikes during BFCM sales events.",
      },
      {
        name: "WooCommerce Deep Integration",
        category: "Operations & Team",
        chatty: "Native two-way synchronization for products, stock status, and catalog variations with automated vector indexing.",
        competitor: "Secondary focus; Gorgias is heavily optimized for Shopify and charges premium add-ons for other channels.",
        advantage: "chatty",
        details: "Chatty provides dedicated WooCommerce tools out of the box.",
      },
      {
        name: "Shopify Action Buttons (Refunds & Edits)",
        category: "Operations & Team",
        chatty: "Supports customer order status queries via webhooks, but requires manual store admin login for issuing refunds.",
        competitor: "Native in-app Shopify action buttons: one-click refunds, order cancellation, and duplicate order merges.",
        advantage: "competitor",
        details: "Gorgias provides unparalleled deep workflow actions for Shopify Plus human support teams.",
      },
      {
        name: "Model Context Protocol (MCP)",
        category: "Developer & Agentic (MCP)",
        chatty: "81 FastMCP endpoints enabling autonomous AI assistants to manage store knowledge and retrieve logs.",
        competitor: "Standard REST API only; no native Model Context Protocol support.",
        advantage: "chatty",
        details: "Chatty gives developer-first teams complete programmatic AI agent orchestration.",
      },
    ],
    pricingBreakdown: [
      {
        tier: "Small Store (300 tickets/mo)",
        volume: "300 inquiries",
        chattyCost: "$19/mo (Hobby)",
        competitorCost: "$60/mo (Basic)",
        difference: "Chatty saves $41/month ($492/year)",
      },
      {
        tier: "Growing Brand (2,000 tickets/mo)",
        volume: "2,000 inquiries",
        chattyCost: "$99/mo (Standard)",
        competitorCost: "$360/mo (Pro)",
        difference: "Chatty saves $261/month ($3,132/year)",
      },
      {
        tier: "High-Volume Brand (5,000 tickets/mo)",
        volume: "5,000 inquiries",
        chattyCost: "$99/mo (Standard)",
        competitorCost: "$900/mo (Advanced)",
        difference: "Chatty saves $801/month ($9,612/year)",
      },
    ],
    deepDives: [
      {
        heading: "1. The E-Commerce Seasonality Trap",
        content:
          "In e-commerce, customer support volume surges 300% to 500% during Q4 holiday shopping and Black Friday Cyber Monday (BFCM). With Gorgias, this volume surge pushes merchants into higher pricing tiers or incurs $36 per 100 extra tickets, turning high sales volume into painful software invoices. Chatty provides flat predictable monthly tiers with generous query pools, protecting your margins when your store performs best.",
      },
    ],
    faqs: [
      {
        question: "Can human agents take over conversations in Chatty like Gorgias?",
        answer:
          "Yes. Chatty provides a full live-chat inbox where human teammates can view live visitor sessions, take over the conversation instantly, send replies, and add private notes.",
      },
    ],
  },

  "chatty-vs-freshdesk": {
    slug: "chatty-vs-freshdesk",
    competitorSlug: "freshdesk",
    competitorName: "Freshdesk",
    competitorProduct: "Freshdesk & Freddy AI Copilot",
    competitorTagline: "Traditional per-agent IT and customer ticketing with add-on Freddy AI pricing",
    title: "Chatty vs Freshdesk (Freddy AI): 2026 Honest Comparison",
    metaTitle: "Chatty vs Freshdesk Freddy AI (2026): Honest Feature & Pricing Review",
    metaDescription: "An in-depth, honest comparison between Chatty and Freshworks Freshdesk. Compare per-seat pricing, Freddy AI session costs, MCP tools, voice agents, and autonomous setup.",
    agenticSummary:
      "Chatty and Freshdesk represent two distinct philosophies in customer service. Freshdesk (part of Freshworks) is a legacy multi-agent ticketing system that charges per human seat ($15–$79/agent/mo) plus extra monthly fees for Freddy AI Copilot ($29/agent/mo) and Freddy AI Agent packs ($100 per 1,000 sessions). Chatty is an autonomous AI customer support platform with zero per-seat fees, flat monthly pricing ($19–$99/mo), an official 81-tool Model Context Protocol (MCP) server, native WebRTC voice agents, and instant 3-minute website crawling.",
    publishedAt: "2026-10-15",
    updatedAt: "2026-10-19",
    verdict:
      "Choose Freshdesk if your organization is a traditional enterprise with 20+ support agents requiring ITIL service management, hardware asset tracking, telephone call center routing, and multi-department ticketing hierarchies. Choose Chatty if you want autonomous AI customer support, flat pricing with unlimited seats, in-chat calendar booking, real-time voice agents, and modern developer control via MCP.",
    pricingOverview: {
      chattyModel: "Flat monthly pricing with unlimited team seats and zero per-agent surcharges",
      chattyStartingPrice: "$19/mo (Hobby) or $99/mo (Standard)",
      competitorModel: "Per-agent seat licensing ($15–$79/seat/mo) + Freddy AI add-on costs",
      competitorStartingPrice: "$15/agent/mo (Growth) + $29/agent/mo (Freddy Copilot)",
      annualSavingsHighlight: "Save $7,000 to $18,000+ per year for a team of 5–10 agents",
      calculationNote:
        "Based on a team of 5 agents with AI assistance. Freshdesk Pro ($49/seat) + Freddy AI ($29/seat) = $390/mo ($4,680/yr). Chatty Standard with unlimited seats = $99/mo ($1,188/yr).",
    },
    scenarios: {
      whenToChooseChatty: [
        "You want to empower your whole company (sales, engineering, support) with customer access without paying $49–$79/month for every user.",
        "You want an AI agent that self-trains by crawling your website, documentation, and PDFs in 3 minutes.",
        "You want customers to book meetings directly on Google Meet or Outlook inside chat.",
        "You need an 81-tool Model Context Protocol (MCP) server for AI assistants like Claude, Cursor, and Codex.",
        "You want real-time WebRTC browser voice calling without setting up a PBX.",
      ],
      whenToChooseCompetitor: [
        "You need strict ITIL service desk processes (Change Management, Asset Tracking, Incident Escalation).",
        "You have dedicated call center teams requiring hardware VoIP desk phone integrations.",
        "You have complex multi-department SLA policies and customer satisfaction scorecards across 50+ staff.",
      ],
    },
    features: [
      {
        name: "Per-Seat Licensing",
        category: "Pricing & Value",
        chatty: "Unlimited team members included on all tiers. Zero per-seat charges.",
        competitor: "Charges $15–$79 per agent every month, penalizing team growth.",
        advantage: "chatty",
        details: "Chatty enables engineering, sales, and management to collaborate without seat licenses.",
      },
      {
        name: "AI Knowledge Training Speed",
        category: "Core AI & Grounding",
        chatty: "Self-service 3-minute crawler: enter your URL, upload PDFs or connect Google Drive.",
        competitor: "Requires manual portal configuration, article curation, and Freddy AI intent tagging.",
        advantage: "chatty",
        details: "Chatty goes from zero to a live, grounded AI agent in under 180 seconds.",
      },
      {
        name: "ITIL & Hardware Asset Tracking",
        category: "Operations & Team",
        chatty: "Focused on customer conversational operations, sales lead capture, and support.",
        competitor: "Full IT service management suite including corporate hardware inventory and change management.",
        advantage: "competitor",
        details: "Freshdesk/Freshservice is superior for internal corporate IT helpdesks managing employee laptops.",
      },
      {
        name: "Model Context Protocol (MCP)",
        category: "Developer & Agentic (MCP)",
        chatty: "81 FastMCP endpoints supporting Anthropic, Claude, Codex, Cursor, and custom agent runtimes.",
        competitor: "Closed proprietary ecosystem; standard REST API only.",
        advantage: "chatty",
        details: "Chatty enables external AI agents to programmatically query and manage customer interactions.",
      },
    ],
    pricingBreakdown: [
      {
        tier: "3 Agents + Basic AI",
        volume: "3 seats, 1,000 queries",
        chattyCost: "$19/mo (Hobby)",
        competitorCost: "$234/mo (Growth seats + Freddy AI)",
        difference: "Chatty saves $215/month ($2,580/year)",
      },
      {
        tier: "8 Agents + Advanced AI",
        volume: "8 seats, 5,000 queries",
        chattyCost: "$99/mo (Standard)",
        competitorCost: "$624/mo (Pro seats + Freddy AI)",
        difference: "Chatty saves $525/month ($6,300/year)",
      },
      {
        tier: "20 Agents + Enterprise AI",
        volume: "20 seats, 10,000 queries",
        chattyCost: "$99/mo (Standard)",
        competitorCost: "$2,160/mo (Enterprise seats + Freddy AI)",
        difference: "Chatty saves $2,061/month ($24,732/year)",
      },
    ],
    deepDives: [
      {
        heading: "1. The Hidden Seat Tax",
        content:
          "In traditional software like Freshdesk, inviting your product manager, marketing lead, or sales rep into the support portal incurs an extra $49–$79/month charge. This leads organizations to share login credentials or isolate teams from customer feedback. Chatty eliminates per-seat licensing entirely: every plan includes unlimited team members with granular Role-Based Access Control so your entire company can stay aligned with customer conversations.",
      },
    ],
    faqs: [
      {
        question: "Can I use Chatty alongside my existing Freshdesk setup?",
        answer:
          "Yes. Many organizations place Chatty on their front-facing website to handle tier-1 inquiries, capture qualified sales leads, and book calendar meetings, while routing escalated support tickets to their existing Freshdesk queue via Chatty's webhook or Slack integrations.",
      },
    ],
  },

  "chatty-vs-drift": {
    slug: "chatty-vs-drift",
    competitorSlug: "drift",
    competitorName: "Drift",
    competitorProduct: "Drift Conversational Marketing & Sales",
    competitorTagline: "High-ticket enterprise conversational sales platform with annual contract lock-in",
    title: "Chatty vs Drift: 2026 Enterprise Conversational AI Comparison",
    metaTitle: "Chatty vs Drift (2026): Honest Feature & Pricing Review",
    metaDescription: "An in-depth, honest comparison between Chatty and Drift. Compare annual enterprise contracts ($30k+/yr vs $99/mo), autonomous lead qualification, MCP tools, and calendar booking.",
    agenticSummary:
      "Drift (acquired by Salesloft) and Chatty both focus on conversational lead generation and meeting booking, but their pricing models and technology stacks are worlds apart. Drift is a high-ticket enterprise sales platform that typically requires annual contracts starting at $2,500/month ($30,000/year minimum) plus lengthy onboarding cycles. Chatty delivers autonomous AI lead qualification, in-chat calendar booking, vector RAG support, WebRTC voice agents, and an official 81-tool Model Context Protocol (MCP) server starting at $19–$99/month with zero annual lock-in.",
    publishedAt: "2026-10-15",
    updatedAt: "2026-10-19",
    verdict:
      "Choose Drift if you are a Fortune 500 B2B enterprise with dedicated Salesforce RevOps administrators, a 6-figure marketing automation budget, and mandatory enterprise integrations with 6sense, Demandbase, and Salesloft cadences. Choose Chatty if you want autonomous AI lead capture, instant calendar meeting booking, high-precision document Q&A, and voice agents at an honest, transparent price of $19–$99/month.",
    pricingOverview: {
      chattyModel: "Transparent monthly pricing ($19–$99/mo) with zero annual lock-in or setup fees",
      chattyStartingPrice: "$19/mo (Hobby) or $99/mo (Standard)",
      competitorModel: "Enterprise annual contract lock-in starting at $2,500/month ($30,000/year)",
      competitorStartingPrice: "$2,500/month (billed annually, custom quote only)",
      annualSavingsHighlight: "Save $25,000 to $40,000+ per year while gaining modern AI & MCP tools",
      calculationNote:
        "Comparing Drift's typical entry contract ($30,000/yr) with Chatty Standard ($1,188/yr).",
    },
    scenarios: {
      whenToChooseChatty: [
        "You want transparent, self-serve pricing without sitting through 3 aggressive enterprise sales pitches.",
        "You want an AI agent that handles both pre-sales lead qualification and post-sales technical support with vector RAG.",
        "You want WebRTC voice calling so high-intent prospects can talk to an AI agent right inside their browser.",
        "You need an 81-tool Model Context Protocol (MCP) server to automate your CRM and customer operations.",
        "You want to launch today in 3 minutes, not in 6 weeks of enterprise professional services.",
      ],
      whenToChooseCompetitor: [
        "You require enterprise Account-Based Marketing (ABM) de-anonymization powered by 6sense or Demandbase.",
        "Your sales floor uses Salesloft as their primary outbound sequencing and dialer engine.",
        "Your procurement department requires custom enterprise SOC2 Type II vendor contracts with bespoke indemnity clauses.",
      ],
    },
    features: [
      {
        name: "Contract Commitment & Pricing",
        category: "Pricing & Value",
        chatty: "Cancel-anytime monthly plans starting at $19/mo or $99/mo. 100% transparent self-serve.",
        competitor: "Requires mandatory annual enterprise contracts starting at $2,500/mo ($30,000/year).",
        advantage: "chatty",
        details: "Chatty gives fast-moving companies enterprise-grade lead booking without 5-figure contract commitments.",
      },
      {
        name: "Pre-Sales & Post-Sales Unification",
        category: "Core AI & Grounding",
        chatty: "Unifies vector RAG technical support documentation with lead qualification and calendar booking in one bot.",
        competitor: "Heavily skewed toward pre-sales routing playbooks; limited native technical documentation grounding.",
        advantage: "chatty",
        details: "Chatty handles both pre-sales demo booking and complex post-sales technical support in one widget.",
      },
      {
        name: "Enterprise ABM De-Anonymization",
        category: "Operations & Team",
        chatty: "Captures visitor emails, company names, and custom fields via interactive conversational forms.",
        competitor: "Native enterprise reverse-IP de-anonymization matching against 6sense and Demandbase account lists.",
        advantage: "competitor",
        details: "Drift excels at alerting sales reps when target Fortune 500 accounts land on the website.",
      },
      {
        name: "Developer & Agentic Extensibility (MCP)",
        category: "Developer & Agentic (MCP)",
        chatty: "81 FastMCP endpoints supporting Anthropic Claude, Codex, Cursor, and autonomous agent loops.",
        competitor: "Proprietary closed platform with standard REST API and webhook endpoints.",
        advantage: "chatty",
        details: "Chatty lets developer-driven teams automate bot behavior and lead routing using modern AI protocols.",
      },
    ],
    pricingBreakdown: [
      {
        tier: "Growth Team",
        volume: "1,000 conversations",
        chattyCost: "$19/mo (Hobby)",
        competitorCost: "Not offered ($30k/yr minimum)",
        difference: "Chatty provides an accessible starting tier for fast-growing companies",
      },
      {
        tier: "Mid-Market B2B",
        volume: "5,000 conversations + Calendar",
        chattyCost: "$99/mo (Standard)",
        competitorCost: "$2,500/mo ($30,000/year minimum contract)",
        difference: "Chatty saves $28,812/year with zero lock-in",
      },
      {
        tier: "Scale Enterprise",
        volume: "Unlimited conversations + Voice",
        chattyCost: "$399/mo (Enterprise)",
        competitorCost: "$4,500/mo ($54,000/year)",
        difference: "Chatty saves $49,212/year",
      },
    ],
    deepDives: [
      {
        heading: "1. The Death of the $30,000 Annual Chat Contract",
        content:
          "Conversational marketing platforms like Drift rose to prominence during the zero-interest-rate era by selling expensive annual contracts to venture-backed B2B companies. Today, engineering and marketing leaders demand software that delivers immediate ROI without 12-month contract lock-in. Chatty proves that modern AI lead capture, meeting scheduling, and vector Q&A can be delivered at a fraction of the cost.",
      },
    ],
    faqs: [
      {
        question: "Does Drift offer self-serve monthly pricing?",
        answer:
          "No. Drift requires talking to an enterprise sales representative and signing an annual or multi-year contract.",
      },
      {
        question: "Can Chatty qualify leads and route meetings like Drift?",
        answer:
          "Yes. Chatty includes visual conversation flows, custom lead capture forms, lead export to CSV/webhooks, and direct calendar meeting scheduling with Google Meet and Outlook.",
      },
    ],
  },
};
