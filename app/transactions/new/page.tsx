'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Customer = { id: string; name: string; default_tier_id: string | null }
type Product = { id: string; name: string }
type ProductOption = {
  id: string
  option_name: string
  option_values: string
  is_required: boolean
  affects_price: boolean
}

export default function NewTransactionPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customerId, setCustomerId] = useState('')
  const [productId, setProductId] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  // 옵션 관련
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})

  // 단가 출처 표시
  const [priceSource, setPriceSource] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('customers').select('id, name, default_tier_id').order('name'),
      supabase.from('products').select('id, name').order('name'),
    ])
    setCustomers(c || [])
    setProducts(p || [])
  }

  // 상품 선택 시 → 옵션 로드
  const handleProductChange = async (pid: string) => {
    setProductId(pid)
    setSelectedOptions({})
    setProductOptions([])
    setUnitPrice('')
    setCostPrice('')
    setPriceSource('')

    if (!pid) return

    const { data: opts } = await supabase
      .from('product_options')
      .select('*')
      .eq('product_id', pid)
      .order('created_at')

    setProductOptions(opts || [])

    // 옵션이 없으면 바로 가격 조회
    if (!opts || opts.length === 0) {
      await lookupPrice(pid, customerId, {})
    }
  }

  // 거래처 선택 시 → 가격 재조회
  const handleCustomerChange = async (cid: string) => {
    setCustomerId(cid)
    setUnitPrice('')
    setCostPrice('')
    setPriceSource('')

    if (!cid || !productId) return
    await lookupPrice(productId, cid, selectedOptions)
  }

  // 옵션 선택 시 → 가격 재조회
  const handleOptionChange = async (optionName: string, value: string) => {
    const updated = { ...selectedOptions, [optionName]: value }
    setSelectedOptions(updated)

    if (productId && customerId) {
      await lookupPrice(productId, customerId, updated)
    }
  }

  // ⭐ 단가 조회 (4단계 우선순위)
  const lookupPrice = async (
    pid: string,
    cid: string,
    opts: Record<string, string>
  ) => {
    if (!pid || !cid) return

    const customer = customers.find((c) => c.id === cid)
    const tierId = customer?.default_tier_id || null

    // 입고가 조회 (level 0)
    const { data: costTier } = await supabase
      .from('price_tiers')
      .select('id')
      .eq('level', 0)
      .single()

    if (costTier) {
      const { data: costData } = await supabase
        .from('product_prices')
        .select('price')
        .eq('product_id', pid)
        .eq('tier_id', costTier.id)
        .single()

      if (costData) setCostPrice(String(costData.price))
    }

    // 1순위: 거래처별 특별 단가
    const { data: specialPrice } = await supabase
      .from('customer_prices')
      .select('special_price')
      .eq('customer_id', cid)
      .eq('product_id', pid)
      .single()

    if (specialPrice) {
      setUnitPrice(String(specialPrice.special_price))
      setPriceSource('특별단가')
      return
    }

    // 2순위: 옵션별 가격 (옵션 선택 + affects_price인 경우)
    if (tierId) {
      const affectsOptions = productOptions.filter((o) => o.affects_price)
      for (const opt of affectsOptions) {
        const selectedVal = opts[opt.option_name]
        if (selectedVal) {
          const { data: optPrice } = await supabase
            .from('option_prices')
            .select('price')
            .eq('product_id', pid)
            .eq('option_name', opt.option_name)
            .eq('option_value', selectedVal)
            .eq('tier_id', tierId)
            .single()

          if (optPrice) {
            setUnitPrice(String(optPrice.price))
            setPriceSource(`옵션별 가격 (${opt.option_name}: ${selectedVal})`)
            return
          }
        }
      }
    }

    // 3순위: 거래처 등급 단가
    if (tierId) {
      const { data: tierPrice } = await supabase
        .from('product_prices')
        .select('price')
        .eq('product_id', pid)
        .eq('tier_id', tierId)
        .single()

      if (tierPrice) {
        setUnitPrice(String(tierPrice.price))
        setPriceSource('등급 단가')
        return
      }
    }

    // 4순위: 소비자가 (level 1)
    const { data: consumerTier } = await supabase
      .from('price_tiers')
      .select('id')
      .eq('level', 1)
      .single()

    if (consumerTier) {
      const { data: consumerPrice } = await supabase
        .from('product_prices')
        .select('price')
        .eq('product_id', pid)
        .eq('tier_id', consumerTier.id)
        .single()

      if (consumerPrice) {
        setUnitPrice(String(consumerPrice.price))
        setPriceSource('소비자가 (기본)')
        return
      }
    }

    setPriceSource('가격 미설정')
  }

  const total = parseFloat(quantity || '0') * parseFloat(unitPrice || '0')

  const handleSave = async () => {
    if (!customerId || !productId || !quantity || !unitPrice) {
      return alert('거래처, 상품, 수량, 단가를 모두 입력해주세요.')
    }

    // 필수 옵션 확인
    for (const opt of productOptions) {
      if (opt.is_required && !selectedOptions[opt.option_name]) {
        return alert(`"${opt.option_name}" 옵션을 선택해주세요.`)
      }
    }

    setLoading(true)

    const optionsData = Object.keys(selectedOptions).length > 0 ? selectedOptions : null

    const { error } = await supabase.from('transactions').insert({
      customer_id: customerId,
      product_id: productId,
      order_date: orderDate,
      quantity: parseInt(quantity),
      unit_price: parseFloat(unitPrice),
      cost_price: costPrice ? parseFloat(costPrice) : null,
      total,
      shipment_status: '대기',
      options: optionsData,
      note,
    })

    if (error) {
      alert('저장 실패: ' + error.message)
    } else {
      router.push('/transactions')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-lg mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <div className="flex items-center mb-6">
        <Link href="/transactions" className="text-gray-500 mr-3">← 목록</Link>
        <h1 className="text-2xl font-bold">새 거래 입력</h1>
      </div>
      <div className="space-y-4">
        {/* 거래처 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">거래처 *</label>
          <select value={customerId} onChange={(e) => handleCustomerChange(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
            <option value="">거래처 선택</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* 상품 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">상품 *</label>
          <select value={productId} onChange={(e) => handleProductChange(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
            <option value="">상품 선택</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* 옵션 선택 */}
        {productOptions.length > 0 && (
          <div className="p-3 bg-gray-50 rounded-md space-y-3">
            <p className="text-sm font-medium text-gray-700">옵션 선택</p>
            {productOptions.map((opt) => (
              <div key={opt.id}>
                <label className="block text-sm text-gray-600">
                  {opt.option_name}
                  {opt.is_required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <select
                  value={selectedOptions[opt.option_name] || ''}
                  onChange={(e) => handleOptionChange(opt.option_name, e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="">선택 안 함</option>
                  {opt.option_values.split(',').map((v) => (
                    <option key={v.trim()} value={v.trim()}>{v.trim()}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        {/* 주문일 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">주문일 *</label>
          <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
        </div>

        {/* 수량 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">수량 *</label>
          <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
        </div>

        {/* 단가 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">단가 * (자동 적용)</label>
          <input type="number" value={unitPrice}
            onChange={(e) => { setUnitPrice(e.target.value); setPriceSource('수동 입력') }}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
          {priceSource && (
            <p className="text-xs text-indigo-600 mt-1">적용: {priceSource}</p>
          )}
        </div>

        {/* 합계 + 마진 */}
        <div className="p-3 bg-gray-50 rounded-md">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">합계</span>
            <span className="font-bold text-lg">{total.toLocaleString()}원</span>
          </div>
          {costPrice && unitPrice && (
            <div className="flex justify-between mt-1">
              <span className="text-sm text-gray-400">마진</span>
              <span className="text-sm text-gray-500">
                {(parseFloat(unitPrice) - parseFloat(costPrice)).toLocaleString()}원
                ({parseFloat(costPrice) > 0
                  ? Math.round(((parseFloat(unitPrice) - parseFloat(costPrice)) / parseFloat(costPrice)) * 100)
                  : 0}%)
              </span>
            </div>
          )}
        </div>

        {/* 비고 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">비고</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
        </div>

        <button onClick={handleSave} disabled={loading}
          className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
          {loading ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  )
}
