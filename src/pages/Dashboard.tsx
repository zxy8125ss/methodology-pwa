import { Link } from 'react-router-dom';
import {
  Library,
  FlaskConical,
  Target,
  GraduationCap,
  Network,
  Search,
  Sparkles,
  AlertTriangle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { Card, CardHeader, CardBody, Stat, Empty, Button, Badge, LoadingBlock, Alert } from '../components/ui';
import { MethodCard } from '../components/MethodCard';
import { useMethods, useDomains, buildDomainMap } from '../hooks/useKnowledge';
import { formatRelative } from '../lib/format';
import { DOMAIN_IDS, DOMAIN_DEFAULT_NAMES } from '@shared/types';

export default function Dashboard() {
  const methodsQuery = useMethods();
  const domainsQuery = useDomains();

  if (methodsQuery.isLoading || domainsQuery.isLoading) return <LoadingBlock />;

  const methods = methodsQuery.data?.methods ?? [];
  const domains = domainsQuery.data?.domains ?? [];
  const domainMap = buildDomainMap(domains.length ? domains : []);

  // 领域分布
  const distribution = DOMAIN_IDS.map((id) => ({
    id,
    name: domainMap.get(id) ?? DOMAIN_DEFAULT_NAMES[id],
    count: methods.filter((m) => m.domainIds.includes(id)).length,
  }));
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));

  // 最近新增
  const recent = [...methods]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 4);

  // 待更新 / 有争议
  const needsWork = methods.filter(
    (m) =>
      m.evidence.level === 'unverified' ||
      m.evidence.level === 'low' ||
      (m.lastResearchedAt &&
        Date.now() - Date.parse(m.lastResearchedAt) > 180 * 24 * 3600 * 1000),
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">综合工作台</h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {methods.length > 0
              ? `知识库共收录 ${methods.length} 条方法论，覆盖 ${distribution.filter((d) => d.count > 0).length} 个领域`
              : '知识库尚未初始化'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/search">
            <Button size="sm" variant="secondary" icon={<Search className="h-3.5 w-3.5" />}>
              提问
            </Button>
          </Link>
          <Link to="/research">
            <Button size="sm" icon={<Sparkles className="h-3.5 w-3.5" />}>
              发起研究
            </Button>
          </Link>
        </div>
      </header>

      {methodsQuery.data?.stale ? (
        <Alert kind="warning" title="离线缓存数据">
          当前展示的是本地缓存的快照，部分内容可能不是最新。
        </Alert>
      ) : null}

      {methods.length === 0 ? (
        <Card>
          <Empty
            icon={<Library className="h-10 w-10" />}
            title="知识库还是空的"
            description="在「研究」页发起一次 AI 研究，或在「设置」页导入已有数据。AI 会自动完成整理与归档，你只需审核。"
            action={
              <Link to="/research">
                <Button icon={<Sparkles className="h-3.5 w-3.5" />}>发起首次研究</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          {/* 关键指标 */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="方法论总数" value={methods.length} tone="primary" />
            <Stat
              label="证据强度达标"
              value={methods.filter((m) => m.evidence.level === 'high' || m.evidence.level === 'meta_analysis').length}
              hint="证据等级为高或元分析级"
              tone="success"
            />
            <Stat
              label="待补充证据"
              value={needsWork.length}
              hint="证据不足或长期未更新"
              tone="warning"
            />
            <Stat
              label="知识关联"
              value={relationsCountPlaceholder()}
              hint="跨方法论连接"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* 领域分布 */}
            <Card className="lg:col-span-2">
              <CardHeader
                title="八大领域分布"
                description="按方法论归属领域统计"
                action={
                  <Link to="/library" className="text-xs text-sky-600 hover:underline dark:text-sky-400">
                    浏览全部
                  </Link>
                }
              />
              <CardBody className="space-y-2.5">
                {distribution.map((d) => (
                  <div key={d.id} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-xs text-slate-600 dark:text-slate-400">
                      {d.name}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-sky-500 transition-all"
                        style={{ width: `${(d.count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {d.count > 0 ? d.count : ''}
                    </span>
                  </div>
                ))}
              </CardBody>
            </Card>

            {/* 快捷入口 */}
            <Card>
              <CardHeader title="快捷入口" />
              <CardBody className="space-y-1.5">
                <QuickLink to="/research" icon={<FlaskConical className="h-4 w-4" />} label="AI 研究中心" desc="主动研究与审核队列" />
                <QuickLink to="/practice" icon={<Target className="h-4 w-4" />} label="实践中心" desc="记录应用与效果验证" />
                <QuickLink to="/learning" icon={<GraduationCap className="h-4 w-4" />} label="学习中心" desc="计划、测验与间隔复习" />
                <QuickLink to="/graph" icon={<Network className="h-4 w-4" />} label="知识图谱" desc="方法论之间的关联网络" />
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* 最近新增 */}
            <Card className="lg:col-span-2">
              <CardHeader title="最近新增" description="AI 研究后经审核入库的方法论" />
              <CardBody>
                {recent.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">暂无记录</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {recent.map((m) => (
                      <MethodCard key={m.id} method={m} domainNames={domainMap} />
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* 待处理 */}
            <Card>
              <CardHeader
                title="待补充与存疑"
                description="证据薄弱或长期未更新"
                action={
                  needsWork.length > 0 ? (
                    <Badge tone="warning">{needsWork.length}</Badge>
                  ) : undefined
                }
              />
              <CardBody>
                {needsWork.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">全部条目证据充分</p>
                ) : (
                  <ul className="space-y-2">
                    {needsWork.slice(0, 6).map((m) => (
                      <li key={m.id}>
                        <Link
                          to={`/method/${m.id}`}
                          className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                              {m.name}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                              <Clock className="h-3 w-3" />
                              {m.lastResearchedAt
                                ? `研究于 ${formatRelative(m.lastResearchedAt)}`
                                : '尚未研究'}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title="系统状态" description="各核心模块的当前进展" />
            <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ModuleStatus
                to="/research"
                icon={<FlaskConical className="h-4 w-4" />}
                label="AI 研究"
                value="等待首次研究"
                hint="在研究页提交研究目标"
              />
              <ModuleStatus
                to="/practice"
                icon={<Target className="h-4 w-4" />}
                label="实践验证"
                value="尚未开始"
                hint="从推荐的方法论创建实践项目"
              />
              <ModuleStatus
                to="/learning"
                icon={<GraduationCap className="h-4 w-4" />}
                label="学习进度"
                value="尚未生成计划"
                hint="AI 会根据知识库生成学习路径"
              />
              <ModuleStatus
                to="/graph"
                icon={<TrendingUp className="h-4 w-4" />}
                label="知识关联"
                value={`${methods.length} 个节点`}
                hint="关联在研究入库时自动建立"
              />
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

function relationsCountPlaceholder(): number {
  return 0;
}

function QuickLink({
  to,
  icon,
  label,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-slate-800 dark:text-slate-200">{label}</span>
        <span className="block truncate text-[11px] text-slate-400">{desc}</span>
      </span>
    </Link>
  );
}

function ModuleStatus({
  to,
  icon,
  label,
  value,
  hint,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-slate-200 p-3 transition-colors hover:border-sky-300 dark:border-slate-800 dark:hover:border-sky-800"
    >
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        {icon}
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>
    </Link>
  );
}
