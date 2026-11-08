/**
 * 备份 —— 把数据仓当前状态打包写入 backups/ 目录
 *
 * 用法：npm run backup
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GitHubClient, DataRepo } from '../shared/repo/github.js';

const OWNER = process.env.GITHUB_OWNER ?? 'zxy8125ss';
const REPO = process.env.GITHUB_REPO ?? 'methodology-data';
const BRANCH = process.env.DATA_REPO_BRANCH ?? 'main';
const TOKEN =
  process.env.GITHUB_TOKEN_DATA ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '';

async function main(): Promise<void> {
  if (!TOKEN) {
    console.error('缺少 GITHUB_TOKEN_DATA，无法访问数据仓');
    process.exit(1);
  }

  const client = new GitHubClient({ owner: OWNER, repo: REPO, token: TOKEN, branch: BRANCH });
  const repo = new DataRepo({ client });

  const [methods, domains, relations, sources, cases, practices, learning, reviews, queue] =
    await Promise.all([
      repo.listMethods(),
      repo.getCollection<unknown>('data/domains.json'),
      repo.getCollection<unknown>('data/relations.json'),
      repo.getCollection<unknown>('data/sources.json'),
      repo.getCollection<unknown>('data/cases.json'),
      repo.getCollection<unknown>('data/practices.json'),
      repo.getCollection<unknown>('data/learning.json'),
      repo.getCollection<unknown>('data/reviews.json'),
      repo.getCollection<unknown>('research/queue.json'),
    ]);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bundle = {
    version: 1,
    createdAt: new Date().toISOString(),
    methods,
    domains,
    relations,
    sources,
    cases,
    practices,
    learning,
    reviews,
    research: queue,
  };

  const outDir = join(process.cwd(), 'backups');
  await mkdir(outDir, { recursive: true });
  const fileName = `backup-${stamp}.json`;
  await writeFile(join(outDir, fileName), JSON.stringify(bundle, null, 2), 'utf8');

  await client.putJson(`backups/${fileName}`, bundle);

  console.log(
    `备份完成：${fileName}（${methods.length} 条方法论，${(JSON.stringify(bundle).length / 1024).toFixed(1)} KB）`,
  );
}

main().catch((err: unknown) => {
  console.error('备份失败：', err instanceof Error ? err.message : err);
  process.exit(1);
});
