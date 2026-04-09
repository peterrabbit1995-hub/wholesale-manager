import { describe, it, expect } from 'vitest'
import { calculateReceivable } from '@/lib/receivables'

describe('calculateReceivable - 미수금 계산', () => {
  it('명세서 총액 - 입금액 = 미수금', () => {
    const invoices = [{ total: 100000 }, { total: 50000 }]
    const payments = [{ amount: 80000 }]
    // 150000 - 80000 = 70000
    expect(calculateReceivable(invoices, payments)).toBe(70000)
  })

  it('입금이 없을 때 미수금은 명세서 총액 그대로', () => {
    const invoices = [{ total: 100000 }, { total: 50000 }]
    const payments: { amount: number }[] = []
    expect(calculateReceivable(invoices, payments)).toBe(150000)
  })

  it('입금이 명세서보다 많을 때 미수금은 음수 (과입금)', () => {
    const invoices = [{ total: 50000 }]
    const payments = [{ amount: 80000 }]
    // 50000 - 80000 = -30000 (3만원 과입금)
    expect(calculateReceivable(invoices, payments)).toBe(-30000)
  })

  it('명세서가 없을 때 미수금은 0 (입금이 있어도)', () => {
    const invoices: { total: number }[] = []
    const payments = [{ amount: 50000 }]
    expect(calculateReceivable(invoices, payments)).toBe(0)
  })

  it('명세서도 입금도 없을 때 미수금은 0', () => {
    expect(calculateReceivable([], [])).toBe(0)
  })

  it('여러 명세서와 여러 입금의 합산이 정확해야 한다', () => {
    const invoices = [{ total: 10000 }, { total: 20000 }, { total: 30000 }]
    const payments = [{ amount: 15000 }, { amount: 25000 }]
    // (10000+20000+30000) - (15000+25000) = 60000 - 40000 = 20000
    expect(calculateReceivable(invoices, payments)).toBe(20000)
  })
})
