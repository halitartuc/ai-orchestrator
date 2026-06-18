import type { EvaluationCriterion, EvaluationResult, OptionScore, ProviderConfig } from "../types.js";
import { createProvider, type LlmProvider } from "../providers.js";

// ─── Multi-Criteria Option Evaluation ───

export async function runEvaluate(
  question: string,
  options: string[],
  criteria: EvaluationCriterion[],
  providers: ProviderConfig[],
  context?: string,
): Promise<EvaluationResult> {
  const llmProviders = providers.map((p) => createProvider(p));
  const mainProvider = llmProviders[0];

  if (!mainProvider || !mainProvider.isConfigured()) {
    throw new Error("No LLM provider configured.");
  }

  if (options.length < 2) {
    throw new Error("Need at least 2 options to evaluate.");
  }

  const defaultCriteria: EvaluationCriterion[] =
    criteria.length > 0
      ? criteria
      : [
          { name: "Impact", weight: 0.3, description: "Potential positive impact", type: "scalar" },
          { name: "Feasibility", weight: 0.25, description: "How practical to implement", type: "scalar" },
          { name: "Cost", weight: 0.2, description: "Resource cost (lower is better)", type: "scalar" },
          { name: "Risk", weight: 0.15, description: "Risk level (lower is better)", type: "scalar" },
          { name: "Time to Value", weight: 0.1, description: "Speed to deliver value", type: "scalar" },
        ];

  const criteriaText = defaultCriteria
    .map((c) => `- ${c.name} (weight: ${c.weight}): ${c.description}`)
    .join("\n");

  const optionsText = options
    .map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`)
    .join("\n");

  const contextText = context ? `\n\nAdditional context:\n${context}` : "";

  const response = await mainProvider.chat({
    model: mainProvider.defaultModel,
    messages: [
      {
        role: "system",
        content: "You are a decision analyst. Evaluate options against weighted criteria. Return structured JSON.",
      },
      {
        role: "user",
        content: `Question: "${question}"\n\nOptions:\n${optionsText}\n\nCriteria:\n${criteriaText}\n${contextText}\n\nScore each option 1-10 for each criterion. Then pick the winner.\n\nReturn JSON:\n{\n  "scores": {\n    "A": {"Impact": 8, "Feasibility": 6, "Cost": 4, "Risk": 7, "Time to Value": 5},\n    "B": {...}\n  },\n  "winner": "A",\n  "analysis": "2-3 sentence reasoning",\n  "pros": {"A": ["pro1", "pro2"], "B": ["pro1"]},\n  "cons": {"A": ["con1"], "B": ["con1"]}\n}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1000,
  });

  try {
    const json = extractJson(response.content);
    return parseEvaluationResult(json, options, defaultCriteria);
  } catch {
    // Fallback: simple text-based result
    return {
      options: options.map((name) => ({
        name,
        totalScore: 5,
        criteriaScores: {},
        pros: [],
        cons: [],
      })),
      winner: options[0],
      analysis: response.content.slice(0, 500),
    };
  }
}

function extractJson(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error("No JSON found");
}

function parseEvaluationResult(
  json: any,
  options: string[],
  criteria: EvaluationCriterion[],
): EvaluationResult {
  const optionScores: OptionScore[] = options.map((opt, i) => {
    const label = String.fromCharCode(65 + i);
    const raw = json.scores?.[label] ?? {};
    const criteriaScores: Record<string, number> = {};
    let total = 0;

    for (const c of criteria) {
      const score = raw[c.name] ?? 5;
      criteriaScores[c.name] = score;
      total += score * c.weight;
    }

    return {
      name: opt,
      totalScore: Math.round(total * 10) / 10,
      criteriaScores,
      pros: json.pros?.[label] ?? [],
      cons: json.cons?.[label] ?? [],
    };
  });

  const winner = json.winner
    ? options[json.winner.charCodeAt(0) - 65] ?? options[0]
    : options[0];

  return {
    options: optionScores,
    winner,
    analysis: json.analysis ?? "",
  };
}

// ─── Spec Review ───

export async function runSpecReview(
  spec: string,
  providers: ProviderConfig[],
  focusAreas: string[] = ["architecture", "security", "performance", "ux", "reliability"],
): Promise<{
  reviews: { area: string; content: string }[];
  riskMatrix: { category: string; severity: string; description: string; mitigation: string }[];
  overallScore: number;
}> {
  const llmProviders = providers.map((p) => createProvider(p));
  const mainProvider = llmProviders[0];

  if (!mainProvider || !mainProvider.isConfigured()) {
    throw new Error("No LLM provider configured.");
  }

  const reviewPromises = focusAreas.map((area) =>
    getSpecAreaReview(area, spec, mainProvider),
  );
  const reviews = await Promise.all(reviewPromises);

  const riskMatrix = await getRiskMatrix(spec, reviews, mainProvider);

  // Compute score from risk matrix: start at 10, deduct for each risk
  const severityDeductions: Record<string, number> = {
    critical: 3,
    high: 2,
    medium: 1,
    low: 0.5,
  };
  let deduction = 0;
  for (const risk of riskMatrix) {
    deduction += severityDeductions[risk.severity.toLowerCase()] ?? 0;
  }
  const overallScore = Math.max(1, Math.round(10 - deduction));

  return {
    reviews,
    riskMatrix,
    overallScore,
  };
}

async function getSpecAreaReview(
  area: string,
  specText: string,
  provider: LlmProvider,
): Promise<{ area: string; content: string }> {
  const response = await provider.chat({
    model: provider.defaultModel,
    messages: [
      {
        role: "system",
        content: `You are a specialist reviewer focusing on ${area}. Review specs critically and constructively.`,
      },
      {
        role: "user",
        content: `Review this spec/plan from a ${area} perspective:\n\n${specText.slice(0, 3000)}\n\nIdentify:
1. What's good
2. What's missing or wrong
3. Specific recommendations`,
      },
    ],
    temperature: 0.3,
    max_tokens: 800,
  });

  return { area, content: response.content };
}

async function getRiskMatrix(
  specText: string,
  reviews: { area: string; content: string }[],
  provider: LlmProvider,
): Promise<{ category: string; severity: string; description: string; mitigation: string }[]> {
  const reviewSummary = reviews.map((r) => `## ${r.area}\n${r.content.slice(0, 400)}`).join("\n\n");

  const response = await provider.chat({
    model: provider.defaultModel,
    messages: [
      {
        role: "system",
        content: "Extract key risks into a structured matrix. Return JSON array.",
      },
      {
        role: "user",
        content: `Spec:\n${specText.slice(0, 1000)}\n\nReviews:\n${reviewSummary}\n\nReturn JSON: [{"category": "...", "severity": "critical|high|medium|low", "description": "...", "mitigation": "..."}]`,
      },
    ],
    temperature: 0.3,
    max_tokens: 800,
  });

  try {
    const json = extractJson(response.content);
    if (Array.isArray(json)) return json;
  } catch {
    // fallback
  }

  return [{ category: "General", severity: "medium", description: "Unable to parse risk matrix", mitigation: "Review manually" }];
}
