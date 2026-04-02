'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Invoice = {
  id: string
  issue_date: string
  period_start: string
  period_end: string
  total_amount: number
  status: string
  customers: { name: string } | null
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInvoices()
  }, [])

  const loadInvoices = async () => {
    const { data } = await supabase
      .from('invoices')
      .select('id, issue_date, period_start, period_end, total_amount, status, customers(name)')
      .order('issue_date', { ascending: false })
    setInvoices(data || [])
    setLoading(false)
  }

  const getName = (field: { name: string } | { name: string }[] | null) => {
    if (!field) return '-'
    if (Array.isArray(field)) return field[0]?.name || '-'
    return field.name
  }

  const statusColor = (status: string) => {
    if (status === '입금완료') return 'bg-green-100 text-green-700'
    if (status === '발송완료') return 'bg-blue-100 text-blue-700'
    return 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">명세서 목록</h1>
        <Link
          href="/invoices/new"
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          + 명세서 생성
        </Link>
      </div>
      {loading ? (
        <p>불러오는 중...</p>
      ) : invoices.length === 0 ? (
        <p className="text-gray-500">생성된 명세서가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}`}
              className="block p-4 bg-white rounded-lg shadow-sm hover:bg-gray-50 border"
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">{getName(inv.customers)}</span>
                  <span className="text-gray-400 text-sm ml-2">
                    {inv.period_start} ~ {inv.period_end}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded ${statusColor(inv.status)}`}>
                    {inv.status}
                  </span>
                  <span className="font-medium">{inv.total_amount?.toLocaleString()}원</span>
                </div>
              </div>
              <div className="text-gray-400 text-sm mt-1">발행일: {inv.issue_date}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
