import type { ChatCompletionRequest, ChatCompletionResponse, ProviderConfig, ProviderType } from "./types.js";

// ─── Provider Interface ───

export interface LlmProvider {
  readonly type: ProviderType;
  readonly defaultModel: string;
  chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  isConfigured(): boolean;
}

// ─── Base Provider with shared HTTP logic ───

abstract class BaseProvider implements LlmProvider {
  abstract readonly type: ProviderType;
  abstract readonly defaultModel: string;
  protected apiKey: string;
  protected baseUrl: string;
  protected defaultTemperature: number;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey ?? "";
    this.baseUrl = config.baseUrl ?? "";
    this.defaultTemperature = config.temperature ?? 0.7;
  }

  abstract isConfigured(): boolean;

  protected async fetchApi(
    endpoint: string,
    body: unknown,
    headers: Record<string, string> = {},
  ): Promise<ChatCompletionResponse> {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error");
      throw new Error(`${this.type} API error ${res.status}: ${errText.slice(0, 500)}`);
    }

    return this.parseResponse(await res.json());
  }

  protected abstract parseResponse(json: unknown): ChatCompletionResponse;

  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    return this.fetchApi(
      this.baseUrl,
      {
        ...req,
        model: req.model || this.defaultModel,
        temperature: req.temperature ?? this.defaultTemperature,
        max_tokens: req.max_tokens ?? 2048,
      },
      this.authHeaders(),
    );
  }

  protected abstract authHeaders(): Record<string, string>;
}

// ─── OpenAI Provider ───

class OpenAIProvider extends BaseProvider {
  readonly type: ProviderType = "openai";
  readonly defaultModel = "gpt-4o";

  constructor(config: ProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || "https://api.openai.com/v1/chat/completions";
    this.apiKey = config.apiKey ?? process.env["OPENAI_API_KEY"] ?? "";
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  protected authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  protected parseResponse(json: any): ChatCompletionResponse {
    return {
      content: json.choices?.[0]?.message?.content ?? "",
      model: json.model ?? this.defaultModel,
      usage: json.usage,
    };
  }
}

// ─── Anthropic Provider ───

class AnthropicProvider extends BaseProvider {
  readonly type: ProviderType = "anthropic";
  readonly defaultModel = "claude-sonnet-4-20250514";

  constructor(config: ProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || "https://api.anthropic.com/v1/messages";
    this.apiKey = config.apiKey ?? process.env["ANTHROPIC_API_KEY"] ?? "";
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  protected authHeaders(): Record<string, string> {
    return {
      "x-api-key": this.apiKey,
      "anthropic-version": "2023-06-01",
    };
  }

  // Anthropic has a different API format
  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const systemMsg = req.messages.find((m) => m.role === "system")?.content ?? "";
    const userMsgs = req.messages
      .filter((m) => m.role === "user")
      .map((m) => ({ role: "user", content: m.content }));

    const body: any = {
      model: req.model || this.defaultModel,
      max_tokens: req.max_tokens ?? 2048,
      temperature: req.temperature ?? this.defaultTemperature,
      system: systemMsg,
      messages: userMsgs,
    };

    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error");
      throw new Error(`Anthropic API error ${res.status}: ${errText.slice(0, 500)}`);
    }

    const json = (await res.json()) as any;
    return {
      content: json.content?.[0]?.text ?? "",
      model: json.model ?? this.defaultModel,
      usage: {
        prompt_tokens: json.usage?.input_tokens ?? 0,
        completion_tokens: json.usage?.output_tokens ?? 0,
        total_tokens: (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0),
      },
    };
  }

  protected parseResponse(_json: unknown): ChatCompletionResponse {
    throw new Error("Use chat() directly for Anthropic");
  }
}

// ─── OpenRouter Provider (OpenAI-compatible API) ───

class OpenRouterProvider extends BaseProvider {
  readonly type: ProviderType = "openrouter";
  readonly defaultModel = "openai/gpt-4o";

  constructor(config: ProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || "https://openrouter.ai/api/v1/chat/completions";
    this.apiKey = config.apiKey ?? process.env["OPENROUTER_API_KEY"] ?? "";
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  protected authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "HTTP-Referer": "https://github.com/anomalyco/ai-orchestrator",
      "X-Title": "AI Orchestrator",
    };
  }

  protected parseResponse(json: any): ChatCompletionResponse {
    return {
      content: json.choices?.[0]?.message?.content ?? "",
      model: json.model ?? this.defaultModel,
      usage: json.usage,
    };
  }
}

// ─── Ollama Provider (local) ───

class OllamaProvider extends BaseProvider {
  readonly type: ProviderType = "ollama";
  readonly defaultModel = "llama3";

  constructor(config: ProviderConfig) {
    super(config);
    this.baseUrl = (config.baseUrl || process.env["OLLAMA_HOST"] || "http://localhost:11434") + "/api/chat";
    this.apiKey = "ollama"; // no auth needed
  }

  isConfigured(): boolean {
    return true; // Always available if Ollama is running
  }

  protected authHeaders(): Record<string, string> {
    return {};
  }

  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const systemMsg = req.messages.find((m) => m.role === "system")?.content ?? "";
    const userMsgs = req.messages.filter((m) => m.role !== "system");
    const body = {
      model: req.model || this.defaultModel,
      messages: [
        { role: "system", content: systemMsg },
        ...userMsgs.map((m) => ({ role: m.role, content: m.content })),
      ],
      stream: false,
      options: {
        temperature: req.temperature ?? this.defaultTemperature,
        num_predict: req.max_tokens ?? 2048,
      },
    };

    try {
      const res = await fetch(this.baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Ollama error ${res.status}`);
      }

      const json = (await res.json()) as any;
      return {
        content: json.message?.content ?? "",
        model: json.model ?? this.defaultModel,
      };
    } catch (err: any) {
      throw new Error(`Ollama not available (${err.message}). Is it running on ${this.baseUrl}?`);
    }
  }

  protected parseResponse(_json: unknown): ChatCompletionResponse {
    throw new Error("Use chat() directly for Ollama");
  }
}

// ─── Groq Provider (OpenAI-compatible) ───

class GroqProvider extends BaseProvider {
  readonly type: ProviderType = "groq";
  readonly defaultModel = "llama-3.2-90b-text-preview";

  constructor(config: ProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || "https://api.groq.com/openai/v1/chat/completions";
    this.apiKey = config.apiKey ?? process.env["GROQ_API_KEY"] ?? "";
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  protected authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  protected parseResponse(json: any): ChatCompletionResponse {
    return {
      content: json.choices?.[0]?.message?.content ?? "",
      model: json.model ?? this.defaultModel,
      usage: json.usage,
    };
  }
}

// ─── Google Provider (Gemini via OpenAI-compatible endpoint) ───

class GoogleProvider extends BaseProvider {
  readonly type: ProviderType = "google";
  readonly defaultModel = "gemini-2.5-pro";

  constructor(config: ProviderConfig) {
    super(config);
    this.baseUrl =
      config.baseUrl ||
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    this.apiKey = config.apiKey ?? process.env["GOOGLE_API_KEY"] ?? "";
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  protected authHeaders(): Record<string, string> {
    return { "x-goog-api-key": this.apiKey };
  }

  protected parseResponse(json: any): ChatCompletionResponse {
    return {
      content: json.choices?.[0]?.message?.content ?? "",
      model: json.model ?? this.defaultModel,
      usage: json.usage,
    };
  }
}

// ─── DeepSeek Provider (OpenAI-compatible) ───

class DeepSeekProvider extends BaseProvider {
  readonly type: ProviderType = "deepseek";
  readonly defaultModel = "deepseek-chat";

  constructor(config: ProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || "https://api.deepseek.com/v1/chat/completions";
    this.apiKey = config.apiKey ?? process.env["DEEPSEEK_API_KEY"] ?? "";
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  protected authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  protected parseResponse(json: any): ChatCompletionResponse {
    return {
      content: json.choices?.[0]?.message?.content ?? "",
      model: json.model ?? this.defaultModel,
      usage: json.usage,
    };
  }
}

// ─── Provider Factory ───

export function createProvider(config: ProviderConfig): LlmProvider {
  switch (config.type) {
    case "openai":
      return new OpenAIProvider(config);
    case "anthropic":
      return new AnthropicProvider(config);
    case "openrouter":
      return new OpenRouterProvider(config);
    case "ollama":
      return new OllamaProvider(config);
    case "groq":
      return new GroqProvider(config);
    case "google":
      return new GoogleProvider(config);
    case "deepseek":
      return new DeepSeekProvider(config);
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}

export function autoDetectProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

  if (process.env["OPENAI_API_KEY"]) {
    providers.push({ type: "openai", model: "gpt-4o" });
  }
  if (process.env["ANTHROPIC_API_KEY"]) {
    providers.push({ type: "anthropic", model: "claude-sonnet-4-20250514" });
  }
  if (process.env["OPENROUTER_API_KEY"]) {
    providers.push({ type: "openrouter", model: "openai/gpt-4o" });
  }
  if (process.env["GROQ_API_KEY"]) {
    providers.push({ type: "groq" });
  }
  if (process.env["GOOGLE_API_KEY"]) {
    providers.push({ type: "google", model: "gemini-2.5-pro" });
  }
  if (process.env["DEEPSEEK_API_KEY"]) {
    providers.push({ type: "deepseek" });
  }

  return providers;
}

export function hasConfiguredProviders(): boolean {
  return autoDetectProviders().length > 0;
}
