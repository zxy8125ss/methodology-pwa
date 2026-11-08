/** 数据仓访问层 —— 封装 GitHub Contents API 读写 */

import { GitHubClient, DataRepo } from '../../shared/repo/github.js';
import type { ResolvedEnv } from './env.js';
import {
  DATA_LAYOUT,
  type CaseStudy,
  type Domain,
  type LearningPlan,
  type LearningTask,
  type MasteryRecord,
  type Method,
  type Practice,
  type Quiz,
  type Relation,
  type Review,
  type ResearchCandidate,
  type ResearchTask,
  type Source,
  type SystemConfig,
} from '../../shared/types.js';

export interface Store {
  client: GitHubClient;
  repo: DataRepo;
}

export function createStore(env: ResolvedEnv): Store {
  const client = new GitHubClient({
    owner: env.githubOwner,
    repo: env.githubRepo,
    token: env.githubToken,
    branch: env.branch,
  });
  return { client, repo: new DataRepo({ client }) };
}

export const DEFAULT_CONFIG: SystemConfig = {
  taskRouting: {
    deep_research: 'claude-sonnet-4-5',
    long_form_synthesis: 'claude-sonnet-4-5',
    classification: 'deepseek-chat',
    dedupe_relation: 'deepseek-reasoner',
    daily_qa: 'deepseek-chat',
    solution_composition: 'claude-sonnet-4-5',
    practice_review: 'deepseek-reasoner',
    learning_plan: 'deepseek-chat',
    quiz_generation: 'deepseek-chat',
    weekly_report: 'claude-sonnet-4-5',
  },
  defaultModel: 'claude-sonnet-4-5',
  fallbackModels: ['deepseek-chat', 'claude-haiku-4-5'],
  webSearchEnabled: true,
  searchProvider: 'auto',
  costLimitPerTask: 1,
  costLimitPerWeek: 10,
  weeklyTargetCount: 5,
  language: 'zh-CN',
  theme: 'light',
  updatedAt: new Date().toISOString(),
};

/** 一次性读取全部知识库数据 */
export interface KnowledgeSnapshot {
  methods: Method[];
  domains: Domain[];
  relations: Relation[];
  sources: Source[];
  cases: CaseStudy[];
  practices: Practice[];
  learning: {
    plans: LearningPlan[];
    tasks: LearningTask[];
    quizzes: Quiz[];
    mastery: MasteryRecord[];
  };
  reviews: Review[];
  research: {
    tasks: ResearchTask[];
    candidates: ResearchCandidate[];
  };
  config: SystemConfig;
}

export async function loadSnapshot(store: Store): Promise<KnowledgeSnapshot> {
  const [methods, domainsFile, relationsFile, sourcesFile, casesFile, practicesFile, learningFile, reviewsFile, researchFile, configFile] =
    await Promise.all([
      store.repo.listMethods(),
      store.repo.getCollection<{ domains: Domain[] }>(DATA_LAYOUT.domains),
      store.repo.getCollection<{ relations: Relation[] }>(DATA_LAYOUT.relations),
      store.repo.getCollection<{ sources: Source[] }>(DATA_LAYOUT.sources),
      store.repo.getCollection<{ cases: CaseStudy[] }>(DATA_LAYOUT.cases),
      store.repo.getCollection<{ practices: Practice[] }>(DATA_LAYOUT.practices),
      store.repo.getCollection<{
        plans: LearningPlan[];
        tasks: LearningTask[];
        quizzes: Quiz[];
        mastery: MasteryRecord[];
      }>(DATA_LAYOUT.learning),
      store.repo.getCollection<{ reviews: Review[] }>(DATA_LAYOUT.reviews),
      store.repo.getCollection<{
        tasks: ResearchTask[];
        candidates: ResearchCandidate[];
      }>(DATA_LAYOUT.researchQueue),
      store.repo.getCollection<SystemConfig>(DATA_LAYOUT.config),
    ]);

  return {
    methods,
    domains: domainsFile?.domains ?? [],
    relations: relationsFile?.relations ?? [],
    sources: sourcesFile?.sources ?? [],
    cases: casesFile?.cases ?? [],
    practices: practicesFile?.practices ?? [],
    learning: learningFile ?? { plans: [], tasks: [], quizzes: [], mastery: [] },
    reviews: reviewsFile?.reviews ?? [],
    research: researchFile ?? { tasks: [], candidates: [] },
    config: configFile ?? DEFAULT_CONFIG,
  };
}

/** 保存单个方法论档案 */
export async function saveMethod(store: Store, method: Method): Promise<void> {
  await store.repo.saveMethod(method);
}

/** 删除方法论档案 */
export async function deleteMethod(store: Store, id: string): Promise<void> {
  await store.repo.deleteMethod(id);
}

/** 保存集合文件 */
export async function saveCollection(store: Store, path: string, data: unknown): Promise<void> {
  await store.repo.setCollection(path, data);
}
