import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Sparkles, Check, X, Merge, RotateCcw, Eye } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Textarea,
  Label,
  LoadingBlock,
  Empty,
  Badge,
  Tabs,
  Alert,
} from '../components/ui';
import { EvidenceBadge } from '../components/EvidenceBadge';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { formatDateTime, formatRelative } from '../lib/format';
import { REVIEW_DECISION_NAMES, type ReviewDecision } from '@shared/types';

type TabId = 'queue' | 'tasks';

export default function Research() {
  const [tab, setTab] = useState<TabId>('queue');
  const queryClient = useQueryClient();
  const showToast = useAppStore((s) => s.showToast);
  const online = useAppStore((s) => s.online);

  const queueQuery = useQuery({
    queryKey: ['research-queue'],
    queryFn: async () => {
      const res = await api.researchQueue();
      return { ...res.data, stale: res.stale };
    },
  });

  const [target, setTarget] = useState('');
  const [taskType, setTaskType] = useState<'discovery' | 'deepen' | 'update' | 'relation'>('discovery');

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await api.runResearch(target.trim(), taskType);
      return res.data;
    },
    onSuccess: (data) => {
      showToast(`研究任务已提交：${data.taskId}`, 'success');
      setTarget('');
      void queryClient.invalidateQueries({ queryKey: ['research-queue'] });
    },
    onError: (err: unknown) => {
      showToast(err instanceof Error ? err.message : '研究任务提交失败', 'error');
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (input: { id: string; decision: ReviewDecision; mergedIntoId?: string }) => {
      await api.reviewCandidate(input.id, {
        decision: input.decision,
        mergedIntoId: input.mergedIntoId,
      });
    },
    onSuccess: () => {
      showToast('审核完成', 'success');
      void queryClient.invalidateQueries({ queryKey: ['research-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['methods'] });
    },
    onError: (err: unknown) => {
      showToast(err instanceof Error ? err.message : '审核提交失败', 'error');
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.retryResearch(id);
    },
    onSuccess: () => {
      showToast('已重新排队', 'success');
      void queryClient.invalidateQueries({ queryKey: ['research-queue'] });
    },
    onError: (err: unknown) => {
      showToast(err instanceof Error ? err.message : '重试失败', 'error');
    },
  });

  if (queueQuery.isLoading) return <LoadingBlock />;

  const tasks = queueQuery.data?.tasks ?? [];
  const candidates = queueQuery.data?.candidates ?? [];
  const pending = candidates.filter((c) => c.status === 'pending');

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">AI 研究中心</h1>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          AI 主动完成检索、交叉验证、整理与去重，你只需审核入库
        </p>
      </header>

      {!online ? (
        <Alert kind="warning" title="离线模式">
          发起研究和审核入库都需要联网。已缓存的内容仍可浏览。
        </Alert>
      ) : null}

      {/* 发起研究 */}
      <Card>
        <CardHeader title="发起研究" description="描述你想研究的方法论或主题" />
        <CardBody className="space-y-3">
          <div>
            <Label>研究目标</Label>
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="例如：深度研究「目标管理」在创业团队中的适配性"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && target.trim() && !runMutation.isPending) {
                  runMutation.mutate();
                }
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="mb-0">类型</Label>
            {(
              [
                ['discovery', '发现新方法论'],
                ['deepen', '深化已有方法论'],
                ['update', '更新过时内容'],
                ['relation', '跨领域关联'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTaskType(value)}
                className={
                  taskType === value
                    ? 'rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-medium text-white'
                    : 'rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }
              >
                {label}
              </button>
            ))}
            <div className="ml-auto">
              <Button
                size="sm"
                loading={runMutation.isPending}
                disabled={!target.trim() || !online}
                onClick={() => runMutation.mutate()}
                icon={<Sparkles className="h-3.5 w-3.5" />}
              >
                提交研究
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 队列与任务 */}
      <Card>
        <Tabs
          items={[
            { id: 'queue', label: '待审核', count: pending.length },
            { id: 'tasks', label: '研究任务', count: tasks.length },
          ]}
          active={tab}
          onChange={(t) => setTab(t as TabId)}
          className="px-2"
        />
        <CardBody>
          {tab === 'queue' ? (
            pending.length === 0 ? (
              <Empty
                icon={<FlaskConical className="h-10 w-10" />}
                title="没有待审核的研究成果"
                description="AI 完成研究后会在这里排队等待你确认。也可以每周由自动任务产出。"
              />
            ) : (
              <ul className="space-y-3">
                {pending.map((c) => (
                  <CandidateCard
                    key={c.id}
                    candidate={c}
                    onDecide={(decision, mergedIntoId) =>
                      reviewMutation.mutate({ id: c.id, decision, mergedIntoId })
                    }
                    busy={reviewMutation.isPending}
                  />
                ))}
              </ul>
            )
          ) : tasks.length === 0 ? (
            <Empty title="暂无研究任务" description="提交一次研究后，任务记录会显示在这里。" />
          ) : (
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                      {t.target}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {t.taskType} · {t.trigger} · {formatRelative(t.createdAt)}
                      {t.model ? ` · ${t.model}` : ''}
                    </p>
                    {t.error ? (
                      <p className="mt-0.5 text-[11px] text-red-600 dark:text-red-400">{t.error}</p>
                    ) : null}
                  </div>
                  <Badge
                    tone={
                      t.status === 'completed'
                        ? 'success'
                        : t.status === 'failed'
                          ? 'danger'
                          : t.status === 'running'
                            ? 'primary'
                            : 'muted'
                    }
                  >
                    {t.status}
                  </Badge>
                  {t.status === 'failed' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => retryMutation.mutate(t.id)}
                      icon={<RotateCcw className="h-3 w-3" />}
                    >
                      重试
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function CandidateCard({
  candidate,
  onDecide,
  busy,
}: {
  candidate: {
    id: string;
    kind: 'new_method' | 'enrichment' | 'relation' | 'update';
    existingMethodId?: string | null;
    draft?: { name?: string; coreIdea?: string; content?: { coreIdea?: string | null } } | null;
    enrichment?: Array<{ field: string; current: unknown; proposed: unknown; rationale: string }>;
    summary: string;
    valuePoints: string[];
    cautions: string[];
    evidenceQuality: { level: 'unverified' | 'low' | 'medium' | 'high' | 'meta_analysis'; note: string; sourceCount: number };
    sourceIds: string[];
    createdAt: string;
  };
  onDecide: (decision: ReviewDecision, mergedIntoId?: string) => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');

  const kindLabel = {
    new_method: '新方法论',
    enrichment: '内容补充',
    relation: '关系建立',
    update: '内容更新',
  }[candidate.kind];

  const draft = candidate.draft as
    | { name?: string; content?: { coreIdea?: string | null } }
    | null
    | undefined;
  const displayName = draft?.name ?? '未命名';
  const coreIdea = draft?.content?.coreIdea ?? '';

  return (
    <li className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="primary">{kindLabel}</Badge>
            <EvidenceBadge level={candidate.evidenceQuality.level} />
            <span className="text-[11px] text-slate-400">
              {candidate.evidenceQuality.sourceCount} 项来源
            </span>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {displayName}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-slate-400">
          {formatDateTime(candidate.createdAt)}
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
        {candidate.summary}
      </p>

      {coreIdea ? (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-slate-950/50 dark:text-slate-400">
          {coreIdea}
        </p>
      ) : null}

      {candidate.valuePoints.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">新增价值</p>
          <ul className="mt-1 space-y-0.5">
            {candidate.valuePoints.map((v, i) => (
              <li key={i} className="text-[11px] text-slate-600 dark:text-slate-400">
                · {v}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {candidate.cautions.length > 0 ? (
        <div className="mt-2.5">
          <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">需要注意</p>
          <ul className="mt-1 space-y-0.5">
            {candidate.cautions.map((v, i) => (
              <li key={i} className="text-[11px] text-slate-600 dark:text-slate-400">
                · {v}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-2 text-[11px] text-slate-400">证据评估：{candidate.evidenceQuality.note}</p>

      {candidate.enrichment && candidate.enrichment.length > 0 ? (
        <div className="mt-3 space-y-2">
          {candidate.enrichment.map((e, i) => (
            <div key={i} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
              <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{e.field}</p>
              <p className="mt-1 text-[11px] text-slate-500 line-through dark:text-slate-500">
                {String(e.current ?? '')}
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                {String(e.proposed ?? '')}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">{e.rationale}</p>
            </div>
          ))}
        </div>
      ) : null}

      {expanded ? (
        <div className="mt-3 space-y-2">
          <div>
            <Label>审核备注（可选）</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="记录你的判断理由，会写入审核历史"
            />
          </div>
          {candidate.kind === 'new_method' ? (
            <div>
              <Label>合并到已有方法论（选择「合并」时生效）</Label>
              <Input
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
                placeholder="填写已有方法论的 ID"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <Button
          size="sm"
          loading={busy}
          onClick={() => onDecide('approve')}
          icon={<Check className="h-3.5 w-3.5" />}
        >
          {REVIEW_DECISION_NAMES.approve}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onDecide('approve_with_edits')}
          icon={<Eye className="h-3.5 w-3.5" />}
        >
          修改后入库
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDecide('reject')}
          icon={<RotateCcw className="h-3.5 w-3.5" />}
        >
          {REVIEW_DECISION_NAMES.reject}
        </Button>
        {candidate.kind === 'new_method' ? (
          <Button
            size="sm"
            variant="outline"
            disabled={!mergeTarget.trim()}
            onClick={() => onDecide('merge', mergeTarget.trim())}
            icon={<Merge className="h-3.5 w-3.5" />}
          >
            {REVIEW_DECISION_NAMES.merge}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => onDecide('ignore')} icon={<X className="h-3.5 w-3.5" />}>
          {REVIEW_DECISION_NAMES.ignore}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
          {expanded ? '收起' : '更多选项'}
        </Button>
      </div>
    </li>
  );
}
