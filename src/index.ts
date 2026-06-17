#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { runCouncil } from "./strategies/council.js";
import { runDebate } from "./strategies/debate.js";
import { runBrainstorm } from "./strategies/brainstorm.js";
import { runEvaluate, runSpecReview } from "./strategies/evaluate.js";
import {
  buildCouncilSimulation,
  buildDebateSimulation,
  buildBrainstormSimulation,
  buildEvaluateSimulation,
  buildSpecReviewSimulation,
} from "./simulation.js";
import {
  getCouncil,
  listCouncils,
  listAdvisors,
  ADVISORS,
  COUNCILS,
} from "./personas.js";
import { autoDetectProviders, createProvider, hasConfiguredProviders } from "./providers.js";
import type { ProviderConfig, EvaluationCriterion } from "./types.js";

// ─── MCP Server Setup ───

const server = new Server(
  {
    name: "ai-orchestrator",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// ─── Tool Definitions ───

const TOOLS = [
  {
    name: "orchestrate",
      description:
        "Run an AI orchestration strategy to evaluate a decision, idea, or plan from multiple independent perspectives. Supports: council (multi-advisor with anonymous peer review — Karpathy method), debate (structured pro/con), brainstorm (creative idea generation), evaluate (multi-criteria scoring), and spec-review (specialist review). Works WITHOUT API keys — uses the calling AI's own intelligence when no provider is configured. Set one of: OPENAI_API_KEY, ANTHROPIC_API_KEY for automated LLM calls.",
    inputSchema: {
      type: "object" as const,
      properties: {
        question: {
          type: "string",
          description: "The decision, question, or plan to evaluate.",
        },
        strategy: {
          type: "string",
          enum: ["council", "debate", "brainstorm", "evaluate", "spec-review"],
          description: "Orchestration strategy to use. 'council' is the default multi-advisor review with anonymous peer evaluation.",
          default: "council",
        },
        council: {
          type: "string",
          description:
            "Preset council to use. Options: akil_kurulu (5 Turkish advisors), executive_board (6 advisors), tech_review (4 tech specialists), ethics_board, quick_check (3 advisors). Default: akil_kurulu.",
        },
        provider: {
          type: "string",
          enum: ["openai", "anthropic", "openrouter", "ollama", "groq", "google", "deepseek"],
          description: "LLM provider to use. Auto-detected from environment variables if not specified.",
        },
        model: {
          type: "string",
          description: "Model override for the main provider.",
        },
        fastMode: {
          type: "boolean",
          description: "Use only 3 advisors instead of full council (faster, cheaper).",
        },
        options: {
          type: "array",
          items: { type: "string" },
          description: "List of options to evaluate (for 'evaluate' strategy only).",
        },
        context: {
          type: "string",
          description: "Additional context or background information for the decision.",
        },
        rounds: {
          type: "number",
          description: "Number of debate rounds (for 'debate' strategy). Default: 2.",
        },
        criteria: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              weight: { type: "number" },
              description: { type: "string" },
            },
          },
          description: "Evaluation criteria with weights (for 'evaluate' strategy).",
        },
      },
      required: ["question"],
    },
  },
  {
    name: "list_councils",
    description: "List all available council presets with their advisor compositions.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "list_personas",
    description: "List all available advisor personas that can be used in custom councils.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "status",
    description: "Check which LLM providers are configured and available.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// ─── Request Handlers ───

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(
  CallToolRequestSchema,
  async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "orchestrate": {
          const result = await handleOrchestrate(args ?? {}) as any;
          // Simulation mode: return the prompt directly so the calling AI executes it
          if (result?.mode === "simulate") {
            return {
              content: [
                {
                  type: "text",
                  text: `## 🤖 AI Orchestrator — ${result.strategy} (No API Keys)

${result.message}

---

${result.prompt}`,
                },
              ],
            };
          }
          // Automated mode: return structured JSON result
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }

        case "list_councils": {
          const councils = listCouncils();
          const detailed = Object.entries(COUNCILS).map(([id, cfg]) => ({
            id,
            name: cfg.name,
            description: cfg.description,
            advisorCount: cfg.advisors.length,
            advisors: cfg.advisors.map((a) => ({
              id: a.id,
              name: a.name,
              emoji: a.emoji,
              stance: a.stance,
            })),
            anonymousReview: cfg.anonymousReview,
          }));
          return {
            content: [{ type: "text", text: JSON.stringify(detailed, null, 2) }],
          };
        }

        case "list_personas": {
          const personas = listAdvisors().map((p) => ({
            id: p.id,
            name: p.name,
            emoji: p.emoji,
            stance: p.stance,
            description: p.description,
            focusAreas: p.focusAreas,
          }));
          return {
            content: [{ type: "text", text: JSON.stringify(personas, null, 2) }],
          };
        }

        case "status": {
          const providers = autoDetectProviders();
          const statuses = providers.map((p) => {
            const instance = createProvider(p);
            return {
              provider: p.type,
              configured: instance.isConfigured(),
              defaultModel: instance.defaultModel,
            };
          });
          return {
            content: [{ type: "text", text: JSON.stringify(statuses, null, 2) }],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (err: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: true,
                message: err.message,
                hint: err.message.includes("No LLM provider")
                  ? "Set one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY, GOOGLE_API_KEY, DEEPSEEK_API_KEY, or run Ollama locally."
                  : undefined,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }
  },
);

// ─── Orchestrate Handler ───

async function handleOrchestrate(args: Record<string, unknown>): Promise<unknown> {
  const question = args["question"] as string;
  const strategy = (args["strategy"] as string) || "council";
  const councilName = (args["council"] as string) || undefined;
  const providerType = (args["provider"] as string) || undefined;
  const model = (args["model"] as string) || undefined;
  const fastMode = Boolean(args["fastMode"]);
  const context = (args["context"] as string) || undefined;
  const optionsArr = (args["options"] as string[]) || undefined;
  const rounds = (args["rounds"] as number) || 2;
  const criteria = (args["criteria"] as any[]) || undefined;

  if (!question || question.trim().length === 0) {
    throw new Error("'question' parameter is required.");
  }

  // Build provider config
  let providers: ProviderConfig[];

  if (providerType) {
    // User explicitly specified a provider — create it directly
    providers = [
      {
        type: providerType as ProviderConfig["type"],
        model: model,
      },
    ];
  } else {
    providers = autoDetectProviders();
    if (model && providers.length > 0) {
      providers[0].model = model;
    }
  }

  // Check if we have working providers
  const haveProviders = providerType
    ? createProvider(providers[0]).isConfigured()
    : hasConfiguredProviders();

  const contextStr = context ? `\n\nContext:\n${context}` : "";

  // ── Simulation Mode (no API keys — AI executes using its own intelligence) ──
  if (!haveProviders) {
    return buildSimulationResponse(strategy, question, {
      councilName,
      fastMode,
      options: optionsArr,
      criteria,
      rounds,
      context,
    });
  }

  // ── Automated Mode (API keys available) ──
  switch (strategy) {
    case "council": {
      if (councilName && !getCouncil(councilName)) {
        throw new Error(
          `Unknown council: '${councilName}'. Available: ${listCouncils().map((c) => c.name).join(", ")}`,
        );
      }

      const result = await runCouncil(
        question + contextStr,
        providers,
        councilName,
        undefined,
        fastMode,
      );

      return {
        strategy: "council",
        council: councilName || "akil_kurulu",
        question,
        advisorResponses: result.responses.map((r) => ({
          advisor: r.advisorName,
          opinion: r.content,
          model: r.model,
        })),
        peerReviews: result.peerReviews?.map((r) => ({
          reviewer: r.reviewerId,
          strongest: r.strongestArg,
          weakest: r.weakestArg,
          blindSpot: r.blindSpot,
        })),
        synthesis: result.synthesis,
        metadata: result.metadata,
      };
    }

    case "debate": {
      const result = await runDebate(question, providers, rounds);
      return {
        strategy: "debate",
        topic: question,
        winner: result.winner,
        reasoning: result.reasoning,
        rounds: result.rounds.map((r) => ({
          round: r.roundNumber,
          pro: r.positionA.slice(0, 500),
          con: r.positionB.slice(0, 500),
        })),
      };
    }

    case "brainstorm": {
      const result = await runBrainstorm(question, providers);
      return {
        strategy: "brainstorm",
        topic: question,
        totalIdeas: result.ideas.length,
        topPick: result.topPick,
        clusters: result.clusters,
        allIdeas: result.ideas.map((i) => ({
          id: i.id,
          content: i.content,
          source: i.source,
          score: i.score,
          novelty: i.novelty,
          feasibility: i.feasibility,
        })),
      };
    }

    case "evaluate": {
      if (!optionsArr || optionsArr.length < 2) {
        throw new Error("'evaluate' strategy requires at least 2 options in the 'options' array.");
      }

      const evaluationCriteria = criteria?.map((c: any) => ({
        name: c.name as string,
        weight: c.weight as number,
        description: c.description as string,
        type: "scalar" as const,
      }));

      const result = await runEvaluate(
        question,
        optionsArr,
        evaluationCriteria ?? [],
        providers,
        context,
      );

      return {
        strategy: "evaluate",
        question,
        winner: result.winner,
        analysis: result.analysis,
        optionScores: result.options.map((o) => ({
          option: o.name,
          totalScore: o.totalScore,
          criteriaScores: o.criteriaScores,
          pros: o.pros,
          cons: o.cons,
        })),
      };
    }

    case "spec-review": {
      const result = await runSpecReview(question, providers);
      return {
        strategy: "spec-review",
        spec: question.slice(0, 200),
        reviews: result.reviews,
        riskMatrix: result.riskMatrix,
        overallScore: result.overallScore,
      };
    }

    default:
      throw new Error(`Unknown strategy: ${strategy}. Use: council, debate, brainstorm, evaluate, spec-review`);
  }
}

// ─── Simulation Mode Helper ───

function buildSimulationResponse(
  strategy: string,
  question: string,
  opts: {
    councilName?: string;
    fastMode?: boolean;
    options?: string[];
    criteria?: any[];
    rounds?: number;
    context?: string;
  },
) {
  // Resolve council advisor IDs
  let advisorIds: string[];
  const council = opts.councilName ? getCouncil(opts.councilName) : undefined;
  if (council) {
    advisorIds = council.advisors.map((a) => a.id);
  } else if (opts.fastMode) {
    advisorIds = ["skeptic", "pragmatist", "visionary"];
  } else {
    advisorIds = ["muhalif", "ilk_ilkeler", "genislemeci", "yabanci", "icraci"];
  }

  const simulationMode = "simulate";
  const contextBlock = opts.context ? `\n## Ek Bağlam\n${opts.context}\n` : "";

  switch (strategy) {
    case "council":
      return {
        mode: simulationMode,
        strategy: "council",
        message:
          "No API keys configured. Executing council using the calling AI's intelligence.",
        prompt: buildCouncilSimulation(question, advisorIds, !!opts.fastMode, opts.context),
      };

    case "debate":
      return {
        mode: simulationMode,
        strategy: "debate",
        message:
          "No API keys configured. Executing debate using the calling AI's intelligence.",
        prompt: buildDebateSimulation(question, opts.rounds ?? 2),
      };

    case "brainstorm":
      return {
        mode: simulationMode,
        strategy: "brainstorm",
        message:
          "No API keys configured. Executing brainstorm using the calling AI's intelligence.",
        prompt: buildBrainstormSimulation(question, 12),
      };

    case "evaluate": {
      const rawCriteria = Array.isArray(opts.criteria) ? opts.criteria : [];
      const parsedCriteria: EvaluationCriterion[] = rawCriteria.map((c: any) => ({
        name: c.name as string,
        weight: c.weight as number,
        description: c.description as string,
        type: (c.type as "scalar" | "boolean" | "text") ?? "scalar",
      }));

      const finalCriteria: EvaluationCriterion[] = parsedCriteria.length > 0
        ? parsedCriteria
        : [
            { name: "Impact", weight: 0.3, description: "Potential positive impact", type: "scalar" as const },
            { name: "Feasibility", weight: 0.25, description: "How practical to implement", type: "scalar" as const },
            { name: "Cost", weight: 0.2, description: "Resource cost (lower is better)", type: "scalar" as const },
            { name: "Risk", weight: 0.15, description: "Risk level (lower is better)", type: "scalar" as const },
            { name: "Time to Value", weight: 0.1, description: "Speed to deliver value", type: "scalar" as const },
          ];

      const evalOptions = Array.isArray(opts.options) ? opts.options : [];

      return {
        mode: simulationMode,
        strategy: "evaluate",
        message:
          "No API keys configured. Executing evaluation using the calling AI's intelligence.",
        prompt: buildEvaluateSimulation(
          question,
          evalOptions,
          finalCriteria,
          opts.context,
        ),
      };
    }

    case "spec-review":
      return {
        mode: simulationMode,
        strategy: "spec-review",
        message:
          "No API keys configured. Executing spec review using the calling AI's intelligence.",
        prompt: buildSpecReviewSimulation(question),
      };

    default:
      return {
        mode: simulationMode,
        strategy: "council",
        message:
          "No API keys configured. Executing council using the calling AI's intelligence.",
        prompt: buildCouncilSimulation(question, advisorIds, !!opts.fastMode, opts.context),
      };
  }
}

// ─── Start Server ───

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const providers = autoDetectProviders();
  const configured = providers.filter((p) => createProvider(p).isConfigured()).length;

  if (configured === 0) {
    console.error(
      "[ai-orchestrator] Running in SIMULATION mode (no API keys). The calling AI will execute strategies using its own intelligence.",
    );
    console.error(
      "  → Set OPENAI_API_KEY, ANTHROPIC_API_KEY, etc. for automated LLM calls.",
    );
    console.error(
      "  → Without keys, the 'orchestrate' tool returns step-by-step instructions for the AI to follow.",
    );
  } else {
    console.error(`[ai-orchestrator] Ready — ${configured} provider(s) configured. Available tools: orchestrate, list_councils, list_personas, status`);
  }
}

main().catch((err) => {
  console.error("[ai-orchestrator] Fatal error:", err.message);
  process.exit(1);
});
