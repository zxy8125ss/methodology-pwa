/**
 * 每周研究任务 —— 由 GitHub Actions 定时触发
 *
 * 流程：选题 → 联网检索 → 深度研究 → 去重 → 关联 → 质量检查 → 写入待审核队列
 *
 * 用法：npx tsx scripts/run-weekly-research.ts
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AIRouter } from '../shared/providers/ai/router.js';
import { GitHubClient, DataRepo } from '../shared/repo/github.js';
import { runResearch } from '../worker/src/research-pipeline.js';
import { DEFAULT_CONFIG } from '../worker/src/store.js';
import type { ResearchCandidate, ResearchTask, SystemConfig } from '../shared/types.js';

const OWNER = process.env.GITHUB_OWNER ?? 'zxy8125ss';
const REPO = process.env.GITHUB_REPO ?? 'methodology-data';
const BRANCH = process.env.DATA_REPO_BRANCH ?? 'main';
const TOKEN =
  process.env.GITHUB_TOKEN_DATA ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '';

/** 优先研究通用方法论，再深化专业领域，最后做跨领域关联 */
const TOPIC_POOL: Array<{ target: string; taskType: 'discovery' | 'deepen' | 'update' | 'relation' }> = [
  { target: '第一性原理思维在产品决策中的应用', taskType: 'discovery' },
  { target: 'PDCA 循环的完整实施步骤与常见误区', taskType: 'deepen' },
  { target: '系统思维识别组织结构中的杠杆点', taskType: 'discovery' },
  { target: 'OKR 与 KPI 的适用边界对比', taskType: 'relation' },
  { target: '复盘方法在个人成长中的标准流程', taskType: 'deepen' },
  { target: '费曼学习法与知识输出的结合机制', taskType: 'relation' },
  { target: '决策树在职业选择中的判断逻辑', taskType: 'discovery' },
  { target: '二八法则在个人时间管理中的正确用法', taskType: 'deepen' },
];

async function main(): Promise<void> {
  if (!TOKEN) {
    console.error('缺少 GITHUB_TOKEN_DATA secret');
    process.exit(1);
  }

  const creds = {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    deepseekApiKey: process.env.DEEPSEEK_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
  };
  if (!creds.anthropicApiKey && !creds.deepseekApiKey) {
    console.error('缺少 AI 密钥（ANTHROPIC_API_KEY 或 DEEPSEEK_API_KEY）');
    process.exit(1);
  }

  const client = new GitHubClient({ owner: OWNER, repo: REPO, token: TOKEN, branch: BRANCH });
  const repo = new DataRepo({ client });
  const router = new AIRouter(creds, {
    taskRouting: DEFAULT_CONFIG.taskRouting,
    defaultModel: DEFAULT_CONFIG.defaultModel,
    fallbackModels: DEFAULT_CONFIG.fallbackModels,
  });

  const methods = await repo.listMethods();
  const relationsRes = await repo.getCollection<{ relations: unknown[] }>('data/relations.json');
  const relations = (relationsRes?.relations ?? []) as Parameters<
    typeof runResearch
  >[0]['relations'];
  const sourcesRes = await repo.getCollection<{ sources: unknown[] }>('data/sources.json');
  const sources = (sourcesRes?.sources ?? []) as Parameters<typeof runResearch>[0]['sources'];

  const configRes = await repo.getCollection<SystemConfig>('data/config.json');
  const config = configRes ?? DEFAULT_CONFIG;

  const queueRes = await repo.getCollection<{
    tasks: ResearchTask[];
    candidates: ResearchCandidate[];
  }>('research/queue.json');
  const tasks = queueRes?.tasks ?? [];
  const candidates = queueRes?.candidates ?? [];

  // 选题：优先用手动指定，否则从池中挑未研究过的
  const manualTarget = process.env.RESEARCH_TARGET?.trim();
  const count = Math.max(1, Math.min(Number(process.env.RESEARCH_COUNT ?? '3') || 3, 10));

  const studied = new Set(
    candidates.filter((c) => c.status !== 'ignored').map((c) => c.draft?.name ?? ''),
  );
  const available = TOPIC_POOL.filter((t) => !studied.has(t.target));

  const picks = manualTarget
    ? [{ target: manualTarget, taskType: 'discovery' as const }]
    : available.slice(0, count);

  if (picks.length === 0) {
    console.log('没有新的研究主题，本轮跳过。');
    return;
  }

  const logDir = join(process.cwd(), 'research-logs');
  await mkdir(logDir, { recursive: true });

  let successCount = 0;
  let failCount = 0;

  for (const pick of picks) {
    const now = new Date().toISOString();
    const task: ResearchTask = {
      id: `task_${Date.now().toString(36)}`,
      taskType: pick.taskType,
      target: pick.target,
      trigger: 'schedule',
      status: 'running',
      priority: 2,
      model: null,
      error: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    console.log(`\n=== 研究：${pick.target} ===`);

    try {
      const output = await runResearch(
        {
          target: pick.target,
          taskType: pick.taskType,
          methods,
          relations,
          sources,
          useWebSearch: config.webSearchEnabled,
          searchProvider: config.searchProvider,
        },
        router,
        {
          tavilyApiKey: process.env.TAVILY_API_KEY,
          braveApiKey: process.env.BRAVE_API_KEY,
        },
      );

      const reportId = `report_${Date.now().toString(36)}`;
      await client.putJson(`research/reports/${reportId}.json`, {
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
        createdAt: now,
      });

      await writeFile(
        join(logDir, `${reportId}.md`),
        output.report.content,
        'utf8',
      );

      candidates.push(output.candidate);
      tasks.push({
        ...task,
        status: 'completed',
        model: output.model,
        usage: output.usage,
        finishedAt: new Date().toISOString(),
      });

      console.log(
        `完成：${output.model}，成本 $${output.usage.estimatedCostUsd.toFixed(4)}，候选 ${output.candidate.id}`,
      );
      successCount += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`失败：${message}`);
      tasks.push({
        ...task,
        status: 'failed',
        error: message,
        finishedAt: new Date().toISOString(),
      });
      failCount += 1;
    }
  }

  await repo.setCollection('research/queue.json', { tasks, candidates });

  console.log(`\n研究完成：成功 ${successCount} 条，失败 ${failCount} 条`);
  console.log('待审核候选已写入 research/queue.json，请在应用「研究」页审核入库。');

  if (failCount > 0 && successCount === 0) {
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error('每周研究任务执行失败：', err instanceof Error ? err.message : err);
  process.exit(1);
});
