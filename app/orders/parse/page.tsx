'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Customer = { id: string; name: string; default_tier_id: string | null }
type Product = { id: string; name: string }

type ParsedItem = {
  product_id: string | null
  product_name: string
  original_text: string | null
  options: Record<string, string> | null
  quantity: number
  unit_price: number | null
  // 클라이언트에서 조회한 가격
  looked_up_price: number | null
  cost_price: number | null
  price_source: string
  _priceDisplay?: string
}

type SavedItem = {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  total: number
}

export default function OrderParsePage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customerId, setCustomerId] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([])
  const [savedItems, setSavedItems] = useState<SavedItem[]>([])
  const [productSearches, setProductSearches] = useState<Record<number, string>>({})
  const [aliasChecks, setAliasChecks] = useState<Record<number, boolean>>({})
  const [aliasTexts, setAliasTexts] = useState<Record<number, string>>({})
  const [editingProduct, setEditingProduct] = useState<Record<number, boolean>>({})

  // 임시 저장: parsedItems가 바뀔 때마다 DB에 자동 저장
  const saveDraft = async (items: ParsedItem[], cid: string) => {
    if (items.length === 0) {
      await supabase.from('draft_data').delete().eq('page_key', 'orders/parse')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('draft_data').upsert({
      user_id: user.id,
      page_key: 'orders/parse',
      customer_id: cid || null,
      data: { parsedItems: items, orderDate },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,page_key' })
  }

  // 임시 저장 데이터 복원
  const loadDraft = async () => {
    const { data: draft } = await supabase
      .from('draft_data')
      .select('*')
      .eq('page_key', 'orders/parse')
      .single()

    if (draft && draft.data?.parsedItems?.length > 0) {
      const restored = confirm(
        `이전에 작업하던 파싱 결과(${draft.data.parsedItems.length}건)가 있습니다.\n복원하시겠습니까?`
      )
      if (restored) {
        setParsedItems(draft.data.parsedItems)
        if (draft.customer_id) setCustomerId(draft.customer_id)
        if (draft.data.orderDate) setOrderDate(draft.data.orderDate)
      } else {
        await supabase.from('draft_data').delete().eq('page_key', 'orders/parse')
      }
    }
  }

  useEffect(() => {
    loadData().then(() => loadDraft())
  }, [])

  const loadData = async () => {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('customers').select('id, name, default_tier_id').order('name'),
      supabase.from('products').select('id, name').order('name'),
    ])
    setCustomers(c || [])
    setProducts(p || [])
  }

  const handleProductMatch = async (index: number, productId: string) => {
    if (productId === '__new__') {
      window.open('/products/new', '_blank')
      return
    }

    const product = products.find(p => p.id === productId)
    if (!product) return

    // 별칭 저장 체크되어 있으면 product_aliases에 저장
    if (aliasChecks[index]) {
      const aliasText = (aliasTexts[index] || parsedItems[index]?.original_text || parsedItems[index]?.product_name || '').trim()
      if (aliasText) {
        await supabase.from('product_aliases').upsert(
          { product_id: productId, alias: aliasText },
          { onConflict: 'alias' }
        )
      }
      setAliasChecks(prev => ({ ...prev, [index]: false }))
      setAliasTexts(prev => ({ ...prev, [index]: '' }))
    }

    const { unitPrice, costPrice, source } = await lookupPrice(productId, customerId, null)
    setParsedItems(prev => {
      const updated = prev.map((item, i) =>
        i === index ? {
          ...item,
          product_id: productId,
          product_name: product.name,
          looked_up_price: unitPrice,
          cost_price: costPrice,
          price_source: source,
        } : item
      )
      saveDraft(updated, customerId)
      return updated
    })
    setProductSearches(prev => ({ ...prev, [index]: '' }))
    setEditingProduct(prev => ({ ...prev, [index]: false }))
  }

  const lookupPrice = async (
    productId: string,
    cid: string,
    options: Record<string, string> | null
  ): Promise<{ unitPrice: number | null; costPrice: number | null; source: string }> => {
    const customer = customers.find(c => c.id === cid)
    const tierId = customer?.default_tier_id || null

    let costPrice: number | null = null
    const { data: costTier } = await supabase
      .from('price_tiers')
      .select('id')
      .eq('level', 0)
      .single()

    if (costTier) {
      const { data: costData } = await supabase
        .from('product_prices')
        .select('price')
        .eq('product_id', productId)
        .eq('tier_id', costTier.id)
        .single()
      if (costData) costPrice = costData.price
    }

    // 특별단가
    const { data: specialPrice } = await supabase
      .from('customer_prices')
      .select('special_price')
      .eq('customer_id', cid)
      .eq('product_id', productId)
      .single()

    if (specialPrice) {
      return { unitPrice: specialPrice.special_price, costPrice, source: '특별단가' }
    }

    // 옵션별 가격
    if (tierId && options) {
      const { data: productOpts } = await supabase
        .from('product_options')
        .select('option_name, affects_price')
        .eq('product_id', productId)

      const affectsOpts = productOpts?.filter(o => o.affects_price) || []
      for (const opt of affectsOpts) {
        const val = options[opt.option_name]
        if (val) {
          const { data: optPrice } = await supabase
            .from('option_prices')
            .select('price')
            .eq('product_id', productId)
            .eq('option_name', opt.option_name)
            .eq('option_value', val)
            .eq('tier_id', tierId)
            .single()
          if (optPrice) {
            return { unitPrice: optPrice.price, costPrice, source: `옵션별 가격 (${opt.option_name}: ${val})` }
          }
        }
      }
    }

    // 등급 단가
    if (tierId) {
      const { data: tierPrice } = await supabase
        .from('product_prices')
        .select('price')
        .eq('product_id', productId)
        .eq('tier_id', tierId)
        .single()
      if (tierPrice) {
        return { unitPrice: tierPrice.price, costPrice, source: '등급 단가' }
      }
    }

    // 소비자가
    const { data: consumerTier } = await supabase
      .from('price_tiers')
      .select('id')
      .eq('level', 1)
      .single()

    if (consumerTier) {
      const { data: consumerPrice } = await supabase
        .from('product_prices')
        .select('price')
        .eq('product_id', productId)
        .eq('tier_id', consumerTier.id)
        .single()
      if (consumerPrice) {
        return { unitPrice: consumerPrice.price, costPrice, source: '소비자가' }
      }
    }

    return { unitPrice: null, costPrice, source: '가격 미설정' }
  }

  const handleParse = async () => {
    if (!customerId) return alert('거래처를 선택해주세요.')
    if (!message.trim()) return alert('주문 메시지를 입력해주세요.')

    // 중복 메시지 체크
    const { data: existing, error: checkError } = await supabase
      .from('order_messages')
      .select('id, created_at')
      .eq('customer_id', customerId)
      .eq('original_text', message.trim())
      .order('created_at', { ascending: false })
      .limit(1)

    if (checkError) {
      alert('중복 체크 실패: ' + checkError.message + '\n코드: ' + checkError.code)
      return
    }

    if (existing && existing.length > 0) {
      const prevDate = new Date(existing[0].created_at).toLocaleString('ko-KR')
      const proceed = confirm(
        `이 메시지는 이미 처리되었습니다. (${prevDate})\n다시 처리하시겠습니까?`
      )
      if (!proceed) return
    }

    setLoading(true)
    setError('')
    setParsedItems([])

    try {
      const res = await fetch('/api/parse-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), customerId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '분석 실패')
        setLoading(false)
        return
      }

      // 메시지 저장 에러가 있으면 표시 (디버그용)
      if (data._msgSaveError) {
        alert('메시지 저장 실패: ' + data._msgSaveError)
      }

      // 각 항목에 대해 가격 조회
      const itemsWithPrices: ParsedItem[] = await Promise.all(
        data.items.map(async (item: ParsedItem) => {
          if (item.product_id) {
            // AI가 단가를 추출한 경우 그 값을 우선 사용
            if (item.unit_price) {
              const { costPrice } = await lookupPrice(item.product_id, customerId, item.options)
              return {
                ...item,
                looked_up_price: item.unit_price,
                cost_price: costPrice,
                price_source: '메시지에서 추출',
              }
            }
            const { unitPrice, costPrice, source } = await lookupPrice(item.product_id, customerId, item.options)
            return {
              ...item,
              looked_up_price: unitPrice,
              cost_price: costPrice,
              price_source: source,
            }
          }
          return {
            ...item,
            looked_up_price: item.unit_price,
            cost_price: null,
            price_source: '상품 미매칭',
          }
        })
      )

      setParsedItems(itemsWithPrices)
      // 파싱 결과 임시 저장
      await saveDraft(itemsWithPrices, customerId)
    } catch {
      setError('요청 실패. 네트워크를 확인해주세요.')
    }
    setLoading(false)
  }

  const updateItem = (index: number, field: keyof ParsedItem, value: unknown) => {
    setParsedItems(prev => {
      const updated = prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
      saveDraft(updated, customerId)
      return updated
    })
  }

  const removeItem = (index: number) => {
    setParsedItems(prev => {
      const updated = prev.filter((_, i) => i !== index)
      saveDraft(updated, customerId)
      return updated
    })
  }

  const handleSaveAll = async () => {
    if (parsedItems.length === 0) return

    const unmatchedItems = parsedItems.filter(item => !item.product_id)
    if (unmatchedItems.length > 0) {
      const names = unmatchedItems.map(i => i.product_name).join(', ')
      if (!confirm(`매칭되지 않은 상품이 있습니다: ${names}\n해당 항목을 제외하고 저장하시겠습니까?`)) {
        return
      }
    }

    const validItems = parsedItems.filter(item => item.product_id)
    const itemsWithoutPrice = validItems.filter(item => !item.looked_up_price && !item.unit_price)
    if (itemsWithoutPrice.length > 0) {
      const names = itemsWithoutPrice.map(i => i.product_name).join(', ')
      if (!confirm(`가격이 설정되지 않은 상품이 있습니다: ${names}\n단가 0원으로 저장하시겠습니까?`)) {
        return
      }
    }

    setSaving(true)

    const newSaved: SavedItem[] = []
    for (const item of validItems) {
      const price = item.looked_up_price || item.unit_price || 0
      const total = item.quantity * price

      const { data: saved, error } = await supabase.from('transactions').insert({
        customer_id: customerId,
        product_id: item.product_id,
        order_date: orderDate,
        quantity: item.quantity,
        unit_price: price,
        cost_price: item.cost_price,
        total,
        shipment_status: '대기',
        options: item.options,
        note: item.unit_price && item.unit_price !== item.looked_up_price
          ? `메시지 단가: ${item.unit_price?.toLocaleString()}원`
          : null,
      }).select('id').single()

      if (error) {
        alert(`저장 실패 (${item.product_name}): ${error.message}`)
        break
      }

      newSaved.push({
        id: saved.id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: price,
        total,
      })
    }

    setSavedItems(prev => [...prev, ...newSaved])
    setParsedItems([])
    setMessage('')
    // 일괄 저장 완료 → 임시 데이터 삭제
    await supabase.from('draft_data').delete().eq('page_key', 'orders/parse')
    setSaving(false)
  }

  const formatPrice = (v: number | null) => v != null ? v.toLocaleString() : '-'

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <div className="flex items-center mb-6">
        <Link href="/transactions" className="text-gray-500 mr-3">← 거래목록</Link>
        <h1 className="text-2xl font-bold">📋 주문 메시지 인식</h1>
      </div>

      <div className="space-y-4">
        {/* 거래처 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">거래처 *</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">거래처 선택</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* 주문일 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">주문일 *</label>
          <input
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        {/* 메시지 입력 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">주문 메시지 *</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={"카카오톡 메시지를 붙여넣으세요.\n예: 까무이 클리어 m 5개, h 5개 블랙 m 10개 보냅니다"}
            rows={6}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md resize-y"
          />
        </div>

        {/* 분석 버튼 */}
        <button
          onClick={handleParse}
          disabled={loading}
          className="w-full py-3 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 font-medium"
        >
          {loading ? '🔍 분석 중...' : '🔍 주문 분석'}
        </button>

        {/* 에러 */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* 분석 결과 */}
        {parsedItems.length > 0 && (
          <div className="mt-4">
            <h2 className="text-lg font-bold mb-3">분석 결과</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left py-2 px-2">상품명</th>
                    <th className="text-left py-2 px-1">옵션</th>
                    <th className="text-right py-2 px-2 whitespace-nowrap">수량</th>
                    <th className="text-right py-2 px-2 whitespace-nowrap">단가</th>
                    <th className="text-right py-2 px-2 whitespace-nowrap">합계</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {parsedItems.map((item, idx) => {
                    const price = item.looked_up_price || item.unit_price || 0
                    const total = item.quantity * price
                    const isUnmatched = !item.product_id
                    return (
                      <tr key={idx} className={`border-b ${isUnmatched ? 'bg-amber-50' : ''}`}>
                        <td className="py-2 px-2">
                          {isUnmatched ? (
                            <div>{item.product_name}</div>
                          ) : (
                            <div
                              className="cursor-pointer hover:text-indigo-600 hover:underline"
                              title="클릭하면 다른 상품으로 변경할 수 있습니다"
                              onClick={() => setEditingProduct(prev => ({ ...prev, [idx]: !prev[idx] }))}
                            >
                              {item.product_name}
                              <span className="ml-1 text-xs text-gray-400">✎</span>
                            </div>
                          )}
                          {(isUnmatched || editingProduct[idx]) ? (
                            <div className="mt-1">
                              {isUnmatched ? (
                                <span className="text-xs text-amber-600">⚠ 미매칭 — 상품을 선택해주세요</span>
                              ) : (
                                <span className="text-xs text-indigo-500">🔄 다른 상품으로 변경</span>
                              )}
                              <input
                                type="text"
                                placeholder="상품명 검색..."
                                value={productSearches[idx] || ''}
                                onChange={(e) => setProductSearches(prev => ({ ...prev, [idx]: e.target.value }))}
                                className={`mt-1 block w-full px-2 py-1 text-sm border rounded ${isUnmatched ? 'border-amber-300' : 'border-indigo-300'}`}
                              />
                              <select
                                value=""
                                onChange={(e) => handleProductMatch(idx, e.target.value)}
                                className={`mt-1 block w-full px-2 py-1 text-sm border rounded ${isUnmatched ? 'border-amber-300' : 'border-indigo-300'}`}
                                size={productSearches[idx] ? Math.min(products.filter(p => productSearches[idx]!.toLowerCase().split(' ').every(w => p.name.toLowerCase().includes(w))).length + 2, 7) : 1}
                              >
                                <option value="">상품 선택</option>
                                {products
                                  .filter(p => !productSearches[idx] || productSearches[idx]!.toLowerCase().split(' ').every(w => p.name.toLowerCase().includes(w)))
                                  .map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                <option disabled>──────────</option>
                                <option value="__new__">+ 신규 상품 등록</option>
                              </select>
                              {/* 별칭 저장 옵션 */}
                              <label className="mt-2 flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={aliasChecks[idx] || false}
                                  onChange={(e) => {
                                    setAliasChecks(prev => ({ ...prev, [idx]: e.target.checked }))
                                    if (e.target.checked && !aliasTexts[idx]) {
                                      setAliasTexts(prev => ({ ...prev, [idx]: item.original_text || item.product_name }))
                                    }
                                  }}
                                  className="rounded border-gray-300"
                                />
                                이 별칭을 저장
                              </label>
                              {aliasChecks[idx] && (
                                <input
                                  type="text"
                                  value={aliasTexts[idx] ?? item.original_text ?? item.product_name}
                                  onChange={(e) => setAliasTexts(prev => ({ ...prev, [idx]: e.target.value }))}
                                  placeholder="저장할 별칭"
                                  className="mt-1 block w-full px-2 py-1 text-sm border border-indigo-300 rounded bg-indigo-50"
                                />
                              )}
                              {!isUnmatched && (
                                <button
                                  onClick={() => setEditingProduct(prev => ({ ...prev, [idx]: false }))}
                                  className="mt-1 text-xs text-gray-500 hover:text-gray-700"
                                >취소</button>
                              )}
                            </div>
                          ) : (
                            item.price_source && (
                              <span className="text-xs text-indigo-500">{item.price_source}</span>
                            )
                          )}
                        </td>
                        <td className="py-2 px-1 text-xs text-gray-500">
                          {item.options && Object.entries(item.options).map(([k, v]) => (
                            <div key={k}>{k}: {v}</div>
                          ))}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-16 text-right px-1 py-0.5 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={item._priceDisplay ?? (price ? price.toLocaleString() : '')}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9-]/g, '')
                              updateItem(idx, '_priceDisplay', raw)
                              updateItem(idx, 'looked_up_price', parseInt(raw) || 0)
                            }}
                            onBlur={() => {
                              const v = item.looked_up_price || item.unit_price || 0
                              updateItem(idx, '_priceDisplay', v ? v.toLocaleString() : '')
                            }}
                            onFocus={() => {
                              const v = item.looked_up_price || item.unit_price || 0
                              updateItem(idx, '_priceDisplay', v ? String(v) : '')
                            }}
                            className="w-24 text-right px-1 py-0.5 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="py-2 px-2 text-right whitespace-nowrap font-medium">
                          {total.toLocaleString()}원
                        </td>
                        <td className="py-2 px-1">
                          <button
                            onClick={() => removeItem(idx)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >✕</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-800 font-bold">
                    <td colSpan={4} className="py-2 px-2 text-right">합계</td>
                    <td className="py-2 px-2 text-right whitespace-nowrap">
                      {parsedItems.reduce((sum, item) => {
                        const price = item.looked_up_price || item.unit_price || 0
                        return sum + item.quantity * price
                      }, 0).toLocaleString()}원
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="mt-4 w-full py-3 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {saving ? '저장 중...' : `✅ 거래 일괄 저장 (${parsedItems.filter(i => i.product_id).length}건)`}
            </button>
          </div>
        )}

        {/* 저장된 항목 */}
        {savedItems.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              ✅ 저장 완료 ({savedItems.length}건)
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1">상품</th>
                  <th className="text-right py-1 whitespace-nowrap">수량</th>
                  <th className="text-right py-1 whitespace-nowrap">단가</th>
                  <th className="text-right py-1 whitespace-nowrap">합계</th>
                </tr>
              </thead>
              <tbody>
                {savedItems.map((item) => (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="py-1">{item.product_name}</td>
                    <td className="py-1 text-right">{item.quantity}</td>
                    <td className="py-1 text-right">{formatPrice(item.unit_price)}</td>
                    <td className="py-1 text-right">{formatPrice(item.total)}원</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-bold">
                  <td colSpan={3} className="py-1 text-right">합계</td>
                  <td className="py-1 text-right whitespace-nowrap">
                    {savedItems.reduce((s, i) => s + i.total, 0).toLocaleString()}원
                  </td>
                </tr>
              </tfoot>
            </table>
            <Link
              href="/invoices/new"
              className="mt-3 block w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 text-center text-sm"
            >
              명세서 생성으로 이동 →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
