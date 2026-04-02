'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Invoice = {
  id: string
  issue_date: string
  period_start: string
  period_end: string
  total_amount: number
  status: string
  customer_id: string
  created_at: string
}

type Customer = {
  name: string
  representative: string
  phone: string
  business_number: string
}

type Company = {
  name: string
  phone: string
  bank_account: string
  business_number: string
}

type Transaction = {
  id: string
  order_date: string
  quantity: number
  unit_price: number
  total: number
  note: string
  options: Record<string, string> | null
  products: { name: string } | null
}

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [previousUnpaid, setPreviousUnpaid] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data: inv } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single()

    if (!inv) {
      setLoading(false)
      return
    }
    setInvoice(inv)

    const [{ data: cust }, { data: comp }, { data: txs }] = await Promise.all([
      supabase.from('customers').select('name, representative, phone, business_number').eq('id', inv.customer_id).single(),
      supabase.from('company_info').select('name, phone, bank_account, business_number').single(),
      supabase.from('transactions')
        .select('id, order_date, quantity, unit_price, total, note, options, products(name)')
        .eq('invoice_id', id)
        .order('order_date'),
    ])

    setCustomer(cust || null)
    setCompany(comp || null)
    setTransactions(txs || [])

    // 이전 미수금 계산: 이전 명세서 총액 - 총 입금액
    const { data: prevInvoices } = await supabase
      .from('invoices')
      .select('total_amount')
      .eq('customer_id', inv.customer_id)
      .neq('id', inv.id)
      .lt('created_at', inv.created_at)

    const prevInvoiceTotal = (prevInvoices || []).reduce((sum, i) => sum + (i.total_amount || 0), 0)

    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .eq('customer_id', inv.customer_id)

    const totalPayments = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0)

    setPreviousUnpaid(prevInvoiceTotal - totalPayments)
    setLoading(false)
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

  const handleDelete = async () => {
    if (!confirm('이 명세서를 삭제하시겠습니까? 거래 내역의 연결도 해제됩니다.')) return

    await supabase
      .from('transactions')
      .update({ invoice_id: null })
      .eq('invoice_id', id)

    await supabase.from('invoices').delete().eq('id', id)
    router.push('/invoices')
  }

  const handleStatusChange = async (newStatus: string) => {
    await supabase
      .from('invoices')
      .update({ status: newStatus })
      .eq('id', id)
    setInvoice((prev) => prev ? { ...prev, status: newStatus } : null)
  }

  if (loading) return <div className="max-w-3xl mx-auto mt-10 p-6">불러오는 중...</div>
  if (!invoice) return <div className="max-w-3xl mx-auto mt-10 p-6">명세서를 찾을 수 없습니다.</div>

  const totalUnpaid = previousUnpaid + (invoice.total_amount || 0)

  return (
    <>
      <style jsx global>{`
        @media print {
          nav, .no-print { display: none !important; }
          body { background: white !important; -webkit-print-color-adjust: exact; }
          .print-area { margin: 0 !important; padding: 20px !important; max-width: 100% !important; box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="no-print max-w-3xl mx-auto mt-6 px-6 flex items-center justify-between">
        <Link href="/invoices" className="text-gray-500">← 목록</Link>
        <div className="flex gap-2">
          <select
            value={invoice.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="미발송">미발송</option>
            <option value="발송완료">발송완료</option>
            <option value="입금완료">입금완료</option>
          </select>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
          >
            PDF 다운로드 / 인쇄
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
          >
            삭제
          </button>
        </div>
      </div>

      <div className="print-area max-w-3xl mx-auto mt-4 mb-10 p-8 bg-white rounded-lg shadow-sm border">
        <h1 className="text-2xl font-bold text-center mb-8">거 래 명 세 서</h1>

        <div className="flex justify-between mb-8">
          <div className="flex-1">
            <h2 className="text-sm text-gray-500 mb-2">수 신</h2>
            <table className="text-sm">
              <tbody>
                <tr>
                  <td className="pr-3 text-gray-500 py-0.5">상호</td>
                  <td className="font-medium text-lg">{customer?.name || '-'}</td>
                </tr>
                {customer?.business_number && (
                  <tr>
                    <td className="pr-3 text-gray-500 py-0.5">사업자번호</td>
                    <td>{customer.business_number}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex-1 text-right">
            <h2 className="text-sm text-gray-500 mb-2">발 신</h2>
            <table className="text-sm ml-auto">
              <tbody>
                <tr>
                  <td className="pr-3 text-gray-500 py-0.5">상호</td>
                  <td className="font-medium">{company?.name || '-'}</td>
                </tr>
                {company?.phone && (
                  <tr>
                    <td className="pr-3 text-gray-500 py-0.5">연락처</td>
                    <td>{company.phone}</td>
                  </tr>
                )}
                {company?.business_number && (
                  <tr>
                    <td className="pr-3 text-gray-500 py-0.5">사업자번호</td>
                    <td>{company.business_number}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-6 text-sm text-gray-600">
          <span>거래기간: {invoice.period_start} ~ {invoice.period_end}</span>
          <span className="ml-6">발행일: {invoice.issue_date}</span>
        </div>

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-t-2 border-b border-gray-800">
              <th className="text-left px-3 py-2 font-medium">주문일</th>
              <th className="text-left px-3 py-2 font-medium">상품명</th>
              <th className="text-right px-3 py-2 font-medium">수량</th>
              <th className="text-right px-3 py-2 font-medium">단가</th>
              <th className="text-right px-3 py-2 font-medium">합계</th>
              <th className="text-left px-3 py-2 font-medium">비고</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b border-gray-200">
                <td className="px-3 py-2">{t.order_date}</td>
                <td className="px-3 py-2">{getProductName(t)}</td>
                <td className="px-3 py-2 text-right">{t.quantity}</td>
                <td className="px-3 py-2 text-right">{t.unit_price?.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{t.total?.toLocaleString()}</td>
                <td className="px-3 py-2 text-gray-500">{t.note || ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-800">
              <td colSpan={4} className="px-3 py-3 text-right font-bold">이번 거래 합계</td>
              <td className="px-3 py-3 text-right font-bold text-lg">
                {invoice.total_amount?.toLocaleString()}원
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        {/* 미수금 요약 */}
        <div className="mt-6 border-t-2 border-gray-800 pt-4">
          <table className="w-full text-sm">
            <tbody>
              {previousUnpaid !== 0 && (
                <tr>
                  <td className="px-3 py-2 text-right text-gray-600">이전 미수금</td>
                  <td className="px-3 py-2 text-right w-40 font-medium">
                    {previousUnpaid.toLocaleString()}원
                  </td>
                </tr>
              )}
              <tr>
                <td className="px-3 py-2 text-right font-bold text-lg">현재 총 미수금</td>
                <td className="px-3 py-2 text-right w-40 font-bold text-lg text-red-600">
                  {totalUnpaid.toLocaleString()}원
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 입금 계좌 */}
        {company?.bank_account && (
          <div className="mt-8 p-4 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-500 mb-1">입금 계좌</p>
            <p className="font-medium">{company.bank_account}</p>
          </div>
        )}
      </div>
    </>
  )
}
