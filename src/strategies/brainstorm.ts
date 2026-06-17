import type {
  AdvisorPersona,
  BrainstormIdea,
  BrainstormResult,
  IdeaCluster,
  ProviderConfig,
} from "../types.js";
import { createProvider, type LlmProvider } from "../providers.js";

// ─── Creative Brainstorming Strategy ───

const BRAINSTORM_PERSONAS: AdvisorPersona[] = [
  {
    id: "dreamer",
    name: "Dreamer",
    emoji: "🌙",
    description: "Wild, unconstrained ideas. No limits.",
    stance: "creative",
    focusAreas: ["moonshots", "impossible ideas", "radical rethinking"],
    questionPatterns: ["What if there were no constraints?"],
    systemPrompt:
      "You are the DREAMER. Generate wildly creative ideas with zero constraints. No idea is too big, too expensive, or too impossible. Think sci-fi. Think paradigm shifts.",
  },
  {
    id: "hacker",
    name: "Hacker",
    emoji: "💻",
    description: "Clever shortcuts, growth hacks, unconventional solutions.",
    stance: "creative",
    focusAreas: ["growth hacks", "clever shortcuts", "unconventional angles"],
    questionPatterns: ["What's the clever shortcut?"],
    systemPrompt:
      "You are the HACKER. Find clever shortcuts, growth hacks, and unconventional solutions. Think like a scrappy startup. What's the 80/20? What's the cheat code?",
  },
  {
    id: "artist",
    name: "Artist",
    emoji: "🎨",
    description: "Aesthetic, experiential, human-centered ideas.",
    stance: "creative",
    focusAreas: ["experience", "aesthetics", "emotional impact", "beauty"],
    questionPatterns: ["What would make this beautiful?"],
    systemPrompt:
      "You are the ARTIST. Focus on aesthetics, experience, and emotional resonance. What makes something beautiful, delightful, memorable? Design for the human, not the system.",
  },
  {
    id: "futurist",
    name: "Futurist",
    emoji: "🚀",
    description: "2050 thinking. Technology trends, emerging paradigms.",
    stance: "creative",
    focusAreas: ["trends", "emerging tech", "future scenarios"],
    questionPatterns: ["What happens when this meets AI/VR/biotech?"],
    systemPrompt:
      "You are the FUTURIST. Think 10-25 years ahead. What emerging technologies, social shifts, or market changes could transform this? Extrapolate trends boldly.",
  },
];

export async function runBrainstorm(
  topic: string,
  providers: ProviderConfig[],
  targetCount = 12,
): Promise<BrainstormResult> {
  const llmProviders = providers.map((p) => createProvider(p));
  const mainProvider = llmProviders[0];

  if (!mainProvider || !mainProvider.isConfigured()) {
    throw new Error("No LLM provider configured.");
  }

  const ideasPerPersona = Math.ceil(targetCount / BRAINSTORM_PERSONAS.length);

  const ideaPromises = BRAINSTORM_PERSONAS.map((persona, i) => {
    const provider = llmProviders[i % llmProviders.length];
    return getBrainstormIdeas(persona, topic, ideasPerPersona, provider);
  });

  const allIdeaGroups = await Promise.all(ideaPromises);
  const allIdeas: BrainstormIdea[] = allIdeaGroups.flat();
  const deduped = deduplicateIdeas(allIdeas);

  // Score ideas
  const scored = await scoreIdeas(deduped, topic, mainProvider);
  const topPick = scored.sort((a, b) => b.score - a.score)[0];

  // Cluster ideas
  const clusters = await clusterIdeas(scored, topic, mainProvider);

  return {
    ideas: scored,
    clusters,
    topPick,
  };
}

async function getBrainstormIdeas(
  persona: AdvisorPersona,
  topic: string,
  count: number,
  provider: LlmProvider,
): Promise<BrainstormIdea[]> {
  const response = await provider.chat({
    model: provider.defaultModel,
    messages: [
      { role: "system", content: persona.systemPrompt },
      {
        role: "user",
        content: `Generate ${count} creative ideas for:\n"${topic}"\n\nFormat: Numbered list, one idea per line. Each idea should be 1-2 sentences. Be specific and actionable.`,
      },
    ],
    temperature: 0.9,
    max_tokens: 1000,
  });

  return parseIdeas(response.content, persona.id);
}

function parseIdeas(text: string, source: string): BrainstormIdea[] {
  const lines = text.split("\n").filter((l) => /^\d+[\.\)]\s/.test(l.trim()));
  return lines.map((line, i) => ({
    id: `${source}-${i}`,
    content: line.replace(/^\d+[\.\)]\s*/, "").trim(),
    source,
    score: 0,
    novelty: 5,
    feasibility: 5,
  }));
}

function deduplicateIdeas(ideas: BrainstormIdea[]): BrainstormIdea[] {
  const seen = new Set<string>();
  return ideas.filter((idea) => {
    const key = idea.content.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function scoreIdeas(
  ideas: BrainstormIdea[],
  topic: string,
  provider: LlmProvider,
): Promise<BrainstormIdea[]> {
  if (ideas.length <= 5) return ideas.map((i) => ({ ...i, score: 7, novelty: 7, feasibility: 7 }));

  const ideaText = ideas
    .map((idea, i) => `${i + 1}. ${idea.content}`)
    .join("\n");

  const response = await provider.chat({
    model: provider.defaultModel,
    messages: [
      {
        role: "system",
        content:
          "You are an idea evaluator. Score ideas 1-10 on novelty and feasibility. Return a JSON array.",
      },
      {
        role: "user",
        content: `Topic: "${topic}"\n\nIdeas:\n${ideaText}\n\nReturn JSON: [{"id": 1, "novelty": 7, "feasibility": 6}, ...]`,
      },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  try {
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const scores = JSON.parse(jsonMatch[0]) as any[];
      return ideas.map((idea, i) => ({
        ...idea,
        novelty: scores[i]?.novelty ?? 5,
        feasibility: scores[i]?.feasibility ?? 5,
        score: ((scores[i]?.novelty ?? 5) + (scores[i]?.feasibility ?? 5)) / 2,
      }));
    }
  } catch {
    // Fallback: random-ish scores
  }

  return ideas.map((i) => ({ ...i, score: 5, novelty: 5, feasibility: 5 }));
}

async function clusterIdeas(
  ideas: BrainstormIdea[],
  _topic: string,
  provider: LlmProvider,
): Promise<IdeaCluster[]> {
  if (ideas.length <= 6) {
    return [
      {
        label: "All Ideas",
        ideaIds: ideas.map((i) => i.id),
      },
    ];
  }

  const ideaList = ideas.map((idea, i) => `${i + 1}. ${idea.content}`).join("\n");

  const response = await provider.chat({
    model: provider.defaultModel,
    messages: [
      {
        role: "system",
        content: "Group similar ideas into thematic clusters. Return JSON array of {label, indices}.",
      },
      {
        role: "user",
        content: `Group these ideas into 3-5 thematic clusters:\n\n${ideaList}\n\nReturn JSON: [{"label": "Cluster Name", "indices": [1, 3, 5]}, ...]`,
      },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  try {
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const clusts = JSON.parse(jsonMatch[0]) as any[];
      return clusts.map((c: any) => ({
        label: c.label,
        ideaIds: (c.indices as number[]).map((idx) => ideas[idx - 1]?.id).filter(Boolean),
      }));
    }
  } catch {
    // fallback
  }

  return [
    {
      label: "All Ideas",
      ideaIds: ideas.map((i) => i.id),
    },
  ];
}
