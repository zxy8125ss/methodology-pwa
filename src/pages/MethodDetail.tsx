import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Brain, Scale, Users, Target, History, Link2 } from 'lucide-react';
import { Card, CardBody, LoadingBlock, Empty, Badge, Tabs, Button } from '../components/ui';
import { DomainBadge } from '../components/DomainBadge';
import { EvidenceBadge, EvidenceCategoryBadge } from '../components/EvidenceBadge';
import { RelationList } from '../components/RelationList';
import { Markdown } from '../components/Markdown';
import {
  useMethod,
  useMethods,
  useDomains,
  useRelations,
  useSources,
  useCases,
  buildNameMap,
  buildDomainMap,
} from '../hooks/useKnowledge';
import { formatDate, formatDateTime, formatPercent } from '../lib/format';
import {
  METHOD_STATUS_NAMES,
  METHOD_TYPE_NAMES,
  SOURCE_TYPE_NAMES,
  type Method,
  type Relation,
} from '@shared/types';

type TabId =
  | 'overview'
  | 'theory'
  | 'steps'
  | 'cases'
  | 'proscons'
  | 'related'
  | 'practice'
  | 'sources';

export default function MethodDetail() {
  const { id } = useParams<{ id: string }>();
  const methodQuery = useMethod(id);
  const methodsQuery = useMethods();
  const domainsQuery = useDomains();
  const relationsQuery = useRelations();
  const sourcesQuery = useSources();
  const casesQuery = useCases();
  const [tab, setTab] = useState<TabId>('overview');

  const methods = methodsQuery.data?.methods ?? [];
  const nameMap = useMemo(() => buildNameMap(methods), [methods]);
  const domainMap = useMemo(
    () => buildDomainMap(domainsQuery.data?.domains ?? []),
    [domainsQuery.data],
  );

  const method = methodQuery.data?.method;

  const relatedRelations = useMemo(() => {
    if (!method) return [];
    const relations = relationsQuery.data?.relations ?? [];
    return relations.filter((r) => r.fromId === method.id || r.toId === method.id);
  }, [relationsQuery.data, method]);

  const methodCases = useMemo(() => {
    if (!method) return [];
    const cases = casesQuery.data?.cases ?? [];
    return cases.filter((c) => c.methodIds.includes(method.id));
  }, [casesQuery.data, method]);

  const methodSources = useMemo(() => {
    if (!method) return [];
    const sources = sourcesQuery.data?.sources ?? [];
    const ids = new Set<string>([
      ...method.origin.sourceIds,
      ...method.evidence.claims.flatMap((c) => c.sourceIds),
    ]);
    return sources.filter((s) => ids.has(s.id));
  }, [sourcesQuery.data, method]);

  const practiceRecords = useMemo(() => {
    if (!method) return [];
    const relations = relationsQuery.data?.relations ?? [];
    void relations;
    return [];
  }, [relationsQuery.data, method]);

  if (methodQuery.isLoading) return <LoadingBlock />;

  if (!method) {
    return (
      <Card>
        <Empty
          title="未找到该方法论"
          description="它可能已被删除，或链接指向了旧版本。"
          action={
            <Link to="/library">
              <Button variant="secondary">返回方法论库</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: 'overview', label: '概览' },
    { id: 'theory', label: '理论原理' },
    { id: 'steps', label: '实施步骤' },
    { id: 'cases', label: '实际案例', count: methodCases.length },
    { id: 'proscons', label: '优缺点与局限' },
    { id: 'related', label: '相关方法', count: relatedRelations.length },
    { id: 'practice', label: '实践记录', count: practiceRecords.length },
    { id: 'sources', label: '来源与版本', count: methodSources.length },
  ];

  return (
    <div className="space-y-4">
      <Link
        to="/library"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        返回方法论库
      </Link>

      {/* 头部 */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{method.name}</h1>
              {method.aliases.length > 0 ? (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  别名：{method.aliases.join('、')}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <EvidenceBadge level={method.evidence.level} />
              <Badge tone="default">{METHOD_TYPE_NAMES[method.type]}</Badge>
              <Badge tone="muted">{METHOD_STATUS_NAMES[method.status]}</Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {method.domainIds.map((d) => (
              <DomainBadge key={d} id={d} name={domainMap.get(d)} />
            ))}
            {method.tags.map((t) => (
              <Badge key={t} tone="muted">
                {t}
              </Badge>
            ))}
          </div>

          {method.content.coreIdea ? (
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {method.content.coreIdea}
            </p>
          ) : null}

          <dl className="grid gap-x-6 gap-y-2 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2 dark:border-slate-800">
            <MetaRow label="提出者" value={method.origin.proposer} />
            <MetaRow label="首次提出" value={method.origin.firstProposedAt} />
            <MetaRow label="最近研究" value={formatDate(method.lastResearchedAt)} />
            <MetaRow
              label="可信度"
              value={method.evidence.confidence !== null ? formatPercent(method.evidence.confidence) : ''}
            />
          </dl>
        </CardBody>
      </Card>

      {/* 标签页 */}
      <Card>
        <Tabs items={tabs} active={tab} onChange={(t) => setTab(t as TabId)} className="px-2" />
        <CardBody className="min-h-[280px]">
          {tab === 'overview' ? <OverviewTab method={method} /> : null}
          {tab === 'theory' ? <TheoryTab method={method} /> : null}
          {tab === 'steps' ? <StepsTab method={method} /> : null}
          {tab === 'cases' ? <CasesTab cases={methodCases} /> : null}
          {tab === 'proscons' ? <ProsConsTab method={method} /> : null}
          {tab === 'related' ? (
            <RelatedTab
              relations={relatedRelations}
              nameMap={nameMap}
              methodId={method.id}
            />
          ) : null}
          {tab === 'practice' ? <PracticeTab method={method} /> : null}
          {tab === 'sources' ? (
            <SourcesTab
              method={method}
              sources={methodSources}
            />
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-slate-400">{label}</dt>
      <dd className="min-w-0 flex-1 text-slate-700 dark:text-slate-300">{value || ''}</dd>
    </div>
  );
}

/* --------------------------------- 概览 ---------------------------------- */

function OverviewTab({ method }: { method: Method }) {
  return (
    <div className="space-y-4">
      {method.article ? (
        <Markdown>{method.article}</Markdown>
      ) : method.content.mechanism ? (
        <section>
          <SectionTitle icon={<Brain className="h-4 w-4" />} title="运行原理" />
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {method.content.mechanism}
          </p>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <ListSection title="适用场景" items={method.content.scenarios} emptyText="尚未整理适用场景" />
        <ListSection title="成立前提" items={method.content.conditions} emptyText="尚未整理成立条件" />
      </div>

      {method.evidence.claims.length > 0 ? (
        <section>
          <SectionTitle icon={<Scale className="h-4 w-4" />} title="证据清单" />
          <ul className="space-y-2">
            {method.evidence.claims.map((claim) => (
              <li
                key={claim.id}
                className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <EvidenceCategoryBadge category={claim.category} />
                  {claim.sourceIds.length > 0 ? (
                    <span className="text-[11px] text-slate-400">
                      {claim.sourceIds.length} 项来源
                    </span>
                  ) : null}
                  <span className="ml-auto text-[11px] text-slate-400">
                    支撑度 {formatPercent(claim.strength)}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  {claim.statement}
                </p>
                {claim.notes ? (
                  <p className="mt-1 text-[11px] text-slate-400">注：{claim.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/* -------------------------------- 理论原理 -------------------------------- */

function TheoryTab({ method }: { method: Method }) {
  return (
    <div className="space-y-4">
      <section>
        <SectionTitle icon={<Brain className="h-4 w-4" />} title="核心理论" />
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {method.content.coreIdea || '尚未整理核心思想'}
        </p>
      </section>

      {method.content.mechanism ? (
        <section>
          <SectionTitle icon={<Scale className="h-4 w-4" />} title="为什么有效" />
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {method.content.mechanism}
          </p>
        </section>
      ) : null}

      <ListSection
        title="理论基础"
        items={method.content.principles}
        emptyText="尚未整理理论基础"
      />

      {method.article ? (
        <section>
          <SectionTitle icon={<BookOpen className="h-4 w-4" />} title="完整研究文章" />
          <Markdown>{method.article}</Markdown>
        </section>
      ) : null}
    </div>
  );
}

/* -------------------------------- 实施步骤 -------------------------------- */

function StepsTab({ method }: { method: Method }) {
  if (method.content.steps.length === 0) {
    return <p className="py-8 text-center text-xs text-slate-400">尚未整理实施步骤</p>;
  }
  return (
    <ol className="space-y-2.5">
      {method.content.steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[11px] font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            {i + 1}
          </span>
          <p className="flex-1 pt-0.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {step}
          </p>
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------- 实际案例 -------------------------------- */

function CasesTab({ cases }: { cases: Array<{ id: string; title: string; context?: string | null; action?: string | null; outcome?: string | null; organization?: string | null; evidenceLevel: Method['evidence']['level'] }> }) {
  if (cases.length === 0) {
    return <p className="py-8 text-center text-xs text-slate-400">尚未收录真实案例</p>;
  }
  return (
    <ul className="space-y-3">
      {cases.map((c) => (
        <li key={c.id} className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{c.title}</p>
            <EvidenceBadge level={c.evidenceLevel} />
          </div>
          {c.organization ? (
            <p className="mt-0.5 text-[11px] text-slate-400">主体：{c.organization}</p>
          ) : null}
          <div className="mt-2 space-y-1.5 text-xs leading-relaxed">
            {c.context ? (
              <p className="text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">背景：</span>
                {c.context}
              </p>
            ) : null}
            {c.action ? (
              <p className="text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">做法：</span>
                {c.action}
              </p>
            ) : null}
            {c.outcome ? (
              <p className="text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">结果：</span>
                {c.outcome}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------ 优缺点与局限 ------------------------------ */

function ProsConsTab({ method }: { method: Method }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <ListSection
          title="主要价值"
          items={method.content.advantages}
          emptyText="尚未整理优点"
          tone="success"
        />
        <ListSection
          title="主要不足"
          items={method.content.disadvantages}
          emptyText="尚未整理缺点"
          tone="danger"
        />
      </div>
      <ListSection
        title="不适用的情况"
        items={method.content.limitations}
        emptyText="尚未整理局限性"
      />
      <ListSection
        title="常见误区"
        items={method.content.misconceptions}
        emptyText="尚未整理误区"
        tone="warning"
      />
    </div>
  );
}

/* -------------------------------- 相关方法 -------------------------------- */

function RelatedTab({
  relations,
  nameMap,
  methodId,
}: {
  relations: Relation[];
  nameMap: Map<string, string>;
  methodId: string;
}) {
  const outgoing = relations.filter((r) => r.fromId === methodId);
  const incoming = relations.filter((r) => r.toId === methodId);

  if (relations.length === 0) {
    return (
      <Empty
        title="暂无关联记录"
        description="关联关系会在 AI 研究入库时自动识别建立。"
      />
    );
  }

  return (
    <div className="space-y-4">
      <section>
        <SectionTitle icon={<Link2 className="h-4 w-4" />} title="本方法关联到" />
        <RelationList relations={outgoing} nameMap={nameMap} />
      </section>
      {incoming.length > 0 ? (
        <section>
          <SectionTitle icon={<Link2 className="h-4 w-4" />} title="其他方法关联到本方法" />
          <RelationList relations={incoming} nameMap={nameMap} />
        </section>
      ) : null}
    </div>
  );
}

/* -------------------------------- 实践记录 -------------------------------- */

function PracticeTab({ method }: { method: Method }) {
  return (
    <div className="space-y-4">
      <AlertBox>
        实践记录由你在「实践中心」中创建和填写。AI 只能基于你实际填写的执行记录做复盘，不会虚构执行进度或效果。
      </AlertBox>

      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
        <Users className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          还没有针对「{method.name}」的实践项目
        </p>
        <Link to="/practice" className="mt-3 inline-block">
          <Button size="sm" variant="secondary" icon={<Target className="h-3.5 w-3.5" />}>
            去实践中心创建
          </Button>
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------ 来源与版本历史 ------------------------------ */

function SourcesTab({
  method,
  sources,
}: {
  method: Method;
  sources: Array<{
    id: string;
    title: string;
    authorOrOrg?: string | null;
    url?: string | null;
    type: keyof typeof SOURCE_TYPE_NAMES;
    publishedAt?: string | null;
    credibility: number;
    supports: string[];
  }>;
}) {
  return (
    <div className="space-y-4">
      <section>
        <SectionTitle icon={<BookOpen className="h-4 w-4" />} title="研究来源" />
        {sources.length === 0 ? (
          <p className="text-xs text-slate-400">尚未记录研究来源</p>
        ) : (
          <ul className="space-y-2">
            {sources.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    {s.url ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="hover:text-sky-600 hover:underline dark:hover:text-sky-400"
                      >
                        {s.title}
                      </a>
                    ) : (
                      s.title
                    )}
                  </p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge tone="muted">{SOURCE_TYPE_NAMES[s.type]}</Badge>
                    <span className="text-[11px] text-slate-400">
                      可信度 {formatPercent(s.credibility)}
                    </span>
                  </div>
                </div>
                {s.authorOrOrg ? (
                  <p className="mt-0.5 text-[11px] text-slate-400">{s.authorOrOrg}</p>
                ) : null}
                {s.supports.length > 0 ? (
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    支持结论：{s.supports.join('；')}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle icon={<History className="h-4 w-4" />} title="版本历史" />
        {method.history && method.history.length > 0 ? (
          <ol className="space-y-2">
            {method.history.map((h) => (
              <li
                key={`${h.version}-${h.at}`}
                className="flex gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800"
              >
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  v{h.version}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{h.summary}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {formatDateTime(h.at)} · {h.by === 'ai' ? 'AI' : h.by === 'user' ? '用户' : '系统'}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-slate-400">暂无版本记录</p>
        )}
      </section>
    </div>
  );
}

/* --------------------------------- 工具 ---------------------------------- */

function SectionTitle({ icon, title }: { icon?: React.ReactNode; title: string }) {
  return (
    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {icon}
      {title}
    </h3>
  );
}

function ListSection({
  title,
  items,
  emptyText,
  tone = 'default',
}: {
  title: string;
  items: string[];
  emptyText: string;
  tone?: 'default' | 'success' | 'danger' | 'warning';
}) {
  const dotColor = {
    default: 'bg-slate-400',
    success: 'bg-emerald-500',
    danger: 'bg-red-500',
    warning: 'bg-amber-500',
  }[tone];

  return (
    <section>
      <SectionTitle title={title} />
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
              <span className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AlertBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-xs leading-relaxed text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
      {children}
    </div>
  );
}
