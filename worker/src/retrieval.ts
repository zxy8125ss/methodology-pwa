/**
 * 混合检索 —— 关键词 + 标签 + 语义近似 + 关系扩展
 *
 * 说明：第一阶段不引入独立向量数据库，用轻量字符 n-gram 相似度近似语义匹配。
 * 规模上来后可平滑替换为真正的向量检索，接口不变。
 */

import type { Method, Relation, RetrievalHit } from '../../shared/types.js';

export interface RetrievalOptions {
  limit?: number;
  /** 关联扩展：是否把关联方法论一并纳入 */
  expandRelations?: boolean;
  /** 领域加权 */
  domainWeights?: Map<string, number>;
}

const CJK_RE = /[\u4e00-\u9fff\u3040-\u30ff]/g;

/** 分词：中文按字 + 双字组合，英文按词 */
export function tokenize(text: string): string[] {
  const lowered = text.toLowerCase();
  const tokens: string[] = [];

  // 英文/数字词
  for (const m of lowered.matchAll(/[a-z0-9][a-z0-9_-]{1,}/g)) {
    tokens.push(m[0]);
  }

  // 中文：单字 + 相邻双字
  const cjk = lowered.match(CJK_RE) ?? [];
  for (let i = 0; i < cjk.length; i++) {
    tokens.push(cjk[i]);
    if (i + 1 < cjk.length) tokens.push(cjk[i] + cjk[i + 1]);
  }

  return tokens;
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

/** 余弦相似度（基于词频向量） */
export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [, v] of a) normA += v * v;
  for (const [, v] of b) normB += v * v;
  for (const [k, v] of a) {
    const other = b.get(k);
    if (other) dot += v * other;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** 构造方法论的检索文本 */
export function methodSearchText(method: Method): string {
  return [
    method.name,
    ...method.aliases,
    ...method.tags,
    method.content.coreIdea ?? '',
    ...method.content.principles,
    ...method.content.scenarios,
    ...method.content.conditions,
    ...method.content.steps,
    ...method.content.advantages,
    ...method.content.limitations,
    ...method.content.misconceptions,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * 执行混合检索
 * @param query 用户问题
 * @param methods 全部方法论
 * @param relations 关系表
 */
export function retrieve(
  query: string,
  methods: Method[],
  relations: Relation[],
  options: RetrievalOptions = {},
): RetrievalHit[] {
  const limit = options.limit ?? 8;
  const queryTokens = termFrequency(tokenize(query));
  const queryLower = query.toLowerCase();

  const scored = methods.map((method) => {
    const text = methodSearchText(method);
    const methodTf = termFrequency(tokenize(text));

    // 1. 关键词得分：名称/别名精确包含权重最高
    let keyword = 0;
    if (method.name.toLowerCase().includes(queryLower)) keyword += 0.6;
    for (const alias of method.aliases) {
      if (alias.toLowerCase().includes(queryLower)) keyword += 0.4;
    }
    for (const tag of method.tags) {
      if (queryLower.includes(tag.toLowerCase())) keyword += 0.3;
    }

    // 2. 标签得分：问题关键词命中方法论标签
    let tag = 0;
    for (const tagName of method.tags) {
      if (queryLower.includes(tagName.toLowerCase())) tag += 0.35;
    }

    // 3. 语义近似：词频余弦
    const vector = cosineSimilarity(queryTokens, methodTf);

    // 4. 领域加权
    const domain = options.domainWeights?.get(method.domainIds[0]) ?? 1;

    return { method, keyword, tag, vector, domain };
  });

  // 5. 关系扩展
  const relationBoost = new Map<string, number>();
  if (options.expandRelations !== false) {
    const directHits = new Set(
      scored
        .filter((s) => s.keyword + s.tag + s.vector > 0.15)
        .slice(0, 5)
        .map((s) => s.method.id),
    );
    for (const rel of relations) {
      if (directHits.has(rel.fromId)) {
        relationBoost.set(rel.toId, (relationBoost.get(rel.toId) ?? 0) + 0.18);
      }
      if (directHits.has(rel.toId)) {
        relationBoost.set(rel.fromId, (relationBoost.get(rel.fromId) ?? 0) + 0.18);
      }
    }
  }

  const hits: RetrievalHit[] = scored
    .map((s) => {
      const relation = relationBoost.get(s.method.id) ?? 0;
      const breakdown = {
        keyword: s.keyword,
        tag: s.tag,
        vector: Number(s.vector.toFixed(4)),
        relation: Number(relation.toFixed(4)),
      };
      const score =
        (s.keyword * 0.45 + s.tag * 0.2 + s.vector * 0.25 + relation * 0.1) * s.domain;
      return {
        methodId: s.method.id,
        methodName: s.method.name,
        snippet: buildSnippet(s.method, queryTokens),
        score: Number(score.toFixed(4)),
        breakdown,
        domainIds: s.method.domainIds,
        evidenceLevel: s.method.evidence.level,
      };
    })
    .filter((h) => h.score > 0.01)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return hits;
}

/** 从方法论内容里抽取包含查询词的片段 */
function buildSnippet(method: Method, queryTf: Map<string, number>): string {
  const pool = [
    method.content.coreIdea,
    ...method.content.scenarios,
    ...method.content.principles,
    ...method.content.steps,
    method.content.mechanism,
  ].filter((s): s is string => !!s && s.length > 0);

  if (pool.length === 0) return '';

  let best = pool[0];
  let bestScore = -1;
  for (const candidate of pool) {
    const tf = termFrequency(tokenize(candidate));
    const score = cosineSimilarity(queryTf, tf);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best.length > 220 ? `${best.slice(0, 220)}…` : best;
}
