'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { recordPriceChange } from '@/lib/priceHistory'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

type PriceTier = {
  id: string
  name: string
  level: number
}

type Alias = {
  id: string
  alias: string
}

type PriceHistoryItem = {
  id: string
  change_type: string
  old_price: number
  new_price: number
  created_at: string
  tier_id: string | null
  customer_id: string | null
}

export default function ProductDetailPage() {
  const router = useRouter()
  const { id } = useParams()
  const [name, setName] = useState('')
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [originalPrices, setOriginalPrices] = useState<Record<string, number>>({})
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([])
  const [loading, setLoading] = useState(false)
  const [aliases, setAliases] = useState<Alias[]>([])
  const [newAlias, setNewAlias] = useState('')
  const [history, setHistory] = useState<PriceHistoryItem[]>([])
  const [tierNames, setTierNames] = useState<Record<string, string>>({})
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({})

  const formatPrice = (value: string) => {
    const nums = value.replace(/[^0-9]/g, '')
    return nums ? Number(nums).toLocaleString() : ''
  }

  const rawPrice = (value: string) => value.replace(/,/g, '')

  useEffect(() => {
    loadData()
    loadHistory()
  }, [])

  const loadData = async () => {
    const [{ data: product }, { data: tiers }, { data: productPrices }, { data: aliasData }] =
      await Promise.all([
        supabase.from('products').select('*').eq('id', id).single(),
        supabase.from('price_tiers').select('id, name, level').order('level'),
        supabase.from('product_prices').select('tier_id, price').eq('product_id', id),
        supabase.from('product_aliases').select('id, alias').eq('product_id', id).order('alias'),
      ])

    if (product) setName(product.name || '')
    setPriceTiers(tiers || [])
    setAliases(aliasData || [])

    const priceMap: Record<string, string> = {}
    const origMap: Record<string, number> = {}
    productPrices?.forEach((p) => {
      priceMap[p.tier_id] = Number(p.price).toLocaleString()
      origMap[p.tier_id] = Number(p.price)
    })
    setPrices(priceMap)
    setOriginalPrices(origMap)
  }

  const loadHistory = async () => {
    const { data } = await supabase
      .from('price_history')
      .select('id, change_type, old_price, new_price, created_at, tier_id, customer_id')
      .eq('product_id', id)
      .order('created_at', { ascending: false })
      .limit(50)

    setHistory(data || [])

    if (!data || data.length === 0) return

    // 등급명 조회
    const tierIds = [...new Set(data.filter(h => h.tier_id).map(h => h.tier_id!))]
    if (tierIds.length > 0) {
      const { data: tiers } = await supabase
        .from('price_tiers')
        .select('id, name')
        .in('id', tierIds)
      const map: Record<string, string> = {}
      tiers?.forEach(t => { map[t.id] = t.name })
      setTierNames(map)
    }

    // 거래처명 조회 (특별단가 이력용)
    const customerIds = [...new Set(data.filter(h => h.customer_id).map(h => h.customer_id!))]
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', customerIds)
      const map: Record<string, string> = {}
      customers?.forEach(c => { map[c.id] = c.name })
      setCustomerNames(map)
    }
  }

  const getHistoryLabel = (h: PriceHistoryItem): string => {
    if (h.change_type === 'consumer') return '소비자가'
    if (h.change_type === 'tier' && h.tier_id) return tierNames[h.tier_id] || '등급'
    if (h.change_type === 'special' && h.customer_id) return `특별단가 (${customerNames[h.customer_id] || '거래처'})`
    return h.change_type
  }

  const getHistoryBadgeColor = (type: string): string => {
    if (type === 'consumer') return 'bg-blue-100 text-blue-700'
    if (type === 'tier') return 'bg-green-100 text-green-700'
    return 'bg-purple-100 text-purple-700'
  }

  const addAlias = async () => {
    const text = newAlias.trim()
    if (!text) return
    const { error } = await supabase.from('product_aliases').insert({
      product_id: id,
      alias: text,
    })
    if (error) {
      if (error.code === '23505') alert('이미 등록된 별칭입니다.')
      else alert('별칭 추가 실패: ' + error.message)
      return
    }
    setNewAlias('')
    loadData()
  }

  const deleteAlias = async (aliasId: string, aliasText: string) => {
    if (!confirm(`별칭 "${aliasText}"을(를) 삭제하시겠습니까?`)) return
    await supabase.from('product_aliases').delete().eq('id', aliasId)
    loadData()
  }

  const handleSave = async () => {
    setLoading(true)

    await supabase.from('products').update({ name }).eq('id', id)

    for (const tier of priceTiers) {
      const price = (prices[tier.id] || '').replace(/,/g, '')
      const { data: existing } = await supabase
        .from('product_prices')
        .select('id')
        .eq('product_id', id)
        .eq('tier_id', tier.id)
        .single()

      if (existing) {
        if (price) {
          await supabase
            .from('product_prices')
            .update({ price: parseFloat(price) })
            .eq('id', existing.id)
        } else {
          await supabase.from('product_prices').delete().eq('id', existing.id)
        }
      } else if (price) {
        await supabase.from('product_prices').insert({
          product_id: id,
          tier_id: tier.id,
          price: parseFloat(price),
        })
      }

      // 가격 변동 이력 기록 (원가 제외, 실제 변경만)
      if (tier.level >= 1 && price) {
        const oldPrice = originalPrices[tier.id]
        const newPrice = parseFloat(price)
        if (oldPrice !== undefined && oldPrice !== newPrice) {
          await recordPriceChange({
            supabase,
            product_id: id as string,
            change_type: tier.level === 1 ? 'consumer' : 'tier',
            tier_id: tier.id,
            old_price: oldPrice,
            new_price: newPrice,
          })
        }
      }
    }

    alert('저장되었습니다!')
    setLoading(false)
    loadData()
    loadHistory()
  }

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    await supabase.from('product_prices').delete().eq('product_id', id)
    await supabase.from('products').delete().eq('id', id)
    router.push('/products')
  }

  return (
    <div className="max-w-lg mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <div className="flex items-center mb-6">
        <Link href="/products" className="text-gray-500 mr-3">&larr; 목록</Link>
        <h1 className="text-2xl font-bold">상품 수정</h1>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">상품명 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">가격 설정</label>
          <div className="space-y-2">
            {priceTiers.map((t) => (
              <div key={t.id} className="flex items-center gap-3">
                <span className="w-24 text-sm text-gray-600">{t.name}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={prices[t.id] || ''}
                  onChange={(e) => setPrices(prev => ({ ...prev, [t.id]: rawPrice(e.target.value) }))}
                  onBlur={(e) => {
                    const v = rawPrice(e.target.value)
                    if (v) setPrices(prev => ({ ...prev, [t.id]: formatPrice(v) }))
                  }}
                  onFocus={(e) => {
                    const v = rawPrice(e.target.value)
                    if (v) setPrices(prev => ({ ...prev, [t.id]: v }))
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? '저장 중...' : '저장하기'}
        </button>
        <Link
          href={`/products/${id}/options`}
          className="block w-full py-2 px-4 bg-amber-500 text-white rounded-md hover:bg-amber-600 text-center"
        >
          옵션 설정
        </Link>
        <button
          onClick={handleDelete}
          className="w-full py-2 px-4 bg-red-500 text-white rounded-md hover:bg-red-600"
        >
          삭제
        </button>

        {/* 별칭 관리 */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h2 className="text-lg font-bold mb-3">별칭 관리</h2>
          <p className="text-xs text-gray-500 mb-3">
            AI 주문인식에서 이 별칭으로 들어온 메시지를 자동으로 이 상품에 매칭합니다.
          </p>

          {/* 별칭 추가 */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAlias()}
              placeholder="새 별칭 입력 (예: 까클)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <button
              onClick={addAlias}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm whitespace-nowrap"
            >
              추가
            </button>
          </div>

          {/* 별칭 목록 */}
          {aliases.length === 0 ? (
            <p className="text-sm text-gray-400">등록된 별칭이 없습니다.</p>
          ) : (
            <div className="space-y-1">
              {aliases.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md">
                  <span className="text-sm font-medium">{a.alias}</span>
                  <button
                    onClick={() => deleteAlias(a.id, a.alias)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >삭제</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 가격 변동 이력 */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h2 className="text-lg font-bold mb-3">가격 변동 이력</h2>
          {history.length === 0 ? (
            <p className="text-sm text-gray-400">가격 변동 이력이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {new Date(h.created_at).toLocaleDateString('ko-KR')}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getHistoryBadgeColor(h.change_type)}`}>
                      {getHistoryLabel(h)}
                    </span>
                  </div>
                  <span className="text-sm">
                    {Number(h.old_price).toLocaleString()}원
                    <span className="mx-1 text-gray-400">&rarr;</span>
                    {Number(h.new_price).toLocaleString()}원
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
