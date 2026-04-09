'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AdminGuard from '@/components/AdminGuard'
import { useToast } from '@/lib/ToastContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Customer = { id: string; name: string }
type Transaction = {
  id: string
  order_date: string
  quantity: number
  unit_price: number
  total: number
  note: string
  options: Record<string, string> | null
  show_options_on_invoice: boolean | null
  products: { name: string } | { name: string }[] | null
  invoice_id: string | null
}

export default function NewInvoicePage() {
  return (
    <AdminGuard>
      <NewInvoicePageContent />
    </AdminGuard>
  )
}

function NewInvoicePageContent() {
  const router = useRouter()
  const toast = useToast()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerId, setCustomerId] = useState('')
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 7) + '-01'
  const [periodStart, setPeriodStart] = useState(firstOfMonth)
  const [periodEnd, setPeriodEnd] = useState(today)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    setCustomers(data || [])
  }

  const handleCustomerChange = async (selectedId: string) => {
    setCustomerId(selectedId)
    setSearched(false)

    if (!selectedId) {
      setPeriodStart(firstOfMonth)
      return
    }

    const { data } = await supabase
      .from('transactions')
      .select('order_date')
      .eq('customer_id', selectedId)
      .is('invoice_id', null)
      .order('order_date', { ascending: true })
      .limit(1)

    if (data && data.length > 0) {
      setPeriodStart(data[0].order_date)
    } else {
      setPeriodStart(firstOfMonth)
    }
  }

  const getProductName = (t: Transaction): string => {
    const name = t.products
      ? Array.isArray(t.products) ? t.products[0]?.name || '-' : t.products.name
      : '-'
    if (t.options && Object.keys(t.options).length > 0) {
      const optStr = Object.values(t.options).join(', ')
      return `${name} (${optStr})`
    }
    return name
  }

  const handleSearch = async () => {
    if (!customerId || !periodStart || !periodEnd) {
      return toast.error('거래처와 기간을 모두 선택해주세요.')
    }
    if (periodStart > periodEnd) {
      return toast.error('시작일이 종료일보다 늦습니다.')
    }

    const { data } = await supabase
      .from('transactions')
      .select('id, order_date, quantity, unit_price, total, note, options, show_options_on_invoice, invoice_id, products(name)')
      .eq('customer_id', customerId)
      .gte('order_date', periodStart)
      .lte('order_date', periodEnd)
      .order('order_date')

    setTransactions(data || [])
    setSearched(true)
  }

  const uninvoiced = transactions.filter((t) => !t.invoice_id)
  const alreadyInvoiced = transactions.filter((t) => t.invoice_id)
  const totalAmount = uninvoiced.reduce((sum, t) => sum + (t.total || 0), 0)

  const handleCreate = async () => {
    if (uninvoiced.length === 0) {
      return toast.error('명세서에 포함할 거래 내역이 없습니다.')
    }

    setLoading(true)

    const txIds = uninvoiced.map((t) => t.id)

    const { data: invoiceId, error } = await supabase.rpc('create_invoice_with_transactions', {
      p_customer_id: customerId,
      p_issue_date: new Date().toISOString().split('T')[0],
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_total_amount: totalAmount,
      p_status: '미발송',
      p_transaction_ids: txIds,
    })

    if (error) {
      toast.error('명세서 생성 실패: ' + error.message)
      setLoading(false)
      return
    }

    router.push(`/invoices/${invoiceId}`)
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6">
      <div className="flex items-center mb-6">
        <Link href="/invoices" className="text-gray-500 mr-3">← 목록</Link>
        <h1 className="text-2xl font-bold">명세서 생성</h1>
      </div>

      {/* 조건 선택 */}
      <div className="p-4 bg-white rounded-lg shadow-sm border mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">거래처 *</label>
          <select
            value={customerId}
            onChange={(e) => handleCustomerChange(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">거래처 선택</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">시작일 *</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => { setPeriodStart(e.target.value); setSearched(false) }}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">종료일 *</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => { setPeriodEnd(e.target.value); setSearched(false) }}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        <button
          onClick={handleSearch}
          className="w-full py-2 px-4 bg-gray-700 text-white rounded-md hover:bg-gray-800"
        >
          거래 내역 조회
        </button>
      </div>

      {/* 조회 결과 */}
      {searched && (
        <>
          {alreadyInvoiced.length > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700">
              이미 명세서에 포함된 거래 {alreadyInvoiced.length}건은 제외됩니다.
            </div>
          )}

          {uninvoiced.length === 0 ? (
            <p className="text-gray-500">해당 기간에 명세서에 포함할 거래 내역이 없습니다.</p>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <h2 className="text-sm font-medium text-gray-700">
                  포함될 거래 내역 ({uninvoiced.length}건)
                </h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">주문일</th>
                    <th className="text-left px-4 py-2 font-medium">상품</th>
                    <th className="text-right px-4 py-2 font-medium">수량</th>
                    <th className="text-right px-4 py-2 font-medium">단가</th>
                    <th className="text-right px-4 py-2 font-medium">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {uninvoiced.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="px-4 py-2">{t.order_date}</td>
                      <td className="px-4 py-2">{getProductName(t)}</td>
                      <td className="px-4 py-2 text-right">{t.quantity}</td>
                      <td className="px-4 py-2 text-right">{t.unit_price?.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">{t.total?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-bold">
                  <tr className="border-t">
                    <td colSpan={4} className="px-4 py-3 text-right">총합계</td>
                    <td className="px-4 py-3 text-right">{totalAmount.toLocaleString()}원</td>
                  </tr>
                </tfoot>
              </table>

              <div className="p-4 border-t">
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? '생성 중...' : '명세서 생성'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
