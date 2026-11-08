/**
 * Cloudflare Worker —— 安全代理层
 *
 * 职责：
 * 1. 持有 AI 模型密钥与 GitHub Token（只从环境变量读取）
 * 2. 代理前端请求：知识库读写、AI 研究、智能问答、实践复盘、学习计划
 * 3. 限流、成本上限、鉴权
 */

import { AIRouter } from '../../shared/providers/ai/router.js';
import type {
  LearningPlan,
  LearningTask,
  Method,
  Practice,
  PracticeReview,
  Quiz,
  Review,
  ReviewDecision,
  ResearchCandidate,
  ResearchTask,
  SystemConfig,
} from '../../shared/types.js';
import { DATA_LAYOUT } from '../../shared/types.js';
import { authorize } from './auth.js';
import { addCost, checkBudget, getTotalCost } from './cost.js';
import { resolveEnv, toProviderCredentials, toSearchCredentials, type Env } from './env.js';
import { checkRateLimit, clientKey } from './rate-limit.js';
import { retrieve } from './retrieval.js';
import { runResearch } from './research-pipeline.js';
import {
  ASK_SYSTEM_PROMPT,
  LEARNING_PLAN_SYSTEM_PROMPT,
  PRACTICE_REVIEW_SYSTEM_PROMPT,
} from './prompts.js';
import { createStore, DEFAULT_CONFIG, loadSnapshot, saveCollection } from './store.js';

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  'access-control-max-age': '86400',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

function error(message: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return json({ error: message, ...extra }, status);
}

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

export default {
  async fetch(request: Request, env: Env, ctx: WorkerContext): Promise<Response> {
    const resolved = resolveEnv(env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    // 健康检查不需要鉴权
    if (path === '/api/health') {
      const model = resolved.anthropicApiKey
        ? 'claude-sonnet-4-5'
        : resolved.deepseekApiKey
          ? 'deepseek-chat'
          : null;
      return json({
        ok: true,
        model,
        searchProvider: resolved.tavilyApiKey
          ? 'tavily'
          : resolved.braveApiKey
            ? 'brave'
            : 'crossref+arxiv+wikipedia+duckduckgo',
        dataRepo: resolved.githubToken
          ? `${resolved.githubOwner}/${resolved.githubRepo}`
          : null,
        cost: getTotalCost(),
      });
    }

    const auth = authorize(request, resolved.appToken);
    if (!auth.ok) return error(auth.reason ?? '未授权', 401);

    const rl = checkRateLimit(clientKey(request), resolved.rateLimitPerMinute);
    if (!rl.allowed) {
      return error(`请求过于频繁，请 ${rl.resetInSeconds} 秒后重试`, 429, {
        retryAfter: rl.resetInSeconds,
      });
    }

    if (!resolved.githubToken) {
      return error('服务端未配置数据仓访问凭据（GITHUB_TOKEN）', 503);
    }

    const store = createStore(resolved);
    const router = new AIRouter(toProviderCredentials(resolved), {
      taskRouting: DEFAULT_CONFIG.taskRouting,
      defaultModel: DEFAULT_CONFIG.defaultModel,
      fallbackModels: DEFAULT_CONFIG.fallbackModels,
    });

    try {
      return await handle(request, path, resolved, store, router, ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`服务端处理失败：${message}`, 500);
    }
  },
};

async function handle(
  request: Request,
  path: string,
  resolved: ReturnType<typeof resolveEnv>,
  store: ReturnType<typeof createStore>,
  router: AIRouter,
  ctx: WorkerContext,
): Promise<Response> {
  const method = request.method;

  // ---------------------------------------------------------------- 知识库
  if (path === '/api/methods' && method === 'GET') {
    const snapshot = await loadSnapshot(store);
    return json({ methods: snapshot.methods });
  }

  if (path.startsWith('/api/methods/') && method === 'GET') {
    const id = decodeURIComponent(path.slice('/api/methods/'.length));
    const snapshot = await loadSnapshot(store);
    const found = snapshot.methods.find((m) => m.id === id);
    if (!found) return error('方法论不存在', 404);
    return json({ method: found });
  }

  if (path.startsWith('/api/methods/') && method === 'PUT') {
    const id = decodeURIComponent(path.slice('/api/methods/'.length));
    const body = (await request.json()) as Method;
    if (!body || body.id !== id) return error('请求体与路径 id 不一致', 400);
    if (!body.name) return error('缺少方法论名称', 400);
    await store.repo.saveMethod(body);
    return json({ ok: true });
  }

  if (path.startsWith('/api/methods/') && method === 'DELETE') {
    const id = decodeURIComponent(path.slice('/api/methods/'.length));
    await store.repo.deleteMethod(id);
    return json({ ok: true });
  }

  if (path === '/api/domains' && method === 'GET') {
    const snapshot = await loadSnapshot(store);
    return json({ domains: snapshot.domains });
  }

  if (path === '/api/relations' && method === 'GET') {
    const snapshot = await loadSnapshot(store);
    return json({ relations: snapshot.relations });
  }

  if (path === '/api/sources' && method === 'GET') {
    const snapshot = await loadSnapshot(store);
    return json({ sources: snapshot.sources });
  }

  if (path === '/api/cases' && method === 'GET') {
    const snapshot = await loadSnapshot(store);
    return json({ cases: snapshot.cases });
  }

  // ---------------------------------------------------------------- 配置
  if (path === '/api/config' && method === 'GET') {
    const snapshot = await loadSnapshot(store);
    return json(snapshot.config);
  }

  if (path === '/api/config' && method === 'PUT') {
    const body = (await request.json()) as SystemConfig;
    const next: SystemConfig = { ...body, updatedAt: new Date().toISOString() };
    await saveCollection(store, DATA_LAYOUT.config, next);
    return json(next);
  }

  // ---------------------------------------------------------------- 研究
  if (path === '/api/research/queue' && method === 'GET') {
    const snapshot = await loadSnapshot(store);
    return json({
      tasks: snapshot.research.tasks,
      candidates: snapshot.research.candidates,
    });
  }

  if (path === '/api/research/run' && method === 'POST') {
    const body = (await request.json()) as {
      target?: string;
      taskType?: ResearchTask['taskType'];
    };
    const target = body.target?.trim();
    if (!target) return error('缺少研究目标', 400);

    const snapshot = await loadSnapshot(store);
    const budget = checkBudget(snapshot.config.costLimitPerTask);
    if (!budget.allowed) return error(budget.reason ?? '超出预算', 429);

    const now = new Date().toISOString();
    const task: ResearchTask = {
      id: `task_${Date.now().toString(36)}`,
      taskType: body.taskType ?? 'discovery',
      target,
      trigger: 'user_request',
      status: 'queued',
      priority: 3,
      model: null,
      error: null,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await saveCollection(store, DATA_LAYOUT.researchQueue, {
      tasks: [...snapshot.research.tasks, task],
      candidates: snapshot.research.candidates,
    });

    // 异步执行研究，不阻塞响应
    ctx.waitUntil(
      (async () => {
        try {
          const output = await runResearch(
            {
              target,
              taskType: (task.taskType ?? 'discovery') as
                | 'discovery'
                | 'deepen'
                | 'update'
                | 'relation',
              methods: snapshot.methods,
              relations: snapshot.relations,
              sources: snapshot.sources,
              useWebSearch: snapshot.config.webSearchEnabled,
              searchProvider: snapshot.config.searchProvider,
            },
            router,
            toSearchCredentials(resolved),
          );

          addCost(output.usage);

          const fresh = await loadSnapshot(store);
          const updatedTask: ResearchTask = {
            ...task,
            status: 'completed',
            model: output.model,
            usage: output.usage,
            startedAt: now,
            finishedAt: new Date().toISOString(),
          };

          await saveCollection(store, DATA_LAYOUT.researchQueue, {
            tasks: fresh.research.tasks.map((t) =>
              t.id === task.id ? updatedTask : t,
            ),
            candidates: [...fresh.research.candidates, output.candidate],
          });

          const reportId = `report_${Date.now().toString(36)}`;
          await store.client.putJson(`${DATA_LAYOUT.researchReports}/${reportId}.json`, {
            id: reportId,
            taskId: task.id,
            title: output.report.title,
            reportType: 'discovery',
            summary: output.report.summary,
            content: output.report.content,
            methodIds: [],
            sourceIds: output.report.sourceIds,
            candidateIds: [output.candidate.id],
            model: output.model,
            usage: output.usage,
            createdAt: new Date().toISOString(),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const fresh = await loadSnapshot(store);
          await saveCollection(store, DATA_LAYOUT.researchQueue, {
            tasks: fresh.research.tasks.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    status: 'failed' as const,
                    error: message,
                    finishedAt: new Date().toISOString(),
                  }
                : t,
            ),
            candidates: fresh.research.candidates,
          });
        }
      })(),
    );

    return json({ taskId: task.id });
  }

  if (path.startsWith('/api/research/tasks/') && path.endsWith('/retry') && method === 'POST') {
    const id = decodeURIComponent(
      path.slice('/api/research/tasks/'.length, -'/retry'.length),
    );
    const snapshot = await loadSnapshot(store);
    const tasks = snapshot.research.tasks.map((t) =>
      t.id === id
        ? { ...t, status: 'queued' as const, error: null, updatedAt: new Date().toISOString() }
        : t,
    );
    await saveCollection(store, DATA_LAYOUT.researchQueue, {
      tasks,
      candidates: snapshot.research.candidates,
    });
    return json({ ok: true });
  }

  if (
    path.startsWith('/api/research/queue/') &&
    path.endsWith('/review') &&
    method === 'POST'
  ) {
    const id = decodeURIComponent(
      path.slice('/api/research/queue/'.length, -'/review'.length),
    );
    const body = (await request.json()) as {
      decision?: ReviewDecision;
      notes?: string;
      edits?: Array<{ field: string; before: unknown; after: unknown }>;
      mergedIntoId?: string;
    };
    const decision = body.decision;
    if (!decision) return error('缺少审核决策', 400);

    const snapshot = await loadSnapshot(store);
    const candidate = snapshot.research.candidates.find((c) => c.id === id);
    if (!candidate) return error('审核项不存在', 404);

    const now = new Date().toISOString();

    if (decision === 'approve' || decision === 'approve_with_edits') {
      await applyCandidateToLibrary(store, candidate, body.edits);
    } else if (decision === 'merge') {
      if (!body.mergedIntoId) return error('合并操作需要指定目标方法论 id', 400);
      await applyCandidateToLibrary(store, candidate, undefined, body.mergedIntoId);
    }

    const statusMap: Record<ReviewDecision, ResearchCandidate['status']> = {
      approve: 'approved',
      approve_with_edits: 'approved',
      reject: 'rejected',
      merge: 'merged',
      ignore: 'ignored',
    };
    const candidates = snapshot.research.candidates.map((c) =>
      c.id === id ? { ...c, status: statusMap[decision], updatedAt: now } : c,
    );

    const review: Review = {
      id: `review_${Date.now().toString(36)}`,
      targetType: 'method',
      targetId: candidate.existingMethodId ?? candidate.draft?.id ?? id,
      decision: decision,
      notes: body.notes ?? null,
      edits: body.edits,
      mergedIntoId: body.mergedIntoId ?? null,
      reviewedAt: now,
      aiSummary: candidate.summary,
    };

    await saveCollection(store, DATA_LAYOUT.researchQueue, {
      tasks: snapshot.research.tasks,
      candidates,
    });
    await saveCollection(store, DATA_LAYOUT.reviews, {
      reviews: [...snapshot.reviews, review],
    });

    return json({ ok: true });
  }

  // ---------------------------------------------------------------- 实践
  if (path === '/api/practices' && method === 'GET') {
    const snapshot = await loadSnapshot(store);
    return json({ practices: snapshot.practices });
  }

  if (path.startsWith('/api/practices/') && method === 'PUT') {
    const id = decodeURIComponent(path.slice('/api/practices/'.length));
    const body = (await request.json()) as Practice;
    if (!body || body.id !== id) return error('请求体与路径 id 不一致', 400);
    const snapshot = await loadSnapshot(store);
    const exists = snapshot.practices.some((p) => p.id === id);
    const practices = exists
      ? snapshot.practices.map((p) =>
          p.id === id ? { ...body, updatedAt: new Date().toISOString() } : p,
        )
      : [...snapshot.practices, body];
    await saveCollection(store, DATA_LAYOUT.practices, { practices });
    return json({ ok: true });
  }

  if (
    path.startsWith('/api/practices/') &&
    path.endsWith('/review') &&
    method === 'POST'
  ) {
    const id = decodeURIComponent(
      path.slice('/api/practices/'.length, -'/review'.length),
    );
    const body = (await request.json()) as {
      logs?: Practice['logs'];
      result?: string;
      reflection?: string;
      evaluation?: Practice['evaluation'];
    };

    const snapshot = await loadSnapshot(store);
    const practice = snapshot.practices.find((p) => p.id === id);
    if (!practice) return error('实践项目不存在', 404);

    // 数据不足时明确报错，绝不虚构
    const hasData =
      (body.logs && body.logs.length > 0) ||
      !!body.result ||
      !!body.evaluation?.actualEffect;
    if (!hasData) {
      return error(
        '缺少实际执行记录，无法生成复盘。请先填写过程记录、实际结果或效果评价。',
        400,
      );
    }

    const budget = checkBudget(snapshot.config.costLimitPerTask);
    if (!budget.allowed) return error(budget.reason ?? '超出预算', 429);

    const methodNames = snapshot.methods
      .filter((m) => practice.methodIds.includes(m.id))
      .map((m) => `${m.name}：${m.content.coreIdea ?? '（无核心思想）'}`)
      .join('\n');

    const review = await router.chat(
      {
        messages: [
          { role: 'system', content: PRACTICE_REVIEW_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              `【实践项目】${practice.name}`,
              `【要解决的问题】${practice.problem}`,
              `【预期目标】${practice.expectedOutcome}`,
              `【使用的方法论】\n${methodNames || '（未关联）'}`,
              '【用户的执行记录】',
              body.logs && body.logs.length > 0
                ? body.logs.map((l) => `- [${l.kind}] ${l.content}`).join('\n')
                : '（未提供）',
              `【实际结果】${body.result ?? '（未提供）'}`,
              `【用户反思】${body.reflection ?? '（未提供）'}`,
              `【效果评价】${body.evaluation ? JSON.stringify(body.evaluation) : '（未提供）'}`,
            ].join('\n'),
          },
        ],
        json: true,
        maxTokens: 3000,
        temperature: 0.2,
        task: 'practice_review',
      },
      'practice_review',
    );

    addCost(review.usage);

    const parsed = (review.data ?? {}) as Record<string, unknown>;
    const now = new Date().toISOString();
    const aiReview: PracticeReview = {
      methodFit: String(parsed.methodFit ?? '数据不足，无法判断'),
      conditionsMet: String(parsed.conditionsMet ?? '数据不足，无法判断'),
      executionCompleteness: String(
        parsed.executionCompleteness ?? '数据不足，无法判断',
      ),
      effectiveSteps: Array.isArray(parsed.effectiveSteps)
        ? (parsed.effectiveSteps as string[])
        : [],
      influencingFactors: Array.isArray(parsed.influencingFactors)
        ? (parsed.influencingFactors as string[])
        : [],
      alternativeExplanations: Array.isArray(parsed.alternativeExplanations)
        ? (parsed.alternativeExplanations as string[])
        : [],
      improvements: Array.isArray(parsed.improvements) ? (parsed.improvements as string[]) : [],
      needsMethodUpdate: parsed.needsMethodUpdate === true,
      updateTargetIds: Array.isArray(parsed.updateTargetIds)
        ? (parsed.updateTargetIds as string[])
        : [],
      model: review.model,
      createdAt: now,
    };

    const practices = snapshot.practices.map((p) =>
      p.id === id
        ? {
            ...p,
            aiReview,
            logs: body.logs ?? p.logs,
            result: body.result ?? p.result,
            reflection: body.reflection ?? p.reflection,
            evaluation: body.evaluation ?? p.evaluation,
            updatedAt: now,
          }
        : p,
    );
    await saveCollection(store, DATA_LAYOUT.practices, { practices });

    return json({ review: aiReview });
  }

  // ---------------------------------------------------------------- 学习
  if (path === '/api/learning' && method === 'GET') {
    const snapshot = await loadSnapshot(store);
    return json(snapshot.learning);
  }

  if (path === '/api/learning/plan' && method === 'POST') {
    const body = (await request.json()) as { goal?: string; methodIds?: string[] };
    const goal = body.goal?.trim();
    if (!goal) return error('缺少学习目标', 400);

    const snapshot = await loadSnapshot(store);
    const budget = checkBudget(snapshot.config.costLimitPerTask);
    if (!budget.allowed) return error(budget.reason ?? '超出预算', 429);

    const selected = snapshot.methods.filter((m) => (body.methodIds ?? []).includes(m.id));
    const context =
      selected.length > 0
        ? selected
            .map(
              (m) =>
                `- ${m.name}：${m.content.coreIdea ?? ''}\n  关键点：${m.content.principles
                  .slice(0, 3)
                  .join('、')}`,
            )
            .join('\n')
        : '（未指定方法论，请从知识库中挑选最相关的）';

    const res = await router.chat(
      {
        messages: [
          { role: 'system', content: LEARNING_PLAN_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `【学习目标】${goal}\n\n【候选方法论】\n${context}`,
          },
        ],
        json: true,
        maxTokens: 5000,
        temperature: 0.3,
        task: 'learning_plan',
      },
      'learning_plan',
    );

    addCost(res.usage);

    const parsed = (res.data ?? {}) as {
      plan?: Partial<LearningPlan>;
      tasks?: Array<Partial<LearningTask>>;
      quizzes?: Array<Partial<Quiz>>;
    };

    const now = new Date().toISOString();
    const plan: LearningPlan = {
      id: parsed.plan?.id ?? `plan_${Date.now().toString(36)}`,
      title: parsed.plan?.title ?? goal.slice(0, 30),
      period: parsed.plan?.period ?? null,
      goal,
      taskIds: [],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    const quizzes: Quiz[] = (parsed.quizzes ?? []).map((q) => ({
      id: q.id ?? `quiz_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      taskId: null,
      methodIds: q.methodIds ?? [],
      question: q.question ?? '',
      kind: q.kind ?? 'single_choice',
      options: q.options,
      answer: q.answer ?? null,
      explanation: q.explanation ?? '',
      createdAt: now,
    }));

    const tasks: LearningTask[] = (parsed.tasks ?? []).map((t) => {
      const taskId =
        t.id ?? `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      return {
        id: taskId,
        planId: plan.id,
        mode: t.mode ?? 'topic',
        title: t.title ?? '学习任务',
        objective: t.objective ?? goal,
        methodIds: t.methodIds ?? [],
        materials: t.materials ?? [],
        keyPoints: t.keyPoints ?? [],
        caseIds: t.caseIds ?? [],
        quizIds: quizzes.length > 0 ? [quizzes[0].id] : [],
        reviewAt: null,
        repetition: null,
        mastery: t.mastery ?? 'aware',
        status: 'pending',
        dueAt: t.dueAt ?? null,
        createdAt: now,
        updatedAt: now,
      };
    });

    plan.taskIds = tasks.map((t) => t.id);

    await saveCollection(store, DATA_LAYOUT.learning, {
      plans: [...snapshot.learning.plans, plan],
      tasks: [...snapshot.learning.tasks, ...tasks],
      quizzes: [...snapshot.learning.quizzes, ...quizzes],
      mastery: snapshot.learning.mastery,
    });

    return json({ plan, tasks });
  }

  if (path.startsWith('/api/quiz/') && path.endsWith('/answer') && method === 'POST') {
    const id = decodeURIComponent(path.slice('/api/quiz/'.length, -'/answer'.length));
    const body = (await request.json()) as { answer?: number[] | string };

    const snapshot = await loadSnapshot(store);
    const quiz = snapshot.learning.quizzes.find((q) => q.id === id);
    if (!quiz) return error('测验不存在', 404);

    const given = Array.isArray(body.answer) ? body.answer : [];
    const expected = quiz.answer ?? [];
    const correct =
      expected.length === given.length && expected.every((v, i) => v === given[i]);

    const masteryRecords = [...snapshot.learning.mastery];
    for (const methodId of quiz.methodIds) {
      const existing = masteryRecords.find((m) => m.methodId === methodId);
      const newLevel = correct ? 'understand' : 'aware';
      if (existing) {
        if (existing.level === 'aware' && newLevel === 'understand') {
          existing.level = newLevel;
          existing.reason = 'quiz';
          existing.score = correct ? 100 : (existing.score ?? 0);
          existing.at = new Date().toISOString();
        }
      } else {
        masteryRecords.push({
          id: `mastery_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          methodId,
          level: newLevel,
          reason: 'quiz',
          score: correct ? 100 : 0,
          at: new Date().toISOString(),
        });
      }
    }

    await saveCollection(store, DATA_LAYOUT.learning, {
      ...snapshot.learning,
      mastery: masteryRecords,
    });

    return json({
      correct,
      explanation: quiz.explanation,
      mastery: quiz.methodIds[0]
        ? (masteryRecords.find((m) => m.methodId === quiz.methodIds[0])?.level ?? 'aware')
        : 'aware',
    });
  }

  // ---------------------------------------------------------------- 智能问答
  if (path === '/api/ask' && method === 'POST') {
    const body = (await request.json()) as { question?: string };
    const question = body.question?.trim();
    if (!question) return error('缺少问题', 400);

    const snapshot = await loadSnapshot(store);
    const budget = checkBudget(snapshot.config.costLimitPerTask);
    if (!budget.allowed) return error(budget.reason ?? '超出预算', 429);

    const hits = retrieve(question, snapshot.methods, snapshot.relations, { limit: 6 });
    const methodById = new Map(snapshot.methods.map((m) => [m.id, m]));

    const context = hits
      .map((h) => {
        const m = methodById.get(h.methodId);
        if (!m) return '';
        return [
          `### ${m.name} [${m.id}]`,
          `别名：${m.aliases.join('、') || '无'}`,
          `核心思想：${m.content.coreIdea ?? '未整理'}`,
          `适用场景：${m.content.scenarios.join('；') || '未整理'}`,
          `成立条件：${m.content.conditions.join('；') || '未整理'}`,
          `实施步骤：${m.content.steps.join(' → ') || '未整理'}`,
          `优点：${m.content.advantages.join('；') || '未整理'}`,
          `局限：${m.content.limitations.join('；') || '未整理'}`,
          `证据等级：${m.evidence.level}，可信度：${m.evidence.confidence ?? '未评估'}`,
        ].join('\n');
      })
      .filter(Boolean)
      .join('\n\n');

    const res = await router.chat(
      {
        messages: [
          { role: 'system', content: ASK_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `【用户问题】${question}\n\n【知识库检索结果】\n${
              context || '（知识库中未检索到相关内容）'
            }`,
          },
        ],
        json: true,
        maxTokens: 4000,
        temperature: 0.3,
        task: 'daily_qa',
      },
      'daily_qa',
    );

    addCost(res.usage);

    const parsed = (res.data ?? {}) as {
      understanding?: string;
      methods?: Array<Record<string, unknown>>;
      combinationLogic?: string;
      aiInference?: string[];
    };

    const methods = (parsed.methods ?? [])
      .map((m) => {
        const methodId = String(m.methodId ?? '');
        const hit = hits.find((h) => h.methodId === methodId);
        const source = methodById.get(methodId);
        return {
          methodId,
          name: String(m.name ?? source?.name ?? methodId),
          reason: String(m.reason ?? ''),
          conditions: Array.isArray(m.conditions) ? (m.conditions as string[]) : [],
          steps: Array.isArray(m.steps) ? (m.steps as string[]) : [],
          cautions: Array.isArray(m.cautions) ? (m.cautions as string[]) : [],
          evidenceLevel: source?.evidence.level ?? hit?.evidenceLevel ?? 'unverified',
          score: Number(m.score ?? hit?.score ?? 0),
        };
      })
      .filter((m) => m.methodId);

    return json({
      understanding:
        parsed.understanding ?? `关于「${question}」，知识库中未检索到高度相关的方法论。`,
      methods,
      combinationLogic: parsed.combinationLogic ?? null,
      caseIds: [],
      sourceIds: [],
      hits,
      provenance: {
        fromKnowledgeBase: hits.length > 0 && methods.length > 0,
        usedWebSearch: false,
        aiInference: Array.isArray(parsed.aiInference) ? parsed.aiInference : [],
      },
      usage: res.usage,
      model: res.model,
    });
  }

  // ---------------------------------------------------------------- 导入导出
  if (path === '/api/export' && method === 'GET') {
    const snapshot = await loadSnapshot(store);
    return json({
      bundle: {
        version: 1,
        exportedAt: new Date().toISOString(),
        methods: snapshot.methods,
        domains: snapshot.domains,
        relations: snapshot.relations,
        sources: snapshot.sources,
        cases: snapshot.cases,
        practices: snapshot.practices,
        learning: snapshot.learning,
        reviews: snapshot.reviews,
        research: snapshot.research,
        config: snapshot.config,
      },
    });
  }

  if (path === '/api/import' && method === 'POST') {
    const bundle = (await request.json()) as Record<string, unknown>;
    if (!bundle || typeof bundle !== 'object') return error('导入内容格式无效', 400);

    const snapshot = await loadSnapshot(store);
    let imported = 0;

    const methods = Array.isArray(bundle.methods)
      ? (bundle.methods as Method[])
      : snapshot.methods;
    for (const m of methods) {
      if (!m?.id || !m?.name) continue;
      await store.repo.saveMethod(m);
      imported += 1;
    }

    if (Array.isArray(bundle.domains)) {
      await saveCollection(store, DATA_LAYOUT.domains, { domains: bundle.domains });
    }
    if (Array.isArray(bundle.relations)) {
      await saveCollection(store, DATA_LAYOUT.relations, { relations: bundle.relations });
    }
    if (Array.isArray(bundle.sources)) {
      await saveCollection(store, DATA_LAYOUT.sources, { sources: bundle.sources });
    }
    if (Array.isArray(bundle.cases)) {
      await saveCollection(store, DATA_LAYOUT.cases, { cases: bundle.cases });
    }
    if (Array.isArray(bundle.practices)) {
      await saveCollection(store, DATA_LAYOUT.practices, { practices: bundle.practices });
    }
    if (bundle.learning && typeof bundle.learning === 'object') {
      await saveCollection(store, DATA_LAYOUT.learning, bundle.learning);
    }
    if (Array.isArray(bundle.reviews)) {
      await saveCollection(store, DATA_LAYOUT.reviews, { reviews: bundle.reviews });
    }

    return json({ ok: true, imported });
  }

  return error('接口不存在', 404);
}

/**
 * 把审核通过的候选写入知识库
 * - approve：新建方法论档案
 * - approve_with_edits：新建并应用用户编辑
 * - merge：把内容并入已有方法论（追加证据与步骤，保留历史）
 */
async function applyCandidateToLibrary(
  store: ReturnType<typeof createStore>,
  candidate: ResearchCandidate,
  edits?: Array<{ field: string; before: unknown; after: unknown }>,
  mergeIntoId?: string,
): Promise<void> {
  const now = new Date().toISOString();

  if (mergeIntoId) {
    const existing = await store.repo.getMethod(mergeIntoId);
    if (!existing) return;
    const draft = candidate.draft;
    if (!draft) return;

    const merged: Method = {
      ...existing,
      content: {
        ...existing.content,
        conditions: dedupeStrings([
          ...existing.content.conditions,
          ...(draft.content?.conditions ?? []),
        ]),
        steps: dedupeStrings([...existing.content.steps, ...(draft.content?.steps ?? [])]),
        advantages: dedupeStrings([
          ...existing.content.advantages,
          ...(draft.content?.advantages ?? []),
        ]),
        limitations: dedupeStrings([
          ...existing.content.limitations,
          ...(draft.content?.limitations ?? []),
        ]),
        misconceptions: dedupeStrings([
          ...existing.content.misconceptions,
          ...(draft.content?.misconceptions ?? []),
        ]),
      },
      evidence: {
        level: betterEvidence(
          existing.evidence.level,
          draft.evidence?.level ?? 'unverified',
        ),
        claims: [...existing.evidence.claims, ...(draft.evidence?.claims ?? [])],
        confidence:
          Math.max(existing.evidence.confidence ?? 0, draft.evidence?.confidence ?? 0) ||
          null,
      },
      tags: dedupeStrings([...existing.tags, ...(draft.tags ?? [])]),
      history: [
        ...(existing.history ?? []),
        {
          version: existing.version + 1,
          at: now,
          summary: `合并研究候选：${candidate.summary.slice(0, 60)}`,
          changeType: 'merge',
          by: 'user',
        },
      ],
      version: existing.version + 1,
      updatedAt: now,
      lastResearchedAt: now,
    };

    await store.repo.saveMethod(merged);
    return;
  }

  const draft = candidate.draft;
  if (!draft?.name) return;

  if (edits && edits.length > 0) {
    for (const edit of edits) {
      applyEdit(draft as Record<string, unknown>, edit.field, edit.after);
    }
  }

  const method: Method = {
    id: draft.id ?? `method_${Date.now().toString(36)}`,
    name: draft.name,
    aliases: draft.aliases ?? [],
    domainIds: draft.domainIds?.length ? draft.domainIds : ['thinking'],
    subDomainIds: draft.subDomainIds,
    type: draft.type ?? 'model',
    origin: draft.origin ?? { proposer: null, firstProposedAt: null, sourceIds: [] },
    content: draft.content ?? {
      principles: [],
      scenarios: [],
      conditions: [],
      steps: [],
      advantages: [],
      disadvantages: [],
      limitations: [],
      misconceptions: [],
    },
    evidence: draft.evidence ?? { level: 'unverified', claims: [], confidence: null },
    relatedIds: draft.relatedIds ?? [],
    caseIds: [],
    tags: draft.tags ?? [],
    status: 'approved',
    article: draft.article ?? null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    lastResearchedAt: now,
    history: [
      {
        version: 1,
        at: now,
        summary: `AI 研究入库：${candidate.summary.slice(0, 80)}`,
        changeType: 'create',
        by: 'ai',
      },
    ],
  };

  await store.repo.saveMethod(method);
}

function dedupeStrings(items: string[]): string[] {
  return Array.from(new Set(items.filter((s) => !!s && s.trim().length > 0)));
}

function betterEvidence(a: string, b: string): Method['evidence']['level'] {
  const order = ['unverified', 'low', 'medium', 'high', 'meta_analysis'];
  const ai = order.indexOf(a);
  const bi = order.indexOf(b);
  if (ai === -1) return b as Method['evidence']['level'];
  if (bi === -1) return a as Method['evidence']['level'];
  return (order[Math.max(ai, bi)] ?? 'unverified') as Method['evidence']['level'];
}

/** 应用用户对草稿的字段编辑 */
function applyEdit(
  draft: Record<string, unknown>,
  field: string,
  value: unknown,
): void {
  if (field === 'name') draft.name = value;
  else if (field === 'type') draft.type = value;
  else if (field === 'aliases') draft.aliases = value;
  else if (field === 'domainIds') draft.domainIds = value;
  else if (field === 'tags') draft.tags = value;
  else if (field.startsWith('content.')) {
    const content = (draft.content ?? {}) as Record<string, unknown>;
    content[field.slice('content.'.length)] = value;
    draft.content = content;
  } else if (field.startsWith('evidence.')) {
    const evidence = (draft.evidence ?? {}) as Record<string, unknown>;
    evidence[field.slice('evidence.'.length)] = value;
    draft.evidence = evidence;
  } else if (field.startsWith('origin.')) {
    const origin = (draft.origin ?? {}) as Record<string, unknown>;
    origin[field.slice('origin.'.length)] = value;
    draft.origin = origin;
  }
}
