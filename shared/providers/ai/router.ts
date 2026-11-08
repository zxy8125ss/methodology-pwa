/**
 * Provider 注册表 + 路由 + 重试 + 降级
 *
 * 这里是「不把模型写死在业务逻辑中」的落点：
 * 业务只调用 chat(task, req)，由本层根据 taskRouting 选择模型，
 * 失败时按 fallbackModels 顺序降级，并统一统计成本。
 */

import type { AITask } from '../../types.js';
import {
  type AIProvider,
  type ChatRequest,
  type ChatResponse,
  type ModelSpec,
  type ProviderCredentials,
  DEFAULT_TASK_ROUTING,
  MODEL_REGISTRY,
  getModelSpec,
} from './types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';

/** 路由配置 */
export interface RoutingConfig {
  taskRouting?: Partial<Record<AITask, string>>;
  defaultModel?: string | null;
  fallbackModels?: string[];
}

export interface ResolvedModel {
  spec: ModelSpec;
  provider: AIProvider;
}

/**
 * 根据凭据创建指定模型的 Provider。
 * 未配置对应 key 时返回 null —— 上层据此走降级链。
 */
export function createProvider(
  modelId: string,
  creds: ProviderCredentials,
): AIProvider | null {
  const spec = getModelSpec(modelId);
  if (!spec) return null;

  switch (spec.provider) {
    case 'anthropic': {
      if (!creds.anthropicApiKey) return null;
      return new AnthropicProvider(creds.anthropicApiKey, spec);
    }
    case 'deepseek': {
      if (!creds.deepseekApiKey) return null;
      return new OpenAICompatibleProvider(creds.deepseekApiKey, spec);
    }
    case 'openai': {
      if (!creds.openaiApiKey) return null;
      return new OpenAICompatibleProvider(creds.openaiApiKey, spec);
    }
    case 'custom': {
      if (!creds.customApiKey) return null;
      return new OpenAICompatibleProvider(
        creds.customApiKey,
        spec,
        creds.customBaseUrl,
      );
    }
    case 'gemini': {
      // Gemini 走 OpenAI 兼容端点
      if (!creds.geminiApiKey) return null;
      return new OpenAICompatibleProvider(
        creds.geminiApiKey,
        spec,
        'https://generativelanguage.googleapis.com/v1beta/openai',
      );
    }
    default:
      return null;
  }
}

/** 解析任务应使用的模型链（主 + 备） */
export function resolveModelChain(
  task: AITask,
  routing: RoutingConfig,
): string[] {
  const primary = routing.taskRouting?.[task] ?? routing.defaultModel ?? DEFAULT_TASK_ROUTING[task];
  const fallbacks = routing.fallbackModels ?? [];
  const chain = [primary, ...fallbacks].filter(
    (m, i, arr) => m && arr.indexOf(m) === i,
  );
  return chain.length ? chain : [DEFAULT_TASK_ROUTING[task]];
}

/** 可用模型列表（根据已配置的凭据过滤） */
export function listAvailableModels(creds: ProviderCredentials): ModelSpec[] {
  return MODEL_REGISTRY.filter((spec) => {
    switch (spec.provider) {
      case 'anthropic':
        return !!creds.anthropicApiKey;
      case 'deepseek':
        return !!creds.deepseekApiKey;
      case 'openai':
        return !!creds.openaiApiKey;
      case 'gemini':
        return !!creds.geminiApiKey;
      case 'custom':
        return !!creds.customApiKey;
      default:
        return false;
    }
  });
}

export interface ChatWithRoutingResult extends ChatResponse {
  /** 实际使用的模型 id */
  modelId: string;
  /** 尝试过的模型链 */
  attempted: string[];
}

export class AIRouter {
  constructor(
    private readonly creds: ProviderCredentials,
    private readonly routing: RoutingConfig = {},
  ) {}

  /**
   * 按任务路由调用，失败自动降级。
   * @param req 请求
   * @param task 任务类型
   * @param options.maxAttempts 最多尝试几个模型
   */
  async chat(
    req: ChatRequest,
    task: AITask,
    options: { maxAttempts?: number } = {},
  ): Promise<ChatWithRoutingResult> {
    const chain = resolveModelChain(task, this.routing);
    const maxAttempts = options.maxAttempts ?? Math.min(chain.length, 3);
    const attempted: string[] = [];
    const errors: string[] = [];

    for (const modelId of chain.slice(0, maxAttempts)) {
      const provider = createProvider(modelId, this.creds);
      if (!provider) {
        errors.push(`${modelId}: 未配置 API Key`);
        attempted.push(modelId);
        continue;
      }
      attempted.push(modelId);
      try {
        const res = await this.withRetry(() => provider.chat({ ...req, task }));
        const degraded = attempted.length > 1;
        return {
          ...res,
          modelId,
          attempted,
          degraded,
          degradedReason:
            degraded ? `主模型失败，已降级至 ${modelId}。失败记录：${errors.join('; ')}` : undefined,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${modelId}: ${msg}`);
      }
    }

    throw new Error(`所有模型调用失败：\n${errors.join('\n')}`);
  }

  /** 指数退避重试（最多 3 次，仅对 5xx / 429 / 网络错误重试） */
  private async withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        const retryable =
          /429|500|502|503|504|timeout|aborted|ECONNRESET|fetch failed|network/i.test(msg);
        if (!retryable || attempt === retries - 1) throw err;
        const delay = 1000 * Math.pow(2, attempt) + Math.random() * 400;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastErr;
  }
}

export * from './types.js';
