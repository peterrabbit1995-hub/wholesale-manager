import type { SupabaseClient } from '@supabase/supabase-js'
import { TIER_LEVEL } from './utils'

// 단가 조회 결과
export type LookupPriceResult = {
  unitPrice: number | null
  costPrice: number | null
  source: string
}

// 단가 조회 파라미터
export type LookupPriceParams = {
  productId: string
  customerId: string
  customerTierId: string | null
  options: Record<string, string> | null
}

/**
 * 상품 단가 조회 (우선순위)
 *
 * 1. 특별단가 (customer_prices)
 * 2. 옵션별 가격 (option_prices, affects_price 옵션만)
 * 3. 등급 단가 (product_prices, tier=customer.default_tier_id)
 * 4. 소비자가 (product_prices, tier level=1)
 *
 * 각 단계가 없으면 다음 단계로 넘어가고, 전부 없으면 unitPrice=null 반환.
 * costPrice는 항상 원가(tier level=0) 기준으로 함께 반환.
 *
 * 성능: 쿼리를 2단계로 묶어 병렬 실행 (worst case 6~8 round trips → 2 round trips)
 *   Phase 1 병렬 (4개): 원가 등급ID, 소비자가 등급ID, 특별단가, 옵션 메타
 *   Phase 2 병렬 (N+3개): 원가, 등급단가, 소비자가, 옵션별가격들
 *   단, 특별단가가 적중하면 Phase 2는 원가 쿼리만 기다리고 종료 (2 round trips 유지)
 */
export async function lookupPrice(
  supabase: SupabaseClient,
  params: LookupPriceParams
): Promise<LookupPriceResult> {
  const { productId, customerId, customerTierId, options } = params

  // ============================================================
  // Phase 1: 서로 독립적인 쿼리 4개를 병렬로 실행
  //   (a) 원가 등급 ID
  //   (b) 소비자가 등급 ID
  //   (c) 특별단가
  //   (d) affects_price 옵션 메타 (customerTierId + options 있을 때만)
  // ============================================================
  const productOptsQuery =
    customerTierId && options
      ? supabase
          .from('product_options')
          .select('option_name, affects_price')
          .eq('product_id', productId)
      : Promise.resolve({ data: null as null | { option_name: string; affects_price: boolean }[] })

  const [costTierResult, consumerTierResult, specialResult, productOptsResult] =
    await Promise.all([
      supabase
        .from('price_tiers')
        .select('id')
        .eq('level', TIER_LEVEL.COST)
        .single(),
      supabase
        .from('price_tiers')
        .select('id')
        .eq('level', TIER_LEVEL.CONSUMER)
        .single(),
      supabase
        .from('customer_prices')
        .select('special_price')
        .eq('customer_id', customerId)
        .eq('product_id', productId)
        .single(),
      productOptsQuery,
    ])

  const costTier = costTierResult.data as { id: string } | null
  const consumerTier = consumerTierResult.data as { id: string } | null
  const specialData = specialResult.data as { special_price: number } | null
  const productOpts = productOptsResult.data as
    | { option_name: string; affects_price: boolean }[]
    | null

  // 원가 쿼리 (costTier ID 확보 후에만 가능)
  const costPricePromise = costTier
    ? supabase
        .from('product_prices')
        .select('price')
        .eq('product_id', productId)
        .eq('tier_id', costTier.id)
        .single()
    : Promise.resolve({ data: null as null | { price: number } })

  // ============================================================
  // 특별단가 적중 시: 원가만 기다리고 종료 (2 round trips)
  // ============================================================
  if (specialData) {
    const costResult = await costPricePromise
    const costData = costResult.data as { price: number } | null
    return {
      unitPrice: specialData.special_price,
      costPrice: costData?.price ?? null,
      source: '특별단가',
    }
  }

  // ============================================================
  // Phase 2: 원가 + 등급단가 + 소비자가 + 옵션별가격들을 모두 병렬로
  //   우선순위 판단은 결과 받은 뒤에 수행 (옵션 > 등급 > 소비자)
  // ============================================================

  // 옵션별 가격 후보 목록 생성: affects_price=true이면서 사용자가 값 선택한 것만
  const optionLookups: Array<{
    optName: string
    optValue: string
    promise: Promise<{ data: { price: number } | null }>
  }> = []

  if (customerTierId && options && productOpts) {
    const affectsOpts = productOpts.filter((o) => o.affects_price)
    for (const opt of affectsOpts) {
      const val = options[opt.option_name]
      if (val) {
        optionLookups.push({
          optName: opt.option_name,
          optValue: val,
          promise: supabase
            .from('option_prices')
            .select('price')
            .eq('product_id', productId)
            .eq('option_name', opt.option_name)
            .eq('option_value', val)
            .eq('tier_id', customerTierId)
            .single() as unknown as Promise<{ data: { price: number } | null }>,
        })
      }
    }
  }

  // 등급 단가
  const tierPricePromise = customerTierId
    ? supabase
        .from('product_prices')
        .select('price')
        .eq('product_id', productId)
        .eq('tier_id', customerTierId)
        .single()
    : Promise.resolve({ data: null as null | { price: number } })

  // 소비자가
  const consumerPricePromise = consumerTier
    ? supabase
        .from('product_prices')
        .select('price')
        .eq('product_id', productId)
        .eq('tier_id', consumerTier.id)
        .single()
    : Promise.resolve({ data: null as null | { price: number } })

  // 모두 동시 대기
  const [costResult, tierResult, consumerResult, ...optionResults] =
    await Promise.all([
      costPricePromise,
      tierPricePromise,
      consumerPricePromise,
      ...optionLookups.map((l) => l.promise),
    ])

  const costPrice = (costResult.data as { price: number } | null)?.price ?? null

  // 우선순위대로 결정 (원본 함수와 동일)
  // 2. 옵션별 가격 (순서대로 첫 번째 매칭되는 옵션)
  for (let i = 0; i < optionResults.length; i++) {
    const optData = optionResults[i].data as { price: number } | null
    if (optData) {
      const lookup = optionLookups[i]
      return {
        unitPrice: optData.price,
        costPrice,
        source: `옵션별 가격 (${lookup.optName}: ${lookup.optValue})`,
      }
    }
  }

  // 3. 등급 단가
  const tierData = tierResult.data as { price: number } | null
  if (tierData) {
    return { unitPrice: tierData.price, costPrice, source: '등급 단가' }
  }

  // 4. 소비자가
  const consumerData = consumerResult.data as { price: number } | null
  if (consumerData) {
    return { unitPrice: consumerData.price, costPrice, source: '소비자가' }
  }

  return { unitPrice: null, costPrice, source: '가격 미설정' }
}
