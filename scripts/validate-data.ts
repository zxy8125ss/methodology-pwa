/**
 * 数据校验 —— Schema 校验 + 引用完整性检查
 *
 * 用法：npm run data:validate
 * 退出码非 0 表示校验失败，CI 会阻止合并。
 */

import { GitHubClient, DataRepo } from '../shared/repo/github.js';
import {
  methodSchema,
  domainSchema,
  relationSchema,
  sourceSchema,
  caseStudySchema,
  practiceSchema,
  learningPlanSchema,
  learningTaskSchema,
  quizSchema,
  masteryRecordSchema,
  researchCandidateSchema,
  validateMany,
} from '../shared/schemas.js';

const OWNER = process.env.GITHUB_OWNER ?? 'zxy8125ss';
const REPO = process.env.GITHUB_REPO ?? 'methodology-data';
const BRANCH = process.env.DATA_REPO_BRANCH ?? 'main';
const TOKEN =
  process.env.GITHUB_TOKEN_DATA ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '';

interface Issue {
  scope: string;
  message: string;
}

async function main(): Promise<void> {
  if (!TOKEN) {
    console.error('缺少 GITHUB_TOKEN_DATA，无法访问数据仓');
    process.exit(1);
  }

  const client = new GitHubClient({ owner: OWNER, repo: REPO, token: TOKEN, branch: BRANCH });
  const repo = new DataRepo({ client });

  const issues: Issue[] = [];

  const methods = await repo.listMethods();
  console.log(`检查方法论 ${methods.length} 条…`);

  const methodResult = validateMany(methodSchema, methods, 'methods');
  for (const issue of methodResult.issues) {
    issues.push({ scope: 'method', message: `${issue.path}: ${issue.message}` });
  }

  const domainsRes = await repo.getCollection<{ domains: unknown[] }>('data/domains.json');
  const domainsResult = validateMany(domainSchema, domainsRes?.domains ?? [], 'domains');
  for (const issue of domainsResult.issues) {
    issues.push({ scope: 'domain', message: `${issue.path}: ${issue.message}` });
  }

  const relationsRes = await repo.getCollection<{ relations: unknown[] }>('data/relations.json');
  const relationsResult = validateMany(relationSchema, relationsRes?.relations ?? [], 'relations');
  for (const issue of relationsResult.issues) {
    issues.push({ scope: 'relation', message: `${issue.path}: ${issue.message}` });
  }

  const sourcesRes = await repo.getCollection<{ sources: unknown[] }>('data/sources.json');
  const sourcesResult = validateMany(sourceSchema, sourcesRes?.sources ?? [], 'sources');
  for (const issue of sourcesResult.issues) {
    issues.push({ scope: 'source', message: `${issue.path}: ${issue.message}` });
  }

  const casesRes = await repo.getCollection<{ cases: unknown[] }>('data/cases.json');
  const casesResult = validateMany(caseStudySchema, casesRes?.cases ?? [], 'cases');
  for (const issue of casesResult.issues) {
    issues.push({ scope: 'case', message: `${issue.path}: ${issue.message}` });
  }

  const practicesRes = await repo.getCollection<{ practices: unknown[] }>('data/practices.json');
  const practicesResult = validateMany(practiceSchema, practicesRes?.practices ?? [], 'practices');
  for (const issue of practicesResult.issues) {
    issues.push({ scope: 'practice', message: `${issue.path}: ${issue.message}` });
  }

  const learningRes = await repo.getCollection<{
    plans: unknown[];
    tasks: unknown[];
    quizzes: unknown[];
    mastery: unknown[];
  }>('data/learning.json');
  const plansResult = validateMany(learningPlanSchema, learningRes?.plans ?? [], 'learning.plans');
  const tasksResult = validateMany(learningTaskSchema, learningRes?.tasks ?? [], 'learning.tasks');
  const quizzesResult = validateMany(quizSchema, learningRes?.quizzes ?? [], 'learning.quizzes');
  const masteryResult = validateMany(
    masteryRecordSchema,
    learningRes?.mastery ?? [],
    'learning.mastery',
  );
  for (const r of [plansResult, tasksResult, quizzesResult, masteryResult]) {
    for (const issue of r.issues) {
      issues.push({ scope: 'learning', message: `${issue.path}: ${issue.message}` });
    }
  }

  const queueRes = await repo.getCollection<{ candidates: unknown[] }>('research/queue.json');
  const candidatesResult = validateMany(
    researchCandidateSchema,
    queueRes?.candidates ?? [],
    'research.candidates',
  );
  for (const issue of candidatesResult.issues) {
    issues.push({ scope: 'candidate', message: `${issue.path}: ${issue.message}` });
  }

  // ---- 引用完整性 ----
  const methodIds = new Set(methods.map((m) => m.id));
  const domainIds = new Set(
    (domainsRes?.domains as Array<{ id: string }> | undefined)?.map((d) => d.id) ?? [],
  );
  const sourceIds = new Set(
    (sourcesRes?.sources as Array<{ id: string }> | undefined)?.map((s) => s.id) ?? [],
  );

  for (const m of methods) {
    for (const d of m.domainIds) {
      if (!domainIds.has(d)) {
        issues.push({ scope: 'method', message: `${m.id} 引用了不存在的领域 "${d}"` });
      }
    }
    for (const sid of m.origin.sourceIds ?? []) {
      if (!sourceIds.has(sid)) {
        issues.push({ scope: 'method', message: `${m.id} 引用了不存在的来源 "${sid}"` });
      }
    }
    for (const rel of m.relatedIds ?? []) {
      if (!methodIds.has(rel)) {
        issues.push({ scope: 'method', message: `${m.id} 关联了不存在的方法论 "${rel}"` });
      }
    }
  }

  for (const rel of (relationsRes?.relations ?? []) as Array<{
    id: string;
    fromId: string;
    toId: string;
  }>) {
    if (!methodIds.has(rel.fromId)) {
      issues.push({ scope: 'relation', message: `${rel.id} 的起点 "${rel.fromId}" 不存在` });
    }
    if (!methodIds.has(rel.toId)) {
      issues.push({ scope: 'relation', message: `${rel.id} 的终点 "${rel.toId}" 不存在` });
    }
  }

  for (const p of (practicesRes?.practices ?? []) as Array<{
    id: string;
    methodIds: string[];
  }>) {
    for (const mid of p.methodIds) {
      if (!methodIds.has(mid)) {
        issues.push({ scope: 'practice', message: `${p.id} 关联了不存在的方法论 "${mid}"` });
      }
    }
  }

  // ---- 报告 ----
  if (issues.length === 0) {
    console.log('数据校验通过，未发现问题。');
    return;
  }

  console.error(`数据校验发现 ${issues.length} 个问题：`);
  for (const issue of issues.slice(0, 50)) {
    console.error(`  [${issue.scope}] ${issue.message}`);
  }
  if (issues.length > 50) {
    console.error(`  …还有 ${issues.length - 50} 个问题`);
  }
  process.exit(1);
}

main().catch((err: unknown) => {
  console.error('数据校验执行失败：', err instanceof Error ? err.message : err);
  process.exit(1);
});
