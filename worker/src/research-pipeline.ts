/**
 * 深度研究流程
 * 搜索 → 交叉验证 → 生成档案 → 去重 → 关联 → 质量检查 → 进入审核队列
 */

import { AIRouter } from '../../shared/providers/ai/router.js';
import { aggregateSearch, type SearchResult } from '../../shared/providers/search/index.js';
import type {
  Method,
  Relation,
  ResearchCandidate,
  Source,
} from '../../shared/types.js';
import { DEDUPE_SYSTEM_PROMPT, RESEARCH_SYSTEM_PROMPT } from './prompts.js';

export interface ResearchInput {
  target: string;
  taskType: 'discovery' | 'deepen' | 'update' | 'relation';
  methods: Method[];
  relations: Relation[];
  sources: Source[];
  useWebSearch: boolean;
  searchProvider: string;
}

export interface ResearchOutput {
  candidate: ResearchCandidate;
  report: {
    title: string;
    summary: string;
    content: string;
    sourceIds: string[];
  };
  usage: { inputTokens: number; outputTokens: number; estimatedCostUsd: number };
  model: string;
  webResults: SearchResult[];
}

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq}`;
}

/** 把搜索结果整理成参考资料文本 */
function formatSources(results: SearchResult[]): string {
  if (results.length === 0) return '（本次未获取到外部资料）';
  return results
    .map((r, i) => {
      const bits = [
        `[${i + 1}] ${r.title}`,
        r.author ? `作者/机构：${r.author}` : '',
        r.publishedAt ? `时间：${r.publishedAt}` : '',
        r.url ? `链接：${r.url}` : '',
        `类型：${r.kind}，可信度：${r.credibility.toFixed(2)}`,
        `摘要：${r.snippet}`,
      ].filter(Boolean);
      return bits.join('\n');
    })
    .join('\n\n');
}

/** 把已有方法论整理成去重参考 */
function formatExisting(methods: Method[]): string {
  if (methods.length === 0) return '（知识库暂无条目）';
  return methods
    .map(
      (m) =>
        `- [${m.id}] ${m.name}${m.aliases.length ? `（别名：${m.aliases.join('、')}）` : ''} | 领域：${m.domainIds.join(',')} | ${m.content.coreIdea?.slice(0, 120) ?? ''}`,
    )
    .join('\n');
}

/** 执行一次深度研究 */
export async function runResearch(
  input: ResearchInput,
  router: AIRouter,
  searchCreds: Record<string, string | undefined>,
): Promise<ResearchOutput> {
  // 1. 联网检索
  let webResults: SearchResult[] = [];
  if (input.useWebSearch) {
    try {
      webResults = await aggregateSearch(
        { query: input.target, limit: 8 },
        searchCreds,
        { providers: input.searchProvider === 'auto' ? undefined : [input.searchProvider] },
      );
    } catch {
      webResults = [];
    }
  }

  // 2. 生成档案
  const userContent = [
    `【研究目标】${input.target}`,
    `【任务类型】${input.taskType}`,
    '',
    '【已有知识库条目（用于去重与关联判断）】',
    formatExisting(input.methods),
    '',
    '【检索到的参考资料】',
    formatSources(webResults),
  ].join('\n');

  const response = await router.chat(
    {
      messages: [
        { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      json: true,
      maxTokens: 8000,
      temperature: 0.2,
      task: 'deep_research',
    },
    'deep_research',
  );

  const data = (response.data ?? {}) as Record<string, unknown>;
  const draft = (data.draft ?? {}) as Partial<Method>;
  const candidateKind = (data.kind ?? 'new_method') as ResearchCandidate['kind'];

  // 3. 来源记录
  const sourceIds = Array.isArray(data.sourceIds) ? (data.sourceIds as string[]) : [];
  const createdAt = new Date().toISOString();

  const candidate: ResearchCandidate = {
    id: nextId('candidate'),
    kind: candidateKind,
    existingMethodId:
      typeof data.existingMethodId === 'string' ? data.existingMethodId : null,
    draft: draft as Partial<Method> | null,
    enrichment: undefined,
    relation: undefined,
    summary: typeof data.summary === 'string' ? data.summary : '',
    valuePoints: Array.isArray(data.valuePoints) ? (data.valuePoints as string[]) : [],
    cautions: Array.isArray(data.cautions) ? (data.cautions as string[]) : [],
    evidenceQuality: {
      level:
        ((data.evidenceQuality as { level?: string } | undefined)?.level as
          | ResearchCandidate['evidenceQuality']['level']
          | undefined) ?? 'unverified',
      note:
        (data.evidenceQuality as { note?: string } | undefined)?.note ??
        'AI 未提供证据质量说明',
      sourceCount:
        (data.evidenceQuality as { sourceCount?: number } | undefined)?.sourceCount ?? 0,
    },
    status: 'pending',
    sourceIds,
    createdAt,
    updatedAt: createdAt,
  };

  // 4. 质量检查：档案缺失关键字段时降级证据等级并记录告警
  if (candidateKind === 'new_method') {
    if (!draft.name) {
      candidate.cautions.push('AI 未返回方法论名称，该候选需人工补充');
      candidate.evidenceQuality.level = 'unverified';
    }
    if (!draft.origin?.proposer) {
      candidate.cautions.push('未能核实提出者，原始出处待补充');
      if (candidate.evidenceQuality.level === 'high') {
        candidate.evidenceQuality.level = 'medium';
      }
    }
    if (candidate.evidenceQuality.sourceCount === 0 && webResults.length === 0) {
      candidate.cautions.push('本次研究未获得任何外部资料来源，证据强度有限');
      candidate.evidenceQuality.level = 'unverified';
    }
  }

  // 5. 去重与关联识别
  const relations = await detectRelations(input, router, candidate);

  return {
    candidate,
    report: {
      title: `研究报告：${input.target}`,
      summary: candidate.summary,
      content: buildReportMarkdown(input, candidate, webResults),
      sourceIds,
    },
    usage: response.usage,
    model: response.model,
    webResults,
    ...(relations ? {} : {}),
  };
}

/** 去重 + 关联识别 */
async function detectRelations(
  input: ResearchInput,
  router: AIRouter,
  candidate: ResearchCandidate,
): Promise<Relation[] | null> {
  if (input.methods.length === 0) return null;

  try {
    const res = await router.chat(
      {
        messages: [
          { role: 'system', content: DEDUPE_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              `【新发现】${candidate.summary}`,
              candidate.draft?.name ? `名称：${candidate.draft.name}` : '',
              `【已有条目】`,
              formatExisting(input.methods),
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
        json: true,
        maxTokens: 3000,
        temperature: 0.1,
        task: 'dedupe_relation',
      },
      'dedupe_relation',
    );

    const data = (res.data ?? {}) as { relations?: unknown[] };
    const raw = Array.isArray(data.relations) ? data.relations : [];
    const now = new Date().toISOString();

    return raw
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
      .map((r) => ({
        id: nextId('rel'),
        fromId: String(r.fromId ?? ''),
        toId: String(r.toId ?? ''),
        type: (r.type ?? 'similar') as Relation['type'],
        explanation: String(r.explanation ?? ''),
        evidenceRefs: Array.isArray(r.evidenceRefs) ? (r.evidenceRefs as string[]) : [],
        confidence: Number(r.confidence ?? 0.5),
        origin: 'ai' as const,
        createdAt: now,
        updatedAt: now,
      }))
      .filter((r) => r.fromId && r.toId);
  } catch {
    return null;
  }
}

/** 生成研究报告 Markdown */
function buildReportMarkdown(
  input: ResearchInput,
  candidate: ResearchCandidate,
  webResults: SearchResult[],
): string {
  const draft = candidate.draft;
  const lines: string[] = [];

  lines.push(`# ${input.target}`);
  lines.push('');
  lines.push(`- 研究类型：${input.taskType}`);
  lines.push(`- 生成时间：${new Date().toISOString()}`);
  lines.push(`- 证据等级：${candidate.evidenceQuality.level}`);
  lines.push('');
  lines.push('## 研究摘要');
  lines.push('');
  lines.push(candidate.summary || '（无摘要）');
  lines.push('');

  if (draft?.name) {
    lines.push('## 方法论概要');
    lines.push('');
    lines.push(`**${draft.name}**`);
    if (draft.aliases?.length) {
      lines.push('');
      lines.push(`别名：${draft.aliases.join('、')}`);
    }
    lines.push('');
    if (draft.content?.coreIdea) {
      lines.push(draft.content.coreIdea);
      lines.push('');
    }
  }

  if (candidate.valuePoints.length > 0) {
    lines.push('## 新增价值');
    lines.push('');
    for (const v of candidate.valuePoints) lines.push(`- ${v}`);
    lines.push('');
  }

  if (candidate.cautions.length > 0) {
    lines.push('## 需要注意');
    lines.push('');
    for (const c of candidate.cautions) lines.push(`- ${c}`);
    lines.push('');
  }

  if (draft?.article) {
    lines.push('## 完整研究文章');
    lines.push('');
    lines.push(draft.article);
    lines.push('');
  }

  if (webResults.length > 0) {
    lines.push('## 参考资料');
    lines.push('');
    webResults.forEach((r, i) => {
      lines.push(`${i + 1}. [${r.title}](${r.url})`);
      lines.push(`   - ${r.kind}｜可信度 ${r.credibility.toFixed(2)}${r.author ? `｜${r.author}` : ''}${r.publishedAt ? `｜${r.publishedAt}` : ''}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}
