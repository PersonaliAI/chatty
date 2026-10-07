# 🏷️ GitHub Topics & SEO Optimization Guide for Chatty

One of the largest drivers of iFixAi's viral discovery (16.5K stars) was comprehensive GitHub repository tagging and topic optimization. Repositories with 20 relevant topics rank significantly higher in GitHub Search, Explore, and Trending algorithms.

---

## 🎯 Recommended 20 GitHub Topics for Chatty

Apply these 20 curated topics to the `PersonaliAI/chatty` repository:

```
ai-chatbot, chatbot, customer-support, conversational-ai, rag, 
 mcp, model-context-protocol, supabase,
fastapi, nextjs, react, open-source, self-hosted, 
widget, e-commerce, appointment-booking, whatsapp-bot, slack-bot
```

### Why These 20 Topics Matter:

1. **Category Anchors:** `ai-chatbot`, `chatbot`, `customer-support`, `conversational-ai` (high search volume)
2. **Key Capabilities:** `mcp`, `model-context-protocol`, `rag`, `appointment-booking`
3. **Tech Stack:** `fastapi`, `nextjs`, `react`, `supabase`, `python`
4. **Channels & Integrations:** `whatsapp-bot`, `slack-bot`, `e-commerce`, `widget`
5. **OSS Positioning:** `open-source`, `self-hosted`

---

## ⚡ How to Apply via GitHub CLI (`gh`)

Run this one-liner from your terminal with the GitHub CLI authenticated:

```bash
gh repo edit PersonaliAI/chatty --add-topic "ai-chatbot,chatbot,customer-support,conversational-ai,rag,mcp,model-context-protocol,supabase,fastapi,nextjs,react,open-source,self-hosted,widget,e-commerce,appointment-booking,whatsapp-bot,slack-bot"
```

Or via GitHub REST API with your personal access token:

```bash
curl -X PUT \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/PersonaliAI/chatty/topics \
  -d '{"names":["ai-chatbot","chatbot","customer-support","conversational-ai","rag","mcp","model-context-protocol","supabase","fastapi","nextjs","react","open-source","self-hosted","widget","e-commerce","appointment-booking","whatsapp-bot","slack-bot"]}'
```

---

## 🖼️ Social Preview Banner & Description Optimization

### Repository Description (150 chars max):
> **Current:** Open-source AI customer support: streaming chat widget + a full MCP server, grounded in your own knowledge base.
> **Recommended (High Conversion):** 🚀 Open-source AI customer support platform: streaming chat widget + 53-tool MCP server, grounded in your own Supabase knowledge base.

### Repository Website Link:
Set the repository homepage to:
`https://chatty.personaliai.com`
