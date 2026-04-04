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

type SavedItem = {
  id: string
  name: string
  quantity: number
  unit_price: number
  total: number
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

  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [priceSource, setPriceSource] = useState('')

  const [savedList, setSavedList] = useState<SavedItem[]>([])
  const [productSearch, setProductSearch] = useState('')

  const formatPrice = (value: string) => {
    const nums = value.replace(/[^0-9]/g, '')
    return nums ? Number(nums).toLocaleString() : ''
  }

  const rawPrice = (value: string) => value.replace(/,/g, '')

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

    if (!opts || opts.length === 0) {
      await lookupPrice(pid, customerId, {})
    }
  }

  const handleCustomerChange = async (cid: string) => {
    setCustomerId(cid)
    setSavedList([])
    setUnitPrice('')
    setCostPrice('')
    setPriceSource('')

    if (!cid || !productId) return
    await lookupPrice(productId, cid, selectedOptions)
  }

  const handleOptionChange = async (optionName: string, value: string) => {
    const updated = { ...selectedOptions, [optionName]: value }
    setSelectedOptions(updated)

    if (productId && customerId) {
      await lookupPrice(productId, customerId, updated)
    }
  }

  const lookupPrice = async (
    pid: string,
    cid: string,
    opts: Record<string, string>
  ) => {
    if (!pid || !cid) return

    const customer = customers.find((c) => c.id === cid)
    const tierId = customer?.default_tier_id || null

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

  const total = parseFloat(quantity || '0') * parseFloat(rawPrice(unitPrice) || '0')

  const handleSave = async () => {
    if (!customerId || !productId || !quantity || !unitPrice) {
      return alert('거래처, 상품, 수량, 단가를 모두 입력해주세요.')
    }

    for (const opt of productOptions) {
      if (opt.is_required && !selectedOptions[opt.option_name]) {
        return alert(`"${opt.option_name}" 옵션을 선택해주세요.`)
      }
    }

    setLoading(true)

    const optionsData = Object.keys(selectedOptions).length > 0 ? selectedOptions : null

    const { data: saved, error } = await supabase.from('transactions').insert({
      customer_id: customerId,
      product_id: productId,
      order_date: orderDate,
      quantity: parseInt(quantity),
      unit_price: parseFloat(rawPrice(unitPrice)),
      cost_price: costPrice ? parseFloat(rawPrice(costPrice)) : null,
      total,
      shipment_status: '대기',
      options: optionsData,
      note,
    }).select('id').single()

    if (error) {
      alert('저장 실패: ' + error.message)
    } else {
      const prodName = products.find(p => p.id === productId)?.name || ''
      setSavedList(prev => [...prev, {
        id: saved.id,
        name: prodName,
        quantity: parseInt(quantity),
        unit_price: parseFloat(rawPrice(unitPrice)),
        total,
      }])
      setProductId('')
      setProductSearch('')
      setQuantity('')
      setUnitPrice('')
      setCostPrice('')
      setNote('')
      setProductOptions([])
      setSelectedOptions({})
      setPriceSource('')
    }
    setLoading(false)
  }

  const handleDeleteSaved = async (itemId: string) => {
    if (!confirm('이 거래를 삭제하시겠습니까?')) return
    const { error } = await supabase.from('transactions').delete().eq('id', itemId)
    if (error) {
      alert('삭제 실패: ' + error.message)
    } else {
      setSavedList(prev => prev.filter(i => i.id !== itemId))
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <div className="flex items-center mb-6">
        <Link href="/transactions" className="text-gray-500 mr-3">← 목록</Link>
        <h1 className="text-2xl font-bold">새 거래 입력</h1>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">거래처 *</label>
          <select value={customerId} onChange={(e) => handleCustomerChange(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
            <option value="">거래처 선택</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">상품 *</label>
          <input
            type="text"
            placeholder="상품명 검색..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <select value={productId} onChange={(e) => { handleProductChange(e.target.value); setProductSearch('') }}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" size={productSearch ? 5 : 1}>
            <option value="">상품 선택</option>
            {products
              .filter((p) => !productSearch || productSearch.toLowerCase().split(' ').every(word => p.name.toLowerCase().includes(word)))
              .map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

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

        <div>
          <label className="block text-sm font-medium text-gray-700">주문일 *</label>
          <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">수량 *</label>
          <input type="text" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^0-9-]/g, ''))}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">단가 * (자동 적용)</label>
          <input type="text" inputMode="numeric" value={unitPrice}
            onChange={(e) => { setUnitPrice(rawPrice(e.target.value)); setPriceSource('수동 입력') }}
            onBlur={() => { if (unitPrice) setUnitPrice(formatPrice(unitPrice)) }}
            onFocus={() => { if (unitPrice) setUnitPrice(rawPrice(unitPrice)) }}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
          {priceSource && (
            <p className="text-xs text-indigo-600 mt-1">적용: {priceSource}</p>
          )}
        </div>

        <div className="p-3 bg-gray-50 rounded-md">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">합계</span>
            <span className="font-bold text-lg">{total.toLocaleString()}원</span>
          </div>
          {costPrice && unitPrice && (
            <div className="flex justify-between mt-1">
              <span className="text-sm text-gray-400">마진</span>
              <span className="text-sm text-gray-500">
                {(parseFloat(rawPrice(unitPrice)) - parseFloat(rawPrice(costPrice))).toLocaleString()}원
                ({parseFloat(rawPrice(costPrice)) > 0
                  ? Math.round(((parseFloat(rawPrice(unitPrice)) - parseFloat(rawPrice(costPrice))) / parseFloat(rawPrice(costPrice))) * 100)
                  : 0}%)
              </span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">비고</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
        </div>

        <button onClick={handleSave} disabled={loading}
          className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
          {loading ? '저장 중...' : '저장하기'}
        </button>

        {savedList.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <h3 className="text-sm font-medium text-gray-700 mb-2">입력한 거래 ({savedList.length}건)</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1">상품</th>
                  <th className="text-right py-1">수량</th>
                  <th className="text-right py-1">단가</th>
                  <th className="text-right py-1">합계</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {savedList.map((item) => (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="py-1">{item.name}</td>
                    <td className="py-1 text-right">{item.quantity}</td>
                    <td className="py-1 text-right">{item.unit_price.toLocaleString()}</td>
                    <td className="py-1 text-right">{item.total.toLocaleString()}</td>
                    <td className="py-1 text-right">
                      <button onClick={() => handleDeleteSaved(item.id)}
                        className="text-red-500 hover:text-red-700 text-xs">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-bold">
                  <td colSpan={3} className="py-1 text-right">합계</td>
                  <td className="py-1 text-right">{savedList.reduce((s, i) => s + i.total, 0).toLocaleString()}원</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <Link href="/invoices/new"
              className="mt-3 block w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 text-center text-sm">
              명세서 생성으로 이동 →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
