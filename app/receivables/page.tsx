'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type CustomerReceivable = {
  customer_id: string
  customer_name: string
  total_invoiced: number
  total_paid: number
  unpaid: number
}

export default function ReceivablesPage() {
  const [receivables, setReceivables] = useState<CustomerReceivable[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data } = await supabase.rpc('get_receivables')
    setReceivables((data as CustomerReceivable[]) || [])
    setLoading(false)
  }

  const totalUnpaid = receivables.reduce((sum, r) => sum + r.unpaid, 0)
  const hasUnpaid = receivables.filter((r) => r.unpaid > 0)
  const fullyPaid = receivables.filter((r) => r.unpaid <= 0)

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6">
      <h1 className="text-2xl font-bold mb-6">미수금 현황</h1>

      {/* 총 미수금 요약 */}
      <div className="p-6 bg-white rounded-lg shadow-sm border mb-8">
        <p className="text-sm text-gray-500">총 미수금</p>
        <p className="text-3xl font-bold text-red-600 mt-1">
          {totalUnpaid.toLocaleString()}원
        </p>
        <p className="text-sm text-gray-400 mt-2">
          미수 거래처 {hasUnpaid.length}곳
        </p>
      </div>

      {loading ? (
        <p>불러오는 중...</p>
      ) : (
        <>
          {/* 미수금 있는 거래처 */}
          {hasUnpaid.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-medium text-gray-700 mb-3">미수금 거래처</h2>
              <div className="space-y-2">
                {hasUnpaid.map((r) => (
                  <div key={r.customer_id} className="p-4 bg-white rounded-lg shadow-sm border">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{r.customer_name}</span>
                      <span className="font-bold text-red-600">{r.unpaid.toLocaleString()}원</span>
                    </div>
                    <div className="flex justify-between mt-2 text-sm text-gray-400">
                      <span>명세서 합계: {r.total_invoiced.toLocaleString()}원</span>
                      <span>입금 합계: {r.total_paid.toLocaleString()}원</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 완납 거래처 */}
          {fullyPaid.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-700 mb-3">완납 거래처</h2>
              <div className="space-y-2">
                {fullyPaid.map((r) => (
                  <div key={r.customer_id} className="p-4 bg-white rounded-lg shadow-sm border">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-500">{r.customer_name}</span>
                      <span className="text-green-600 text-sm">완납</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasUnpaid.length === 0 && fullyPaid.length === 0 && (
            <p className="text-gray-500">명세서가 발행된 거래처가 없습니다.</p>
          )}
        </>
      )}
    </div>
  )
}
