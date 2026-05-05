export type Operator = 'gt' | 'lt' | 'gte' | 'lte' | 'eq'

export function evaluate(value: number, operator: Operator, threshold: number): boolean {
  switch (operator) {
    case 'gt':  return value > threshold
    case 'lt':  return value < threshold
    case 'gte': return value >= threshold
    case 'lte': return value <= threshold
    case 'eq':  return value === threshold
    default:    return false
  }
}

export function calcProposedBudget(
  currentSpend: number,
  action: string,
  actionValue: number | null
): number | null {
  if (!action.includes('budget') || !actionValue) return null
  const direction = action === 'increase_budget' ? 1 : -1
  return Math.round(currentSpend * (1 + direction * actionValue))
}
