'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Transaction = {
  id: string
  order_date: string
  quantity: number
  unit_price: number
  total: number
  customers: { name: string } | null
  products: { name: string } | null
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTransactions()
  }, [])

  const loadTransactions = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('id, order_date, quantity, unit_price, total, customers(name), products(name)')
      .order('order_date', { ascending: false })
    setTransactions(data || [])
    setLoading(false)
  }

  const getName = (field: { name: string } | { name: string }[] | null) => {
    if (!field) return '-'
    if (Array.isArray(field)) return field[0]?.name || '-'
    return field.name
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">거래 목록</h1>
        <Link
          href="/transactions/new"
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          + 새 거래
        </Link>
      </div>
      {loading ? (
        <p>불러오는 중...</p>
      ) : transactions.length === 0 ? (
        <p className="text-gray-500">거래 내역이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => (
            <Link
              key={t.id}
              href={`/transactions/${t.id}`}
              className="block p-4 bg-white rounded-lg shadow-sm hover:bg-gray-50 border"
            >
              <div className="flex justify-between">
                <span className="font-medium">{getName(t.customers)}</span>
                <span className="text-gray-500 text-sm">{t.order_date}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-gray-600 text-sm">{getName(t.products)} × {t.quantity}</span>
                <span className="font-medium">{t.total?.toLocaleString()}원</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
