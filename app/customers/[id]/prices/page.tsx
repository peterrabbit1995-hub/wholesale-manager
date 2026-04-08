'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { recordPriceChange } from '@/lib/priceHistory'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type CustomerPrice = {
  id: string
  product_id: string
  special_price: number
  products: { name: string } | { name: string }[] | null
}

type Product = {
  id: string
  name: string
}

type TierPrice = {
  product_id: string
  price: number
}

export default function CustomerPricesPage() {
  const { id } = useParams()
  const [customerName, setCustomerName] = useState('')
  const [tierName, setTierName] = useState('')
  const [tierId, setTierId] = useState('')
  const [customerPrices, setCustomerPrices] = useState<CustomerPrice[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [tierPrices, setTierPrices] = useState<TierPrice[]>([])

  const [selectedProductId, setSelectedProductId] = useState('')
  const [specialPrice, setSpecialPrice] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [loading, setLoading] = useState(false)
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
    // 거래처 정보
    const { data: customer } = await supabase
      .from('customers')
      .select('name, default_tier_id, price_tiers(name)')
      .eq('id', id)
      .single()

    if (customer) {
      setCustomerName(customer.name)
      setTierId(customer.default_tier_id || '')
      const tier = customer.price_tiers as { name: string } | { name: string }[] | null
      if (tier) {
        setTierName(Array.isArray(tier) ? tier[0]?.name || '' : tier.name)
      }
    }

    // 기존 특별단가 목록
    const { data: prices } = await supabase
      .from('customer_prices')
      .select('id, product_id, special_price, products(name)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })

    setCustomerPrices(prices || [])

    // 전체 상품 목록
    const { data: prods } = await supabase
      .from('products')
      .select('id, name')
      .order('name')

    setProducts(prods || [])

    // 거래처 등급 기준 단가 목록 (참고용)
    if (customer?.default_tier_id) {
      const { data: tp } = await supabase
        .from('product_prices')
        .select('product_id, price')
        .eq('tier_id', customer.default_tier_id)

      setTierPrices(tp || [])
    }
  }

  // 해당 상품의 등급 단가 찾기 (참고용)
  const getTierPrice = (productId: string): string => {
    const found = tierPrices.find((p) => p.product_id === productId)
    return found ? String(found.price) : '-'
  }

  // 이미 특별단가가 설정된 상품 제외
  const availableProducts = products.filter(
    (p) => !customerPrices.some((cp) => cp.product_id === p.id)
  )

  const getProductName = (cp: CustomerPrice): string => {
    if (!cp.products) return '-'
    if (Array.isArray(cp.products)) return cp.products[0]?.name || '-'
    return cp.products.name
  }

  // 추가
  const handleAdd = async () => {
    if (!selectedProductId || !specialPrice) {
      return alert('상품과 특별단가를 모두 입력해주세요.')
    }
    setLoading(true)

    const { error } = await supabase.from('customer_prices').insert({
      customer_id: id,
      product_id: selectedProductId,
      special_price: parseFloat(rawPrice(specialPrice)),
    })

    if (error) {
      alert('저장 실패: ' + error.message)
    } else {
      await recordPriceChange({
        supabase,
        product_id: selectedProductId,
        change_type: 'special',
        customer_id: id as string,
        old_price: 0,
        new_price: parseFloat(rawPrice(specialPrice)),
      })
      setSelectedProductId('')
      setSpecialPrice('')
      setProductSearch('')
      await loadData()
    }
    setLoading(false)
  }

  // 수정
  const handleUpdate = async (cpId: string) => {
    if (!editPrice) return
    setLoading(true)

    const oldItem = customerPrices.find(cp => cp.id === cpId)
    const newPrice = parseFloat(rawPrice(editPrice))

    const { error } = await supabase
      .from('customer_prices')
      .update({ special_price: newPrice })
      .eq('id', cpId)

    if (error) {
      alert('수정 실패: ' + error.message)
    } else {
      if (oldItem && oldItem.special_price !== newPrice) {
        await recordPriceChange({
          supabase,
          product_id: oldItem.product_id,
          change_type: 'special',
          customer_id: id as string,
          old_price: oldItem.special_price,
          new_price: newPrice,
        })
      }
      setEditingId(null)
      setEditPrice('')
      await loadData()
    }
    setLoading(false)
  }

  // 삭제
  const handleDelete = async (cpId: string) => {
    if (!confirm('이 특별단가를 삭제하시겠습니까?')) return

    const oldItem = customerPrices.find(cp => cp.id === cpId)

    const { error } = await supabase
      .from('customer_prices')
      .delete()
      .eq('id', cpId)

    if (error) {
      alert('삭제 실패: ' + error.message)
    } else {
      if (oldItem) {
        await recordPriceChange({
          supabase,
          product_id: oldItem.product_id,
          change_type: 'special',
          customer_id: id as string,
          old_price: oldItem.special_price,
          new_price: 0,
        })
      }
      await loadData()
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6">
      <div className="flex items-center mb-6">
        <Link href={`/customers/${id}`} className="text-gray-500 mr-3">← 거래처 정보</Link>
        <h1 className="text-2xl font-bold">특별단가 설정</h1>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-lg font-medium">{customerName}</p>
        <p className="text-sm text-gray-500">기본 등급: {tierName || '미설정'}</p>
      </div>

      {/* 새 특별단가 추가 */}
      <div className="mb-8 p-4 bg-white rounded-lg shadow-sm border">
        <h2 className="text-sm font-medium text-gray-700 mb-3">특별단가 추가</h2>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="상품명 검색..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <select
            value={selectedProductId}
            onChange={(e) => { setSelectedProductId(e.target.value); setProductSearch('') }}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            size={productSearch ? 5 : 1}
          >
            <option value="">상품 선택</option>
            {availableProducts
              .filter((p) => !productSearch || productSearch.toLowerCase().split(' ').every(word => p.name.toLowerCase().includes(word)))
              .map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {selectedProductId && (
            <p className="text-sm text-gray-500">
              등급 단가 참고: {getTierPrice(selectedProductId)}원
            </p>
          )}
          <input
            type="text"
            inputMode="numeric"
            placeholder="특별단가 입력"
            value={specialPrice}
            onChange={(e) => setSpecialPrice(rawPrice(e.target.value))}
            onBlur={() => { if (specialPrice) setSpecialPrice(formatPrice(specialPrice)) }}
            onFocus={() => { if (specialPrice) setSpecialPrice(rawPrice(specialPrice)) }}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <button
            onClick={handleAdd}
            disabled={loading}
            className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? '저장 중...' : '추가'}
          </button>
        </div>
      </div>

      {/* 기존 특별단가 목록 */}
      <h2 className="text-sm font-medium text-gray-700 mb-3">
        설정된 특별단가 ({customerPrices.length}건)
      </h2>
      {customerPrices.length === 0 ? (
        <p className="text-gray-400 text-sm">설정된 특별단가가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {customerPrices.map((cp) => (
            <div key={cp.id} className="p-4 bg-white rounded-lg shadow-sm border">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{getProductName(cp)}</p>
                  <p className="text-sm text-gray-500">등급 단가: {getTierPrice(cp.product_id)}원</p>
                </div>
                {editingId === cp.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editPrice}
                      onChange={(e) => setEditPrice(rawPrice(e.target.value))}
                      onBlur={() => { if (editPrice) setEditPrice(formatPrice(editPrice)) }}
                      onFocus={() => { if (editPrice) setEditPrice(rawPrice(editPrice)) }}
                      className="w-24 px-2 py-1 border border-gray-300 rounded-md text-right"
                    />
                    <button
                      onClick={() => handleUpdate(cp.id)}
                      className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-md"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded-md"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{cp.special_price.toLocaleString()}원</span>
                    <button
                      onClick={() => { setEditingId(cp.id); setEditPrice(Number(cp.special_price).toLocaleString()) }}
                      className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-md hover:bg-gray-200"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(cp.id)}
                      className="px-3 py-1 bg-red-50 text-red-600 text-sm rounded-md hover:bg-red-100"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
