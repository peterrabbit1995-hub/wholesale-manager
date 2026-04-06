'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type PriceTier = {
  id: string
  name: string
  level: number
}

export default function NewProductPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadPriceTiers()
  }, [])

  const loadPriceTiers = async () => {
    const { data } = await supabase
      .from('price_tiers')
      .select('id, name, level')
      .order('level')
    setPriceTiers(data || [])
  }

  const handleSave = async () => {
    if (!name) return alert('상품명을 입력해주세요.')
    setLoading(true)

    const { data: product, error } = await supabase
      .from('products')
      .insert({ name })
      .select()
      .single()

    if (error || !product) {
      alert('상품 저장 실패: ' + error?.message)
      setLoading(false)
      return
    }

    const priceRows = priceTiers
      .filter((t) => prices[t.id])
      .map((t) => ({
        product_id: product.id,
        tier_id: t.id,
        price: parseFloat(prices[t.id]),
      }))

    if (priceRows.length > 0) {
      await supabase.from('product_prices').insert(priceRows)
    }

    router.push(`/products/${product.id}`)
    setLoading(false)
  }

  return (
    <div className="max-w-lg mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <div className="flex items-center mb-6">
        <Link href="/products" className="text-gray-500 mr-3">← 목록</Link>
        <h1 className="text-2xl font-bold">새 상품 등록</h1>
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
                  type="number"
                  placeholder="0"
                  value={prices[t.id] || ''}
                  onChange={(e) => setPrices({ ...prices, [t.id]: e.target.value })}
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
      </div>
    </div>
  )
}