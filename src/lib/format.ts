export function formatMoney(amount: number | string, currency = 'VND') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    // VND defaults to 0 decimals; keep stored cents visible instead of rounding them away
    maximumFractionDigits: 2,
  }).format(
    Number(amount),
  )
}

export function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

export function readStorage<T>(key: string): T | null {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

// DRAFT is not here: drafts live on their own page and are completed, not set by status
export const ORDER_STATUSES = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const
