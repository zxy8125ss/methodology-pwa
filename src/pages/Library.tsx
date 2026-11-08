import { useMemo, useState } from 'react';
import { Library as LibraryIcon, LayoutGrid, List, Search as SearchIcon, X } from 'lucide-react';
import { Card, CardBody, Input, Button, LoadingBlock, Empty, Badge, Alert } from '../components/ui';
import { MethodCard } from '../components/MethodCard';
import { DomainBadge } from '../components/DomainBadge';
import { useMethods, useDomains, buildDomainMap } from '../hooks/useKnowledge';
import { cn } from '../lib/utils';
import {
  DOMAIN_IDS,
  DOMAIN_DEFAULT_NAMES,
  METHOD_TYPES,
  METHOD_TYPE_NAMES,
  type Method,
} from '@shared/types';

const PAGE_SIZE = 24;

export default function Library() {
  const methodsQuery = useMethods();
  const domainsQuery = useDomains();
  const [keyword, setKeyword] = useState('');
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);

  const methods = methodsQuery.data?.methods ?? [];
  const domains = domainsQuery.data?.domains ?? [];
  const domainMap = buildDomainMap(domains.length ? domains : []);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return methods.filter((m) => {
      if (domainFilter && !m.domainIds.includes(domainFilter)) return false;
      if (typeFilter && m.type !== typeFilter) return false;
      if (!kw) return true;
      const haystack = [
        m.name,
        ...m.aliases,
        ...m.tags,
        m.content.coreIdea ?? '',
        ...m.content.scenarios,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(kw);
    });
  }, [methods, keyword, domainFilter, typeFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const paged = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const domainCounts = DOMAIN_IDS.map((id) => ({
    id,
    name: domainMap.get(id) ?? DOMAIN_DEFAULT_NAMES[id],
    count: methods.filter((m) => m.domainIds.includes(id)).length,
  })).filter((d) => d.count > 0);

  if (methodsQuery.isLoading) return <LoadingBlock />;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">方法论知识库</h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            共 {methods.length} 条，当前筛选出 {filtered.length} 条
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
          <button
            onClick={() => setView('grid')}
            aria-label="网格视图"
            className={cn(
              'rounded-md p-1.5 transition-colors',
              view === 'grid'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-400 hover:text-slate-600',
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setView('list')}
            aria-label="列表视图"
            className={cn(
              'rounded-md p-1.5 transition-colors',
              view === 'list'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-400 hover:text-slate-600',
            )}
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {methodsQuery.data?.stale ? (
        <Alert kind="warning">当前为离线缓存数据，可能不是最新状态。</Alert>
      ) : null}

      {/* 搜索与筛选 */}
      <Card>
        <CardBody className="space-y-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              placeholder="搜索名称、别名、标签或适用场景"
              className="pl-9"
            />
            {keyword ? (
              <button
                onClick={() => setKeyword('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="清除搜索"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={domainFilter === null && typeFilter === null}
              onClick={() => {
                setDomainFilter(null);
                setTypeFilter(null);
                setPage(1);
              }}
            >
              全部
            </FilterChip>
            {domainCounts.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setDomainFilter(domainFilter === d.id ? null : d.id);
                  setPage(1);
                }}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                  domainFilter === d.id
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                )}
              >
                {d.name}
                <span className="ml-1 opacity-70">{d.count}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
            {METHOD_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTypeFilter(typeFilter === t ? null : t);
                  setPage(1);
                }}
                className={cn(
                  'rounded-md px-2 py-0.5 text-[11px] transition-colors',
                  typeFilter === t
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800',
                )}
              >
                {METHOD_TYPE_NAMES[t]}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* 结果 */}
      {filtered.length === 0 ? (
        <Card>
          <Empty
            icon={<LibraryIcon className="h-10 w-10" />}
            title={methods.length === 0 ? '知识库还没有内容' : '没有匹配的方法论'}
            description={
              methods.length === 0
                ? '发起一次 AI 研究，系统会自动完成检索、整理、归档，你只需审核。'
                : '换个关键词，或清除筛选条件试试。'
            }
            action={
              methods.length === 0 ? (
                <Button onClick={() => (window.location.href = '/research')}>发起研究</Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setKeyword('');
                    setDomainFilter(null);
                    setTypeFilter(null);
                  }}
                >
                  清除筛选
                </Button>
              )
            }
          />
        </Card>
      ) : view === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {paged.map((m) => (
            <MethodCard key={m.id} method={m} domainNames={domainMap} />
          ))}
        </div>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {paged.map((m) => (
              <MethodRow key={m.id} method={m} domainMap={domainMap} />
            ))}
          </ul>
        </Card>
      )}

      {/* 分页 */}
      {pageCount > 1 ? (
        <div className="flex items-center justify-center gap-2 py-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            上一页
          </Button>
          <span className="text-xs text-slate-500">
            {current} / {pageCount}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={current >= pageCount}
            onClick={() => setPage(current + 1)}
          >
            下一页
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-slate-900 text-white dark:bg-slate-700 dark:text-slate-100'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
      )}
    >
      {children}
    </button>
  );
}

function MethodRow({ method, domainMap }: { method: Method; domainMap: Map<string, string> }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{method.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {method.domainIds.map((d) => (
            <DomainBadge key={d} id={d} name={domainMap.get(d)} />
          ))}
          <Badge tone="muted">{METHOD_TYPE_NAMES[method.type]}</Badge>
        </div>
      </div>
      <MethodCardLink method={method} />
    </li>
  );
}

function MethodCardLink({ method }: { method: Method }) {
  return (
    <a
      href={`#/method/${method.id}`}
      onClick={(e) => {
        e.preventDefault();
        window.location.hash = `#/method/${method.id}`;
      }}
      className="shrink-0 rounded-lg px-2.5 py-1 text-xs text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/50"
    >
      查看
    </a>
  );
}
