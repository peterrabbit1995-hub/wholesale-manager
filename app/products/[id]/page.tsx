'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

type PriceTier = {
  id: string
  name: string
  level: number
}

export default function ProductDetailPage() {
  const router = useRouter()
  const { id } = useParams()
  const [name, setName] = useState('')
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [{ data: product }, { data: tiers }, { data: productPrices }] =
      await Promise.all([
        supabase.from('products').select('*').eq('id', id).single(),
        supabase.from('price_tiers').select('id, name, level').order('level'),
        supabase.from('product_prices').select('tier_id, price').eq('product_id', id),
      ])

    if (product) setName(product.name || '')
    setPriceTiers(tiers || [])

    const priceMap: Record<string, string> = {}
    productPrices?.forEach((p) => {
      priceMap[p.tier_id] = String(p.price)
    })
    setPrices(priceMap)
  }

  const handleSave = async () => {
    setLoading(true)

    await supabase.from('products').update({ name }).eq('id', id)

    for (const tier of priceTiers) {
      const price = prices[tier.id]
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
    }

    alert('저장되었습니다!')
    setLoading(false)
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
        <Link href="/products" className="text-gray-500 mr-3">← 목록</Link>
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
        <button
          onClick={handleDelete}
          className="w-full py-2 px-4 bg-red-500 text-white rounded-md hover:bg-red-600"
        >
          삭제
        </button>
      </div>
    </div>
  )
}