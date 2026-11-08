import { useMemo, useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force';
import { Network, Filter } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, LoadingBlock, Empty, Badge } from '../components/ui';
import { useMethods, useRelations, useDomains, buildDomainMap } from '../hooks/useKnowledge';
import { cn } from '../lib/utils';
import { DOMAIN_IDS, DOMAIN_DEFAULT_NAMES, RELATION_TYPE_NAMES } from '@shared/types';

interface SimNode {
  id: string;
  name: string;
  domainIds: string[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  degree: number;
}

interface SimLink {
  source: string;
  target: string;
  type: string;
}

const WIDTH = 900;
const HEIGHT = 560;

export default function Graph() {
  const methodsQuery = useMethods();
  const relationsQuery = useRelations();
  const domainsQuery = useDomains();
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<SimNode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: WIDTH, h: HEIGHT });

  const methods = methodsQuery.data?.methods ?? [];
  const relations = relationsQuery.data?.relations ?? [];
  const domainMap = buildDomainMap(domainsQuery.data?.domains ?? []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth || WIDTH, h: Math.max(420, el.clientWidth * 0.62) });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { nodes, links } = useMemo(() => {
    const allowed = domainFilter
      ? methods.filter((m) => m.domainIds.includes(domainFilter))
      : methods;

    const allowedIds = new Set(allowed.map((m) => m.id));
    const validLinks = relations.filter(
      (r) => allowedIds.has(r.fromId) && allowedIds.has(r.toId),
    );

    const degree = new Map<string, number>();
    for (const l of validLinks) {
      degree.set(l.fromId, (degree.get(l.fromId) ?? 0) + 1);
      degree.set(l.toId, (degree.get(l.toId) ?? 0) + 1);
    }

    const simNodes: SimNode[] = allowed.map((m) => ({
      id: m.id,
      name: m.name,
      domainIds: m.domainIds,
      x: size.w / 2 + (Math.random() - 0.5) * 200,
      y: size.h / 2 + (Math.random() - 0.5) * 200,
      vx: 0,
      vy: 0,
      degree: degree.get(m.id) ?? 0,
    }));

    const simLinks: SimLink[] = validLinks.map((r) => ({
      source: r.fromId,
      target: r.toId,
      type: r.type,
    }));

    return { nodes: simNodes, links: simLinks };
  }, [methods, relations, domainFilter, size.w, size.h]);

  // 力导向布局
  useEffect(() => {
    if (nodes.length === 0) return;
    const simulation = forceSimulation(nodes as unknown as Array<{ x: number; y: number; vx: number; vy: number; fx?: number | null; fy?: number | null }>)
      .force(
        'link',
        forceLink(links as unknown as Array<{ source: string; target: string }>)
          .id((d: unknown) => (d as SimNode).id)
          .distance(90)
          .strength(0.35),
      )
      .force('charge', forceManyBody().strength(-260))
      .force('center', forceCenter(size.w / 2, size.h / 2))
      .force('collide', forceCollide().radius((d: unknown) => 26 + (d as SimNode).degree * 2));

    simulation.alpha(1).restart();
    return () => {
      simulation.stop();
    };
  }, [nodes, links, size.w, size.h]);

  if (methodsQuery.isLoading) return <LoadingBlock />;

  const domainOptions = DOMAIN_IDS.map((id) => ({
    id,
    name: domainMap.get(id) ?? DOMAIN_DEFAULT_NAMES[id],
    count: methods.filter((m) => m.domainIds.includes(id)).length,
  })).filter((d) => d.count > 0);

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const linkPairs = links
    .map((l) => {
      const s = typeof l.source === 'string' ? l.source : (l.source as SimNode).id;
      const t = typeof l.target === 'string' ? l.target : (l.target as SimNode).id;
      return { s, t, type: l.type };
    })
    .filter((l) => nodeById.has(l.s) && nodeById.has(l.t));

  const selectedRelations = selected
    ? relations.filter((r) => r.fromId === selected.id || r.toId === selected.id)
    : [];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">知识图谱</h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {nodes.length} 个方法论节点 · {linkPairs.length} 条关联
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <Filter className="h-3 w-3" />
            领域
          </span>
          <button
            onClick={() => setDomainFilter(null)}
            className={cn(
              'rounded-lg px-2 py-1 text-[11px] font-medium transition-colors',
              domainFilter === null
                ? 'bg-slate-900 text-white dark:bg-slate-700'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
            )}
          >
            全部
          </button>
          {domainOptions.map((d) => (
            <button
              key={d.id}
              onClick={() => setDomainFilter(domainFilter === d.id ? null : d.id)}
              className={cn(
                'rounded-lg px-2 py-1 text-[11px] font-medium transition-colors',
                domainFilter === d.id
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
              )}
            >
              {d.name}
              <span className="ml-1 opacity-70">{d.count}</span>
            </button>
          ))}
        </div>
      </header>

      {nodes.length === 0 ? (
        <Card>
          <Empty
            icon={<Network className="h-10 w-10" />}
            title="图谱还是空的"
            description="知识库中的方法论及其关联关系会在这里自动生成可视化网络。"
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardBody>
              <div ref={containerRef} className="relative w-full">
                <svg
                  width="100%"
                  height={size.h}
                  viewBox={`0 0 ${size.w} ${size.h}`}
                  className="rounded-xl bg-slate-50 dark:bg-slate-950/40"
                >
                  <g>
                    {linkPairs.map((l, i) => {
                      const s = nodeById.get(l.s)!;
                      const t = nodeById.get(l.t)!;
                      const isActive =
                        selected && (l.s === selected.id || l.t === selected.id);
                      return (
                        <line
                          key={i}
                          x1={s.x}
                          y1={s.y}
                          x2={t.x}
                          y2={t.y}
                          stroke={isActive ? '#0ea5e9' : '#cbd5e1'}
                          strokeWidth={isActive ? 1.8 : 1}
                          strokeOpacity={selected ? (isActive ? 0.9 : 0.25) : 0.55}
                          className="dark:stroke-slate-700"
                        />
                      );
                    })}
                  </g>
                  <g>
                    {nodes.map((n) => {
                      const r = 5 + Math.min(n.degree, 6) * 1.4;
                      const isSelected = selected?.id === n.id;
                      const isRelated = selected
                        ? selectedRelations.some((r2) => r2.fromId === n.id || r2.toId === n.id)
                        : false;
                      const dim = selected && !isSelected && !isRelated;
                      return (
                        <g
                          key={n.id}
                          transform={`translate(${n.x},${n.y})`}
                          onClick={() => setSelected(isSelected ? null : n)}
                          className="cursor-pointer"
                          opacity={dim ? 0.28 : 1}
                        >
                          <circle
                            r={r}
                            fill={isSelected ? '#0ea5e9' : '#64748b'}
                            className="dark:fill-slate-400"
                          />
                          {n.degree > 0 ? (
                            <circle r={r + 3} fill="none" stroke="#0ea5e9" strokeOpacity={0.25} strokeWidth={1} />
                          ) : null}
                          <text
                            y={r + 11}
                            textAnchor="middle"
                            className="pointer-events-none select-none"
                            style={{ fontSize: 10, fill: '#475569' }}
                          >
                            {n.name.length > 8 ? `${n.name.slice(0, 8)}…` : n.name}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={selected ? selected.name : '节点详情'}
              description={selected ? `${selected.degree} 条关联` : '点击图中节点查看'}
            />
            <CardBody>
              {selected ? (
                <div className="space-y-3">
                  <Link to={`/method/${selected.id}`}>
                    <Button size="sm" variant="secondary" className="w-full">
                      查看完整档案
                    </Button>
                  </Link>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.domainIds.map((d) => (
                      <Badge key={d} tone="primary">
                        {domainMap.get(d) ?? DOMAIN_DEFAULT_NAMES[d as keyof typeof DOMAIN_DEFAULT_NAMES] ?? d}
                      </Badge>
                    ))}
                  </div>
                  {selectedRelations.length > 0 ? (
                    <ul className="space-y-1.5">
                      {selectedRelations.map((r) => {
                        const otherId = r.fromId === selected.id ? r.toId : r.fromId;
                        const other = nodeById.get(otherId);
                        return (
                          <li
                            key={r.id}
                            className="rounded-lg border border-slate-200 px-2.5 py-2 dark:border-slate-800"
                          >
                            <div className="flex items-center gap-1.5">
                              <Badge tone="info">{RELATION_TYPE_NAMES[r.type]}</Badge>
                              <Link
                                to={`/method/${otherId}`}
                                className="min-w-0 truncate text-[11px] font-medium text-sky-700 hover:underline dark:text-sky-400"
                              >
                                {other?.name ?? otherId}
                              </Link>
                            </div>
                            {r.explanation ? (
                              <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                                {r.explanation}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400">该节点暂无关联记录</p>
                  )}
                </div>
              ) : (
                <p className="py-8 text-center text-xs text-slate-400">
                  点击图中的节点查看它的关联方法论
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
