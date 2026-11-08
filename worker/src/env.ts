/** Worker 环境变量定义 —— 所有密钥只从这里读取，绝不进入前端代码或仓库 */

export interface Env {
  /** 访问私有数据仓的 GitHub PAT */
  GITHUB_TOKEN?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  DATA_REPO_BRANCH?: string;

  /** AI Provider 密钥（可选，按需配置） */
  ANTHROPIC_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;

  /** 联网搜索密钥（可选，零 key 方案也能用） */
  TAVILY_API_KEY?: string;
  BRAVE_API_KEY?: string;

  /** 前端调用 Worker 的 Bearer Token */
  APP_TOKEN?: string;

  /** 限流：每 IP 每分钟请求数 */
  RATE_LIMIT_PER_MINUTE?: string;
}

export interface ResolvedEnv {
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  branch: string;
  appToken: string;
  anthropicApiKey?: string;
  deepseekApiKey?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  tavilyApiKey?: string;
  braveApiKey?: string;
  rateLimitPerMinute: number;
}

export function resolveEnv(env: Env): ResolvedEnv {
  return {
    githubToken: env.GITHUB_TOKEN ?? '',
    githubOwner: env.GITHUB_OWNER ?? 'zxy8125ss',
    githubRepo: env.GITHUB_REPO ?? 'methodology-data',
    branch: env.DATA_REPO_BRANCH ?? 'main',
    appToken: env.APP_TOKEN ?? '',
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    deepseekApiKey: env.DEEPSEEK_API_KEY,
    openaiApiKey: env.OPENAI_API_KEY,
    geminiApiKey: env.GEMINI_API_KEY,
    tavilyApiKey: env.TAVILY_API_KEY,
    braveApiKey: env.BRAVE_API_KEY,
    rateLimitPerMinute: Number(env.RATE_LIMIT_PER_MINUTE ?? '60'),
  };
}

/** 组装 Provider 凭据 */
export function toProviderCredentials(env: ResolvedEnv) {
  return {
    anthropicApiKey: env.anthropicApiKey,
    deepseekApiKey: env.deepseekApiKey,
    openaiApiKey: env.openaiApiKey,
    geminiApiKey: env.geminiApiKey,
  };
}

export function toSearchCredentials(env: ResolvedEnv) {
  return {
    tavilyApiKey: env.tavilyApiKey,
    braveApiKey: env.braveApiKey,
  };
}
