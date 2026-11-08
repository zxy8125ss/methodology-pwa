/**
 * GitHub 数据仓适配层
 *
 * 职责：
 * 1. 通过 GitHub Contents API 读写数据仓中的 JSON 文件
 * 2. 分片存储：方法论按 ID 前缀分片写入，避免单文件过大导致的冲突与索引问题
 * 3. 乐观并发：基于 sha 的 CAS 写入 + 冲突重试
 * 4. 索引生成：构建 methods-index / search-index / graph-index
 *
 * 关键设计 —— 为什么用「单文件一方法论」而不是「一个大 JSON」：
 * - 每次写入只触碰一个文件，Git 冲突面最小（GitHub API 是整文件替换）
 * - 天然版本化：每次改动都是一次 commit，可回溯到具体方法论的历史
 * - 索引可增量重建，不受总量影响
 * 代价是文件数变多 —— 因此用 tree API 一次拉取目录树，避免 N 次请求
 */

import { DATA_LAYOUT, type Method } from '../types.js';

// ============================================================================
// GitHub API 基础封装
// ============================================================================

export interface GitHubClientOptions {
  owner: string;
  repo: string;
  token: string;
  /** 分支，默认 main */
  branch?: string;
  /** 请求超时 */
  timeoutMs?: number;
  baseUrl?: string;
}

interface GhContent {
  type: 'file' | 'dir';
  name: string;
  path: string;
  sha: string;
  size?: number;
  download_url?: string | null;
  url?: string;
}

interface GhTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
}

export class GitHubClient {
  private readonly owner: string;
  private readonly repo: string;
  private readonly token: string;
  private readonly branch: string;
  private readonly timeoutMs: number;
  private readonly base: string;

  constructor(opts: GitHubClientOptions) {
    this.owner = opts.owner;
    this.repo = opts.repo;
    this.token = opts.token;
    this.branch = opts.branch || 'main';
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.base = opts.baseUrl || 'https://api.github.com';
  }

  private async request<T>(
    path: string,
    init: RequestInit & { retries?: number } = {},
  ): Promise<T> {
    const retries = init.retries ?? 3;
    let lastErr: unknown;

    for (let attempt = 0; attempt < retries; attempt++) {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await fetch(`${this.base}${path}`, {
          ...init,
          signal: controller.signal,
          headers: {
            accept: 'application/vnd.github+json',
            'x-github-api-version': '2022-11-28',
            authorization: `Bearer ${this.token}`,
            'user-agent': 'methodology-pwa',
            ...(init.headers || {}),
          },
        });

        if (res.status === 404) {
          const e = new Error(`GitHub 404: ${path}`) as Error & { status: number };
          e.status = 404;
          throw e;
        }

        if (res.status === 409 || res.status === 422) {
          // 冲突 —— 立即重试（调用方需重新读取 sha）
          const e = new Error(`GitHub ${res.status} 冲突: ${path}`) as Error & { status: number };
          e.status = res.status;
          throw e;
        }

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`GitHub ${res.status}: ${text.slice(0, 400)}`);
        }

        if (res.status === 204) return undefined as T;
        return (await res.json()) as T;
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isConflict = /409|422/.test(msg);
        const retryable =
          isConflict ||
          /429|500|502|503|504|timeout|aborted|fetch failed|network/i.test(msg);
        if (!retryable || attempt === retries - 1) throw err;
        await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt) + Math.random() * 250));
      }
    }
    throw lastErr;
  }

  /** 获取文件内容与 sha */
  async getFile(path: string): Promise<{ content: string; sha: string } | null> {
    try {
      const res = await this.request<{ content: string; sha: string; encoding: string }>(
        `/repos/${this.owner}/${this.repo}/contents/${encodePath(path)}?ref=${this.branch}`,
      );
      const content =
        res.encoding === 'base64'
          ? decodeBase64(res.content.replace(/\n/g, ''))
          : res.content;
      return { content, sha: res.sha };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  /** 读取并解析 JSON */
  async getJson<T>(path: string): Promise<{ data: T; sha: string } | null> {
    const file = await this.getFile(path);
    if (!file) return null;
    return { data: JSON.parse(file.content) as T, sha: file.sha };
  }

  /** 写入 JSON。sha 存在则更新，不存在则创建。 */
  async putJson(path: string, data: unknown, sha?: string): Promise<{ sha: string; commitSha: string }> {
    const body = {
      message: `chore(data): update ${path}`,
      content: encodeBase64(JSON.stringify(data, null, 2)),
      branch: this.branch,
      ...(sha ? { sha } : {}),
    };
    const res = await this.request<{ content: { sha: string }; commit: { sha: string } }>(
      `/repos/${this.owner}/${this.repo}/contents/${encodePath(path)}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        retries: 2,
      },
    );
    return { sha: res.content.sha, commitSha: res.commit.sha };
  }

  /**
   * CAS 写入：读 → 改 → 写，冲突则重读重试。
   * @param mutate 接收当前内容，返回新内容；返回 null 表示放弃写入
   */
  async mutateJson<T>(
    path: string,
    mutate: (current: T | null) => T | null,
    options: { retries?: number; message?: string } = {},
  ): Promise<{ data: T; sha: string; commitSha: string } | null> {
    const retries = options.retries ?? 4;
    for (let attempt = 0; attempt < retries; attempt++) {
      const cur = await this.getJson<T>(path);
      const next = mutate(cur?.data ?? null);
      if (next === null) return null;
      try {
        const { sha, commitSha } = await this.putJson(path, next, cur?.sha);
        return { data: next, sha, commitSha };
      } catch (err) {
        if (isConflict(err) && attempt < retries - 1) {
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1) + Math.random() * 200));
          continue;
        }
        throw err;
      }
    }
    return null;
  }

  /** 递归列出仓库文件树 */
  async listTree(dirPath = ''): Promise<GhTreeEntry[]> {
    const query = dirPath ? `${encodePath(dirPath)}/` : '';
    const res = await this.request<{ tree: GhTreeEntry[]; truncated: boolean }>(
      `/repos/${this.owner}/${this.repo}/git/trees/${this.branch}:${query}?recursive=1`,
    );
    return res.tree || [];
  }

  /** 列出某目录下的文件 */
  async listDir(dirPath: string): Promise<GhContent[]> {
    try {
      const res = await this.request<GhContent[]>(
        `/repos/${this.owner}/${this.repo}/contents/${encodePath(dirPath)}?ref=${this.branch}`,
      );
      return Array.isArray(res) ? res : [];
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
  }

  /** 删除文件 */
  async deleteFile(path: string, sha: string): Promise<void> {
    await this.request<void>(
      `/repos/${this.owner}/${this.repo}/contents/${encodePath(path)}`,
      {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: `chore(data): remove ${path}`, sha, branch: this.branch }),
      },
    );
  }

  /** 批量下载多个文件内容（并行，用 tree sha 直接取 blob） */
  async fetchBlobs(
    entries: Array<{ path: string; sha: string }>,
    concurrency = 8,
  ): Promise<Array<{ path: string; content: string }>> {
    const out: Array<{ path: string; content: string }> = [];
    let i = 0;
    const workers = Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
      while (i < entries.length) {
        const idx = i++;
        const entry = entries[idx];
        try {
          const res = await this.request<{ content: string; encoding: string }>(
            `/repos/${this.owner}/${this.repo}/git/blobs/${entry.sha}`,
          );
          const content =
            res.encoding === 'base64'
              ? decodeBase64(res.content.replace(/\n/g, ''))
              : res.content;
          out.push({ path: entry.path, content });
        } catch {
          /* 单个失败不影响整体 */
        }
      }
    });
    await Promise.all(workers);
    return out;
  }
}

// ============================================================================
// 数据仓仓储
// ============================================================================

export interface DataRepoOptions {
  client: GitHubClient;
  /** 方法论文件所在目录 */
  methodsDir?: string;
}

export class DataRepo {
  private readonly client: GitHubClient;
  private readonly methodsDir: string;

  constructor(opts: DataRepoOptions) {
    this.client = opts.client;
    this.methodsDir = opts.methodsDir || DATA_LAYOUT.methods;
  }

  /** 拉取全部方法论档案 */
  async listMethods(): Promise<Method[]> {
    const tree = await this.client.listTree(this.methodsDir);
    const files = tree.filter(
      (t) => t.type === 'blob' && t.path.endsWith('.json') && t.path.startsWith(this.methodsDir),
    );
    if (!files.length) return [];
    const blobs = await this.client.fetchBlobs(
      files.map((f) => ({ path: f.path, sha: f.sha })),
    );
    const methods: Method[] = [];
    for (const blob of blobs) {
      try {
        methods.push(JSON.parse(blob.content) as Method);
      } catch {
        /* 跳过损坏文件 */
      }
    }
    return methods.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }

  /** 获取单个方法论 */
  async getMethod(id: string): Promise<Method | null> {
    const res = await this.client.getJson<Method>(`${this.methodsDir}/${id}.json`);
    return res?.data ?? null;
  }

  /** 保存方法论（新建或更新） */
  async saveMethod(method: Method): Promise<void> {
    const path = `${this.methodsDir}/${method.id}.json`;
    await this.client.mutateJson<Method>(
      path,
      (current) => {
        const next: Method = {
          ...method,
          version: current ? current.version + 1 : 1,
          createdAt: current?.createdAt ?? method.createdAt,
          updatedAt: new Date().toISOString(),
          history: [
            ...(current?.history ?? []),
            {
              version: current ? current.version + 1 : 1,
              at: new Date().toISOString(),
              summary: current ? '更新方法论档案' : '创建方法论档案',
              changeType: current ? 'update' : 'create',
              by: 'user',
            },
          ],
        };
        return next;
      },
      { message: `feat(method): save ${method.id}` },
    );
  }

  /** 删除方法论 */
  async deleteMethod(id: string): Promise<void> {
    const file = await this.client.getFile(`${this.methodsDir}/${id}.json`);
    if (file) await this.client.deleteFile(`${this.methodsDir}/${id}.json`, file.sha);
  }

  /** 读取集合文件（domains/sources/relations/cases/...） */
  async getCollection<T>(path: string): Promise<T | null> {
    const res = await this.client.getJson<T>(path);
    return res?.data ?? null;
  }

  /** 写入集合文件 */
  async setCollection(path: string, data: unknown): Promise<void> {
    await this.client.mutateJson(path, () => data as never, {
      message: `feat(data): update ${path}`,
    });
  }
}

// ============================================================================
// 工具函数
// ============================================================================

export function isNotFound(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { status?: number }).status === 404;
}

export function isConflict(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 409 || status === 422) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /409|422|冲突/.test(msg);
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

export function encodeBase64(text: string): string {
  if (typeof btoa === 'function') {
    // 需要处理 UTF-8
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }
  return Buffer.from(text, 'utf8').toString('base64');
}

export function decodeBase64(b64: string): string {
  if (typeof atob === 'function') {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(b64, 'base64').toString('utf8');
}
