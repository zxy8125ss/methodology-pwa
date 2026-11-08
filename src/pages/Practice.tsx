import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Target, Plus, Check, Sparkles, ArrowLeft, Lightbulb } from 'lucide-react';
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
  Alert,
  Tabs,
} from '../components/ui';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { useMethods, buildNameMap } from '../hooks/useKnowledge';
import { formatDate, formatRelative } from '../lib/format';
import { uid } from '../lib/utils';
import type { Practice } from '@shared/types';

const STATUS_LABEL: Record<Practice['status'], string> = {
  planning: '规划中',
  active: '进行中',
  completed: '已完成',
  abandoned: '已放弃',
};

export default function PracticePage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const showToast = useAppStore((s) => s.showToast);
  const [creating, setCreating] = useState(false);

  const practicesQuery = useQuery({
    queryKey: ['practices'],
    queryFn: async () => {
      const res = await api.listPractices();
      return { practices: res.data.practices, stale: res.stale };
    },
  });

  const methodsQuery = useMethods();
  const methods = methodsQuery.data?.methods ?? [];
  const nameMap = useMemo(() => buildNameMap(methods), [methods]);

  const practices = practicesQuery.data?.practices ?? [];
  const current = id ? practices.find((p) => p.id === id) : undefined;

  // 从搜索页跳转过来时自动打开创建面板
  useEffect(() => {
    if (params.get('method')) setCreating(true);
  }, [params]);

  if (practicesQuery.isLoading) return <LoadingBlock />;

  if (current) {
    return <PracticeDetail practice={current} nameMap={nameMap} />;
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">实践中心</h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            记录实际应用过程，用真实数据检验方法论是否有效
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating((v) => !v)} icon={<Plus className="h-3.5 w-3.5" />}>
          新建实践
        </Button>
      </header>

      {practicesQuery.data?.stale ? (
        <Alert kind="warning">当前为离线缓存数据，修改操作需要联网。</Alert>
      ) : null}

      {creating ? (
        <CreatePractice
          methods={methods}
          presetMethodId={params.get('method') ?? undefined}
          onCancel={() => setCreating(false)}
          onCreated={async (newId) => {
            setCreating(false);
            showToast('实践项目已创建', 'success');
            await queryClient.invalidateQueries({ queryKey: ['practices'] });
            window.location.hash = `#/practice/${newId}`;
          }}
        />
      ) : null}

      {practices.length === 0 && !creating ? (
        <Card>
          <Empty
            icon={<Target className="h-10 w-10" />}
            title="还没有实践项目"
            description="实践不是随手记笔记，而是一份可验证的数据资产。从搜索结果或方法论详情页创建。"
            action={
              <Button onClick={() => setCreating(true)} icon={<Plus className="h-3.5 w-3.5" />}>
                创建第一个实践
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {practices.map((p) => (
            <Link key={p.id} to={`/practice/${p.id}`}>
              <Card className="h-full p-4 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{p.name}</h3>
                  <Badge
                    tone={
                      p.status === 'completed'
                        ? 'success'
                        : p.status === 'active'
                          ? 'primary'
                          : p.status === 'abandoned'
                            ? 'danger'
                            : 'muted'
                    }
                  >
                    {STATUS_LABEL[p.status]}
                  </Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {p.problem}
                </p>
                {p.methodIds.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {p.methodIds.map((mid) => (
                      <Badge key={mid} tone="info">
                        {nameMap.get(mid) ?? mid}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-400 dark:border-slate-800">
                  开始于 {formatDate(p.startedAt)}
                  {p.evaluation?.goalCompletion !== null &&
                  p.evaluation?.goalCompletion !== undefined ? (
                    <span> · 目标完成度 {p.evaluation.goalCompletion}%</span>
                  ) : null}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ 新建实践 ------------------------------ */

function CreatePractice({
  methods,
  presetMethodId,
  onCancel,
  onCreated,
}: {
  methods: Array<{ id: string; name: string; content: { coreIdea?: string | null; steps: string[] } }>;
  presetMethodId?: string;
  onCancel: () => void;
  onCreated: (id: string) => void | Promise<void>;
}) {
  const showToast = useAppStore((s) => s.showToast);
  const [name, setName] = useState('');
  const [problem, setProblem] = useState('');
  const [expected, setExpected] = useState('');
  const [methodIds, setMethodIds] = useState<string[]>(presetMethodId ? [presetMethodId] : []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const practice: Practice = {
        id: uid('practice'),
        name: name.trim(),
        problem: problem.trim(),
        methodIds,
        expectedOutcome: expected.trim(),
        plan: null,
        steps: [],
        startedAt: now,
        endedAt: null,
        cost: null,
        status: 'planning',
        logs: [],
        result: null,
        reflection: null,
        aiReview: null,
        evaluation: null,
        createdAt: now,
        updatedAt: now,
      };
      await api.savePractice(practice);
      return practice.id;
    },
    onSuccess: (newId) => void onCreated(newId),
    onError: (err: unknown) => {
      showToast(err instanceof Error ? err.message : '创建失败', 'error');
    },
  });

  const valid = name.trim() && problem.trim() && expected.trim();

  return (
    <Card>
      <CardHeader title="新建实践项目" description="明确要解决的问题和期望效果" />
      <CardBody className="space-y-3">
        <div>
          <Label>项目名称</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：Q3 团队执行机制改进"
          />
        </div>
        <div>
          <Label>实际问题</Label>
          <Textarea
            rows={2}
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="要解决的是什么问题？现状如何？"
          />
        </div>
        <div>
          <Label>预期目标</Label>
          <Textarea
            rows={2}
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            placeholder="希望达成什么效果？如何判断达成了？"
          />
        </div>
        <div>
          <Label>关联方法论（可多选）</Label>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
            {methods.length === 0 ? (
              <p className="px-1 py-2 text-[11px] text-slate-400">知识库为空，暂时无法选择方法论</p>
            ) : (
              methods.map((m) => (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={methodIds.includes(m.id)}
                    onChange={(e) =>
                      setMethodIds((prev) =>
                        e.target.checked ? [...prev, m.id] : prev.filter((x) => x !== m.id),
                      )
                    }
                    className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600"
                  />
                  <span className="text-xs text-slate-700 dark:text-slate-300">{m.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            loading={saveMutation.isPending}
            disabled={!valid}
            onClick={() => saveMutation.mutate()}
          >
            创建
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            取消
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/* ------------------------------ 实践详情 ------------------------------ */

function PracticeDetail({
  practice,
  nameMap,
}: {
  practice: Practice;
  nameMap: Map<string, string>;
}) {
  const queryClient = useQueryClient();
  const showToast = useAppStore((s) => s.showToast);
  const online = useAppStore((s) => s.online);
  const [tab, setTab] = useState<'plan' | 'log' | 'result' | 'review'>('plan');
  const [draft, setDraft] = useState(practice);

  useEffect(() => {
    setDraft(practice);
  }, [practice]);

  const saveMutation = useMutation({
    mutationFn: async (next: Practice) => {
      await api.savePractice(next);
    },
    onSuccess: () => {
      showToast('已保存', 'success');
      void queryClient.invalidateQueries({ queryKey: ['practices'] });
    },
    onError: (err: unknown) => {
      showToast(err instanceof Error ? err.message : '保存失败', 'error');
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const res = await api.reviewPractice(practice.id, {
        logs: draft.logs,
        result: draft.result ?? undefined,
        reflection: draft.reflection ?? undefined,
        evaluation: draft.evaluation ?? undefined,
      });
      return res.data.review;
    },
    onSuccess: (review) => {
      setDraft((d) => ({ ...d, aiReview: review }));
      showToast('AI 复盘已生成', 'success');
      void queryClient.invalidateQueries({ queryKey: ['practices'] });
    },
    onError: (err: unknown) => {
      showToast(err instanceof Error ? err.message : '复盘失败', 'error');
    },
  });

  const toggleStep = (index: number) => {
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((s, i) =>
        i === index ? { ...s, done: !s.done, doneAt: !s.done ? new Date().toISOString() : null } : s,
      ),
    }));
  };

  const addStep = () => {
    setDraft((d) => ({
      ...d,
      steps: [...d.steps, { text: '', done: false, doneAt: null }],
    }));
  };

  const addLog = (kind: Practice['logs'][number]['kind'], content: string) => {
    setDraft((d) => ({
      ...d,
      logs: [
        ...d.logs,
        { id: uid('log'), at: new Date().toISOString(), kind, content },
      ],
    }));
  };

  const hasRealData =
    draft.logs.length > 0 || !!draft.result || !!draft.evaluation?.actualEffect;

  return (
    <div className="space-y-4">
      <Link
        to="/practice"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        返回实践中心
      </Link>

      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{practice.name}</h1>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {practice.problem}
              </p>
            </div>
            <Badge tone={practice.status === 'completed' ? 'success' : 'primary'}>
              {STATUS_LABEL[practice.status]}
            </Badge>
          </div>

          {practice.methodIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400">使用方法论</span>
              {practice.methodIds.map((mid) => (
                <Link key={mid} to={`/method/${mid}`}>
                  <Badge tone="info">{nameMap.get(mid) ?? mid}</Badge>
                </Link>
              ))}
            </div>
          ) : null}

          <dl className="grid gap-x-6 gap-y-1.5 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2 dark:border-slate-800">
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-slate-400">预期目标</dt>
              <dd className="flex-1 text-slate-700 dark:text-slate-300">{practice.expectedOutcome}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-slate-400">开始时间</dt>
              <dd className="flex-1 text-slate-700 dark:text-slate-300">{formatDate(practice.startedAt)}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <Card>
        <Tabs
          items={[
            { id: 'plan', label: '执行计划' },
            { id: 'log', label: '过程记录', count: draft.logs.length },
            { id: 'result', label: '结果与评价' },
            { id: 'review', label: 'AI 复盘' },
          ]}
          active={tab}
          onChange={(t) => setTab(t as typeof tab)}
          className="px-2"
        />
        <CardBody>
          {tab === 'plan' ? (
            <div className="space-y-3">
              <ul className="space-y-1.5">
                {draft.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <button
                      onClick={() => toggleStep(i)}
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-300 text-white transition-colors dark:border-slate-600"
                      style={s.done ? { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' } : undefined}
                      aria-label={s.done ? '标记为未完成' : '标记为完成'}
                    >
                      {s.done ? <Check className="h-3 w-3" /> : null}
                    </button>
                    <input
                      value={s.text}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          steps: d.steps.map((x, j) =>
                            j === i ? { ...x, text: e.target.value } : x,
                          ),
                        }))
                      }
                      placeholder="步骤内容"
                      className="min-w-0 flex-1 border-b border-transparent bg-transparent text-xs text-slate-700 outline-none focus:border-sky-500 dark:text-slate-300"
                    />
                  </li>
                ))}
              </ul>
              <Button size="sm" variant="ghost" onClick={addStep} icon={<Plus className="h-3.5 w-3.5" />}>
                添加步骤
              </Button>
            </div>
          ) : null}

          {tab === 'log' ? <LogPanel logs={draft.logs} onAdd={addLog} /> : null}

          {tab === 'result' ? (
            <ResultPanel draft={draft} setDraft={setDraft} />
          ) : null}

          {tab === 'review' ? (
            <div className="space-y-3">
              {!hasRealData ? (
                <Alert kind="warning" title="缺少实际执行数据">
                  AI 复盘只能基于你填写的执行记录、实际结果和效果评价。
                  没有这些数据，AI 无法判断方法论是否有效，也不会编造执行进度或效果。
                </Alert>
              ) : null}
              <Button
                size="sm"
                loading={reviewMutation.isPending}
                disabled={!hasRealData || !online}
                onClick={() => reviewMutation.mutate()}
                icon={<Sparkles className="h-3.5 w-3.5" />}
              >
                生成 AI 复盘
              </Button>
              {draft.aiReview ? (
                <ReviewView review={draft.aiReview} />
              ) : null}
            </div>
          ) : null}
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          loading={saveMutation.isPending}
          onClick={() => saveMutation.mutate(draft)}
        >
          保存实践记录
        </Button>
      </div>
    </div>
  );
}

function LogPanel({
  logs,
  onAdd,
}: {
  logs: Practice['logs'];
  onAdd: (kind: Practice['logs'][number]['kind'], content: string) => void;
}) {
  const [kind, setKind] = useState<Practice['logs'][number]['kind']>('progress');
  const [content, setContent] = useState('');

  const KIND_LABEL = {
    progress: '进展',
    blocker: '阻碍',
    decision: '决策',
    change: '变更',
    result: '结果',
  } as const;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(KIND_LABEL) as Array<typeof kind>).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={
              kind === k
                ? 'rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-medium text-white'
                : 'rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="记录一条过程信息"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && content.trim()) {
              onAdd(kind, content.trim());
              setContent('');
            }
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={!content.trim()}
          onClick={() => {
            onAdd(kind, content.trim());
            setContent('');
          }}
        >
          添加
        </Button>
      </div>
      {logs.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-400">还没有过程记录</p>
      ) : (
        <ul className="space-y-1.5">
          {[...logs].reverse().map((log) => (
            <li
              key={log.id}
              className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
            >
              <div className="flex items-center gap-2">
                <Badge tone="muted">{KIND_LABEL[log.kind]}</Badge>
                <span className="text-[11px] text-slate-400">
                  {formatRelative(log.at)}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                {log.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultPanel({
  draft,
  setDraft,
}: {
  draft: Practice;
  setDraft: React.Dispatch<React.SetStateAction<Practice>>;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label>最终结果</Label>
        <Textarea
          rows={3}
          value={draft.result ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, result: e.target.value }))}
          placeholder="实际发生了什么？写具体的事实，不要写感受"
        />
      </div>
      <div>
        <Label>个人反思</Label>
        <Textarea
          rows={3}
          value={draft.reflection ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, reflection: e.target.value }))}
          placeholder="你的判断：哪里有效，哪里失效，为什么"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>目标完成度（%）</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={draft.evaluation?.goalCompletion ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                evaluation: {
                  goalCompletion: e.target.value === '' ? null : Number(e.target.value),
                  processRating: d.evaluation?.processRating ?? null,
                  actualEffect: d.evaluation?.actualEffect ?? null,
                  timeSpent: d.evaluation?.timeSpent ?? null,
                  costIncurred: d.evaluation?.costIncurred ?? null,
                  longTerm: d.evaluation?.longTerm ?? null,
                  contextConditions: d.evaluation?.contextConditions ?? null,
                  evaluatedAt: d.evaluation?.evaluatedAt ?? new Date().toISOString(),
                },
              }))
            }
            placeholder="0-100"
          />
        </div>
        <div>
          <Label>投入时间（小时）</Label>
          <Input
            type="number"
            min={0}
            step="0.5"
            value={draft.evaluation?.timeSpent ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                evaluation: {
                  goalCompletion: d.evaluation?.goalCompletion ?? null,
                  processRating: d.evaluation?.processRating ?? null,
                  actualEffect: d.evaluation?.actualEffect ?? null,
                  timeSpent: e.target.value === '' ? null : Number(e.target.value),
                  costIncurred: d.evaluation?.costIncurred ?? null,
                  longTerm: d.evaluation?.longTerm ?? null,
                  contextConditions: d.evaluation?.contextConditions ?? null,
                  evaluatedAt: d.evaluation?.evaluatedAt ?? new Date().toISOString(),
                },
              }))
            }
          />
        </div>
      </div>
      <div>
        <Label>场景与适用条件</Label>
        <Textarea
          rows={2}
          value={draft.evaluation?.contextConditions ?? ''}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              evaluation: {
                goalCompletion: d.evaluation?.goalCompletion ?? null,
                processRating: d.evaluation?.processRating ?? null,
                actualEffect: d.evaluation?.actualEffect ?? null,
                timeSpent: d.evaluation?.timeSpent ?? null,
                costIncurred: d.evaluation?.costIncurred ?? null,
                longTerm: d.evaluation?.longTerm ?? null,
                contextConditions: e.target.value,
                evaluatedAt: d.evaluation?.evaluatedAt ?? new Date().toISOString(),
              },
            }))
          }
          placeholder="在什么环境下做的？团队规模、阶段、资源约束等。同一方法论在不同环境效果可能不同。"
        />
      </div>
    </div>
  );
}

function ReviewView({ review }: { review: NonNullable<Practice['aiReview']> }) {
  const sections: Array<{ title: string; body: string; items?: string[] }> = [
    { title: '方法论是否选对', body: review.methodFit },
    { title: '适用条件是否满足', body: review.conditionsMet },
    { title: '执行过程是否完整', body: review.executionCompleteness },
    { title: '哪些步骤发挥了作用', body: '', items: review.effectiveSteps },
    { title: '哪些因素影响结果', body: '', items: review.influencingFactors },
    { title: '是否存在其他解释', body: '', items: review.alternativeExplanations },
    { title: '下次如何改进', body: '', items: review.improvements },
  ];

  return (
    <div className="space-y-3">
      {review.needsMethodUpdate ? (
        <Alert kind="warning" title="建议更新方法论档案">
          AI 认为本次实践暴露了该方法论档案需要补充的内容。
        </Alert>
      ) : null}
      {sections.map((s) => (
        <div key={s.title} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
            {s.title}
          </p>
          {s.body ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{s.body}</p>
          ) : null}
          {s.items && s.items.length > 0 ? (
            <ul className="mt-1 space-y-0.5">
              {s.items.map((item, i) => (
                <li key={i} className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  · {item}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}
