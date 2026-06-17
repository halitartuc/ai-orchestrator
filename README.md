# 🤖 AI Orchestrator

**Advanced AI orchestration engine** — multi-advisor councils, structured debates, creative brainstorming, and multi-criteria evaluation. Works as an **MCP (Model Context Protocol) server** with any compatible AI tool.

Supports: **OpenCode, Claude Code, Cursor, Windsurf, Continue, Cline, Copilot, and any MCP-compatible client.**

---

## ✨ Features

### 5 Orchestration Strategies

| Strategy | Description | Use Case |
|---|---|---|
| **Council** 🏛️ | Multi-advisor decision review with anonymous peer evaluation (Karpathy method) | Critical decisions, risk assessment |
| **Debate** ⚔️ | Structured pro/con debate with judge verdict | Go/no-go decisions, tradeoff analysis |
| **Brainstorm** 💡 | Creative idea generation with scoring and clustering | Feature discovery, product innovation |
| **Evaluate** 📊 | Multi-criteria option scoring with weighted analysis | Vendor selection, tech choices |
| **Spec Review** 🔍 | Specialist review from multiple angles (security, UX, DevOps, etc.) | Pre-implementation plan review |

### 15+ Advisor Personas

| Persona | Stance | Specialty |
|---|---|---|
| Muhalif (Skeptic) | Critical | Risk detection, failure modes |
| İlk İlkeler (First Principles) | Analytical | Assumption deconstruction |
| Genişlemeci (Expansionist) | Creative | Opportunity discovery |
| Yabancı (Outsider) | Neutral | Jargon-free fresh eyes |
| İcracı (Executor) | Practical | Implementation, first steps |
| Security Auditor | Critical | Attack surfaces, data exposure |
| UX Advocate | Critical | User journey, accessibility |
| Business Analyst | Analytical | ROI, market positioning |
| DevOps Engineer | Practical | Deployability, scaling |
| Ethicist | Analytical | Fairness, societal impact |

### Pre-built Councils

- **Akıl Kurulu** (5 Turkish advisors — Karpathy method)
- **Executive Board** (6 advisors: Skeptic, Visionary, Pragmatist, Security, Business, UX)
- **Tech Review** (4 specialists: Architecture, Security, DevOps, Testing)
- **Ethics Board** (4 specialists: Ethics, UX, Skeptic, Business)
- **Quick Check** (3 advisors, no peer review — fast mode)

### Multi-Provider Support

| Provider | Setup |
|---|---|
| OpenAI | `OPENAI_API_KEY` |
| Anthropic (Claude) | `ANTHROPIC_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Ollama (local) | No key needed — just run `ollama serve` |
| Groq | `GROQ_API_KEY` |
| Google (Gemini) | `GOOGLE_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- At least one LLM provider API key (or Ollama running locally)

### Install & Configure

```bash
# Clone
git clone https://github.com/YOUR_USER/ai-orchestrator.git
cd ai-orchestrator

# Install
npm install
npm run build

# Configure at least one provider
export OPENAI_API_KEY="sk-..."
# OR
export ANTHROPIC_API_KEY="sk-ant-..."
# OR run Ollama locally: ollama serve
```

### Add to Your AI Tool

#### OpenCode

```json
// opencode.json
{
  "mcpServers": {
    "ai-orchestrator": {
      "command": "node",
      "args": ["/path/to/ai-orchestrator/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "${OPENAI_API_KEY}"
      }
    }
  }
}
```

#### Claude Code

```json
// .claude/mcp.json
{
  "mcpServers": {
    "ai-orchestrator": {
      "command": "node",
      "args": ["/path/to/ai-orchestrator/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}"
      }
    }
  }
}
```

#### Cursor / Windsurf

Add to Cursor MCP settings or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "ai-orchestrator": {
      "command": "node",
      "args": ["/absolute/path/to/ai-orchestrator/dist/index.js"]
    }
  }
}
```

---

## 📖 Usage

Once configured, call any tool from your AI assistant:

### Council (Decision Review)

```
Use the orchestrate tool to review: "Should we rewrite our Bootstrap themes to Tailwind?"

Strategy: council
Council: executive_board
```

Returns: 6 independent advisor opinions → anonymous peer review → chairman synthesis with recommendations.

### Debate (Pro/Con Analysis)

```
Orchestrate a debate on: "Should we adopt microservices?"

Strategy: debate
Rounds: 3
```

### Brainstorm (Idea Generation)

```
Brainstorm ideas for: "How to improve developer onboarding?"

Strategy: brainstorm
```

### Evaluate (Option Scoring)

```
Evaluate these database options: PostgreSQL, MongoDB, Supabase
Criteria: Performance (0.4), Ease of Use (0.3), Cost (0.3)

Strategy: evaluate
```

### Spec Review (Plan Audit)

```
Review this architecture spec from security, performance, and UX perspectives.

Strategy: spec-review
```

---

## 🔧 Architecture

```
src/
├── index.ts          # MCP Server entry point (4 tools exposed)
├── types.ts          # TypeScript type definitions
├── personas.ts       # 15+ advisor personas + 5 council presets
├── providers.ts      # LLM provider layer (7 providers)
└── strategies/
    ├── council.ts    # Karpathy 3-stage multi-advisor council
    ├── debate.ts     # Structured pro/con debate with judge
    ├── brainstorm.ts # Creative brainstorming with clustering
    └── evaluate.ts   # Multi-criteria evaluation + spec review
```

### Council Flow (Karpathy Method)

```
                   ┌─────────────┐
                   │  Question   │
                   └──────┬──────┘
           ┌──────────────┼──────────────┐
     ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
     │ Advisor A │ │ Advisor B │ │ Advisor N │  ← Parallel (isolated)
     │ (Muhalif) │ │(İlk İlk.)│ │  (...)    │
     └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
           └──────────────┼──────────────┘
                    ┌─────▼─────┐
                    │ Anonymize │              ← Anonymous review
                    └─────┬─────┘
           ┌──────────────┼──────────────┐
     ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
     │ Peer Rev A│ │ Peer Rev B│ │ Peer Rev N│
     └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
           └──────────────┼──────────────┘
                    ┌─────▼─────┐
                    │ Chairman  │              ← Synthesis
                    │ Verdict   │
                    └───────────┘
```

---

## 🛠️ Development

```bash
npm install        # Install dependencies
npm run build      # Compile TypeScript
npm run dev        # Watch mode
npm start          # Run server directly
```

---

## 📄 License

MIT — see [LICENSE](LICENSE)

---

## 🙏 Credits

- Inspired by [Andrej Karpathy's LLM Council](https://github.com/karpathy/llm-council)
- Built on the [Model Context Protocol](https://modelcontextprotocol.io/)
- Advisor personas adapted from the [Claude Skills LLM Council](https://github.com/aiwithremy/claude-skills-llm-council) community

---

**Made for AI-powered decision making. Ship with confidence.**
