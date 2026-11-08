/**
 * 构建检索索引 —— 写入数据仓的 indexes/ 目录
 *
 * 用法：npm run data:index
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GitHubClient, DataRepo } from '../shared/repo/github.js';
import { tokenize } from '../worker/src/retrieval.js';
import type { Relation } from '../shared/types.js';

const OWNER = process.env.GITHUB_OWNER ?? 'zxy8125ss';
const REPO = process.env.GITHUB_REPO ?? 'methodology-data';
const BRANCH = process.env.DATA_REPO_BRANCH ?? 'main';
const TOKEN =
  process.env.GITHUB_TOKEN_DATA ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '';

/** 方法论索引 —— 轻量摘要，供列表页快速渲染 */
interface MethodsIndexEntry {
  id: string;
  name: string;
  aliases: string[];
  domainIds: string[];
  type: string;
  evidenceLevel: string;
  confidence: number | null;
  status: string;
  tags: string[];
  updatedAt: string;
  lastResearchedAt: string | null;
  summary: string;
}

interface SearchIndexEntry {
  id: string;
  tokens: string[];
  name: string;
  domainIds: string[];
}

interface GraphIndexEntry {
  id: string;
  name: string;
  domainIds: string[];
  type: string;
  degree: number;
  links: string[];
}

async function main(): Promise<void> {
  if (!TOKEN) {
    console.error('缺少 GITHUB_TOKEN_DATA，无法访问数据仓');
    process.exit(1);
  }

  const client = new GitHubClient({ owner: OWNER, repo: REPO, token: TOKEN, branch: BRANCH });
  const repo = new DataRepo({ client });

  const methods = await repo.listMethods();
  console.log(`读取方法论 ${methods.length} 条`);

  const relationsRes = await repo.getCollection<{ relations: Relation[] }>('data/relations.json');
  const relations = relationsRes?.relations ?? [];

  // ---- methods-index.json ----
  const methodsIndex: MethodsIndexEntry[] = methods.map((m) => ({
    id: m.id,
    name: m.name,
    aliases: m.aliases,
    domainIds: m.domainIds,
    type: m.type,
    evidenceLevel: m.evidence.level,
    confidence: m.evidence.confidence,
    status: m.status,
    tags: m.tags,
    updatedAt: m.updatedAt,
    lastResearchedAt: m.lastResearchedAt ?? null,
    summary: (m.content.coreIdea ?? '').slice(0, 160),
  }));

  // ---- search-index.json ----
  const searchIndex: SearchIndexEntry[] = methods.map((m) => ({
    id: m.id,
    name: m.name,
    domainIds: m.domainIds,
    tokens: Array.from(
      new Set(
        tokenize(
          [
            m.name,
            ...m.aliases,
            ...m.tags,
            m.content.coreIdea ?? '',
            ...m.content.scenarios,
            ...m.content.steps,
          ].join(' '),
        ),
      ),
    ),
  }));

  // ---- graph-index.json ----
  const degree = new Map<string, number>();
  const linksOf = new Map<string, string[]>();
  for (const rel of relations) {
    degree.set(rel.fromId, (degree.get(rel.fromId) ?? 0) + 1);
    degree.set(rel.toId, (degree.get(rel.toId) ?? 0) + 1);
    linksOf.set(rel.fromId, [...(linksOf.get(rel.fromId) ?? []), rel.toId]);
    linksOf.set(rel.toId, [...(linksOf.get(rel.toId) ?? []), rel.fromId]);
  }

  const graphIndex: GraphIndexEntry[] = methods.map((m) => ({
    id: m.id,
    name: m.name,
    domainIds: m.domainIds,
    type: m.type,
    degree: degree.get(m.id) ?? 0,
    links: linksOf.get(m.id) ?? [],
  }));

  const outDir = join(process.cwd(), '.index-out');
  await mkdir(outDir, { recursive: true });

  const files: Array<[string, unknown]> = [
    ['methods-index.json', { generatedAt: new Date().toISOString(), entries: methodsIndex }],
    ['search-index.json', { generatedAt: new Date().toISOString(), entries: searchIndex }],
    ['graph-index.json', { generatedAt: new Date().toISOString(), entries: graphIndex }],
  ];

  for (const [name, data] of files) {
    const content = JSON.stringify(data, null, 2);
    await writeFile(join(outDir, name), content, 'utf8');
    await client.putJson(`indexes/${name}`, data);
    console.log(`已写入 indexes/${name}（${(content.length / 1024).toFixed(1)} KB）`);
  }
}

main().catch((err: unknown) => {
  console.error('索引构建失败：', err instanceof Error ? err.message : err);
  process.exit(1);
});
