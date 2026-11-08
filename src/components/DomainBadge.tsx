import { Badge } from './ui';
import { DOMAIN_DEFAULT_NAMES, type DomainId } from '@shared/types';

const TONE_MAP: Record<string, 'primary' | 'success' | 'info' | 'warning' | 'danger' | 'muted'> = {
  management: 'primary',
  personal_growth: 'success',
  thinking: 'info',
  work_methods: 'warning',
  communication: 'danger',
  learning: 'primary',
  business: 'success',
  life: 'muted',
};

export function DomainBadge({
  id,
  name,
  className,
}: {
  id: string;
  name?: string;
  className?: string;
}) {
  const label = name ?? DOMAIN_DEFAULT_NAMES[id as DomainId] ?? id;
  return (
    <Badge tone={TONE_MAP[id] ?? 'muted'} className={className}>
      {label}
    </Badge>
  );
}
