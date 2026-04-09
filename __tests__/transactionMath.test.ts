import { describe, it, expect } from 'vitest'
import { calculateLineTotal, calculateInvoiceTotal } from '@/lib/transactionMath'

describe('calculateLineTotal - 거래 한 줄 금액', () => {
  it('정상 수량: 10개 × 5000원 = 50000', () => {
    expect(calculateLineTotal(10, 5000)).toBe(50000)
  })

  it('음수 수량(반품): -3개 × 10000원 = -30000', () => {
    expect(calculateLineTotal(-3, 10000)).toBe(-30000)
  })

  it('수량이 0이면 0', () => {
    expect(calculateLineTotal(0, 5000)).toBe(0)
  })

  it('단가가 0이면 0', () => {
    expect(calculateLineTotal(10, 0)).toBe(0)
  })
})

describe('calculateInvoiceTotal - 명세서 합계 (반품 포함)', () => {
  it('일반 거래만 있을 때 합계가 정확해야 한다', () => {
    const items = [
      { quantity: 10, unit_price: 5000 },
      { quantity: 2, unit_price: 30000 },
    ]
    // 50000 + 60000 = 110000
    expect(calculateInvoiceTotal(items)).toBe(110000)
  })

  it('반품이 섞인 명세서 합계가 정확해야 한다', () => {
    const items = [
      { quantity: 10, unit_price: 5000 }, // +50000
      { quantity: -2, unit_price: 5000 }, // -10000 (반품)
      { quantity: 1, unit_price: 20000 }, // +20000
    ]
    // 50000 - 10000 + 20000 = 60000
    expect(calculateInvoiceTotal(items)).toBe(60000)
  })

  it('전부 반품일 때 합계가 음수', () => {
    const items = [
      { quantity: -5, unit_price: 10000 },
      { quantity: -3, unit_price: 5000 },
    ]
    // -50000 - 15000 = -65000
    expect(calculateInvoiceTotal(items)).toBe(-65000)
  })

  it('빈 배열이면 0', () => {
    expect(calculateInvoiceTotal([])).toBe(0)
  })
})
