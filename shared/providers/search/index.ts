/**
 * 联网搜索 Provider 统一接口
 *
 * 设计要点：
 * 1. 统一接口屏蔽各家 API 差异，业务层只依赖 SearchProvider
 * 2. 内置零 key 可用方案（Crossref / arXiv / Wikipedia / DuckDuckGo），
 *    保证没有付费 API 时研究流程仍能跑通
 * 3. 每条结果都带来源元信息，用于「有据可查」和证据分级
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  /** 来源类型 */
  kind: 'academic' | 'encyclopedia' | 'web' | 'news' | 'book';
  /** 作者或机构 */
  author?: string;
  /** 发布时间 */
  publishedAt?: string;
  /** 该结果的可信度启发分 0-1 */
  credibility: number;
  /** 提供该结果的 provider */
  provider: string;
}

export interface SearchQuery {
  query: string;
  /** 结果数量上限 */
  limit?: number;
  /** 语言 */
  language?: string;
  /** 时间过滤（天） */
  freshnessDays?: number;
}

export interface SearchProvider {
  readonly name: string;
  /** 是否需要 API Key */
  readonly requiresKey: boolean;
  /** 该 provider 是否可用 */
  isAvailable(creds: SearchCredentials): boolean;
  search(q: SearchQuery, creds: SearchCredentials): Promise<SearchResult[]>;
}

export interface SearchCredentials {
  tavilyApiKey?: string;
  braveApiKey?: string;
  serperApiKey?: string;
}

const DEFAULT_UA =
  'MethodologyPWA/1.0 (personal knowledge research system; +https://github.com/)';

/** 通用 fetch 封装，带超时与 UA */
async function fetchText(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 15_000);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'user-agent': DEFAULT_UA, ...(init.headers || {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

/** 清洗 HTML 标签与实体 */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// Crossref —— 学术论文（零 key）
// ============================================================================

export class CrossrefProvider implements SearchProvider {
  readonly name = 'crossref';
  readonly requiresKey = false;

  isAvailable(): boolean {
    return true;
  }

  async search(q: SearchQuery): Promise<SearchResult[]> {
    const limit = Math.min(q.limit ?? 8, 20);
    const params = new URLSearchParams({
      query: q.query,
      rows: String(limit),
      'select': 'title,author,container-title,URL,issued,abstract,type,publisher,DOI',
      sort: 'relevance',
    });
    const raw = await fetchText(
      `https://api.crossref.org/works?${params.toString()}`,
      { timeoutMs: 20_000 },
    );
    const json = JSON.parse(raw) as {
      message?: { items?: Array<Record<string, unknown>> };
    };
    const items = json.message?.items ?? [];

    return items.map((item) => {
      const title =
        (Array.isArray(item.title) ? (item.title[0] as string) : (item.title as string)) ||
        '无标题';
      const authors = Array.isArray(item.author) ? item.author : [];
      const authorNames = authors
        .slice(0, 4)
        .map((a) => {
          const rec = a as Record<string, string>;
          return [rec.given, rec.family].filter(Boolean).join(' ');
        })
        .filter(Boolean)
        .join(', ');
      const issued = item.issued as { 'date-parts'?: number[][] } | undefined;
      const year = issued?.['date-parts']?.[0]?.[0];
      const container = Array.isArray(item['container-title'])
        ? (item['container-title'][0] as string)
        : undefined;

      return {
        title,
        url: (item.URL as string) || (item.DOI ? `https://doi.org/${item.DOI}` : ''),
        snippet: stripHtml((item.abstract as string) || container || '').slice(0, 600),
        kind: 'academic' as const,
        author: authorNames || undefined,
        publishedAt: year ? String(year) : undefined,
        credibility: 0.9,
        provider: this.name,
      };
    });
  }
}

// ============================================================================
// arXiv —— 预印本（零 key）
// ============================================================================

export class ArxivProvider implements SearchProvider {
  readonly name = 'arxiv';
  readonly requiresKey = false;

  isAvailable(): boolean {
    return true;
  }

  async search(q: SearchQuery): Promise<SearchResult[]> {
    const limit = Math.min(q.limit ?? 8, 20);
    const query = `all:${JSON.stringify(q.query)}`;
    const raw = await fetchText(
      `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&max_results=${limit}`,
      { timeoutMs: 20_000 },
    );

    const entries = raw.split('<entry>').slice(1);
    return entries.map((entry) => {
      const pick = (tag: string): string => {
        const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
        return m ? m[1].trim() : '';
      };
      const title = stripHtml(pick('title'));
      const summary = stripHtml(pick('summary'));
      const published = pick('published');
      const authors = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)]
        .map((m) => m[1].trim())
        .join(', ');
      const id = pick('id');

      return {
        title: title || '无标题',
        url: id,
        snippet: summary.slice(0, 600),
        kind: 'academic' as const,
        author: authors || undefined,
        publishedAt: published ? published.slice(0, 10) : undefined,
        credibility: 0.85,
        provider: this.name,
      };
    });
  }
}

// ============================================================================
// Wikipedia —— 百科/定义（零 key，用于交叉验证定义与出处）
// ============================================================================

export class WikipediaProvider implements SearchProvider {
  readonly name = 'wikipedia';
  readonly requiresKey = false;

  isAvailable(): boolean {
    return true;
  }

  async search(q: SearchQuery): Promise<SearchResult[]> {
    const limit = Math.min(q.limit ?? 5, 10);
    const lang = q.language?.startsWith('zh') ? 'zh' : 'en';
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: q.query,
      srlimit: String(limit),
      format: 'json',
      origin: '*',
    });
    const raw = await fetchText(
      `https://${lang}.wikipedia.org/w/api.php?${params.toString()}`,
      { timeoutMs: 15_000 },
    );
    const json = JSON.parse(raw) as {
      query?: { search?: Array<{ title: string; snippet: string; pageid: number; timestamp?: string }> };
    };

    return (json.query?.search ?? []).map((item) => ({
      title: item.title,
      url: `https://${lang}.wikipedia.org/?curid=${item.pageid}`,
      snippet: stripHtml(item.snippet),
      kind: 'encyclopedia' as const,
      credibility: 0.6,
      provider: this.name,
    }));
  }
}

// ============================================================================
// DuckDuckGo —— 通用网页（零 key，HTML 抓取）
// ============================================================================

export class DuckDuckGoProvider implements SearchProvider {
  readonly name = 'duckduckgo';
  readonly requiresKey = false;

  isAvailable(): boolean {
    return true;
  }

  async search(q: SearchQuery): Promise<SearchResult[]> {
    const limit = Math.min(q.limit ?? 8, 20);
    const params = new URLSearchParams({ q: q.query, kl: 'wt-wt' });
    const raw = await fetchText(`https://html.duckduckgo.com/html/?${params.toString()}`, {
      timeoutMs: 20_000,
      headers: { accept: 'text/html' },
    });

    const results: SearchResult[] = [];
    const blocks = raw.split('result__body').slice(1);
    for (const block of blocks) {
      if (results.length >= limit) break;
      const titleMatch = block.match(/result__a[^>]*>([\s\S]*?)<\/a>/);
      const linkMatch = block.match(/result__a[^>]*href="([^"]+)"/);
      const snippetMatch = block.match(/result__snippet[^>]*>([\s\S]*?)<\/a>/);
      if (!titleMatch) continue;

      let url = linkMatch?.[1] || '';
      // DDG 跳转链接解码
      if (url.includes('duckduckgo.com/l/')) {
        const enc = url.match(/uddg=([^&]+)/);
        if (enc) url = decodeURIComponent(enc[1]);
      }

      results.push({
        title: stripHtml(titleMatch[1]),
        url,
        snippet: stripHtml(snippetMatch?.[1] || '').slice(0, 400),
        kind: 'web' as const,
        credibility: 0.45,
        provider: this.name,
      });
    }
    return results;
  }
}

// ============================================================================
// Tavily —— 专为 AI 检索设计（需 key）
// ============================================================================

export class TavilyProvider implements SearchProvider {
  readonly name = 'tavily';
  readonly requiresKey = true;

  isAvailable(creds: SearchCredentials): boolean {
    return !!creds.tavilyApiKey;
  }

  async search(q: SearchQuery, creds: SearchCredentials): Promise<SearchResult[]> {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: creds.tavilyApiKey,
        query: q.query,
        max_results: Math.min(q.limit ?? 8, 20),
        search_depth: 'advanced',
        include_answer: false,
        include_raw_content: false,
      }),
    });
    if (!res.ok) throw new Error(`Tavily ${res.status}`);
    const json = (await res.json()) as {
      results?: Array<{
        title: string;
        url: string;
        content: string;
        score?: number;
        published_date?: string;
      }>;
    };
    return (json.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: (r.content || '').slice(0, 600),
      kind: 'web' as const,
      publishedAt: r.published_date,
      credibility: Math.min(0.95, 0.5 + (r.score ?? 0.5) * 0.5),
      provider: this.name,
    }));
  }
}

// ============================================================================
// Brave Search —— 索引量大（需 key）
// ============================================================================

export class BraveProvider implements SearchProvider {
  readonly name = 'brave';
  readonly requiresKey = true;

  isAvailable(creds: SearchCredentials): boolean {
    return !!creds.braveApiKey;
  }

  async search(q: SearchQuery, creds: SearchCredentials): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      q: q.query,
      count: String(Math.min(q.limit ?? 8, 20)),
    });
    if (q.freshnessDays) {
      const end = new Date();
      const start = new Date(end.getTime() - q.freshnessDays * 86400_000);
      params.set('freshness', `${start.toISOString().slice(0, 10)}..${end.toISOString().slice(0, 10)}`);
    }
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
      headers: {
        'x-subscription-token': creds.braveApiKey!,
        accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Brave ${res.status}`);
    const json = (await res.json()) as {
      web?: {
        results?: Array<{
          title: string;
          url: string;
          description?: string;
          age?: string;
        }>;
      };
    };
    return (json.web?.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: (r.description || '').slice(0, 500),
      kind: 'web' as const,
      publishedAt: r.age,
      credibility: 0.65,
      provider: this.name,
    }));
  }
}

// ============================================================================
// Serper —— Google 封装（需 key）
// ============================================================================

export class SerperProvider implements SearchProvider {
  readonly name = 'serper';
  readonly requiresKey = true;

  isAvailable(creds: SearchCredentials): boolean {
    return !!creds.serperApiKey;
  }

  async search(q: SearchQuery, creds: SearchCredentials): Promise<SearchResult[]> {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'x-api-key': creds.serperApiKey!,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ q: q.query, num: Math.min(q.limit ?? 8, 20) }),
    });
    if (!res.ok) throw new Error(`Serper ${res.status}`);
    const json = (await res.json()) as {
      organic?: Array<{
        title: string;
        link: string;
        snippet?: string;
        date?: string;
      }>;
    };
    return (json.organic ?? []).map((r) => ({
      title: r.title,
      url: r.link,
      snippet: (r.snippet || '').slice(0, 500),
      kind: 'web' as const,
      publishedAt: r.date,
      credibility: 0.7,
      provider: this.name,
    }));
  }
}

// ============================================================================
// 聚合器 —— 多路并行 + 去重 + 排序
// ============================================================================

export const ALL_PROVIDERS: SearchProvider[] = [
  new CrossrefProvider(),
  new ArxivProvider(),
  new WikipediaProvider(),
  new DuckDuckGoProvider(),
  new TavilyProvider(),
  new BraveProvider(),
  new SerperProvider(),
];

export interface AggregateSearchOptions {
  /** 指定 provider 名称；'auto' 表示按可用性智能组合 */
  providers?: string[];
  /** 每个 provider 取几条 */
  perProvider?: number;
  /** 是否启用付费 provider（需 key） */
  allowPaid?: boolean;
}

/**
 * 多路搜索并去重合并。
 * 学术来源优先，网页来源补充实践细节 —— 契合文档「资料来源优先级」。
 */
export async function aggregateSearch(
  q: SearchQuery,
  creds: SearchCredentials,
  options: AggregateSearchOptions = {},
): Promise<SearchResult[]> {
  const perProvider = options.perProvider ?? 5;
  const allowPaid = options.allowPaid ?? true;

  let selected: SearchProvider[];
  if (options.providers && options.providers.length && !options.providers.includes('auto')) {
    selected = options.providers
      .map((name) => ALL_PROVIDERS.find((p) => p.name === name))
      .filter((p): p is SearchProvider => !!p);
  } else if (allowPaid) {
    selected = [
      ...ALL_PROVIDERS.filter((p) => p.requiresKey && p.isAvailable(creds)),
      ...ALL_PROVIDERS.filter((p) => !p.requiresKey),
    ];
  } else {
    selected = ALL_PROVIDERS.filter((p) => !p.requiresKey);
  }

  const settled = await Promise.allSettled(
    selected.map((p) =>
      p.search({ ...q, limit: perProvider }, creds).catch(() => [] as SearchResult[]),
    ),
  );

  const merged: SearchResult[] = [];
  const seen = new Set<string>();
  for (const s of settled) {
    if (s.status !== 'fulfilled') continue;
    for (const r of s.value) {
      const key = normalizeUrl(r.url || r.title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(r);
    }
  }

  // 排序：学术 > 百科 > 网页；同类型按可信度
  const kindWeight: Record<SearchResult['kind'], number> = {
    academic: 3,
    book: 2.5,
    encyclopedia: 2,
    web: 1,
    news: 1.2,
  };
  return merged.sort((a, b) => {
    const kd = kindWeight[b.kind] - kindWeight[a.kind];
    if (kd !== 0) return kd;
    return b.credibility - a.credibility;
  });
}

function normalizeUrl(url: string): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    u.hash = '';
    u.search = '';
    return u.toString().toLowerCase().replace(/\/$/, '');
  } catch {
    return url.toLowerCase().trim();
  }
}
