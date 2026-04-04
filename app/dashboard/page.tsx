'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function DashboardPage() {
  const [missingCount, setMissingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMissingCount()
  }, [])

  const loadMissingCount = async () => {
    const [{ data: products }, { data: tiers }, { data: prices }] = await Promise.all([
      supabase.from('products').select('id'),
      supabase.from('price_tiers').select('id'),
      supabase.from('product_prices').select('product_id, tier_id'),
    ])

    if (!products || !tiers) {
      setLoading(false)
      return
    }

    const priceSet = new Set(
      (prices || []).map((p) => `${p.product_id}::${p.tier_id}`)
    )

    let count = 0
    for (const product of products) {
      if (tiers.some((t) => !priceSet.has(`${product.id}::${t.id}`))) {
        count++
      }
    }

    setMissingCount(count)
    setLoading(false)
  }

  return (
    <div className="max-w-lg mx-auto mt-10 p-6">
      <h1 className="text-2xl font-bold mb-6">도매상 관리 시스템</h1>
      <div className="space-y-3">
        <Link
          href="/transactions"
          className="block p-4 bg-white rounded-lg shadow-md hover:bg-gray-50"
        >
          📋 거래 관리
        </Link>
        <Link
          href="/customers"
          className="block p-4 bg-white rounded-lg shadow-md hover:bg-gray-50"
        >
          👥 거래처 관리
        </Link>
        <Link
          href="/products"
          className="block p-4 bg-white rounded-lg shadow-md hover:bg-gray-50"
        >
          📦 상품 관리
          {!loading && missingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
              가격 미설정: {missingCount}개
            </span>
          )}
        </Link>
        <Link
          href="/settings/company"
          className="block p-4 bg-white rounded-lg shadow-md hover:bg-gray-50"
        >
          ⚙️ 회사 정보 설정
        </Link>
      </div>
    </div>
  )
}
