'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/lib/ToastContext'
import { TIER_LEVEL, paramToString } from '@/lib/utils'
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
  product_id: string
  products: { name: string } | { name: string }[] | null
}

type Payment = {
  payment_date: string
  amount: number
  note: string
}

export default function InvoiceDetailPage() {
  const { id: rawId } = useParams()
  const id = paramToString(rawId as string | string[])
  const router = useRouter()
  const toast = useToast()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [recentPayments, setRecentPayments] = useState<Payment[]>([])
  const [previousUnpaid, setPreviousUnpaid] = useState(0)
  const [consumerPrices, setConsumerPrices] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  const handleDownloadPNG = async () => {
    if (!printRef.current) return
    const { toPng } = await import('html-to-image')
    const el = printRef.current
    const originalStyle = el.style.cssText
    el.style.width = '800px'
    el.style.maxWidth = '800px'
    el.style.margin = '0'
    el.style.padding = '32px'
    const dataUrl = await toPng(el, {
      quality: 1.0,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      width: 800,
    })
    el.style.cssText = originalStyle
    const link = document.createElement('a')
    link.download = `명세서_${customer?.name || ''}_${invoice?.period_start}_${invoice?.period_end}.png`
    link.href = dataUrl
    link.click()
  }

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
        .select('id, order_date, quantity, unit_price, total, note, options, product_id, products(name)')
        .eq('invoice_id', id)
        .order('order_date'),
    ])

    setCustomer(cust || null)
    setCompany(comp || null)
    setTransactions(txs || [])

    // 소비자가 조회 (price_tiers level=1)
    if (txs && txs.length > 0) {
      const { data: consumerTier } = await supabase
        .from('price_tiers')
        .select('id')
        .eq('level', TIER_LEVEL.CONSUMER)
        .single()

      if (consumerTier) {
        const productIds = [...new Set(txs.map((t: Transaction) => t.product_id))]
        const { data: prices } = await supabase
          .from('product_prices')
          .select('product_id, price')
          .eq('tier_id', consumerTier.id)
          .in('product_id', productIds)

        if (prices) {
          const priceMap: Record<string, number> = {}
          prices.forEach((p: { product_id: string; price: number }) => {
            priceMap[p.product_id] = p.price
          })
          setConsumerPrices(priceMap)
        }
      }
    }

    // 이전 미수금 계산
    const { data: prevInvoices } = await supabase
      .from('invoices')
      .select('total_amount')
      .eq('customer_id', inv.customer_id)
      .neq('id', inv.id)
      .lt('created_at', inv.created_at)

    const prevInvoiceTotal = (prevInvoices || []).reduce((sum, i) => sum + (i.total_amount || 0), 0)

    const { data: payments } = await supabase
      .from('payments')
      .select('payment_date, amount, note')
      .eq('customer_id', inv.customer_id)
      .order('payment_date', { ascending: false })

    const totalPayments = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0)

    setPreviousUnpaid(prevInvoiceTotal - totalPayments)
    setRecentPayments((payments || []).slice(0, 10))
    setLoading(false)
  }

  const getProductName = (t: Transaction): string => {
    const name = t.products
      ? Array.isArray(t.products) ? t.products[0]?.name || '-' : t.products.name
      : '-'
    if (t.options && Object.keys(t.options).length > 0) {
      // 빈 문자열 옵션값 제거
      const validValues = Object.values(t.options).filter(v => v && v.trim() !== '')
      if (validValues.length > 0) {
        return `${name} (${validValues.join(', ')})`
      }
    }
    return name
  }

  const handleDelete = async () => {
    if (!confirm('이 명세서를 삭제하시겠습니까? 거래 내역의 연결도 해제됩니다.')) return

    const { error: unlinkError } = await supabase
      .from('transactions')
      .update({ invoice_id: null })
      .eq('invoice_id', id)

    if (unlinkError) return toast.error('거래 연결 해제 실패: ' + unlinkError.message)

    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) return toast.error('명세서 삭제 실패: ' + error.message)
    router.push('/invoices')
  }

  const handleStatusChange = async (newStatus: string) => {
    const { error } = await supabase
      .from('invoices')
      .update({ status: newStatus })
      .eq('id', id)
    if (error) return toast.error('상태 변경 실패: ' + error.message)
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
            PDF / 인쇄
          </button>
          <button
            onClick={handleDownloadPNG}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
          >
            PNG 이미지
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
          >
            삭제
          </button>
        </div>
      </div>

      <div ref={printRef} className="print-area max-w-3xl mx-auto mt-4 mb-10 p-8 bg-white rounded-lg shadow-sm border">
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
              <th className="text-right px-3 py-2 font-medium">소비자가</th>
              <th className="text-right px-3 py-2 font-medium">단가</th>
              <th className="text-right px-3 py-2 font-medium">합계</th>
              <th className="text-left px-3 py-2 font-medium">비고</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const cp = consumerPrices[t.product_id]
              return (
                <tr key={t.id} className="border-b border-gray-200">
                  <td className="px-3 py-2">{t.order_date}</td>
                  <td className="px-3 py-2">{getProductName(t)}</td>
                  <td className="px-3 py-2 text-right">{t.quantity}</td>
                  <td className="px-3 py-2 text-right text-gray-400">{cp ? cp.toLocaleString() : '-'}</td>
                  <td className="px-3 py-2 text-right">{t.unit_price?.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{t.total?.toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-500">{t.note || ''}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-800">
              <td colSpan={5} className="px-3 py-3 text-right font-bold">이번 거래 합계</td>
              <td className="px-3 py-3 text-right font-bold text-lg">
                {invoice.total_amount?.toLocaleString()}원
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        {/* 최근 입금 내역 */}
        {recentPayments.length > 0 && (
          <div className="mt-6 border-t border-gray-300 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">최근 입금 내역</p>
            <table className="w-full text-sm">
              <tbody>
                {recentPayments.map((p, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-3 py-1 text-gray-600">{p.payment_date}</td>
                    <td className="px-3 py-1 text-right text-green-600">+{p.amount?.toLocaleString()}원</td>
                    <td className="px-3 py-1 text-gray-400">{p.note || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
