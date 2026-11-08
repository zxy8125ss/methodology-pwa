import { Link } from 'react-router-dom';
import { Card } from './ui';
import { DomainBadge } from './DomainBadge';
import { EvidenceBadge } from './EvidenceBadge';
import { firstSentence, formatRelative } from '../lib/format';
import { METHOD_TYPE_NAMES, type Method } from '@shared/types';

export function MethodCard({
  method,
  domainNames,
  className,
}: {
  method: Method;
  domainNames?: Map<string, string>;
  className?: string;
}) {
  const summary = firstSentence(method.content.coreIdea, 110);

  return (
    <Link to={`/method/${method.id}`} className="block">
      <Card className={`h-full p-4 transition-shadow hover:shadow-md ${className ?? ''}`}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
            {method.name}
          </h3>
          <EvidenceBadge level={method.evidence.level} />
        </div>

        {method.aliases.length > 0 ? (
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">别名：{method.aliases.join('、')}</p>
        ) : null}

        {summary ? (
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {summary}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {method.domainIds.slice(0, 3).map((d) => (
            <DomainBadge key={d} id={d} name={domainNames?.get(d)} />
          ))}
          {method.domainIds.length > 3 ? (
            <span className="text-[11px] text-slate-400">+{method.domainIds.length - 3}</span>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
          <span>{METHOD_TYPE_NAMES[method.type]}</span>
          <span>更新于 {formatRelative(method.updatedAt) || '—'}</span>
        </div>
      </Card>
    </Link>
  );
}
