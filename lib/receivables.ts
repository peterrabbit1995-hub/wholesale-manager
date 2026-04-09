// 미수금 계산 순수 함수
//
// 실제 화면에서는 RPC get_receivables를 사용하지만,
// 같은 로직을 클라이언트에서 재현/테스트할 수 있도록 순수 함수로 제공.

export type InvoiceLike = { total: number }
export type PaymentLike = { amount: number }

/**
 * 미수금 = 이전 명세서 총액 합계 - 총 입금액
 *
 * - 명세서가 없으면 0
 * - 입금이 명세서보다 많으면 음수 (과입금)
 * - 입금이 없으면 명세서 총액 전체가 미수금
 */
export function calculateReceivable(
  invoices: InvoiceLike[],
  payments: PaymentLike[]
): number {
  if (!invoices || invoices.length === 0) return 0
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0)
  const totalPaid = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0)
  return totalInvoiced - totalPaid
}
