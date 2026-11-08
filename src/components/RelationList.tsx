import { Link } from 'react-router-dom';
import { Badge } from './ui';
import { RELATION_TYPE_NAMES, type Relation } from '@shared/types';
import { formatPercent } from '../lib/format';

export function RelationList({
  relations,
  nameMap,
  direction = 'both',
  className,
}: {
  relations: Relation[];
  nameMap: Map<string, string>;
  direction?: 'both' | 'outgoing' | 'incoming';
  className?: string;
}) {
  const items = relations.filter((r) => {
    if (direction === 'outgoing') return r.fromId !== '';
    if (direction === 'incoming') return r.toId !== '';
    return true;
  });

  if (items.length === 0) {
    return <p className={`text-xs text-slate-400 ${className ?? ''}`}>暂无关联记录</p>;
  }

  return (
    <ul className={`space-y-2 ${className ?? ''}`}>
      {items.map((rel) => (
        <li
          key={rel.id}
          className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/40"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{RELATION_TYPE_NAMES[rel.type]}</Badge>
            <Link
              to={`/method/${rel.toId}`}
              className="text-xs font-medium text-sky-700 hover:underline dark:text-sky-400"
            >
              {nameMap.get(rel.toId) ?? rel.toId}
            </Link>
            {rel.confidence > 0 ? (
              <span className="ml-auto text-[11px] text-slate-400">
                置信度 {formatPercent(rel.confidence)}
              </span>
            ) : null}
          </div>
          {rel.explanation ? (
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {rel.explanation}
            </p>
          ) : null}
          {rel.evidenceRefs.length > 0 ? (
            <p className="mt-1 text-[11px] text-slate-400">依据 {rel.evidenceRefs.length} 项</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
