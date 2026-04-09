'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import AdminGuard from '@/components/AdminGuard'
import { useToast } from '@/lib/ToastContext'
import { formatPrice, rawPrice } from '@/lib/utils'
import { lookupPrice as lookupPriceLib } from '@/lib/lookupPrice'
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
  date: string
  name: string
  quantity: number
  unit_price: number
  total: number
}

type PriceChangeInfo = {
  date: string
  oldPrice: number
  newPrice: number
}

export default function NewTransactionPage() {
  return (
    <AdminGuard>
      <NewTransactionPageContent />
    </AdminGuard>
  )
}

function NewTransactionPageContent() {
  const router = useRouter()
  const toast = useToast()
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

  const [priceChangeInfo, setPriceChangeInfo] = useState<PriceChangeInfo | null>(null)
  const [addPriceChangeToNote, setAddPriceChangeToNote] = useState(true)

  // 가격 조회 경쟁 상태 방지용 카운터
  const lookupCounterRef = useRef(0)

  // 임시 저장: savedList가 바뀔 때마다 DB에 자동 저장
  const saveDraft = async (items: SavedItem[], cid: string) => {
    if (items.length === 0) {
      await supabase.from('draft_data').delete().eq('page_key', 'transactions/new')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('draft_data').upsert({
      user_id: user.id,
      page_key: 'transactions/new',
      customer_id: cid || null,
      data: { savedList: items },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,page_key' })
  }

  // 임시 저장 데이터 복원
  const loadDraft = async () => {
    const { data: draft } = await supabase
      .from('draft_data')
      .select('*')
      .eq('page_key', 'transactions/new')
      .single()

    if (draft && draft.data?.savedList?.length > 0) {
      const restored = confirm(
        `이전에 입력하던 거래 목록(${draft.data.savedList.length}건)이 있습니다.\n복원하시겠습니까?`
      )
      if (restored) {
        setSavedList(draft.data.savedList)
        if (draft.customer_id) setCustomerId(draft.customer_id)
      } else {
        await supabase.from('draft_data').delete().eq('page_key', 'transactions/new')
      }
    }
  }

  useEffect(() => {
    loadData().then(() => loadDraft())
  }, [])

  const loadData = async () => {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('customers').select('id, name, default_tier_id').eq('is_active', true).order('name'),
      supabase.from('products').select('id, name').eq('is_active', true).order('name'),
    ])
    setCustomers(c || [])
    setProducts(p || [])
  }

  // 가격 변동 확인: 마지막 거래 단가와 현재 적용 단가 비교
  const checkPriceChange = async (pid: string, cid: string, currentPrice: number) => {
    setPriceChangeInfo(null)

    // 해당 거래처의 이 상품 마지막 거래 단가 조회
    const { data: lastTx } = await supabase
      .from('transactions')
      .select('unit_price')
      .eq('customer_id', cid)
      .eq('product_id', pid)
      .order('order_date', { ascending: false })
      .limit(1)
      .single()

    if (!lastTx || lastTx.unit_price === currentPrice) return

    // 가격이 다르면 → price_history에서 변경 날짜 조회
    const { data: history } = await supabase
      .from('price_history')
      .select('created_at')
      .eq('product_id', pid)
      .in('change_type', ['consumer', 'tier'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const changeDate = history
      ? new Date(history.created_at).toLocaleDateString('ko-KR')
      : '최근'

    setPriceChangeInfo({
      date: changeDate,
      oldPrice: lastTx.unit_price,
      newPrice: currentPrice,
    })
    setAddPriceChangeToNote(true)
  }

  const handleProductChange = async (pid: string) => {
    setProductId(pid)
    setSelectedOptions({})
    setProductOptions([])
    setUnitPrice('')
    setCostPrice('')
    setPriceSource('')
    setPriceChangeInfo(null)

    if (!pid) return

    const { data: opts } = await supabase
      .from('product_options')
      .select('*')
      .eq('product_id', pid)
      .order('created_at')

    setProductOptions(opts || [])

    // 옵션 유무와 관계없이 항상 단가 조회 (특별단가 → 등급단가 → 소비자가)
    // 옵션 선택 시 옵션별 가격으로 덮어씀
    await lookupPrice(pid, customerId, {})
  }

  const handleCustomerChange = async (cid: string) => {
    setCustomerId(cid)
    setSavedList([])
    setUnitPrice('')
    setCostPrice('')
    setPriceSource('')
    setPriceChangeInfo(null)

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

    const currentLookup = ++lookupCounterRef.current
    const isStale = () => currentLookup !== lookupCounterRef.current

    const customer = customers.find((c) => c.id === cid)
    const tierId = customer?.default_tier_id || null

    const result = await lookupPriceLib(supabase, {
      productId: pid,
      customerId: cid,
      customerTierId: tierId,
      options: opts,
    })

    if (isStale()) return

    if (result.costPrice !== null) setCostPrice(String(result.costPrice))

    if (result.unitPrice !== null) {
      setUnitPrice(String(result.unitPrice))
      // 소비자가 표시는 기존대로 "(기본)" 붙임
      setPriceSource(result.source === '소비자가' ? '소비자가 (기본)' : result.source)
      await checkPriceChange(pid, cid, result.unitPrice)
      return
    }

    setPriceSource('가격 미설정')
    setPriceChangeInfo(null)
  }

  const total = parseFloat(quantity || '0') * parseFloat(rawPrice(unitPrice) || '0')

  const handleSave = async () => {
    if (!customerId || !productId || !quantity || !unitPrice) {
      return toast.error('거래처, 상품, 수량, 단가를 모두 입력해주세요.')
    }

    for (const opt of productOptions) {
      if (opt.is_required && !selectedOptions[opt.option_name]) {
        return toast.error(`"${opt.option_name}" 옵션을 선택해주세요.`)
      }
    }

    setLoading(true)

    // 빈 문자열 옵션값 제거 후 저장
    const filteredOptions = Object.fromEntries(
      Object.entries(selectedOptions).filter(([, v]) => v && v.trim() !== '')
    )
    const optionsData = Object.keys(filteredOptions).length > 0 ? filteredOptions : null

    // 비고에 가격 변동 정보 추가
    let finalNote = note
    if (priceChangeInfo && addPriceChangeToNote) {
      const prodName = products.find(p => p.id === productId)?.name || ''
      const changeText = `${prodName} ${priceChangeInfo.oldPrice.toLocaleString()} → ${priceChangeInfo.newPrice.toLocaleString()}원 변경`
      finalNote = finalNote ? `${finalNote} / ${changeText}` : changeText
    }

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
      note: finalNote || null,
    }).select('id').single()

    if (error) {
      toast.error('저장 실패: ' + error.message)
    } else {
      const prodName = products.find(p => p.id === productId)?.name || ''
      const newItem = {
        id: saved.id,
        date: orderDate,
        name: prodName,
        quantity: parseInt(quantity),
        unit_price: parseFloat(rawPrice(unitPrice)),
        total,
      }
      setSavedList(prev => {
        const updated = [...prev, newItem]
        saveDraft(updated, customerId)
        return updated
      })
      setProductId('')
      setProductSearch('')
      setQuantity('')
      setUnitPrice('')
      setCostPrice('')
      setNote('')
      setProductOptions([])
      setSelectedOptions({})
      setPriceSource('')
      setPriceChangeInfo(null)
    }
    setLoading(false)
  }

  const handleDeleteSaved = async (itemId: string) => {
    if (!confirm('이 거래를 삭제하시겠습니까?')) return
    const { error } = await supabase.from('transactions').delete().eq('id', itemId)
    if (error) {
      toast.error('삭제 실패: ' + error.message)
    } else {
      setSavedList(prev => {
        const updated = prev.filter(i => i.id !== itemId)
        saveDraft(updated, customerId)
        return updated
      })
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

        {/* 가격 변동 알림 */}
        {priceChangeInfo && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-sm text-amber-800">
              이 상품은 {priceChangeInfo.date}부터 가격이 변경되었습니다 ({priceChangeInfo.oldPrice.toLocaleString()} → {priceChangeInfo.newPrice.toLocaleString()}원)
            </p>
            <label className="mt-2 flex items-center gap-2 text-sm text-amber-700 cursor-pointer">
              <input
                type="checkbox"
                checked={addPriceChangeToNote}
                onChange={(e) => setAddPriceChangeToNote(e.target.checked)}
                className="rounded border-amber-300"
              />
              명세서에 표시
            </label>
          </div>
        )}

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
                  <th className="text-left py-1 whitespace-nowrap">날짜</th>
                  <th className="text-left py-1">상품</th>
                  <th className="text-right py-1 whitespace-nowrap">수량</th>
                  <th className="text-right py-1 whitespace-nowrap">단가</th>
                  <th className="text-right py-1 whitespace-nowrap">합계</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {savedList.map((item) => (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="py-1 text-gray-500 whitespace-nowrap">{item.date}</td>
                    <td className="py-1">{item.name}</td>
                    <td className="py-1 text-right whitespace-nowrap">{item.quantity}</td>
                    <td className="py-1 text-right whitespace-nowrap">{item.unit_price.toLocaleString()}</td>
                    <td className="py-1 text-right whitespace-nowrap">{item.total.toLocaleString()}</td>
                    <td className="py-1 text-right">
                      <button onClick={() => handleDeleteSaved(item.id)}
                        className="text-red-500 hover:text-red-700 text-xs">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-bold">
                  <td colSpan={4} className="py-1 text-right">합계</td>
                  <td className="py-1 text-right whitespace-nowrap">{savedList.reduce((s, i) => s + i.total, 0).toLocaleString()}원</td>
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
