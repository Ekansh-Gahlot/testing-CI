import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ============================================================================
// PROVIDER INTERFACE
// ============================================================================

export interface AIProviderConfig {
  maxTokens: number;
  temperature: number;
  model: string;
}

export interface AIProvider {
  readonly name: string;
  review(
    systemPrompt: string,
    userPrompt: string,
    config: AIProviderConfig
  ): Promise<string>;
}

// ============================================================================
// OPENAI ADAPTER
// ============================================================================

class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async review(
    systemPrompt: string,
    userPrompt: string,
    config: AIProviderConfig
  ): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: config.maxTokens,
      temperature: config.temperature,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }
    return content;
  }
}

// ============================================================================
// ANTHROPIC ADAPTER
// ============================================================================

class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async review(
    systemPrompt: string,
    userPrompt: string,
    config: AIProviderConfig
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      system: systemPrompt + "\n\nRespond ONLY with valid JSON. No markdown fences, no extra text.",
      messages: [{ role: "user", content: userPrompt }],
    });

    const block = response.content[0];
    if (!block || block.type !== "text") {
      throw new Error("Empty response from Anthropic");
    }
    return block.text;
  }
}

// ============================================================================
// GOOGLE GEMINI ADAPTER
// ============================================================================

class GoogleProvider implements AIProvider {
  readonly name = "google";
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async review(
    systemPrompt: string,
    userPrompt: string,
    config: AIProviderConfig
  ): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: config.model,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(userPrompt);
    const content = result.response.text();
    if (!content) {
      throw new Error("Empty response from Google Gemini");
    }
    return content;
  }
}

// ============================================================================
// DEFAULT MODELS PER PROVIDER
// ============================================================================

const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-5.2",
  anthropic: "claude-sonnet-4-20250514",
  google: "gemini-2.0-flash",
};

// ============================================================================
// FACTORY
// ============================================================================

export function getDefaultModel(provider: string): string {
  return DEFAULT_MODELS[provider] || DEFAULT_MODELS.openai;
}

export function resolveApiKey(provider: string): string | undefined {
  // Unified key takes priority, then provider-specific fallback
  if (process.env.AI_API_KEY) return process.env.AI_API_KEY;

  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    case "google":
      return process.env.GOOGLE_API_KEY;
    default:
      return undefined;
  }
}

export function createProvider(provider: string, apiKey: string): AIProvider {
  switch (provider) {
    case "openai":
      return new OpenAIProvider(apiKey);
    case "anthropic":
      return new AnthropicProvider(apiKey);
    case "google":
      return new GoogleProvider(apiKey);
    default:
      throw new Error(
        `Unknown AI provider: "${provider}". Supported: openai, anthropic, google`
      );
  }
}
