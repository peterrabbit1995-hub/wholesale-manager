// 거래 금액 계산 (반품/음수 수량 지원)

export type LineItem = {
  quantity: number
  unit_price: number
}

/**
 * 거래 한 줄 금액 = 수량 × 단가
 *
 * - 음수 수량(반품)은 음수 금액으로 계산됨
 * - 0 수량은 0
 */
export function calculateLineTotal(quantity: number, unitPrice: number): number {
  return quantity * unitPrice
}

/**
 * 거래 여러 줄 합계 (반품 섞여도 정확)
 *
 * - 빈 배열 → 0
 * - 반품(음수)이 포함돼도 일반 거래와 그대로 합산
 */
export function calculateInvoiceTotal(items: LineItem[]): number {
  if (!items || items.length === 0) return 0
  return items.reduce((sum, item) => sum + calculateLineTotal(item.quantity, item.unit_price), 0)
}
