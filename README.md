# Agent Playground

The interactive AI agent playground for my [**Agentic AI: From Acronyms to Applications**](https://segunakinyemi.com/blog/agentic-ai-from-acronyms-to-applications/) workshop.

## What Is an Agent?

There's a definition that's gained consensus in the [AI Engineering](https://www.latent.space/p/ai-engineer) community, articulated well by [Simon Willison](https://simonwillison.net/2025/Sep/18/agents/) and [Anthropic](https://www.anthropic.com/engineering/building-effective-agents):

> An LLM agent runs tools in a loop to achieve a goal.

**Tools** are functions the AI can call. **Loop** means it can call them multiple times, feeding results back in. **Goal** means there's a stopping condition. A chatbot just predicts the next word. An agent *does things*. This playground lets you see that in action.

## What Is This?

A web-based Agent Playground that lets workshop participants interact with a real AI agent powered by [Microsoft Foundry](https://learn.microsoft.com/azure/ai-foundry/what-is-foundry). The playground visualizes the agent's **tool-calling loop** in real time, showing when the AI autonomously decides to call tools, what results it gets back, and how it synthesizes a final response.

This is the hands-on component of the workshop, embedded inside a [VS Code for Education](https://vscodeedu.com) course.

## Architecture

1. Student sends a message from the browser.
2. A Vercel serverless function forwards it to the LLM with tool definitions.
3. The LLM may request tool calls. If it does, the function executes those tools and feeds results back to the LLM.
4. The LLM produces a final text response.
5. The full reasoning trace (every step of the loop) is returned to the browser so students can watch the agent think.

```mermaid
flowchart LR
    A["Student Browser"]:::browser
    B["Vercel Function"]:::vercel
    C["Microsoft Foundry LLM"]:::foundry
    D["Execute Tools"]:::tools

    A -- "1. Send message" --> B
    B -- "2. Forward to LLM" --> C
    C -. "3. tool_calls[]" .-> D
    D -. "4. tool results" .-> C
    C -- "5. Final response" --> B
    B -- "6. Response + reasoning trace" --> A

    classDef browser fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#1e3a5f
    classDef vercel fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#064e3b
    classDef foundry fill:#ede9fe,stroke:#7c3aed,stroke-width:2px,color:#3b0764
    classDef tools fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f
```

## Tools

The agent has access to four tools:

| Tool | Description |
|------|-------------|
| `get_charlotte_weather` | Live weather and 3-day forecast for Charlotte, NC (via [Open-Meteo](https://open-meteo.com/)) |
| `get_people_in_space` | Who is currently in space right now (via [Open Notify](http://open-notify.org/)) |
| `get_recent_earthquakes` | Significant earthquakes from the past 7 days worldwide (via [USGS](https://earthquake.usgs.gov/)) |
| `get_charlotte_cinnamon_roll_rankings` | Returns my definitive cinnamon roll rankings for Charlotte, NC |

Three of these tools hit live external APIs (weather, astronauts, earthquakes). One returns local data (cinnamon rolls from my strong opinions). The LLM decides when and which tool to call autonomously. That autonomous decision-making is what makes it an agent.

## How It Works

The playground is embedded directly in the workshop course on [VS Code for Education](https://vscodeedu.com). Each lab page includes a standalone HTML chat client that talks to the Vercel API. Students click the green play button in VS Code for Education to open the chat, and the enabled tools are configured per-lab:

- **Lab 1**: No tools (bare chatbot)
- **Lab 2**: Weather tool only
- **Lab 3**: All 4 tools (full agent)

## Environment Variables (Vercel)

| Variable | Description |
|----------|-------------|
| `FOUNDRY_API_KEY` | Microsoft Foundry API key |
| `WORKSHOP_KEY` | Auth token shared with students during the session. Required when accessing from non-trusted origins. |
| `WORKSHOP_ACTIVE` | Set to `true` to allow requests. Set to `false` to shut down all access. This is the kill switch. |
| `TRUSTED_ORIGINS` | Comma-separated list of domain names that bypass the workshop key check. Uses hostname suffix matching. Leave empty to require the key from all origins. |

## Development

```bash
npm install
npm run dev
```
