/**
 * Anthropic (Claude) Provider
 * 使用原生 fetch，不引入 SDK —— Worker 与 Node 脚本均可直接运行。
 */

import {
  type AIProvider,
  type ChatRequest,
  type ChatResponse,
  type ModelSpec,
  estimateCost,
  estimateTokens,
} from './types.js';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  readonly supportsWebSearch = true;

  constructor(
    private readonly apiKey: string,
    private readonly spec: ModelSpec,
  ) {
    this.model = spec.model;
  }

  readonly model: string;

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const system = req.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const messages = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const tools: unknown[] = [];
    if (req.webSearch) {
      tools.push({
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 8,
      });
    }

    const body: Record<string, unknown> = {
      model: this.spec.model,
      max_tokens: req.maxTokens ?? 4096,
      messages,
    };
    if (system) body.system = system;
    if (tools.length) body.tools = tools;
    if (req.json) {
      // 强制 JSON 输出
      body.messages = [
        ...messages,
        {
          role: 'assistant',
          content: '开始输出 JSON。',
        },
      ];
      body.system = `${system}\n\n${JSON_INSTRUCTION}`;
    }
    if (req.temperature !== undefined) body.temperature = req.temperature;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), req.timeoutMs ?? 120_000);
    try {
      const res = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Anthropic ${res.status}: ${text.slice(0, 500)}`);
      }

      const json = (await res.json()) as {
        content?: Array<{ type: string; text?: string; thinking?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      const content = (json.content || [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text || '')
        .join('')
        .trim();

      const inputTokens = json.usage?.input_tokens ?? estimateTokens(JSON.stringify(body.messages));
      const outputTokens = json.usage?.output_tokens ?? estimateTokens(content);

      return {
        content,
        data: req.json ? safeParseJson(content) : undefined,
        usage: {
          inputTokens,
          outputTokens,
          estimatedCostUsd: estimateCost(this.spec, inputTokens, outputTokens),
        },
        model: this.spec.model,
        provider: this.name,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const JSON_INSTRUCTION = `
【输出格式要求】
你的回复必须是**单个合法 JSON 对象**，不要包含 markdown 代码块标记，不要有任何解释性前后缀。
- 只输出 JSON 本体，第一个字符必须是 { 或 [
- 最后一个字符必须是 } 或 ]
- 所有字符串用双引号，内部引号需转义
- 不确定的字段用 null，不要编造
`;

/** 容错 JSON 解析：剥 markdown 围栏、修正尾逗号、截取首个完整对象 */
export function safeParseJson(text: string): unknown {
  if (!text) return undefined;
  let s = text.trim();

  // 剥离 ```json 围栏
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();

  // 直接尝试
  try {
    return JSON.parse(s);
  } catch {
    /* 继续尝试 */
  }

  // 提取第一个平衡的 {...} 或 [...]
  for (const [open, close] of [
    ['{', '}'],
    ['[', ']'],
  ]) {
    const start = s.indexOf(open);
    if (start === -1) continue;
    let depth = 0;
    let inStr = false;
    let escape = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inStr = !inStr;
        continue;
      }
      if (inStr) continue;
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) {
          const slice = s.slice(start, i + 1);
          try {
            return JSON.parse(slice);
          } catch {
            try {
              return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1'));
            } catch {
              /* 继续 */
            }
          }
        }
      }
    }
  }

  return undefined;
}
