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
 */
export async function lookupPrice(
  supabase: SupabaseClient,
  params: LookupPriceParams
): Promise<LookupPriceResult> {
  const { productId, customerId, customerTierId, options } = params

  // 원가 조회 (source와 무관하게 항상 시도)
  let costPrice: number | null = null
  const { data: costTier } = await supabase
    .from('price_tiers')
    .select('id')
    .eq('level', TIER_LEVEL.COST)
    .single()

  if (costTier) {
    const { data: costData } = await supabase
      .from('product_prices')
      .select('price')
      .eq('product_id', productId)
      .eq('tier_id', costTier.id)
      .single()
    if (costData) costPrice = costData.price
  }

  // 1. 특별단가
  const { data: specialPrice } = await supabase
    .from('customer_prices')
    .select('special_price')
    .eq('customer_id', customerId)
    .eq('product_id', productId)
    .single()

  if (specialPrice) {
    return { unitPrice: specialPrice.special_price, costPrice, source: '특별단가' }
  }

  // 2. 옵션별 가격 (customerTierId + options 둘 다 있을 때만)
  if (customerTierId && options) {
    const { data: productOpts } = await supabase
      .from('product_options')
      .select('option_name, affects_price')
      .eq('product_id', productId)

    const affectsOpts = productOpts?.filter((o) => o.affects_price) || []
    for (const opt of affectsOpts) {
      const val = options[opt.option_name]
      if (val) {
        const { data: optPrice } = await supabase
          .from('option_prices')
          .select('price')
          .eq('product_id', productId)
          .eq('option_name', opt.option_name)
          .eq('option_value', val)
          .eq('tier_id', customerTierId)
          .single()
        if (optPrice) {
          return {
            unitPrice: optPrice.price,
            costPrice,
            source: `옵션별 가격 (${opt.option_name}: ${val})`,
          }
        }
      }
    }
  }

  // 3. 등급 단가
  if (customerTierId) {
    const { data: tierPrice } = await supabase
      .from('product_prices')
      .select('price')
      .eq('product_id', productId)
      .eq('tier_id', customerTierId)
      .single()
    if (tierPrice) {
      return { unitPrice: tierPrice.price, costPrice, source: '등급 단가' }
    }
  }

  // 4. 소비자가
  const { data: consumerTier } = await supabase
    .from('price_tiers')
    .select('id')
    .eq('level', TIER_LEVEL.CONSUMER)
    .single()

  if (consumerTier) {
    const { data: consumerPrice } = await supabase
      .from('product_prices')
      .select('price')
      .eq('product_id', productId)
      .eq('tier_id', consumerTier.id)
      .single()
    if (consumerPrice) {
      return { unitPrice: consumerPrice.price, costPrice, source: '소비자가' }
    }
  }

  return { unitPrice: null, costPrice, source: '가격 미설정' }
}
