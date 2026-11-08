import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GraduationCap, Sparkles, Check, RotateCcw, BookOpen } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
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
import { MASTERY_LEVEL_NAMES, type MasteryLevel } from '@shared/types';

const MASTERY_TONE: Record<MasteryLevel, 'muted' | 'info' | 'primary' | 'success'> = {
  aware: 'muted',
  understand: 'info',
  master: 'primary',
  apply: 'success',
};

const MASTERY_ORDER: MasteryLevel[] = ['aware', 'understand', 'master', 'apply'];

export default function Learning() {
  const [tab, setTab] = useState<'plan' | 'tasks' | 'mastery'>('plan');
  const queryClient = useQueryClient();
  const showToast = useAppStore((s) => s.showToast);
  const online = useAppStore((s) => s.online);

  const learningQuery = useQuery({
    queryKey: ['learning'],
    queryFn: async () => {
      const res = await api.learning();
      return { ...res.data, stale: res.stale };
    },
  });

  const methodsQuery = useMethods();
  const methods = methodsQuery.data?.methods ?? [];
  const nameMap = useMemo(() => buildNameMap(methods), [methods]);

  const [goal, setGoal] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const planMutation = useMutation({
    mutationFn: async () => {
      const res = await api.createLearningPlan(goal.trim(), selectedIds);
      return res.data;
    },
    onSuccess: () => {
      showToast('学习计划已生成', 'success');
      setGoal('');
      setSelectedIds([]);
      setTab('tasks');
      void queryClient.invalidateQueries({ queryKey: ['learning'] });
    },
    onError: (err: unknown) => {
      showToast(err instanceof Error ? err.message : '生成失败', 'error');
    },
  });

  const answerMutation = useMutation({
    mutationFn: async (input: { quizId: string; answer: number[] }) => {
      const res = await api.answerQuiz(input.quizId, input.answer);
      return res.data;
    },
    onSuccess: (data) => {
      showToast(data.correct ? '回答正确' : '回答错误', data.correct ? 'success' : 'error');
      void queryClient.invalidateQueries({ queryKey: ['learning'] });
    },
    onError: (err: unknown) => {
      showToast(err instanceof Error ? err.message : '提交失败', 'error');
    },
  });

  if (learningQuery.isLoading) return <LoadingBlock />;

  const plans = learningQuery.data?.plans ?? [];
  const tasks = learningQuery.data?.tasks ?? [];
  const quizzes = learningQuery.data?.quizzes ?? [];
  const mastery = learningQuery.data?.mastery ?? [];

  const masteryByMethod = new Map<string, MasteryLevel>();
  for (const m of mastery) masteryByMethod.set(m.methodId, m.level);

  const dueTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'archived');

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">学习中心</h1>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          AI 根据知识库、你的目标和学习记录生成个性化学习路径
        </p>
      </header>

      {!online ? (
        <Alert kind="warning" title="离线模式">
          生成学习计划和提交测验需要联网。已缓存的学习资料仍可阅读。
        </Alert>
      ) : null}

      {/* 生成计划 */}
      <Card>
        <CardHeader title="生成学习计划" description="说明你想达成什么，AI 会安排学习路径" />
        <CardBody className="space-y-3">
          <div>
            <Label>学习目标</Label>
            <Textarea
              rows={2}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="例如：三个月内掌握团队管理领域的方法论，能独立主持一次目标制定会"
            />
          </div>
          <div>
            <Label>指定方法论（可留空，由 AI 挑选）</Label>
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
              {methods.length === 0 ? (
                <p className="px-1 py-2 text-[11px] text-slate-400">知识库为空</p>
              ) : (
                methods.map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(m.id)}
                      onChange={(e) =>
                        setSelectedIds((prev) =>
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
          <Button
            size="sm"
            loading={planMutation.isPending}
            disabled={!goal.trim() || !online}
            onClick={() => planMutation.mutate()}
            icon={<Sparkles className="h-3.5 w-3.5" />}
          >
            生成计划
          </Button>
        </CardBody>
      </Card>

      <Card>
        <Tabs
          items={[
            { id: 'plan', label: '学习计划', count: plans.length },
            { id: 'tasks', label: '学习任务', count: dueTasks.length },
            { id: 'mastery', label: '掌握程度', count: mastery.length },
          ]}
          active={tab}
          onChange={(t) => setTab(t as typeof tab)}
          className="px-2"
        />
        <CardBody>
          {tab === 'plan' ? (
            plans.length === 0 ? (
              <Empty
                icon={<GraduationCap className="h-10 w-10" />}
                title="还没有学习计划"
                description="填写上面的学习目标，AI 会生成学习路径、测验和复习安排。"
              />
            ) : (
              <ul className="space-y-2.5">
                {plans.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{p.title}</p>
                      <Badge tone={p.status === 'active' ? 'primary' : 'muted'}>
                        {p.status === 'active' ? '进行中' : p.status === 'completed' ? '已完成' : '已归档'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {p.goal}
                    </p>
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      {p.taskIds.length} 项任务
                      {p.period ? ` · ${formatDate(p.period.start)} 至 ${formatDate(p.period.end)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === 'tasks' ? (
            tasks.length === 0 ? (
              <Empty title="暂无学习任务" description="生成学习计划后，这里会列出具体的学习任务与测验。" />
            ) : (
              <ul className="space-y-2.5">
                {tasks.map((t) => {
                  const quiz = quizzes.find((q) => q.id === t.quizIds[0]);
                  return (
                    <li
                      key={t.id}
                      className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.title}</p>
                        <div className="flex items-center gap-1.5">
                          <Badge tone={MASTERY_TONE[t.mastery]}>
                            {MASTERY_LEVEL_NAMES[t.mastery]}
                          </Badge>
                          <Badge tone={t.status === 'completed' ? 'success' : 'muted'}>
                            {t.status === 'completed' ? '已完成' : t.status === 'in_progress' ? '进行中' : '待开始'}
                          </Badge>
                        </div>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {t.objective}
                      </p>
                      {t.methodIds.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {t.methodIds.map((mid) => (
                            <Link key={mid} to={`/method/${mid}`}>
                              <Badge tone="info">{nameMap.get(mid) ?? mid}</Badge>
                            </Link>
                          ))}
                        </div>
                      ) : null}
                      {t.keyPoints.length > 0 ? (
                        <ul className="mt-2 space-y-0.5">
                          {t.keyPoints.map((k, i) => (
                            <li key={i} className="text-[11px] text-slate-500 dark:text-slate-400">
                              · {k}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {t.reviewAt ? (
                        <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                          <RotateCcw className="h-3 w-3" />
                          复习时间：{formatRelative(t.reviewAt)}
                        </p>
                      ) : null}
                      {quiz ? (
                        <QuizBlock
                          quiz={quiz}
                          onAnswer={(answer) => answerMutation.mutate({ quizId: quiz.id, answer })}
                          busy={answerMutation.isPending}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}

          {tab === 'mastery' ? (
            mastery.length === 0 ? (
              <Empty
                title="还没有掌握程度记录"
                description="完成阅读、测验或实践后，系统会更新每个方法论的掌握程度。"
              />
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-4">
                  {MASTERY_ORDER.map((level) => {
                    const count = mastery.filter((m) => m.level === level).length;
                    return (
                      <div
                        key={level}
                        className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800"
                      >
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {MASTERY_LEVEL_NAMES[level]}
                        </p>
                        <p className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {count > 0 ? count : ''}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <ul className="space-y-1.5">
                  {mastery.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
                    >
                      <Link
                        to={`/method/${m.methodId}`}
                        className="min-w-0 flex-1 truncate text-xs font-medium text-sky-700 hover:underline dark:text-sky-400"
                      >
                        {nameMap.get(m.methodId) ?? m.methodId}
                      </Link>
                      <Badge tone={MASTERY_TONE[m.level]}>{MASTERY_LEVEL_NAMES[m.level]}</Badge>
                      <span className="shrink-0 text-[11px] text-slate-400">
                        {formatRelative(m.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}

function QuizBlock({
  quiz,
  onAnswer,
  busy,
}: {
  quiz: {
    id: string;
    question: string;
    kind: string;
    options?: string[];
    explanation: string;
  };
  onAnswer: (answer: number[]) => void;
  busy: boolean;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);

  const isChoice = quiz.kind === 'single_choice' || quiz.kind === 'multi_choice' || quiz.kind === 'true_false';

  const submit = () => {
    onAnswer(selected);
    setRevealed(true);
  };

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40">
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
        <BookOpen className="h-3.5 w-3.5" />
        {quiz.question}
      </p>
      {isChoice && quiz.options ? (
        <ul className="mt-2 space-y-1">
          {quiz.options.map((opt, i) => (
            <li key={i}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-900">
                <input
                  type={quiz.kind === 'multi_choice' ? 'checkbox' : 'radio'}
                  name={`quiz-${quiz.id}`}
                  checked={selected.includes(i)}
                  onChange={(e) =>
                    setSelected((prev) =>
                      e.target.checked
                        ? [...prev, i]
                        : prev.filter((x) => x !== i),
                    )
                  }
                  className="h-3.5 w-3.5 text-sky-600"
                />
                <span>{opt}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <Textarea
          rows={2}
          placeholder="写下你的答案"
          onChange={(e) => setSelected([e.target.value] as unknown as number[])}
          className="mt-2"
        />
      )}
      <div className="mt-2 flex items-center gap-2">
        <Button
          size="sm"
          loading={busy}
          disabled={selected.length === 0}
          onClick={submit}
          icon={<Check className="h-3.5 w-3.5" />}
        >
          提交
        </Button>
        {revealed ? (
          <span className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {quiz.explanation}
          </span>
        ) : null}
      </div>
    </div>
  );
}
