/**
 * 方法论系统 · 核心数据模型
 * 全部实体定义与 zod 校验规则，供前端、Worker、GitHub Actions 脚本共用。
 *
 * 设计原则：
 * 1. 每个实体都有唯一稳定 ID（便于跨文件引用与增量更新）
 * 2. 证据等级显式建模，杜绝「AI 推断冒充原始观点」
 * 3. 内容字段支持空值语义 —— 未知就是 null，不填 0 不填空字符串
 * 4. 所有可变更实体保留版本号与更新时间
 */

// ============================================================================
// 枚举与基础常量
// ============================================================================

/** 八大知识领域 */
export const DOMAIN_IDS = [
  'management',
  'personal_growth',
  'thinking',
  'work_methods',
  'communication',
  'learning',
  'business',
  'life',
] as const;
export type DomainId = (typeof DOMAIN_IDS)[number];

/** 领域中文名（内置默认，可被 domains.json 覆盖以支持动态扩展） */
export const DOMAIN_DEFAULT_NAMES: Record<DomainId, string> = {
  management: '管理与组织方法',
  personal_growth: '个人成长与自我管理',
  thinking: '思维模型与认知方法',
  work_methods: '工作方法与效率工具',
  communication: '沟通、谈判与决策方法',
  learning: '学习方法与知识管理',
  business: '商业、经营与赚钱方法',
  life: '生活中的实用方法论',
};

/** 方法论类型 */
export const METHOD_TYPES = ['theory', 'model', 'tool', 'process', 'principle', 'framework'] as const;
export type MethodType = (typeof METHOD_TYPES)[number];

export const METHOD_TYPE_NAMES: Record<MethodType, string> = {
  theory: '理论',
  model: '模型',
  tool: '工具',
  process: '流程',
  principle: '原则',
  framework: '框架',
};

/** 证据等级 —— 质量控制的核心字段 */
export const EVIDENCE_LEVELS = [
  'unverified',
  'low',
  'medium',
  'high',
  'meta_analysis',
] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const EVIDENCE_LEVEL_NAMES: Record<EvidenceLevel, string> = {
  unverified: '未核实',
  low: '低',
  medium: '中',
  high: '高',
  meta_analysis: '元分析级',
};

/** 证据类别 —— 严格区分原始理论/研究证据/实践经验/AI 推断 */
export const EVIDENCE_CATEGORIES = [
  'origin',
  'research',
  'practice',
  'ai_inference',
] as const;
export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

export const EVIDENCE_CATEGORY_NAMES: Record<EvidenceCategory, string> = {
  origin: '原始理论',
  research: '研究证据',
  practice: '实践经验',
  ai_inference: 'AI 推断',
};

/** 关系类型 */
export const RELATION_TYPES = [
  'superordinate',
  'subordinate',
  'complementary',
  'similar',
  'conflicting',
  'composition',
  'evolution',
  'application',
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export const RELATION_TYPE_NAMES: Record<RelationType, string> = {
  superordinate: '上位关系',
  subordinate: '下位关系',
  complementary: '互补关系',
  similar: '相似关系',
  conflicting: '冲突关系',
  composition: '组合使用',
  evolution: '演化关系',
  application: '应用关系',
};

/** 档案状态 */
export const METHOD_STATUSES = ['draft', 'pending_review', 'approved', 'archived', 'deprecated'] as const;
export type MethodStatus = (typeof METHOD_STATUSES)[number];

export const METHOD_STATUS_NAMES: Record<MethodStatus, string> = {
  draft: '草稿',
  pending_review: '待审核',
  approved: '已入库',
  archived: '已归档',
  deprecated: '已过时',
};

/** 审核决策 */
export const REVIEW_DECISIONS = [
  'approve',
  'approve_with_edits',
  'reject',
  'merge',
  'ignore',
] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const REVIEW_DECISION_NAMES: Record<ReviewDecision, string> = {
  approve: '通过并入库',
  approve_with_edits: '修改后入库',
  reject: '退回重新研究',
  merge: '合并到已有方法论',
  ignore: '忽略此次发现',
};

/** 资料类型 */
export const SOURCE_TYPES = [
  'book',
  'paper',
  'speech',
  'article',
  'website',
  'course',
  'case_study',
  'report',
  'interview',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_TYPE_NAMES: Record<SourceType, string> = {
  book: '书籍',
  paper: '论文',
  speech: '演讲',
  article: '文章',
  website: '网站',
  course: '课程',
  case_study: '案例研究',
  report: '研究报告',
  interview: '访谈',
};

/** 掌握程度四级 */
export const MASTERY_LEVELS = ['aware', 'understand', 'master', 'apply'] as const;
export type MasteryLevel = (typeof MASTERY_LEVELS)[number];

export const MASTERY_LEVEL_NAMES: Record<MasteryLevel, string> = {
  aware: '了解',
  understand: '理解',
  master: '掌握',
  apply: '熟练应用',
};

/** AI 任务类型 —— 决定模型路由与预算 */
export const AI_TASKS = [
  'deep_research',
  'long_form_synthesis',
  'classification',
  'dedupe_relation',
  'daily_qa',
  'solution_composition',
  'practice_review',
  'learning_plan',
  'quiz_generation',
  'weekly_report',
] as const;
export type AITask = (typeof AI_TASKS)[number];

export const AI_TASK_NAMES: Record<AITask, string> = {
  deep_research: '深度研究',
  long_form_synthesis: '长文本整理',
  classification: '知识分类',
  dedupe_relation: '去重与关系识别',
  daily_qa: '日常问答',
  solution_composition: '复杂方案组合',
  practice_review: '实践复盘',
  learning_plan: '学习计划生成',
  quiz_generation: '测验生成',
  weekly_report: '周研究报告',
};

/** 学习方式 */
export const LEARNING_MODES = [
  'domain',
  'topic',
  'problem',
  'daily',
  'weekly',
  'case_study',
  'quiz',
  'spaced_repetition',
] as const;
export type LearningMode = (typeof LEARNING_MODES)[number];

/** 实践项目状态 */
export const PRACTICE_STATUSES = ['planning', 'active', 'completed', 'abandoned'] as const;
export type PracticeStatus = (typeof PRACTICE_STATUSES)[number];

// ============================================================================
// 实体定义
// ============================================================================

/** 领域（支持动态扩展，不写死在代码里） */
export interface Domain {
  id: string;
  name: string;
  description?: string;
  /** 父领域 id，用于多级子领域 */
  parentId?: string | null;
  /** 手工排序权重 */
  order: number;
  /** 语义检索用的关键词/别名 */
  keywords?: string[];
  createdAt: string;
  updatedAt: string;
}

/** 资料来源 */
export interface Source {
  id: string;
  title: string;
  authorOrOrg?: string | null;
  url?: string | null;
  /** 出版/发布时间 ISO */
  publishedAt?: string | null;
  /** 访问时间 ISO */
  accessedAt?: string;
  type: SourceType;
  /** 可信度 0-1 */
  credibility: number;
  /** 该资料支持的具体结论 */
  supports: string[];
  /** 原始出版信息 */
  publisher?: string | null;
  isbn?: string | null;
  doi?: string | null;
  language?: string;
  createdAt: string;
  updatedAt: string;
}

/** 知识关系 */
export interface Relation {
  id: string;
  fromId: string;
  toId: string;
  type: RelationType;
  /** AI 生成的关系说明 */
  explanation: string;
  /** 支撑该关系的证据（引用 source id 或方法论 id） */
  evidenceRefs: string[];
  /** 关系置信度 0-1 */
  confidence: number;
  /** 由谁产生：ai / user */
  origin: 'ai' | 'user';
  createdAt: string;
  updatedAt: string;
}

/** 方法论档案 */
export interface Method {
  id: string;
  name: string;
  aliases: string[];
  domainIds: string[];
  subDomainIds?: string[];
  type: MethodType;

  origin: {
    proposer?: string | null;
    firstProposedAt?: string | null;
    sourceIds: string[];
  };

  content: {
    coreIdea?: string | null;
    /** 理论基础 */
    principles: string[];
    /** 运行原理 */
    mechanism?: string | null;
    scenarios: string[];
    /** 成立前提 */
    conditions: string[];
    steps: string[];
    advantages: string[];
    disadvantages: string[];
    limitations: string[];
    misconceptions: string[];
  };

  evidence: {
    level: EvidenceLevel;
    /** 分条证据，每条标注类别 */
    claims: EvidenceClaim[];
    /** AI 综合可信度 0-1 */
    confidence: number | null;
  };

  /** 关联方法论 id（与 relations 表互为索引） */
  relatedIds: string[];

  /** 真实案例 */
  caseIds: string[];
  tags: string[];

  status: MethodStatus;
  /** 完整研究文章（Markdown） */
  article?: string | null;

  version: number;
  createdAt: string;
  updatedAt: string;
  /** 最近一次研究时间 */
  lastResearchedAt?: string | null;
  /** 版本历史 */
  history?: VersionEntry[];
}

/** 单条证据声明 */
export interface EvidenceClaim {
  id: string;
  /** 证据类别 —— 决定这段话能否被当作原作者观点 */
  category: EvidenceCategory;
  statement: string;
  /** 关联资料来源 id */
  sourceIds: string[];
  /** 支撑强度 0-1 */
  strength: number;
  notes?: string | null;
}

/** 版本记录 */
export interface VersionEntry {
  version: number;
  at: string;
  /** 变更摘要 */
  summary: string;
  /** 变更类型 */
  changeType: 'create' | 'update' | 'review' | 'merge' | 'deprecate' | 'archive';
  /** 变更来源 */
  by: 'ai' | 'user' | 'system';
  /** 变更前后的字段差异 */
  diff?: Array<{ field: string; before: unknown; after: unknown }>;
}

/** 真实案例 */
export interface CaseStudy {
  id: string;
  methodIds: string[];
  title: string;
  /** 场景背景 */
  context?: string | null;
  /** 做了什么 */
  action?: string | null;
  /** 结果 */
  outcome?: string | null;
  /** 结果是否可量化 */
  quantified?: boolean;
  /** 度量指标 */
  metrics?: Array<{ name: string; value: string }>;
  /** 案例来源 */
  sourceIds: string[];
  /** 组织/主体 */
  organization?: string | null;
  /** 时间 */
  occurredAt?: string | null;
  /** 证据等级 */
  evidenceLevel: EvidenceLevel;
  createdAt: string;
  updatedAt: string;
}

/** 研究任务 */
export interface ResearchTask {
  id: string;
  /** 任务类型 */
  taskType: 'discovery' | 'deepen' | 'update' | 'relation' | 'weekly_report';
  /** 研究目标（方法论名称或研究主题） */
  target: string;
  /** 触发来源 */
  trigger: 'manual' | 'schedule' | 'user_request';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  /** 优先级 1-5 */
  priority: number;
  /** 任务使用的模型 */
  model?: string | null;
  /** 成本统计 */
  usage?: { inputTokens: number; outputTokens: number; estimatedCostUsd: number };
  error?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 研究报告 */
export interface ResearchReport {
  id: string;
  taskId?: string | null;
  title: string;
  /** 报告类型 */
  reportType: 'discovery' | 'method_profile' | 'update' | 'relation' | 'weekly';
  summary: string;
  /** 报告正文 Markdown */
  content: string;
  /** 研究涉及的方法论 id */
  methodIds: string[];
  /** 引用的资料 */
  sourceIds: string[];
  /** 本次研究产生的候选档案（待审核） */
  candidateIds: string[];
  /** 模型信息 */
  model?: string | null;
  usage?: { inputTokens: number; outputTokens: number; estimatedCostUsd: number };
  createdAt: string;
}

/** 审核记录 */
export interface Review {
  id: string;
  /** 待审核内容类型 */
  targetType: 'method' | 'relation' | 'report';
  targetId: string;
  decision: ReviewDecision;
  /** 审核人备注 */
  notes?: string | null;
  /** 修改后入库时用户所做的编辑 */
  edits?: Array<{ field: string; before: unknown; after: unknown }>;
  /** 合并到哪个方法论 */
  mergedIntoId?: string | null;
  reviewedAt: string;
  /** AI 生成的审核摘要 */
  aiSummary?: string | null;
}

/** 实践项目 */
export interface Practice {
  id: string;
  name: string;
  /** 要解决的实际问题 */
  problem: string;
  /** 关联方法论 */
  methodIds: string[];
  /** 预期目标 */
  expectedOutcome: string;
  /** 实施方案（AI 辅助制定） */
  plan?: string | null;
  /** 执行步骤 */
  steps: Array<{ text: string; done: boolean; doneAt?: string | null }>;
  startedAt: string;
  endedAt?: string | null;
  /** 投入成本 */
  cost?: { hours?: number | null; people?: number | null; money?: number | null; note?: string | null } | null;
  status: PracticeStatus;
  /** 执行过程记录 */
  logs: PracticeLog[];
  /** 最终结果 */
  result?: string | null;
  /** 个人反思 */
  reflection?: string | null;
  /** AI 复盘 */
  aiReview?: PracticeReview | null;
  /** 效果评价 */
  evaluation?: PracticeEvaluation | null;
  createdAt: string;
  updatedAt: string;
}

/** 实践过程记录 */
export interface PracticeLog {
  id: string;
  at: string;
  /** 记录类型 */
  kind: 'progress' | 'blocker' | 'decision' | 'change' | 'result';
  content: string;
  /** 关联步骤序号 */
  stepIndex?: number | null;
}

/** 实践效果评价 */
export interface PracticeEvaluation {
  /** 目标完成度 0-100 */
  goalCompletion: number | null;
  /** 执行过程评价 */
  processRating: number | null;
  /** 实际效果描述 */
  actualEffect: string | null;
  /** 时间投入 */
  timeSpent?: number | null;
  /** 成本投入 */
  costIncurred?: number | null;
  /** 长期跟踪 */
  longTerm?: string | null;
  /** 场景与适用条件记录 —— 同方法论不同环境效果可能不同 */
  contextConditions?: string | null;
  evaluatedAt: string;
}

/** AI 实践复盘 */
export interface PracticeReview {
  /** 方法论是否选对 */
  methodFit: string;
  /** 适用条件是否满足 */
  conditionsMet: string;
  /** 执行过程是否完整 */
  executionCompleteness: string;
  /** 哪些步骤发挥了作用 */
  effectiveSteps: string[];
  /** 哪些因素影响结果 */
  influencingFactors: string[];
  /** 是否存在其他解释 */
  alternativeExplanations: string[];
  /** 下次如何改进 */
  improvements: string[];
  /** 是否需要更新方法论档案 */
  needsMethodUpdate: boolean;
  /** 需要更新的方法论 id */
  updateTargetIds: string[];
  model?: string | null;
  createdAt: string;
}

/** 学习计划 */
export interface LearningPlan {
  id: string;
  title: string;
  /** 计划周期 */
  period?: { start: string; end: string } | null;
  /** 计划目标 */
  goal: string;
  /** 任务列表 */
  taskIds: string[];
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
}

/** 学习任务 */
export interface LearningTask {
  id: string;
  planId?: string | null;
  mode: LearningMode;
  title: string;
  /** 学习目标 */
  objective: string;
  /** 相关方法论 */
  methodIds: string[];
  /** 学习材料 */
  materials: string[];
  /** 重点知识 */
  keyPoints: string[];
  /** 真实案例 */
  caseIds: string[];
  /** 测验题目 */
  quizIds: string[];
  /** 复习时间 */
  reviewAt?: string | null;
  /** 间隔重复参数 */
  repetition?: { interval: number; ease: number; reps: number } | null;
  /** 掌握程度 */
  mastery: MasteryLevel;
  status: 'pending' | 'in_progress' | 'completed' | 'archived';
  dueAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 测验题目 */
export interface Quiz {
  id: string;
  taskId?: string | null;
  methodIds: string[];
  question: string;
  /** 题目类型 */
  kind: 'single_choice' | 'multi_choice' | 'true_false' | 'short_answer' | 'scenario';
  options?: string[];
  /** 正确答案索引（short_answer 为 null） */
  answer: number[] | null;
  /** 参考答案 */
  explanation: string;
  createdAt: string;
}

/** 掌握程度记录 */
export interface MasteryRecord {
  id: string;
  methodId: string;
  level: MasteryLevel;
  /** 更新原因 */
  reason: 'read' | 'quiz' | 'practice' | 'manual' | 'ai_assessed';
  /** 测验得分 0-100 */
  score?: number | null;
  at: string;
  note?: string | null;
}

/** 模型配置 */
export interface ModelConfig {
  id: string;
  provider: 'anthropic' | 'openai' | 'gemini' | 'deepseek' | 'custom';
  model: string;
  /** 显示名 */
  label: string;
  /** 上下文窗口 */
  contextWindow?: number | null;
  /** 输入价格（美元 / 百万 token） */
  inputPricePerMillion?: number | null;
  outputPricePerMillion?: number | null;
  /** 是否启用 */
  enabled: boolean;
  /** 备注 */
  note?: string | null;
}

/** 系统配置 */
export interface SystemConfig {
  /** 各任务类型绑定的模型 */
  taskRouting: Partial<Record<AITask, string>>;
  /** 默认模型 */
  defaultModel?: string | null;
  /** 备用模型（主模型失败时使用） */
  fallbackModels: string[];
  /** 联网搜索开关 */
  webSearchEnabled: boolean;
  /** 搜索 provider */
  searchProvider: string;
  /** 单次任务费用上限（美元） */
  costLimitPerTask: number;
  /** 每周费用上限（美元） */
  costLimitPerWeek: number;
  /** 每周研究目标数量 */
  weeklyTargetCount: number;
  /** 语言 */
  language: string;
  /** 主题 */
  theme: 'light' | 'dark' | 'system';
  updatedAt: string;
}

// ============================================================================
// 数据仓布局（GitHub 仓库目录结构）
// ============================================================================

export const DATA_LAYOUT = {
  config: 'data/config.json',
  domains: 'data/domains.json',
  methods: 'data/methods',
  relations: 'data/relations.json',
  sources: 'data/sources.json',
  cases: 'data/cases.json',
  practices: 'data/practices.json',
  learning: 'data/learning.json',
  reviews: 'data/reviews.json',
  researchQueue: 'research/queue.json',
  researchReports: 'research/reports',
  indexes: 'indexes',
} as const;

/** 方法论档案在数据仓中的存储文件名 */
export function methodFilePath(id: string): string {
  return `${DATA_LAYOUT.methods}/${id}.json`;
}

// ============================================================================
// 派生类型工具
// ============================================================================

/** 带分页信息的方法论列表项 */
export interface MethodListItem {
  id: string;
  name: string;
  aliases: string[];
  domainIds: string[];
  type: MethodType;
  evidenceLevel: EvidenceLevel;
  confidence: number | null;
  status: MethodStatus;
  tags: string[];
  updatedAt: string;
  lastResearchedAt?: string | null;
}

/** 检索结果 */
export interface RetrievalHit {
  methodId: string;
  methodName: string;
  /** 命中的文本片段 */
  snippet: string;
  /** 综合得分 */
  score: number;
  /** 各路检索得分明细 */
  breakdown: {
    keyword: number;
    tag: number;
    vector: number;
    relation: number;
  };
  domainIds: string[];
  evidenceLevel: EvidenceLevel;
}

/** 推荐结果结构（对应文档 3.4 节） */
export interface RecommendationResult {
  /** 问题理解 */
  understanding: string;
  /** 推荐方法论 */
  methods: Array<{
    methodId: string;
    name: string;
    /** 推荐理由 */
    reason: string;
    /** 适用条件 */
    conditions: string[];
    /** 实施步骤 */
    steps: string[];
    /** 注意事项 */
    cautions: string[];
    /** 证据等级 */
    evidenceLevel: EvidenceLevel;
    score: number;
  }>;
  /** 组合逻辑说明 */
  combinationLogic?: string | null;
  /** 相关案例 */
  caseIds: string[];
  /** 参考来源 */
  sourceIds: string[];
  /** 检索命中明细 */
  hits: RetrievalHit[];
  /** 回答来源性质区分 */
  provenance: {
    fromKnowledgeBase: boolean;
    usedWebSearch: boolean;
    aiInference: string[];
  };
  usage?: { inputTokens: number; outputTokens: number; estimatedCostUsd: number };
  model?: string | null;
}

/** 研究成果候选（待审核） */
export interface ResearchCandidate {
  id: string;
  /** 候选类型 */
  kind: 'new_method' | 'enrichment' | 'relation' | 'update';
  /** 关联的已有方法论 id */
  existingMethodId?: string | null;
  /** 新方法论草案（kind=new_method 时有效） */
  draft?: Partial<Method> | null;
  /** 对已有方法论的补充建议（kind=enrichment 时有效） */
  enrichment?: { field: string; current: unknown; proposed: unknown; rationale: string }[];
  /** 建议的关系 */
  relation?: Omit<Relation, 'id' | 'createdAt' | 'updatedAt'> | null;
  /** AI 审核摘要 */
  summary: string;
  /** 新增价值亮点 */
  valuePoints: string[];
  /** 需要注意的问题 */
  cautions: string[];
  /** 证据质量评估 */
  evidenceQuality: { level: EvidenceLevel; note: string; sourceCount: number };
  /** 状态 */
  status: 'pending' | 'approved' | 'rejected' | 'merged' | 'ignored';
  sourceIds: string[];
  createdAt: string;
  updatedAt: string;
}
