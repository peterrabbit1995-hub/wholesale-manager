'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AdminGuard from '@/components/AdminGuard'
import Link from 'next/link'

type Product = {
  id: string
  name: string
}

export default function ProductsPage() {
  return (
    <AdminGuard>
      <ProductsPageContent />
    </AdminGuard>
  )
}

function ProductsPageContent() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [tierCount, setTierCount] = useState(0)
  const [priceCountMap, setPriceCountMap] = useState<Record<string, number>>({})
  const perPage = 10

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    const [{ data: productsData }, { data: tiers }, { data: prices }] = await Promise.all([
      supabase.from('products').select('id, name').eq('is_active', true).order('name'),
      supabase.from('price_tiers').select('id'),
      supabase.from('product_prices').select('product_id, tier_id'),
    ])

    setProducts(productsData || [])
    setTierCount(tiers?.length || 0)

    const countMap: Record<string, number> = {}
    for (const p of prices || []) {
      countMap[p.product_id] = (countMap[p.product_id] || 0) + 1
    }
    setPriceCountMap(countMap)
    setLoading(false)
  }

  const filtered = products.filter((p) =>
    !search || search.toLowerCase().split(' ').every(word => p.name.toLowerCase().includes(word))
  )

  const totalPages = Math.ceil(filtered.length / perPage)
  const paged = filtered.slice((page - 1) * perPage, page * perPage)

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">상품 목록</h1>
        <Link
          href="/products/new"
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          + 새 상품
        </Link>
      </div>
      <input
        type="text"
        placeholder="상품명 검색 (예: 아담 상대)"
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
      />
      {loading ? (
        <p>불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">상품이 없습니다.</p>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-2">총 {filtered.length}개</p>
          <div className="space-y-2">
            {paged.map((p) => {
              const set = priceCountMap[p.id] || 0
              const complete = tierCount > 0 && set >= tierCount
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm hover:bg-gray-50 border"
                >
                  <span className="font-medium">{p.name}</span>
                  <span
                    className={`text-sm font-medium ${complete ? 'text-green-600' : 'text-gray-400'}`}
                  >
                    {set}/{tierCount}
                  </span>
                </Link>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded-md text-sm disabled:opacity-30"
              >
                ← 이전
              </button>
              <span className="text-sm text-gray-600">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border rounded-md text-sm disabled:opacity-30"
              >
                다음 →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
