 'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Customer = {
  id: string
  name: string
  phone: string
  price_tiers: { name: string } | { name: string }[] | null
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone, price_tiers(name)')
      .order('name')
    setCustomers(data || [])
    setLoading(false)
  }

  const filtered = customers.filter((c) =>
    c.name.includes(search) || (c.phone || '').includes(search)
  )

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">거래처 목록</h1>
        <Link
          href="/customers/new"
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          + 새 거래처
        </Link>
      </div>
      <input
        type="text"
        placeholder="상호명 또는 연락처 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
      />
      {loading ? (
        <p>불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">거래처가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/customers/${c.id}`}
              className="block p-4 bg-white rounded-lg shadow-sm hover:bg-gray-50 border"
            >
              <div className="flex justify-between">
                <span className="font-medium">{c.name}</span>
                <span className="text-gray-500 text-sm">{Array.isArray(c.price_tiers) ? c.price_tiers[0]?.name : c.price_tiers?.name || '등급 미설정'}</span>
              </div>
              <div className="text-gray-400 text-sm mt-1">{c.phone || '연락처 없음'}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
