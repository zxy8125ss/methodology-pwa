/** 成本累计与预算上限 —— 超预算时拒绝执行非必要任务 */

export interface CostRecord {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

/**
 * 简单的进程内累计器。
 * 生产环境可换用 KV / D1 持久化，此处保证单实例行为正确。
 */
const totals: CostRecord = {
  inputTokens: 0,
  outputTokens: 0,
  estimatedCostUsd: 0,
};

export function getTotalCost(): CostRecord {
  return { ...totals };
}

export function addCost(record: CostRecord): CostRecord {
  totals.inputTokens += record.inputTokens;
  totals.outputTokens += record.outputTokens;
  totals.estimatedCostUsd += record.estimatedCostUsd;
  return getTotalCost();
}

export function resetCost(): void {
  totals.inputTokens = 0;
  totals.outputTokens = 0;
  totals.estimatedCostUsd = 0;
}

export interface BudgetCheck {
  allowed: boolean;
  reason?: string;
  spent: number;
  limit: number;
}

export function checkBudget(limitUsd: number, projectedCost = 0): BudgetCheck {
  const spent = totals.estimatedCostUsd;
  if (spent >= limitUsd) {
    return {
      allowed: false,
      reason: `已达到费用上限（$${limitUsd.toFixed(2)}），请在设置中调整或等待预算重置`,
      spent,
      limit: limitUsd,
    };
  }
  if (spent + projectedCost > limitUsd) {
    return {
      allowed: false,
      reason: `本次任务预计费用将超出剩余预算（已用 $${spent.toFixed(4)} / 上限 $${limitUsd.toFixed(2)}）`,
      spent,
      limit: limitUsd,
    };
  }
  return { allowed: true, spent, limit: limitUsd };
}
