'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type DashboardStats = {
  today_revenue: number
  week_revenue: number
  month_revenue: number
  last_month_revenue: number
  month_cost: number
  month_margin: number
  month_margin_rate: number
  margin_start_date: string | null
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [missingCount, setMissingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    await Promise.all([loadStats(), loadMissingCount()])
    setLoading(false)
  }

  const loadStats = async () => {
    const { data } = await supabase.rpc('get_dashboard_stats')
    if (data && data.length > 0) {
      setStats(data[0] as DashboardStats)
    }
  }

  const loadMissingCount = async () => {
    const [{ data: products }, { data: tiers }, { data: prices }] = await Promise.all([
      supabase.from('products').select('id'),
      supabase.from('price_tiers').select('id'),
      supabase.from('product_prices').select('product_id, tier_id'),
    ])

    if (!products || !tiers) return

    const priceSet = new Set(
      (prices || []).map((p) => `${p.product_id}::${p.tier_id}`)
    )

    let count = 0
    for (const product of products) {
      if (tiers.some((t) => !priceSet.has(`${product.id}::${t.id}`))) {
        count++
      }
    }
    setMissingCount(count)
  }

  // 지난 달 대비 변화 계산
  const monthDiff = stats
    ? stats.month_revenue - stats.last_month_revenue
    : 0
  const monthDiffPercent = stats && stats.last_month_revenue > 0
    ? Math.round((monthDiff / stats.last_month_revenue) * 100)
    : 0

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6">
      <h1 className="text-2xl font-bold mb-6">도매상 관리 시스템</h1>

      {/* 매출 요약 */}
      {loading ? (
        <p className="text-gray-400 mb-6">불러오는 중...</p>
      ) : stats && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-4 bg-white rounded-lg shadow-sm border">
              <p className="text-xs text-gray-500">오늘 매출</p>
              <p className="text-lg font-bold mt-1">{Number(stats.today_revenue).toLocaleString()}원</p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border">
              <p className="text-xs text-gray-500">이번 주</p>
              <p className="text-lg font-bold mt-1">{Number(stats.week_revenue).toLocaleString()}원</p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border">
              <p className="text-xs text-gray-500">이번 달</p>
              <p className="text-lg font-bold mt-1">{Number(stats.month_revenue).toLocaleString()}원</p>
              {stats.last_month_revenue > 0 && (
                <p className={`text-xs mt-1 ${monthDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  지난 달 대비 {monthDiff >= 0 ? '+' : ''}{monthDiffPercent}%
                </p>
              )}
            </div>
          </div>

          {/* 마진 분석 */}
          <div className="p-4 bg-white rounded-lg shadow-sm border mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700">이번 달 마진 분석</p>
              {stats.margin_start_date && (
                <p className="text-xs text-gray-400">{stats.margin_start_date} 이후 거래 기준</p>
              )}
            </div>
            {!stats.margin_start_date ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
                마진 계산 시작일이 설정되지 않았습니다. 원가 입력이 모두 끝난 후{' '}
                <Link href="/settings/company" className="underline font-medium">
                  회사 정보 설정
                </Link>
                에서 시작일을 지정해주세요.
                <p className="text-xs mt-1 text-amber-600">
                  (원가가 입력된 거래만 사용해 임시 표시 중)
                </p>
              </div>
            ) : null}
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <p className="text-xs text-gray-500">매출</p>
                <p className="text-base font-medium mt-1">{Number(stats.month_revenue).toLocaleString()}원</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">원가</p>
                <p className="text-base font-medium mt-1 text-gray-600">{Number(stats.month_cost).toLocaleString()}원</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">마진</p>
                <p className="text-base font-bold mt-1 text-indigo-600">
                  {Number(stats.month_margin).toLocaleString()}원
                  <span className="text-xs text-gray-500 ml-1">({Number(stats.month_margin_rate)}%)</span>
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 메뉴 */}
      <div className="space-y-3">
        <Link
          href="/transactions"
          className="block p-4 bg-white rounded-lg shadow-md hover:bg-gray-50"
        >
          📋 거래 관리
        </Link>
        <Link
          href="/customers"
          className="block p-4 bg-white rounded-lg shadow-md hover:bg-gray-50"
        >
          👥 거래처 관리
        </Link>
        <Link
          href="/products"
          className="block p-4 bg-white rounded-lg shadow-md hover:bg-gray-50"
        >
          📦 상품 관리
          {!loading && missingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
              가격 미설정: {missingCount}개
            </span>
          )}
        </Link>
        <Link
          href="/settings/company"
          className="block p-4 bg-white rounded-lg shadow-md hover:bg-gray-50"
        >
          ⚙️ 회사 정보 설정
        </Link>
      </div>
    </div>
  )
}
