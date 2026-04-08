import type { SupabaseClient } from '@supabase/supabase-js'

type PriceChangeParams = {
  supabase: SupabaseClient
  product_id: string
  change_type: 'consumer' | 'tier' | 'special'
  tier_id?: string
  customer_id?: string
  old_price: number
  new_price: number
}

export async function recordPriceChange(params: PriceChangeParams) {
  // 가격이 같으면 기록하지 않음
  if (params.old_price === params.new_price) return

  await params.supabase.from('price_history').insert({
    product_id: params.product_id,
    change_type: params.change_type,
    tier_id: params.tier_id || null,
    customer_id: params.customer_id || null,
    old_price: params.old_price,
    new_price: params.new_price,
  })
}
