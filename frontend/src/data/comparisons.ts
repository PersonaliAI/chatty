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
};
