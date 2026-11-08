import { Badge } from './ui';
import {
  EVIDENCE_CATEGORY_NAMES,
  EVIDENCE_LEVEL_NAMES,
  type EvidenceCategory,
  type EvidenceLevel,
} from '@shared/types';

const LEVEL_TONE: Record<EvidenceLevel, 'muted' | 'warning' | 'info' | 'primary' | 'success'> = {
  unverified: 'muted',
  low: 'warning',
  medium: 'info',
  high: 'primary',
  meta_analysis: 'success',
};

export function EvidenceBadge({ level, className }: { level: EvidenceLevel; className?: string }) {
  return (
    <Badge tone={LEVEL_TONE[level] ?? 'muted'} className={className} title={`证据等级：${EVIDENCE_LEVEL_NAMES[level]}`}>
      证据 {EVIDENCE_LEVEL_NAMES[level]}
    </Badge>
  );
}

const CATEGORY_TONE: Record<EvidenceCategory, 'default' | 'primary' | 'success' | 'info' | 'warning'> = {
  origin: 'primary',
  research: 'success',
  practice: 'warning',
  ai_inference: 'info',
};

export function EvidenceCategoryBadge({
  category,
  className,
}: {
  category: EvidenceCategory;
  className?: string;
}) {
  return (
    <Badge tone={CATEGORY_TONE[category] ?? 'default'} className={className}>
      {EVIDENCE_CATEGORY_NAMES[category]}
    </Badge>
  );
}
