/**
 * AI Provider 统一接口
 *
 * 设计要点：
 * 1. 业务逻辑只依赖 AIProvider 接口，不写死任何厂商
 * 2. 任务级模型路由由上层配置决定（taskRouting）
 * 3. 统一的重试 / 降级 / 成本统计 / token 用量上报
 * 4. 所有返回都强制 JSON 模式，避免解析自由文本
 */

import type { AITask } from '../../types.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  /** 期望返回 JSON */
  json?: boolean;
  /** JSON schema（严格模式） */
  schema?: Record<string, unknown>;
  /** 最大输出 token */
  maxTokens?: number;
  temperature?: number;
  /** 联网搜索（仅部分 provider 支持） */
  webSearch?: boolean;
  /** 超时（毫秒） */
  timeoutMs?: number;
  /** 任务类型（用于日志与成本归因） */
  task?: AITask;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface ChatResponse {
  content: string;
  /** 解析后的 JSON（当 json=true 且解析成功） */
  data?: unknown;
  usage: Usage;
  model: string;
  provider: string;
  /** 是否因降级而返回 */
  degraded?: boolean;
  /** 降级原因 */
  degradedReason?: string;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  /** 该 provider 是否支持原生联网搜索 */
  readonly supportsWebSearch: boolean;
  chat(req: ChatRequest): Promise<ChatResponse>;
}

/** 供应商配置（由环境变量 / Secrets 注入，不落前端代码） */
export interface ProviderCredentials {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  deepseekApiKey?: string;
  geminiApiKey?: string;
  /** 自定义 OpenAI 兼容端点 */
  customBaseUrl?: string;
  customApiKey?: string;
}

/** 模型注册表条目 */
export interface ModelSpec {
  /** 唯一 id，如 claude-sonnet-4-5 */
  id: string;
  provider: 'anthropic' | 'openai' | 'gemini' | 'deepseek' | 'custom';
  model: string;
  label: string;
  contextWindow: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  supportsWebSearch: boolean;
  /** 适合的任务类型（用于自动路由建议） */
  suitedFor: AITask[];
}

/** 内置模型注册表 —— 价格单位：美元 / 百万 token */
export const MODEL_REGISTRY: ModelSpec[] = [
  {
    id: 'claude-sonnet-4-5',
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    label: 'Claude Sonnet 4.5',
    contextWindow: 200_000,
    inputPricePerMillion: 3,
    outputPricePerMillion: 15,
    supportsWebSearch: true,
    suitedFor: ['deep_research', 'long_form_synthesis', 'solution_composition', 'weekly_report'],
  },
  {
    id: 'claude-opus-4-1',
    provider: 'anthropic',
    model: 'claude-opus-4-1',
    label: 'Claude Opus 4.1',
    contextWindow: 200_000,
    inputPricePerMillion: 15,
    outputPricePerMillion: 75,
    supportsWebSearch: true,
    suitedFor: ['deep_research', 'solution_composition'],
  },
  {
    id: 'claude-haiku-4-5',
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    contextWindow: 200_000,
    inputPricePerMillion: 1,
    outputPricePerMillion: 5,
    supportsWebSearch: true,
    suitedFor: ['classification', 'dedupe_relation', 'daily_qa'],
  },
  {
    id: 'deepseek-chat',
    provider: 'deepseek',
    model: 'deepseek-chat',
    label: 'DeepSeek Chat',
    contextWindow: 64_000,
    inputPricePerMillion: 0.27,
    outputPricePerMillion: 1.1,
    supportsWebSearch: false,
    suitedFor: ['daily_qa', 'classification', 'long_form_synthesis', 'quiz_generation'],
  },
  {
    id: 'deepseek-reasoner',
    provider: 'deepseek',
    model: 'deepseek-reasoner',
    label: 'DeepSeek Reasoner',
    contextWindow: 64_000,
    inputPricePerMillion: 0.55,
    outputPricePerMillion: 2.19,
    supportsWebSearch: false,
    suitedFor: ['dedupe_relation', 'solution_composition', 'practice_review'],
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    model: 'gpt-4o',
    label: 'GPT-4o',
    contextWindow: 128_000,
    inputPricePerMillion: 2.5,
    outputPricePerMillion: 10,
    supportsWebSearch: false,
    suitedFor: ['long_form_synthesis', 'daily_qa', 'learning_plan'],
  },
  {
    id: 'gemini-2.0-flash',
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    contextWindow: 1_000_000,
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0.4,
    supportsWebSearch: true,
    suitedFor: ['classification', 'daily_qa', 'quiz_generation'],
  },
];

/** 默认任务路由 —— 双 Provider 分工（Claude 深度研究 / DeepSeek 日常） */
export const DEFAULT_TASK_ROUTING: Record<AITask, string> = {
  deep_research: 'claude-sonnet-4-5',
  long_form_synthesis: 'claude-sonnet-4-5',
  classification: 'deepseek-chat',
  dedupe_relation: 'deepseek-reasoner',
  daily_qa: 'deepseek-chat',
  solution_composition: 'claude-sonnet-4-5',
  practice_review: 'deepseek-reasoner',
  learning_plan: 'deepseek-chat',
  quiz_generation: 'deepseek-chat',
  weekly_report: 'claude-sonnet-4-5',
};

export function getModelSpec(id: string): ModelSpec | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

/** 估算成本（美元） */
export function estimateCost(spec: ModelSpec, inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * spec.inputPricePerMillion +
    (outputTokens / 1_000_000) * spec.outputPricePerMillion
  );
}

/** 简单的中文友好的字符计数近似 token 数 */
export function estimateTokens(text: string): number {
  // 中文约 1 字 ≈ 0.6-1 token，英文约 4 字符 ≈ 1 token
  const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) || []).length;
  const rest = text.length - cjk;
  return Math.ceil(cjk * 1.05 + rest / 3.6);
}
