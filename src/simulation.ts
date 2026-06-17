import type { AdvisorPersona, EvaluationCriterion } from "./types.js";
import { ADVISORS } from "./personas.js";

// ─── Simulation Mode ───
// When no LLM provider is configured, return a structured prompt
// that the calling AI agent executes using its own intelligence.
//
// All content is English-first to serve global users.
// Advisors with non-English definitions will respond in their native language.

const MULTI_LANG_NOTE = `> **Multi-language support:** You can respond in any language (English, Turkish, Spanish, etc.).
> Advisors defined with native-language personas (e.g. Turkish advisors) will respond in that language.
> The question and context can be in any language — match accordingly.`;

export function buildCouncilSimulation(
  question: string,
  advisorIds: string[],
  fastMode: boolean,
  context?: string,
): string {
  const advisors = advisorIds
    .map((id) => ADVISORS[id])
    .filter(Boolean);
  const list = fastMode ? advisors.slice(0, 3) : advisors;

  const advisorSections = list
    .map(
      (a: AdvisorPersona) => `### ${a.emoji} ${a.name}

**Focus areas:**
${a.focusAreas.map((f: string) => `- ${f}`).join("\n")}

**Character:** ${a.description}

**Voice:** ${a.systemPrompt.slice(0, 250)}
`,
    )
    .join("\n");

  const contextBlock = context ? `\n## Additional Context\n${context}\n` : "";

  const advisorLines = list
    .map((a, i) => `${i + 1}. **${a.emoji} ${a.name}** — ${a.description}`)
    .join("\n");

  return `# 🤖 AI Orchestrator — Council Strategy

${MULTI_LANG_NOTE}

## Instructions
No API key is configured, so you will execute this evaluation **using your own intelligence**. Follow the steps below in order.

## Decision to Evaluate
"${question}"${contextBlock}

## Advisors
${advisorSections}

---

## Stage 1: Independent Opinions (Parallel)

Write a **150-200 word** evaluation from each advisor's perspective. Each advisor must NOT see the others' responses — treat each as fully independent. Do NOT try to be balanced — each advisor leans fully into their assigned perspective.

${advisorLines}

## Stage 2: Anonymous Peer Review

Collect all responses. **Hide** which advisor wrote which (label them Advisor A, B, C, D, E in random order). From each advisor's perspective, answer:
- Which argument is STRONGEST? (which letter and why?)
- Which argument is WEAKEST / most risky? (which letter and why?)
- Which response has a major blind spot? (which letter and what blind spot?)

## Stage 3: Chairman Synthesis

Now act as the CHAIRMAN. Evaluate all data and produce a final decision in this exact format:

> **FINAL VERDICT**
>
> **Consensus:** [points all advisors agree on]
>
> **Conflict:** [key disagreements and why]
>
> **Blind Spots:** [critical elements everyone missed]
>
> **Recommendation:** [clear yes/no/modify — do NOT say "it depends"]
>
> **First Action:** [the single concrete step to take Monday morning]

---

Execute all three stages now and return the result in this format.`;
}

export function buildDebateSimulation(topic: string, rounds: number): string {
  return `# 🤖 AI Orchestrator — Debate Strategy

${MULTI_LANG_NOTE}

## Instructions
Execute this structured debate **using your own intelligence**. Role-play all participants.

## Debate Topic
"${topic}"

## Format: ${rounds}-Round Debate

### Roles
- **🟢 PRO Advocate** — Arguments FOR the topic. Persuasive, evidence-based, forceful.
- **🔴 CON Advocate** — Arguments AGAINST the topic. Critical, evidence-based, forceful.
- **⚖️ Judge** — Impartial evaluation, declares a clear winner.

### Round 0: Opening Statements
Both PRO and CON deliver **100-150 word** opening statements.

${Array.from({ length: rounds }, (_, i) => `### Round ${i + 1}: Rebuttal
Each side responds directly to the opponent's previous argument. Be specific, counter their points directly.`).join("\n\n")}

### Final Verdict
As the JUDGE:
- Who was more persuasive?
- Which side had stronger evidence?
- Logical consistency?

**WINNER:** [PRO/CON]
**REASONING:** [2-3 sentences]

---

Execute all rounds now and declare the winner.`;
}

export function buildBrainstormSimulation(topic: string, targetCount: number): string {
  return `# 🤖 AI Orchestrator — Brainstorm Strategy

${MULTI_LANG_NOTE}

## Instructions
Execute this brainstorming session **using your own intelligence**.

## Topic
"${topic}"

## Stage 1: Divergent Thinking (Idea Generation)

Generate ${targetCount} ideas from 4 different perspectives:

### 🌙 Dreamer
Wild, unconstrained ideas. Sci-fi level. Zero limits.

### 💻 Hacker
Clever shortcuts, growth hacks, unconventional angles. 80/20 rule.

### 🎨 Artist
Aesthetic, experiential, human-centered. Beautiful, memorable.

### 🚀 Futurist
5-10 year horizon. Trends, emerging tech, paradigm shifts.

3-4 ideas per perspective. Each idea: 1-2 sentences.

## Stage 2: Convergent Thinking (Evaluation)

Evaluate all ideas:
1. **Score** — Rate each idea for novelty (1-10) and feasibility (1-10)
2. **Cluster** — Group similar themes
3. **Pick** — Select the highest-scoring idea as the winner

## Output Format

**Top Idea:** [content]
**Score:** [novelty]/10 + [feasibility]/10

**Clusters:**
- [cluster name]: [idea list]

**All Ideas:**
1. [idea] (N:8 F:6 = 7.0)

---

Execute all stages now.`;
}

export function buildEvaluateSimulation(
  question: string,
  options: string[],
  criteria: EvaluationCriterion[],
  context?: string,
): string {
  const criteriaText = criteria
    .map((c) => `- **${c.name}** (weight: ${c.weight}): ${c.description}`)
    .join("\n");

  const optionsText = options
    .map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`)
    .join("\n");

  const contextBlock = context ? `\n## Additional Context\n${context}\n` : "";

  return `# 🤖 AI Orchestrator — Multi-Criteria Evaluation

${MULTI_LANG_NOTE}

## Instructions
Execute this weighted evaluation **using your own intelligence**.

## Question
"${question}"${contextBlock}

## Options
${optionsText}

## Criteria
${criteriaText}

## Steps

### 1. Score Each Option
Score each option **1-10** per criterion. Calculate: TOTAL = Σ(score × weight)

### 2. Analyze
- Pros and cons of each option
- Determine the winner

### 3. Output Format
\`\`\`
Option A: [total score]
  + [criterion]: [score]
  + Pros: [...]
  + Cons: [...]

Option B: [total score]
  ...

WINNER: [option]
ANALYSIS: [reasoning]
\`\`\`

---

Execute the evaluation now.`;
}

export function buildSpecReviewSimulation(spec: string): string {
  return `# 🤖 AI Orchestrator — Specification Review

${MULTI_LANG_NOTE}

## Instructions
Review this specification/plan **using your own intelligence**.

## Document Under Review
${spec}

## Review perspectives

Evaluate separately from each perspective:

### 🔒 Security
- Vulnerabilities?
- Data exposure?
- Auth/authorization?
- Dependency trust?

### 🎨 User Experience
- User journey coherent?
- Accessibility?
- Cognitive load?
- Delight moments?

### ⚡ Performance
- Bottlenecks?
- Scaling?
- Caching strategy?
- Database queries?

### ⚙️ Operations
- Deploy/rollback?
- Monitoring?
- Failure modes?
- Infrastructure cost?

### 📊 Business Value
- ROI?
- Market fit?
- Opportunity cost?

## Output Format

### [Perspective] Review
- ✅ Good: ...
- ❌ Missing: ...
- 🔧 Suggestion: ...

## Risk Matrix
| Category | Severity | Description | Mitigation |
|---|---|---|---|
| ... | Critical/High/Medium/Low | ... | ... |

## Overall Score: [1-10]
[2-3 sentence summary]

---

Execute the review now.`;
}
