import { describe, it, expect } from 'vitest'
import { lookupPrice } from '@/lib/lookupPrice'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------- Mock Supabase client ----------
//
// 실제 Supabase 쿼리 체이닝 `.from().select().eq()...single()`를 흉내내는 mock.
// 각 테이블별로 조건(eq 체인) + 요청 모드(single/array)에 따라 다른 값을 반환하도록
// "fixture" 객체를 받아서 매칭된 결과를 돌려준다.

type EqArg = { col: string; val: unknown }

type Fixture = {
  // 테이블명 → 조건 매칭 함수 배열
  [table: string]: Array<{
    match: (eqs: EqArg[]) => boolean
    data: unknown // single() 모드용 단일 객체
    list?: unknown // 배열 모드용
  }>
}

function createMockSupabase(fixture: Fixture): SupabaseClient {
  function buildQuery(table: string) {
    const eqs: EqArg[] = []

    const api = {
      select: (_cols: string) => api,
      eq: (col: string, val: unknown) => {
        eqs.push({ col, val })
        return api
      },
      // single()은 조건을 모두 만족하는 첫 번째 레코드 반환
      single: () => {
        const rules = fixture[table] || []
        for (const rule of rules) {
          if (rule.match(eqs)) {
            return Promise.resolve({ data: rule.data, error: null })
          }
        }
        return Promise.resolve({ data: null, error: { message: 'not found' } })
      },
      // await 직접 호출 시 (배열 반환)
      then: (resolve: (val: { data: unknown; error: null }) => void) => {
        const rules = fixture[table] || []
        for (const rule of rules) {
          if (rule.match(eqs)) {
            resolve({ data: rule.list ?? rule.data, error: null })
            return
          }
        }
        resolve({ data: [], error: null })
      },
    }
    return api
  }

  return {
    from: (table: string) => buildQuery(table),
  } as unknown as SupabaseClient
}

// ---------- 공통 fixture 조각 ----------

const costTierRecord = { id: 'tier-cost' }
const consumerTierRecord = { id: 'tier-consumer' }
const costPriceRecord = { price: 3000 }

// ---------- 테스트 ----------

describe('lookupPrice - 단가 적용 우선순위', () => {
  it('특별단가가 있으면 특별단가 적용', async () => {
    const fixture: Fixture = {
      price_tiers: [
        { match: (eqs) => eqs.some((e) => e.col === 'level' && e.val === 0), data: costTierRecord },
        { match: (eqs) => eqs.some((e) => e.col === 'level' && e.val === 1), data: consumerTierRecord },
      ],
      product_prices: [
        // 원가
        {
          match: (eqs) =>
            eqs.some((e) => e.col === 'tier_id' && e.val === 'tier-cost'),
          data: costPriceRecord,
        },
        // 등급 단가 (아래에서 우선순위 검증용으로 존재하지만 특별단가가 우선)
        {
          match: (eqs) => eqs.some((e) => e.col === 'tier_id' && e.val === 'tier-A'),
          data: { price: 20000 },
        },
      ],
      customer_prices: [
        {
          match: (eqs) =>
            eqs.some((e) => e.col === 'customer_id' && e.val === 'cust-1') &&
            eqs.some((e) => e.col === 'product_id' && e.val === 'prod-1'),
          data: { special_price: 15000 },
        },
      ],
    }

    const supabase = createMockSupabase(fixture)
    const result = await lookupPrice(supabase, {
      productId: 'prod-1',
      customerId: 'cust-1',
      customerTierId: 'tier-A',
      options: null,
    })

    expect(result.unitPrice).toBe(15000)
    expect(result.source).toBe('특별단가')
    expect(result.costPrice).toBe(3000)
  })

  it('특별단가 없고 옵션가격 있으면 옵션가격 적용', async () => {
    const fixture: Fixture = {
      price_tiers: [
        { match: (eqs) => eqs.some((e) => e.col === 'level' && e.val === 0), data: costTierRecord },
        { match: (eqs) => eqs.some((e) => e.col === 'level' && e.val === 1), data: consumerTierRecord },
      ],
      product_prices: [
        {
          match: (eqs) => eqs.some((e) => e.col === 'tier_id' && e.val === 'tier-cost'),
          data: costPriceRecord,
        },
        // 등급 단가도 있지만 옵션이 우선해야 함
        {
          match: (eqs) => eqs.some((e) => e.col === 'tier_id' && e.val === 'tier-A'),
          data: { price: 20000 },
        },
      ],
      customer_prices: [], // 특별단가 없음
      product_options: [
        {
          match: (eqs) => eqs.some((e) => e.col === 'product_id' && e.val === 'prod-1'),
          data: null,
          list: [{ option_name: '사이즈', affects_price: true }],
        },
      ],
      option_prices: [
        {
          match: (eqs) =>
            eqs.some((e) => e.col === 'option_value' && e.val === 'M') &&
            eqs.some((e) => e.col === 'tier_id' && e.val === 'tier-A'),
          data: { price: 18000 },
        },
      ],
    }

    const supabase = createMockSupabase(fixture)
    const result = await lookupPrice(supabase, {
      productId: 'prod-1',
      customerId: 'cust-1',
      customerTierId: 'tier-A',
      options: { 사이즈: 'M' },
    })

    expect(result.unitPrice).toBe(18000)
    expect(result.source).toContain('옵션별 가격')
    expect(result.source).toContain('사이즈: M')
  })

  it('특별단가/옵션가격 없고 등급단가 있으면 등급단가 적용', async () => {
    const fixture: Fixture = {
      price_tiers: [
        { match: (eqs) => eqs.some((e) => e.col === 'level' && e.val === 0), data: costTierRecord },
        { match: (eqs) => eqs.some((e) => e.col === 'level' && e.val === 1), data: consumerTierRecord },
      ],
      product_prices: [
        {
          match: (eqs) => eqs.some((e) => e.col === 'tier_id' && e.val === 'tier-cost'),
          data: costPriceRecord,
        },
        {
          match: (eqs) => eqs.some((e) => e.col === 'tier_id' && e.val === 'tier-A'),
          data: { price: 20000 },
        },
      ],
      customer_prices: [],
      product_options: [],
      option_prices: [],
    }

    const supabase = createMockSupabase(fixture)
    const result = await lookupPrice(supabase, {
      productId: 'prod-1',
      customerId: 'cust-1',
      customerTierId: 'tier-A',
      options: null,
    })

    expect(result.unitPrice).toBe(20000)
    expect(result.source).toBe('등급 단가')
  })

  it('전부 없으면 소비자가 적용', async () => {
    const fixture: Fixture = {
      price_tiers: [
        { match: (eqs) => eqs.some((e) => e.col === 'level' && e.val === 0), data: costTierRecord },
        { match: (eqs) => eqs.some((e) => e.col === 'level' && e.val === 1), data: consumerTierRecord },
      ],
      product_prices: [
        {
          match: (eqs) => eqs.some((e) => e.col === 'tier_id' && e.val === 'tier-cost'),
          data: costPriceRecord,
        },
        {
          match: (eqs) => eqs.some((e) => e.col === 'tier_id' && e.val === 'tier-consumer'),
          data: { price: 25000 },
        },
      ],
      customer_prices: [],
      product_options: [],
      option_prices: [],
    }

    const supabase = createMockSupabase(fixture)
    const result = await lookupPrice(supabase, {
      productId: 'prod-1',
      customerId: 'cust-1',
      customerTierId: null, // 등급 없음 → 등급단가 스킵
      options: null,
    })

    expect(result.unitPrice).toBe(25000)
    expect(result.source).toBe('소비자가')
  })

  it('아무 가격도 없으면 unitPrice는 null, source는 "가격 미설정"', async () => {
    const fixture: Fixture = {
      price_tiers: [
        { match: (eqs) => eqs.some((e) => e.col === 'level' && e.val === 0), data: costTierRecord },
        { match: (eqs) => eqs.some((e) => e.col === 'level' && e.val === 1), data: consumerTierRecord },
      ],
      product_prices: [],
      customer_prices: [],
      product_options: [],
      option_prices: [],
    }

    const supabase = createMockSupabase(fixture)
    const result = await lookupPrice(supabase, {
      productId: 'prod-1',
      customerId: 'cust-1',
      customerTierId: null,
      options: null,
    })

    expect(result.unitPrice).toBeNull()
    expect(result.source).toBe('가격 미설정')
  })

  it('옵션이 없으면 옵션단계는 건너뛰고 등급단가 조회', async () => {
    // options=null이면 옵션 단계 스킵 → 등급단가로 넘어가야 함
    const fixture: Fixture = {
      price_tiers: [
        { match: (eqs) => eqs.some((e) => e.col === 'level' && e.val === 0), data: costTierRecord },
        { match: (eqs) => eqs.some((e) => e.col === 'level' && e.val === 1), data: consumerTierRecord },
      ],
      product_prices: [
        {
          match: (eqs) => eqs.some((e) => e.col === 'tier_id' && e.val === 'tier-cost'),
          data: costPriceRecord,
        },
        {
          match: (eqs) => eqs.some((e) => e.col === 'tier_id' && e.val === 'tier-A'),
          data: { price: 22000 },
        },
      ],
      customer_prices: [],
    }

    const supabase = createMockSupabase(fixture)
    const result = await lookupPrice(supabase, {
      productId: 'prod-1',
      customerId: 'cust-1',
      customerTierId: 'tier-A',
      options: null,
    })

    expect(result.unitPrice).toBe(22000)
    expect(result.source).toBe('등급 단가')
  })

  it('affects_price=false인 옵션은 무시하고 다음 단계(등급단가)로 넘어간다', async () => {
    const fixture: Fixture = {
      price_tiers: [
        { match: (eqs) => eqs.some((e) => e.col === 'level' && e.val === 0), data: costTierRecord },
        { match: (eqs) => eqs.some((e) => e.col === 'level' && e.val === 1), data: consumerTierRecord },
      ],
      product_prices: [
        {
          match: (eqs) => eqs.some((e) => e.col === 'tier_id' && e.val === 'tier-cost'),
          data: costPriceRecord,
        },
        {
          match: (eqs) => eqs.some((e) => e.col === 'tier_id' && e.val === 'tier-A'),
          data: { price: 22000 },
        },
      ],
      customer_prices: [],
      product_options: [
        {
          match: (eqs) => eqs.some((e) => e.col === 'product_id' && e.val === 'prod-1'),
          data: null,
          list: [{ option_name: '색상', affects_price: false }], // 가격 영향 없음
        },
      ],
      option_prices: [],
    }

    const supabase = createMockSupabase(fixture)
    const result = await lookupPrice(supabase, {
      productId: 'prod-1',
      customerId: 'cust-1',
      customerTierId: 'tier-A',
      options: { 색상: '빨강' },
    })

    // affects_price=false이므로 옵션단계 스킵 → 등급단가
    expect(result.unitPrice).toBe(22000)
    expect(result.source).toBe('등급 단가')
  })

  it('원가(costPrice)는 source와 무관하게 항상 포함된다', async () => {
    const fixture: Fixture = {
      price_tiers: [
        { match: (eqs) => eqs.some((e) => e.col === 'level' && e.val === 0), data: costTierRecord },
        { match: (eqs) => eqs.some((e) => e.col === 'level' && e.val === 1), data: consumerTierRecord },
      ],
      product_prices: [
        {
          match: (eqs) => eqs.some((e) => e.col === 'tier_id' && e.val === 'tier-cost'),
          data: { price: 5000 },
        },
      ],
      customer_prices: [
        {
          match: (eqs) => eqs.some((e) => e.col === 'customer_id' && e.val === 'cust-1'),
          data: { special_price: 15000 },
        },
      ],
    }

    const supabase = createMockSupabase(fixture)
    const result = await lookupPrice(supabase, {
      productId: 'prod-1',
      customerId: 'cust-1',
      customerTierId: 'tier-A',
      options: null,
    })

    expect(result.unitPrice).toBe(15000)
    expect(result.source).toBe('특별단가')
    expect(result.costPrice).toBe(5000)
  })
})
