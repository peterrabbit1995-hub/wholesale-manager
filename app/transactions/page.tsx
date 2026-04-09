'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AdminGuard from '@/components/AdminGuard'
import { getName } from '@/lib/utils'
import Link from 'next/link'

type Transaction = {
  id: string
  order_date: string
  quantity: number
  unit_price: number
  total: number
  invoice_id: string | null
  customer_id: string
  customers: { name: string } | { name: string }[] | null
  products: { name: string } | { name: string }[] | null
}

type Customer = {
  id: string
  name: string
}

export default function TransactionsPage() {
  return (
    <AdminGuard>
      <TransactionsPageContent />
    </AdminGuard>
  )
}

function TransactionsPageContent() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'unlinked' | 'all'>('unlinked')
  const [customerFilter, setCustomerFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const perPage = 10

  useEffect(() => {
    loadCustomers()
  }, [])

  useEffect(() => {
    loadTransactions()
  }, [statusFilter, customerFilter, page])

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    setCustomers(data || [])
  }

  const loadTransactions = async () => {
    setLoading(true)
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    let countQuery = supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })

    let query = supabase
      .from('transactions')
      .select('id, order_date, quantity, unit_price, total, invoice_id, customer_id, customers(name), products(name)')
      .order('order_date', { ascending: false })
      .range(from, to)

    if (statusFilter === 'unlinked') {
      query = query.is('invoice_id', null)
      countQuery = countQuery.is('invoice_id', null)
    }

    if (customerFilter !== 'all') {
      query = query.eq('customer_id', customerFilter)
      countQuery = countQuery.eq('customer_id', customerFilter)
    }

    const [{ data }, { count }] = await Promise.all([query, countQuery])
    setTransactions(data || [])
    setTotalCount(count || 0)
    setLoading(false)
  }

  const totalPages = Math.ceil(totalCount / perPage)



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

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex rounded-md overflow-hidden border">
          <button
            onClick={() => { setStatusFilter('unlinked'); setPage(1) }}
            className={`px-4 py-2 text-sm font-medium ${
              statusFilter === 'unlinked'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            미처리
          </button>
          <button
            onClick={() => { setStatusFilter('all'); setPage(1) }}
            className={`px-4 py-2 text-sm font-medium ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            전체
          </button>
        </div>

        <select
          value={customerFilter}
          onChange={(e) => { setCustomerFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 border rounded-md text-sm bg-white"
        >
          <option value="all">전체 거래처</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {!loading && (
          <span className="text-sm text-gray-500">
            {totalCount}건
          </span>
        )}
      </div>

      {loading ? (
        <p>불러오는 중...</p>
      ) : transactions.length === 0 ? (
        <p className="text-gray-500">거래 내역이 없습니다.</p>
      ) : (
        <>
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
