import type {
  AdvisorPersona,
  AdvisorResponse,
  CouncilConfig,
  OrchestrationResult,
  PeerReviewResult,
  ProviderConfig,
  SynthesisResult,
} from "../types.js";
import { createProvider, type LlmProvider } from "../providers.js";
import { getCouncil, listCouncilNames } from "../personas.js";

// ─── Council Strategy (Karpathy 3-Stage Method) ───

export async function runCouncil(
  question: string,
  providers: ProviderConfig[],
  councilName?: string,
  customCouncil?: CouncilConfig,
  fastMode = false,
): Promise<OrchestrationResult> {
  const council = customCouncil ?? getCouncil(councilName ?? "executive_board");
  if (!council) {
    throw new Error(
      `Council '${councilName}' not found. Available: ${listCouncilNames().join(", ")}`,
    );
  }

  const advisorList = fastMode ? council.advisors.slice(0, 3) : council.advisors;
  const llmProviders = providers.map((p) => createProvider(p));
  const mainProvider = llmProviders[0]; // Primary for chairman

  if (!mainProvider || !mainProvider.isConfigured()) {
    throw new Error(
      "No LLM provider configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or run Ollama locally.",
    );
  }

  const startTime = Date.now();
  const result: OrchestrationResult = {
    strategy: "council",
    question,
    responses: [],
    synthesis: {
      consensusAreas: [],
      conflictAreas: [],
      blindSpots: [],
      recommendation: "",
      firstAction: "",
      chairmanNotes: "",
    },
    metadata: {
      totalLatencyMs: 0,
      totalTokens: 0,
      providersUsed: [],
      anonymousLabels: {},
    },
  };

  // ── Stage 1: Independent Opinions (Parallel) ──

  const opinionPromises = advisorList.map((advisor, i) => {
    const provider = llmProviders[i % llmProviders.length];
    return getAdvisorOpinion(advisor, question, provider);
  });

  const opinions = await Promise.all(opinionPromises);
  result.responses = opinions;
  for (const op of opinions) {
    result.metadata.totalTokens += op.latencyMs; // approximate
    if (!result.metadata.providersUsed.includes(op.provider)) {
      result.metadata.providersUsed.push(op.provider);
    }
  }

  // ── Stage 2: Anonymous Peer Review (if enabled) ──

  if (council.anonymousReview && opinions.length >= 3) {
    // Assign anonymous labels
    const shuffled = [...opinions].sort(() => Math.random() - 0.5);
    const labels = shuffled.map((_, i) => String.fromCharCode(65 + i)); // A, B, C...
    const labelMap: Record<string, string> = {};

    shuffled.forEach((op, i) => {
      labelMap[op.advisorId] = labels[i];
    });
    result.metadata.anonymousLabels = labelMap;

    // Build anonymized prompt
    const anonymizedText = shuffled
      .map(
        (op, i) =>
          `--- ADVISOR ${labels[i]} ---\n${op.content}\n`,
      )
      .join("\n");

    const reviewPromises = advisorList.map((advisor) => {
      const provider = llmProviders[Math.floor(Math.random() * llmProviders.length)];
      return getPeerReview(advisor, anonymizedText, question, provider);
    });

    const reviews = await Promise.all(reviewPromises);
    result.peerReviews = reviews.filter((r): r is PeerReviewResult => r !== null);
  }

  // ── Stage 3: Chairman Synthesis ──

  const synthesis = await getChairmanSynthesis(
    question,
    opinions,
    result.peerReviews ?? [],
    council,
    mainProvider,
  );
  result.synthesis = synthesis;

  result.metadata.totalLatencyMs = Date.now() - startTime;
  return result;
}

async function getAdvisorOpinion(
  advisor: AdvisorPersona,
  question: string,
  provider: LlmProvider,
): Promise<AdvisorResponse> {
  const start = Date.now();

  const wordRange = `Write ${150}-${200} words. Stay strictly in character. Do not try to be balanced — lean fully into your assigned perspective.`;

  const messages = [
    { role: "system" as const, content: advisor.systemPrompt },
    {
      role: "user" as const,
      content: `Evaluate this decision from your perspective:\n\n"${question}"\n\n${wordRange}\n\nFocus on:\n${advisor.focusAreas.map((f) => `- ${f}`).join("\n")}`,
    },
  ];

  const response = await provider.chat({
    model: provider.defaultModel,
    messages,
    temperature: 0.7,
    max_tokens: 600,
  });

  return {
    advisorId: advisor.id,
    advisorName: advisor.name,
    content: response.content,
    model: response.model,
    provider: provider.type,
    latencyMs: Date.now() - start,
  };
}

async function getPeerReview(
  advisor: AdvisorPersona,
  anonymizedOpinions: string,
  question: string,
  provider: LlmProvider,
): Promise<PeerReviewResult | null> {
  const messages = [
    { role: "system" as const, content: advisor.systemPrompt },
    {
      role: "user" as const,
      content: `Below are anonymous opinions (labeled A, B, C, D, E) from different advisors about:\n"${question}"\n\n${anonymizedOpinions}\n\nAnswer concisely:\n1. Which is the STRONGEST argument? (which letter and why?)\n2. Which is the WEAKEST/riskiest? (which letter and why?)\n3. Which response has a major blind spot? (which letter and what blind spot?)`,
    },
  ];

  try {
    const response = await provider.chat({
      model: provider.defaultModel,
      messages,
      temperature: 0.3,
      max_tokens: 400,
    });

    return {
      reviewerId: advisor.id,
      strongestArg: extractLabel(response.content, "strongest"),
      weakestArg: extractLabel(response.content, "weakest"),
      blindSpot: extractLabel(response.content, "blind"),
      reasoning: response.content.slice(0, 500),
    };
  } catch {
    return null;
  }
}

function extractLabel(text: string, _type: string): string {
  // Simple heuristic: find capital letter A-E in first relevant section
  const match = text.match(/[A-E]/);
  return match ? match[0] : "?";
}

async function getChairmanSynthesis(
  question: string,
  opinions: AdvisorResponse[],
  reviews: PeerReviewResult[],
  council: CouncilConfig,
  provider: LlmProvider,
): Promise<SynthesisResult> {
  const opinionText = opinions
    .map((op) => `### ${op.advisorName}\n${op.content}`)
    .join("\n\n");

  const reviewText = reviews.length > 0
    ? `\n\n## Akran Değerlendirmesi\n${reviews
        .map((r) => `**${r.reviewerId}:** Strongest: ${r.strongestArg}, Weakest: ${r.weakestArg}, Blind spot: ${r.blindSpot}`)
        .join("\n")}`
    : "";

  const prompt = `${council.chairmanPrompt ?? "Synthesize all opinions into a final decision."}

## Original Question
${question}

## Advisor Opinions
${opinionText}
${reviewText}

Format your response EXACTLY as:

**Consensus:**
...

**Conflict:**
...

**Blind Spots:**
...

**Recommendation:**
...

**First Action:**
...`;

  const messages = [
    {
      role: "system" as const,
      content: "You are the CHAIRMAN of an advisory council. Synthesize all opinions into a clear, decisive verdict. Be specific. Do not hedge. Do not say 'it depends'.",
    },
    { role: "user" as const, content: prompt },
  ];

  const response = await provider.chat({
    model: provider.defaultModel,
    messages,
    temperature: 0.3,
    max_tokens: 1000,
  });

  return parseSynthesis(response.content);
}

function parseSynthesis(text: string): SynthesisResult {
  const extract = (header: string): string => {
    const regex = new RegExp(`\\*\\*${header}\\*\\*[\\s\\S]*?\\n([\\s\\S]*?)(?=\\n\\*\\*|$)`, "i");
    const match = text.match(regex);
    return match?.[1]?.trim() ?? "";
  };

  return {
    consensusAreas: [extract("Consensus") || extract("Hemfikir Olunan Yer")],
    conflictAreas: [extract("Conflict") || extract("Çatışılan Yer")],
    blindSpots: [extract("Blind Spots") || extract("Kör Noktalar")],
    recommendation: extract("Recommendation") || extract("Tavsiye"),
    firstAction: extract("First Action") || extract("İlk Yapılması Gereken Tek Şey"),
    chairmanNotes: "",
  };
}
