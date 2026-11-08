/**
 * OpenAI 兼容 Provider
 * 同时服务 DeepSeek、OpenAI、以及自建端点（baseUrl 可覆盖）。
 */

import {
  type AIProvider,
  type ChatRequest,
  type ChatResponse,
  type ModelSpec,
  estimateCost,
  estimateTokens,
} from './types.js';
import { JSON_INSTRUCTION, safeParseJson } from './anthropic.js';

const DEFAULT_BASE: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  custom: 'https://api.openai.com/v1',
};

export class OpenAICompatibleProvider implements AIProvider {
  readonly supportsWebSearch = false;
  readonly name: string;

  constructor(
    private readonly apiKey: string,
    private readonly spec: ModelSpec,
    private readonly baseUrl?: string,
  ) {
    this.model = spec.model;
    this.name = spec.provider;
  }

  readonly model: string;

  get base(): string {
    return (this.baseUrl || DEFAULT_BASE[this.spec.provider] || DEFAULT_BASE.openai).replace(/\/$/, '');
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const body: Record<string, unknown> = {
      model: this.spec.model,
      messages: req.messages,
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.3,
    };
    if (req.json) {
      body.response_format = { type: 'json_object' };
      body.messages = [
        ...req.messages,
        {
          role: 'system',
          content: `${JSON_INSTRUCTION}\n注意：json_object 模式下 response 必须以 { 开头。`,
        },
      ];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), req.timeoutMs ?? 120_000);
    try {
      const res = await fetch(`${this.base}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`${this.spec.provider} ${res.status}: ${text.slice(0, 500)}`);
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const choice = json.choices?.[0]?.message;
      // DeepSeek Reasoner 会把思考放在 reasoning_content
      const content = (choice?.content || choice?.reasoning_content || '').trim();

      const inputTokens =
        json.usage?.prompt_tokens ?? estimateTokens(JSON.stringify(req.messages));
      const outputTokens =
        json.usage?.completion_tokens ?? estimateTokens(content);

      return {
        content,
        data: req.json ? safeParseJson(content) : undefined,
        usage: {
          inputTokens,
          outputTokens,
          estimatedCostUsd: estimateCost(this.spec, inputTokens, outputTokens),
        },
        model: this.spec.model,
        provider: this.spec.provider,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
