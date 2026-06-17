import type { AdvisorPersona, DebateResult, DebateRound, ProviderConfig } from "../types.js";
import { createProvider, type LlmProvider } from "../providers.js";

// ─── Structured Debate Strategy ───

const DEBATER_A: AdvisorPersona = {
  id: "debater_pro",
  name: "Pro Advocate",
  emoji: "🟢",
  description: "Argues FOR the proposition with conviction.",
  stance: "creative",
  focusAreas: ["strengths", "benefits", "supporting evidence"],
  questionPatterns: ["Why is this the right move?", "What does success look like?"],
  systemPrompt:
    "You are the PRO advocate. Argue FOR the proposition with conviction and evidence. Find every reason this is the right decision. Be persuasive, specific, and forceful.",
};

const DEBATER_B: AdvisorPersona = {
  id: "debater_con",
  name: "Con Advocate",
  emoji: "🔴",
  description: "Argues AGAINST the proposition with conviction.",
  stance: "critical",
  focusAreas: ["weaknesses", "risks", "counter-evidence"],
  questionPatterns: ["Why is this wrong?", "What's the hidden cost?"],
  systemPrompt:
    "You are the CON advocate. Argue AGAINST the proposition with conviction and evidence. Find every reason this is the wrong decision. Be persuasive, specific, and forceful.",
};

const JUDGE: AdvisorPersona = {
  id: "judge",
  name: "Judge",
  emoji: "⚖️",
  description: "Impartial judge.",
  stance: "neutral",
  focusAreas: ["logic", "evidence", "argument quality"],
  questionPatterns: ["Who argued better and why?"],
  systemPrompt:
    "You are an impartial JUDGE. Evaluate debate arguments based on evidence quality, logical coherence, and persuasiveness. Do not favor either side. Declare a clear winner with reasoning.",
};

export async function runDebate(
  topic: string,
  providers: ProviderConfig[],
  rounds = 2,
): Promise<DebateResult> {
  const llmProviders = providers.map((p) => createProvider(p));
  const mainProvider = llmProviders[0];

  if (!mainProvider || !mainProvider.isConfigured()) {
    throw new Error("No LLM provider configured.");
  }

  const result: DebateResult = {
    topic,
    rounds: [],
    winner: "",
    reasoning: "",
  };

  // Opening statements
  const [openingA, openingB] = await Promise.all([
    getDebaterResponse(DEBATER_A, topic, "Opening Statement", mainProvider),
    getDebaterResponse(DEBATER_B, topic, "Opening Statement", mainProvider),
  ]);

  result.rounds.push({
    roundNumber: 0,
    positionA: openingA,
    positionB: openingB,
  });

  let lastA = openingA;
  let lastB = openingB;

  // Rebuttal rounds
  for (let r = 1; r <= rounds; r++) {
    const [rebuttalA, rebuttalB] = await Promise.all([
      getRebuttal(DEBATER_A, topic, lastB, mainProvider),
      getRebuttal(DEBATER_B, topic, lastA, mainProvider),
    ]);

    result.rounds.push({
      roundNumber: r,
      positionA: rebuttalA,
      positionB: rebuttalB,
      rebuttalA,
      rebuttalB,
    });

    lastA = rebuttalA;
    lastB = rebuttalB;
  }

  // Judge decision
  const debateTranscript = result.rounds
    .map(
      (r) =>
        `ROUND ${r.roundNumber}:\nPRO: ${r.positionA.slice(0, 500)}\nCON: ${r.positionB.slice(0, 500)}`,
    )
    .join("\n\n");

  const judgeResponse = await mainProvider.chat({
    model: mainProvider.defaultModel,
    messages: [
      { role: "system", content: JUDGE.systemPrompt },
      {
        role: "user",
        content: `Debate topic: "${topic}"\n\n${debateTranscript}\n\nDeclare the WINNER (PRO or CON) with clear reasoning. Format: WINNER: [PRO/CON]\nREASONING: ...`,
      },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  result.winner = judgeResponse.content.toUpperCase().includes("PRO") ? "PRO" : "CON";
  result.reasoning = judgeResponse.content;

  return result;
}

async function getDebaterResponse(
  persona: AdvisorPersona,
  topic: string,
  label: string,
  provider: LlmProvider,
): Promise<string> {
  const response = await provider.chat({
    model: provider.defaultModel,
    messages: [
      { role: "system", content: persona.systemPrompt },
      {
        role: "user",
        content: `${label}: "${topic}"\n\nArgue your position in 100-150 words. Be specific and persuasive.`,
      },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });
  return response.content;
}

async function getRebuttal(
  persona: AdvisorPersona,
  topic: string,
  opponentArg: string,
  provider: LlmProvider,
): Promise<string> {
  const response = await provider.chat({
    model: provider.defaultModel,
    messages: [
      { role: "system", content: persona.systemPrompt },
      {
        role: "user",
        content: `Topic: "${topic}"\n\nOpponent's argument:\n${opponentArg.slice(0, 800)}\n\nWrite a rebuttal (100-150 words). Counter their points directly. Be specific.`,
      },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });
  return response.content;
}
