import type {
  CaseStudy,
  Domain,
  LearningPlan,
  LearningTask,
  MasteryRecord,
  Method,
  Practice,
  PracticeReview,
  Quiz,
  RecommendationResult,
  Relation,
  ResearchCandidate,
  ResearchTask,
  ReviewDecision,
  Source,
  SystemConfig,
} from '@shared/types';
import { readCache, writeCache } from './offline';

/**
 * API 客户端
 * - 统一调用 Worker 的 /api/* 端点
 * - 离线或请求失败时回退到 IndexedDB 缓存，并标记 stale
 * - AI 相关端点在离线时抛出明确错误，绝不假装成功
 */

const TOKEN_KEY = 'methodology-app-token';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly offline = false,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 响应可能带 stale 标记（来自离线缓存） */
export interface ApiResult<T> {
  data: T;
  stale: boolean;
  fetchedAt?: string;
}

function baseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE as string | undefined;
  if (configured) return configured.replace(/\/$/, '');
  // 相对路径：GitHub Pages 同源部署 Worker，或本地 dev 走 vite proxy
  return '';
}

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** 是否允许在失败时回退到离线缓存（仅 GET） */
  cacheFallback?: boolean;
  /** 缓存 key */
  cacheKey?: string;
  /** 离线时是否直接报错（AI 类请求必须为 true） */
  requireOnline?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const method = options.method ?? 'GET';
  const isGet = method === 'GET';
  const requireOnline = options.requireOnline ?? !isGet;

  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      let message = `请求失败 (${res.status})`;
      try {
        const payload = (await res.json()) as { error?: string; message?: string };
        message = payload.error ?? payload.message ?? message;
      } catch {
        /* 保留默认信息 */
      }
      throw new ApiError(message, res.status);
    }

    const data = (await res.json()) as T;

    if (isGet && options.cacheKey) {
      void writeCache({ key: options.cacheKey, data });
    }

    return { data, stale: false };
  } catch (err) {
    const offline = !navigator.onLine;
    if (err instanceof ApiError) throw err;

    // 网络层失败：若允许则回退缓存
    if (isGet && options.cacheFallback && options.cacheKey) {
      const cached = await readCache<{ key: string; data: T }>();
      const payload = cached?.data;
      if (payload && payload.key === options.cacheKey) {
        return { data: payload.data, stale: true, fetchedAt: cached?.fetchedAt };
      }
    }

    if (requireOnline && offline) {
      throw new ApiError('当前处于离线状态，该操作需要联网完成', 0, true);
    }
    throw new ApiError(
      err instanceof Error ? err.message : '网络请求失败',
      0,
      offline,
    );
  }
}

// ---------------------------------------------------------------------------
// 健康检查与配置
// ---------------------------------------------------------------------------

export interface HealthInfo {
  ok: boolean;
  model: string | null;
  searchProvider: string;
  dataRepo: string | null;
}

export const api = {
  health: () => request<HealthInfo>('/api/health'),

  getConfig: () =>
    request<SystemConfig>('/api/config', { cacheFallback: true, cacheKey: 'config' }),

  putConfig: (config: SystemConfig) =>
    request<SystemConfig>('/api/config', { method: 'PUT', body: config }),

  // -----------------------------------------------------------------------
  // 知识库
  // -----------------------------------------------------------------------

  listMethods: () =>
    request<{ methods: Method[] }>('/api/methods', {
      cacheFallback: true,
      cacheKey: 'methods',
    }),

  getMethod: (id: string) =>
    request<{ method: Method }>(`/api/methods/${encodeURIComponent(id)}`, {
      cacheFallback: true,
      cacheKey: `method:${id}`,
    }),

  saveMethod: (method: Method) =>
    request<{ ok: true }>(`/api/methods/${encodeURIComponent(method.id)}`, {
      method: 'PUT',
      body: method,
    }),

  deleteMethod: (id: string) =>
    request<{ ok: true }>(`/api/methods/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  listDomains: () =>
    request<{ domains: Domain[] }>('/api/domains', {
      cacheFallback: true,
      cacheKey: 'domains',
    }),

  listRelations: () =>
    request<{ relations: Relation[] }>('/api/relations', {
      cacheFallback: true,
      cacheKey: 'relations',
    }),

  listSources: () =>
    request<{ sources: Source[] }>('/api/sources', {
      cacheFallback: true,
      cacheKey: 'sources',
    }),

  listCases: () =>
    request<{ cases: CaseStudy[] }>('/api/cases', {
      cacheFallback: true,
      cacheKey: 'cases',
    }),

  // -----------------------------------------------------------------------
  // AI 研究中心
  // -----------------------------------------------------------------------

  researchQueue: () =>
    request<{ tasks: ResearchTask[]; candidates: ResearchCandidate[] }>(
      '/api/research/queue',
      { cacheFallback: true, cacheKey: 'research-queue' },
    ),

  reviewCandidate: (
    id: string,
    payload: {
      decision: ReviewDecision;
      notes?: string;
      edits?: Array<{ field: string; before: unknown; after: unknown }>;
      mergedIntoId?: string;
    },
  ) =>
    request<{ ok: true }>(
      `/api/research/queue/${encodeURIComponent(id)}/review`,
      { method: 'POST', body: payload },
    ),

  runResearch: (target: string, taskType = 'discovery') =>
    request<{ taskId: string }>('/api/research/run', {
      method: 'POST',
      body: { target, taskType },
    }),

  retryResearch: (id: string) =>
    request<{ ok: true }>(`/api/research/tasks/${encodeURIComponent(id)}/retry`, {
      method: 'POST',
    }),

  // -----------------------------------------------------------------------
  // 实践中心
  // -----------------------------------------------------------------------

  listPractices: () =>
    request<{ practices: Practice[] }>('/api/practices', {
      cacheFallback: true,
      cacheKey: 'practices',
    }),

  savePractice: (practice: Practice) =>
    request<{ ok: true }>(`/api/practices/${encodeURIComponent(practice.id)}`, {
      method: 'PUT',
      body: practice,
    }),

  reviewPractice: (
    id: string,
    payload: {
      logs?: unknown;
      result?: string;
      reflection?: string;
      evaluation?: unknown;
    },
  ) =>
    request<{ review: PracticeReview }>(
      `/api/practices/${encodeURIComponent(id)}/review`,
      { method: 'POST', body: payload },
    ),

  // -----------------------------------------------------------------------
  // 学习中心
  // -----------------------------------------------------------------------

  learning: () =>
    request<{
      plans: LearningPlan[];
      tasks: LearningTask[];
      quizzes: Quiz[];
      mastery: MasteryRecord[];
    }>('/api/learning', { cacheFallback: true, cacheKey: 'learning' }),

  createLearningPlan: (goal: string, methodIds: string[]) =>
    request<{ plan: LearningPlan; tasks: LearningTask[] }>('/api/learning/plan', {
      method: 'POST',
      body: { goal, methodIds },
    }),

  answerQuiz: (id: string, answer: number[] | string) =>
    request<{ correct: boolean; explanation: string; mastery: string }>(
      `/api/quiz/${encodeURIComponent(id)}/answer`,
      { method: 'POST', body: { answer } },
    ),

  // -----------------------------------------------------------------------
  // 智能检索
  // -----------------------------------------------------------------------

  ask: (question: string) =>
    request<RecommendationResult>('/api/ask', {
      method: 'POST',
      body: { question },
      requireOnline: true,
    }),

  // -----------------------------------------------------------------------
  // 导入导出
  // -----------------------------------------------------------------------

  exportBundle: () => request<{ bundle: unknown }>('/api/export'),

  importBundle: (bundle: unknown) =>
    request<{ ok: boolean; imported: number }>('/api/import', {
      method: 'POST',
      body: bundle,
    }),
};
