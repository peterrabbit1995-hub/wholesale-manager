'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminGuard from '@/components/AdminGuard'
import { useToast } from '@/lib/ToastContext'
import * as XLSX from 'xlsx'
import Link from 'next/link'

export default function ExportPage() {
  return (
    <AdminGuard>
      <ExportPageContent />
    </AdminGuard>
  )
}

function ExportPageContent() {
  const toast = useToast()
  const [loading, setLoading] = useState<string | null>(null)
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 7) + '-01'
  const [periodStart, setPeriodStart] = useState(firstOfMonth)
  const [periodEnd, setPeriodEnd] = useState(today)

  // 파일 다운로드 헬퍼
  const downloadExcel = (rows: Record<string, unknown>[], sheetName: string, fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, fileName)
  }

  // 1. 상품 데이터 다운로드
  const exportProducts = async () => {
    setLoading('products')
    try {
      // 상품 + 등급별 가격 + 판매 통계
      const [{ data: products }, { data: tiers }, { data: prices }, { data: stats }] = await Promise.all([
        supabase.from('products').select('id, name, created_at').eq('is_active', true).order('name'),
        supabase.from('price_tiers').select('id, name, level').order('level'),
        supabase.from('product_prices').select('product_id, tier_id, price'),
        supabase.rpc('get_product_stats'),
      ])

      if (!products || !tiers) {
        toast.error('데이터 조회 실패')
        return
      }

      const statsMap = new Map<string, { total_quantity: number; total_revenue: number }>()
      ;(stats || []).forEach((s: { product_id: string; total_quantity: number; total_revenue: number }) => {
        statsMap.set(s.product_id, { total_quantity: s.total_quantity, total_revenue: s.total_revenue })
      })

      const priceMap = new Map<string, number>()
      ;(prices || []).forEach((p) => {
        priceMap.set(`${p.product_id}::${p.tier_id}`, p.price)
      })

      const rows = products.map((p) => {
        const row: Record<string, unknown> = {
          상품명: p.name,
          등록일: p.created_at?.split('T')[0] || '',
        }
        tiers.forEach((t) => {
          row[t.name] = priceMap.get(`${p.id}::${t.id}`) || ''
        })
        const stat = statsMap.get(p.id)
        row['총 판매수량'] = stat?.total_quantity || 0
        row['총 매출액'] = stat?.total_revenue || 0
        return row
      })

      downloadExcel(rows, '상품', `상품데이터_${today}.xlsx`)
      toast.success('상품 데이터 다운로드 완료')
    } catch (e) {
      toast.error('다운로드 실패: ' + (e as Error).message)
    }
    setLoading(null)
  }

  // 2. 거래처 데이터 다운로드
  const exportCustomers = async () => {
    setLoading('customers')
    try {
      const { data, error } = await supabase.rpc('get_customer_stats')
      if (error) {
        toast.error('조회 실패: ' + error.message)
        setLoading(null)
        return
      }

      const rows = (data || []).map((c: {
        customer_name: string
        total_amount: number
        transaction_count: number
        top_product: string
        top_product_qty: number
      }) => ({
        거래처명: c.customer_name,
        '누적 거래액': c.total_amount,
        '거래 건수': c.transaction_count,
        '가장 많이 주문한 상품': c.top_product,
        '해당 상품 수량': c.top_product_qty,
      }))

      downloadExcel(rows, '거래처', `거래처데이터_${today}.xlsx`)
      toast.success('거래처 데이터 다운로드 완료')
    } catch (e) {
      toast.error('다운로드 실패: ' + (e as Error).message)
    }
    setLoading(null)
  }

  // 3. 거래 내역 다운로드 (기간 선택)
  const exportTransactions = async () => {
    if (periodStart > periodEnd) {
      return toast.error('시작일이 종료일보다 늦습니다.')
    }
    setLoading('transactions')
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('order_date, quantity, unit_price, total, options, note, customers(name), products(name)')
        .gte('order_date', periodStart)
        .lte('order_date', periodEnd)
        .order('order_date')

      if (error) {
        toast.error('조회 실패: ' + error.message)
        setLoading(null)
        return
      }

      const rows = (data || []).map((t: Record<string, unknown>) => {
        const customer = t.customers as { name: string } | { name: string }[] | null
        const product = t.products as { name: string } | { name: string }[] | null
        const customerName = customer
          ? Array.isArray(customer) ? customer[0]?.name || '-' : customer.name
          : '-'
        const productName = product
          ? Array.isArray(product) ? product[0]?.name || '-' : product.name
          : '-'
        const opts = t.options as Record<string, string> | null
        const optStr = opts && Object.keys(opts).length > 0
          ? Object.entries(opts).map(([k, v]) => `${k}:${v}`).join(', ')
          : ''

        return {
          주문일: t.order_date,
          거래처: customerName,
          상품: productName,
          옵션: optStr,
          수량: t.quantity,
          단가: t.unit_price,
          합계: t.total,
          비고: t.note || '',
        }
      })

      downloadExcel(rows, '거래내역', `거래내역_${periodStart}_${periodEnd}.xlsx`)
      toast.success(`거래 내역 ${rows.length}건 다운로드 완료`)
    } catch (e) {
      toast.error('다운로드 실패: ' + (e as Error).message)
    }
    setLoading(null)
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6">
      <div className="flex items-center mb-6">
        <Link href="/dashboard" className="text-gray-500 mr-3">← 메인</Link>
        <h1 className="text-2xl font-bold">엑셀 내보내기</h1>
      </div>

      <div className="space-y-4">
        {/* 상품 데이터 */}
        <div className="p-4 bg-white rounded-lg shadow-sm border">
          <h2 className="font-medium mb-2">📦 상품 데이터</h2>
          <p className="text-sm text-gray-500 mb-3">
            전체 상품의 등급별 가격, 총 판매수량, 총 매출액
          </p>
          <button
            onClick={exportProducts}
            disabled={loading !== null}
            className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading === 'products' ? '다운로드 중...' : '상품 데이터 다운로드'}
          </button>
        </div>

        {/* 거래처 데이터 */}
        <div className="p-4 bg-white rounded-lg shadow-sm border">
          <h2 className="font-medium mb-2">👥 거래처 데이터</h2>
          <p className="text-sm text-gray-500 mb-3">
            거래처별 누적 거래액, 거래 건수, 가장 많이 주문한 상품
          </p>
          <button
            onClick={exportCustomers}
            disabled={loading !== null}
            className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading === 'customers' ? '다운로드 중...' : '거래처 데이터 다운로드'}
          </button>
        </div>

        {/* 거래 내역 (기간 선택) */}
        <div className="p-4 bg-white rounded-lg shadow-sm border">
          <h2 className="font-medium mb-2">📋 거래 내역</h2>
          <p className="text-sm text-gray-500 mb-3">
            기간별 전체 거래 목록 (날짜, 거래처, 상품, 수량, 단가, 합계)
          </p>
          <div className="flex gap-2 mb-3">
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <span className="self-center text-gray-400">~</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <button
            onClick={exportTransactions}
            disabled={loading !== null}
            className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading === 'transactions' ? '다운로드 중...' : '거래 내역 다운로드'}
          </button>
        </div>
      </div>
    </div>
  )
}
