import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Search as SearchIcon, Sparkles, Target, AlertTriangle } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Textarea,
  LoadingBlock,
  Empty,
  Badge,
  Alert,
} from '../components/ui';
import { EvidenceBadge } from '../components/EvidenceBadge';
import { api, ApiError } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { formatPercent } from '../lib/format';
import type { RecommendationResult } from '@shared/types';

const EXAMPLES = [
  '如何提高团队执行力？',
  '如何建立有效的绩效管理机制？',
  '如何提高个人学习效率？',
  '如何解决团队内部沟通冲突？',
  '如何判断一项决策是否值得投入？',
];

export default function SearchPage() {
  const [question, setQuestion] = useState('');
  const online = useAppStore((s) => s.online);
  const showToast = useAppStore((s) => s.showToast);

  const askMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await api.ask(q);
      return res.data;
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : '请求失败';
      showToast(msg, 'error');
    },
  });

  const result = askMutation.data;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">智能搜索与场景推荐</h1>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          用实际问题提问，AI 会先检索知识库再作答，而不是凭模型记忆泛泛而谈
        </p>
      </header>

      {!online ? (
        <Alert kind="warning" title="离线模式">
          智能问答需要联网调用 AI 模型，离线状态下无法完成。已缓存的方法论仍可正常浏览。
        </Alert>
      ) : null}

      <Card>
        <CardBody className="space-y-3">
          <Textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="描述你正在面对的实际问题，例如：团队执行力不足该怎么改善？"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && question.trim()) {
                askMutation.mutate(question.trim());
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-400">试试：</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setQuestion(ex)}
                className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {ex}
              </button>
            ))}
            <div className="ml-auto">
              <Button
                size="sm"
                loading={askMutation.isPending}
                disabled={!question.trim() || !online}
                onClick={() => askMutation.mutate(question.trim())}
                icon={<Sparkles className="h-3.5 w-3.5" />}
              >
                提问
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {askMutation.isPending ? <LoadingBlock label="正在检索知识库并生成回答" /> : null}

      {askMutation.isError ? (
        <Alert kind="danger" title="请求失败">
          {askMutation.error instanceof Error ? askMutation.error.message : '未知错误'}
        </Alert>
      ) : null}

      {result ? <ResultView result={result} /> : null}

      {!askMutation.isPending && !result ? (
        <Card>
          <Empty
            icon={<SearchIcon className="h-10 w-10" />}
            title="输入一个实际问题"
            description="推荐结果会包含问题理解、推荐方法论、推荐理由、适用条件、实施步骤、注意事项与参考来源。"
          />
        </Card>
      ) : null}
    </div>
  );
}

function ResultView({ result }: { result: RecommendationResult }) {
  return (
    <div className="space-y-4">
      {/* 问题理解 */}
      <Card>
        <CardHeader title="问题理解" description="AI 对你问题的解析" />
        <CardBody>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {result.understanding}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
            {result.provenance.fromKnowledgeBase ? (
              <Badge tone="success">基于知识库</Badge>
            ) : (
              <Badge tone="warning">知识库未命中</Badge>
            )}
            {result.provenance.usedWebSearch ? <Badge tone="info">含联网检索</Badge> : null}
            {result.provenance.aiInference.length > 0 ? (
              <Badge tone="muted">含 AI 推断 {result.provenance.aiInference.length} 项</Badge>
            ) : null}
            {result.model ? <Badge tone="muted">{result.model}</Badge> : null}
          </div>
        </CardBody>
      </Card>

      {/* 推荐方法论 */}
      {result.methods.length > 0 ? (
        <div className="space-y-3">
          {result.methods.map((m, idx) => (
            <Card key={m.methodId}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-sky-100 text-[11px] font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                      {idx + 1}
                    </span>
                    <Link
                      to={`/method/${m.methodId}`}
                      className="hover:text-sky-600 hover:underline dark:hover:text-sky-400"
                    >
                      {m.name}
                    </Link>
                  </span>
                }
                description={`推荐度 ${formatPercent(m.score)}`}
                action={<EvidenceBadge level={m.evidenceLevel} />}
              />
              <CardBody className="space-y-3">
                <div>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">推荐理由</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    {m.reason}
                  </p>
                </div>

                {m.conditions.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">适用条件</p>
                    <ul className="mt-1 space-y-0.5">
                      {m.conditions.map((c, i) => (
                        <li key={i} className="text-xs text-slate-600 dark:text-slate-400">
                          · {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {m.steps.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">实施步骤</p>
                    <ol className="mt-1 space-y-0.5">
                      {m.steps.map((s, i) => (
                        <li key={i} className="text-xs text-slate-600 dark:text-slate-400">
                          {i + 1}. {s}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                {m.cautions.length > 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/40">
                    <p className="flex items-center gap-1 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-3 w-3" />
                      注意事项
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {m.cautions.map((c, i) => (
                        <li key={i} className="text-xs text-amber-900/80 dark:text-amber-200/80">
                          · {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <Link to={`/practice?method=${m.methodId}`}>
                  <Button size="sm" variant="secondary" icon={<Target className="h-3.5 w-3.5" />}>
                    用它建立实践项目
                  </Button>
                </Link>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Empty
            title="知识库中没有匹配的方法论"
            description="可以先发起一次 AI 研究补充相关方法论。"
          />
        </Card>
      )}

      {/* 组合逻辑 */}
      {result.combinationLogic ? (
        <Card>
          <CardHeader title="组合逻辑" description="这些方法论如何配合使用" />
          <CardBody>
            <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              {result.combinationLogic}
            </p>
          </CardBody>
        </Card>
      ) : null}

      {/* 检索命中 */}
      {result.hits.length > 0 ? (
        <Card>
          <CardHeader title="知识库命中" description="答案所依据的知识库条目" />
          <CardBody>
            <ul className="space-y-1.5">
              {result.hits.map((h) => (
                <li
                  key={h.methodId}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Link
                    to={`/method/${h.methodId}`}
                    className="min-w-0 flex-1 truncate text-xs font-medium text-sky-700 hover:underline dark:text-sky-400"
                  >
                    {h.methodName}
                  </Link>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    综合 {formatPercent(h.score)}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {/* AI 推断声明 */}
      {result.provenance.aiInference.length > 0 ? (
        <Card>
          <CardHeader
            title="AI 推断部分"
            description="以下内容不是知识库原文，也不是研究证据"
            action={<Badge tone="warning">需自行判断</Badge>}
          />
          <CardBody>
            <ul className="space-y-1">
              {result.provenance.aiInference.map((item, i) => (
                <li key={i} className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  · {item}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
