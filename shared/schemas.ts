import { z } from 'zod';
import {
  AI_TASKS,
  DOMAIN_IDS,
  EVIDENCE_CATEGORIES,
  EVIDENCE_LEVELS,
  LEARNING_MODES,
  MASTERY_LEVELS,
  METHOD_STATUSES,
  METHOD_TYPES,
  PRACTICE_STATUSES,
  RELATION_TYPES,
  REVIEW_DECISIONS,
  SOURCE_TYPES,
} from './types.js';

// ============================================================================
// 基础片段
// ============================================================================

export const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: '不是合法 ISO 时间' });

export const idField = z.string().min(1).max(120);

export const confidence = z.number().min(0).max(1);

export const evidenceLevelSchema = z.enum(EVIDENCE_LEVELS);
export const evidenceCategorySchema = z.enum(EVIDENCE_CATEGORIES);

// ============================================================================
// Domain
// ============================================================================

export const domainSchema = z.object({
  id: idField,
  name: z.string().min(1),
  description: z.string().optional(),
  parentId: z.string().nullable().optional(),
  order: z.number().int().default(0),
  keywords: z.array(z.string()).default([]),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type DomainInput = z.input<typeof domainSchema>;

// ============================================================================
// Source
// ============================================================================

export const sourceSchema = z.object({
  id: idField,
  title: z.string().min(1),
  authorOrOrg: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  accessedAt: isoDate.optional(),
  type: z.enum(SOURCE_TYPES),
  credibility: confidence,
  supports: z.array(z.string()).default([]),
  publisher: z.string().nullable().optional(),
  isbn: z.string().nullable().optional(),
  doi: z.string().nullable().optional(),
  language: z.string().optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

// ============================================================================
// Relation
// ============================================================================

export const relationSchema = z.object({
  id: idField,
  fromId: idField,
  toId: idField,
  type: z.enum(RELATION_TYPES),
  explanation: z.string().min(1),
  evidenceRefs: z.array(z.string()).default([]),
  confidence,
  origin: z.enum(['ai', 'user']),
  createdAt: isoDate,
  updatedAt: isoDate,
});

// ============================================================================
// Method
// ============================================================================

export const evidenceClaimSchema = z.object({
  id: idField,
  category: evidenceCategorySchema,
  statement: z.string().min(1),
  sourceIds: z.array(z.string()).default([]),
  strength: confidence,
  notes: z.string().nullable().optional(),
});

export const versionEntrySchema = z.object({
  version: z.number().int().min(1),
  at: isoDate,
  summary: z.string().min(1),
  changeType: z.enum(['create', 'update', 'review', 'merge', 'deprecate', 'archive']),
  by: z.enum(['ai', 'user', 'system']),
  diff: z
    .array(z.object({ field: z.string(), before: z.unknown(), after: z.unknown() }))
    .optional(),
});

export const methodSchema = z.object({
  id: idField,
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  domainIds: z.array(z.string()).min(1, '至少归属一个领域'),
  subDomainIds: z.array(z.string()).optional(),
  type: z.enum(METHOD_TYPES),
  origin: z.object({
    proposer: z.string().nullable().optional(),
    firstProposedAt: z.string().nullable().optional(),
    sourceIds: z.array(z.string()).default([]),
  }),
  content: z.object({
    coreIdea: z.string().nullable().optional(),
    principles: z.array(z.string()).default([]),
    mechanism: z.string().nullable().optional(),
    scenarios: z.array(z.string()).default([]),
    conditions: z.array(z.string()).default([]),
    steps: z.array(z.string()).default([]),
    advantages: z.array(z.string()).default([]),
    disadvantages: z.array(z.string()).default([]),
    limitations: z.array(z.string()).default([]),
    misconceptions: z.array(z.string()).default([]),
  }),
  evidence: z.object({
    level: evidenceLevelSchema,
    claims: z.array(evidenceClaimSchema).default([]),
    confidence: z.number().min(0).max(1).nullable(),
  }),
  relatedIds: z.array(z.string()).default([]),
  caseIds: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  status: z.enum(METHOD_STATUSES),
  article: z.string().nullable().optional(),
  version: z.number().int().min(1),
  createdAt: isoDate,
  updatedAt: isoDate,
  lastResearchedAt: z.string().nullable().optional(),
  history: z.array(versionEntrySchema).optional(),
});

// ============================================================================
// CaseStudy
// ============================================================================

export const caseStudySchema = z.object({
  id: idField,
  methodIds: z.array(z.string()).default([]),
  title: z.string().min(1),
  context: z.string().nullable().optional(),
  action: z.string().nullable().optional(),
  outcome: z.string().nullable().optional(),
  quantified: z.boolean().optional(),
  metrics: z.array(z.object({ name: z.string(), value: z.string() })).default([]),
  sourceIds: z.array(z.string()).default([]),
  organization: z.string().nullable().optional(),
  occurredAt: z.string().nullable().optional(),
  evidenceLevel: evidenceLevelSchema,
  createdAt: isoDate,
  updatedAt: isoDate,
});

// ============================================================================
// Research
// ============================================================================

export const researchTaskSchema = z.object({
  id: idField,
  taskType: z.enum(['discovery', 'deepen', 'update', 'relation', 'weekly_report']),
  target: z.string().min(1),
  trigger: z.enum(['manual', 'schedule', 'user_request']),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']),
  priority: z.number().int().min(1).max(5),
  model: z.string().nullable().optional(),
  usage: z
    .object({
      inputTokens: z.number().nonnegative(),
      outputTokens: z.number().nonnegative(),
      estimatedCostUsd: z.number().nonnegative(),
    })
    .optional(),
  error: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  finishedAt: z.string().nullable().optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const researchReportSchema = z.object({
  id: idField,
  taskId: z.string().nullable().optional(),
  title: z.string().min(1),
  reportType: z.enum(['discovery', 'method_profile', 'update', 'relation', 'weekly']),
  summary: z.string().min(1),
  content: z.string(),
  methodIds: z.array(z.string()).default([]),
  sourceIds: z.array(z.string()).default([]),
  candidateIds: z.array(z.string()).default([]),
  model: z.string().nullable().optional(),
  usage: z
    .object({
      inputTokens: z.number().nonnegative(),
      outputTokens: z.number().nonnegative(),
      estimatedCostUsd: z.number().nonnegative(),
    })
    .optional(),
  createdAt: isoDate,
});

export const reviewSchema = z.object({
  id: idField,
  targetType: z.enum(['method', 'relation', 'report']),
  targetId: idField,
  decision: z.enum(REVIEW_DECISIONS),
  notes: z.string().nullable().optional(),
  edits: z
    .array(z.object({ field: z.string(), before: z.unknown(), after: z.unknown() }))
    .optional(),
  mergedIntoId: z.string().nullable().optional(),
  reviewedAt: isoDate,
  aiSummary: z.string().nullable().optional(),
});

export const researchCandidateSchema = z.object({
  id: idField,
  kind: z.enum(['new_method', 'enrichment', 'relation', 'update']),
  existingMethodId: z.string().nullable().optional(),
  draft: z.unknown().nullable().optional(),
  enrichment: z
    .array(
      z.object({
        field: z.string(),
        current: z.unknown(),
        proposed: z.unknown(),
        rationale: z.string(),
      }),
    )
    .optional(),
  relation: z.unknown().nullable().optional(),
  summary: z.string(),
  valuePoints: z.array(z.string()).default([]),
  cautions: z.array(z.string()).default([]),
  evidenceQuality: z.object({
    level: evidenceLevelSchema,
    note: z.string(),
    sourceCount: z.number().int().nonnegative(),
  }),
  status: z.enum(['pending', 'approved', 'rejected', 'merged', 'ignored']),
  sourceIds: z.array(z.string()).default([]),
  createdAt: isoDate,
  updatedAt: isoDate,
});

// ============================================================================
// Practice
// ============================================================================

export const practiceLogSchema = z.object({
  id: idField,
  at: isoDate,
  kind: z.enum(['progress', 'blocker', 'decision', 'change', 'result']),
  content: z.string().min(1),
  stepIndex: z.number().int().nullable().optional(),
});

export const practiceEvaluationSchema = z.object({
  goalCompletion: z.number().min(0).max(100).nullable(),
  processRating: z.number().min(0).max(5).nullable(),
  actualEffect: z.string().nullable(),
  timeSpent: z.number().nullable().optional(),
  costIncurred: z.number().nullable().optional(),
  longTerm: z.string().nullable(),
  contextConditions: z.string().nullable(),
  evaluatedAt: isoDate,
});

export const practiceReviewSchema = z.object({
  methodFit: z.string(),
  conditionsMet: z.string(),
  executionCompleteness: z.string(),
  effectiveSteps: z.array(z.string()).default([]),
  influencingFactors: z.array(z.string()).default([]),
  alternativeExplanations: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  needsMethodUpdate: z.boolean(),
  updateTargetIds: z.array(z.string()).default([]),
  model: z.string().nullable().optional(),
  createdAt: isoDate,
});

export const practiceSchema = z.object({
  id: idField,
  name: z.string().min(1),
  problem: z.string().min(1),
  methodIds: z.array(z.string()).default([]),
  expectedOutcome: z.string(),
  plan: z.string().nullable().optional(),
  steps: z
    .array(
      z.object({
        text: z.string(),
        done: z.boolean().default(false),
        doneAt: z.string().nullable().optional(),
      }),
    )
    .default([]),
  startedAt: isoDate,
  endedAt: z.string().nullable().optional(),
  cost: z
    .object({
      hours: z.number().nullable().optional(),
      people: z.number().nullable().optional(),
      money: z.number().nullable().optional(),
      note: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  status: z.enum(PRACTICE_STATUSES),
  logs: z.array(practiceLogSchema).default([]),
  result: z.string().nullable().optional(),
  reflection: z.string().nullable().optional(),
  aiReview: practiceReviewSchema.nullable().optional(),
  evaluation: practiceEvaluationSchema.nullable().optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

// ============================================================================
// Learning
// ============================================================================

export const learningPlanSchema = z.object({
  id: idField,
  title: z.string().min(1),
  period: z.object({ start: isoDate, end: isoDate }).nullable().optional(),
  goal: z.string(),
  taskIds: z.array(z.string()).default([]),
  status: z.enum(['active', 'completed', 'archived']),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const quizSchema = z.object({
  id: idField,
  taskId: z.string().nullable().optional(),
  methodIds: z.array(z.string()).default([]),
  question: z.string().min(1),
  kind: z.enum(['single_choice', 'multi_choice', 'true_false', 'short_answer', 'scenario']),
  options: z.array(z.string()).optional(),
  answer: z.array(z.number().int()).nullable(),
  explanation: z.string(),
  createdAt: isoDate,
});

export const learningTaskSchema = z.object({
  id: idField,
  planId: z.string().nullable().optional(),
  mode: z.enum(LEARNING_MODES),
  title: z.string().min(1),
  objective: z.string(),
  methodIds: z.array(z.string()).default([]),
  materials: z.array(z.string()).default([]),
  keyPoints: z.array(z.string()).default([]),
  caseIds: z.array(z.string()).default([]),
  quizIds: z.array(z.string()).default([]),
  reviewAt: z.string().nullable().optional(),
  repetition: z
    .object({
      interval: z.number().int().min(0),
      ease: z.number().min(1),
      reps: z.number().int().min(0),
    })
    .nullable()
    .optional(),
  mastery: z.enum(MASTERY_LEVELS),
  status: z.enum(['pending', 'in_progress', 'completed', 'archived']),
  dueAt: z.string().nullable().optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const masteryRecordSchema = z.object({
  id: idField,
  methodId: idField,
  level: z.enum(MASTERY_LEVELS),
  reason: z.enum(['read', 'quiz', 'practice', 'manual', 'ai_assessed']),
  score: z.number().min(0).max(100).nullable().optional(),
  at: isoDate,
  note: z.string().nullable().optional(),
});

// ============================================================================
// Config
// ============================================================================

export const modelConfigSchema = z.object({
  id: idField,
  provider: z.enum(['anthropic', 'openai', 'gemini', 'deepseek', 'custom']),
  model: z.string().min(1),
  label: z.string().min(1),
  contextWindow: z.number().nullable().optional(),
  inputPricePerMillion: z.number().nullable().optional(),
  outputPricePerMillion: z.number().nullable().optional(),
  enabled: z.boolean(),
  note: z.string().nullable().optional(),
});

export const systemConfigSchema = z.object({
  taskRouting: z.object({}) as unknown as z.ZodType<Partial<Record<(typeof AI_TASKS)[number], string>>> & { partial(): unknown },
  defaultModel: z.string().nullable().optional(),
  fallbackModels: z.array(z.string()).default([]),
  webSearchEnabled: z.boolean().default(true),
  searchProvider: z.string().default('auto'),
  costLimitPerTask: z.number().nonnegative().default(1),
  costLimitPerWeek: z.number().nonnegative().default(10),
  weeklyTargetCount: z.number().int().min(0).max(50).default(5),
  language: z.string().default('zh-CN'),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  updatedAt: isoDate,
});

// ============================================================================
// 集合容器
// ============================================================================

export const domainsFileSchema = z.object({ domains: z.array(domainSchema) });
export const sourcesFileSchema = z.object({ sources: z.array(sourceSchema) });
export const relationsFileSchema = z.object({ relations: z.array(relationSchema) });
export const casesFileSchema = z.object({ cases: z.array(caseStudySchema) });
export const practicesFileSchema = z.object({ practices: z.array(practiceSchema) });
export const reviewsFileSchema = z.object({ reviews: z.array(reviewSchema) });
export const researchQueueFileSchema = z.object({
  tasks: z.array(researchTaskSchema),
  candidates: z.array(researchCandidateSchema),
});
export const learningFileSchema = z.object({
  plans: z.array(learningPlanSchema),
  tasks: z.array(learningTaskSchema),
  quizzes: z.array(quizSchema),
  mastery: z.array(masteryRecordSchema),
});

// ============================================================================
// 校验辅助
// ============================================================================

export interface ValidationIssue {
  path: string;
  message: string;
}

/** 批量校验并返回结构化问题列表 */
export function validateMany<T extends z.ZodTypeAny>(
  schema: T,
  items: unknown[],
  basePath = '',
): { ok: boolean; issues: ValidationIssue[]; valid: unknown[] } {
  const issues: ValidationIssue[] = [];
  const valid: unknown[] = [];
  items.forEach((item, i) => {
    const result = schema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      for (const issue of result.error.issues) {
        issues.push({
          path: `${basePath}[${i}].${issue.path.join('.')}`,
          message: issue.message,
        });
      }
    }
  });
  return { ok: issues.length === 0, issues, valid };
}

/** 单条校验，返回错误信息列表 */
export function validateOne<T extends z.ZodTypeAny>(
  schema: T,
  item: unknown,
  basePath = '',
): { ok: boolean; issues: ValidationIssue[]; data?: z.infer<T> } {
  const result = schema.safeParse(item);
  if (result.success) return { ok: true, issues: [], data: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      path: `${basePath}${issue.path.join('.')}`,
      message: issue.message,
    })),
  };
}

export { DOMAIN_IDS };
