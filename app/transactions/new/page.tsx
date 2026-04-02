'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Customer = { id: string; name: string; default_tier_id: string | null }
type Product = { id: string; name: string }
type Price = { tier_id: string; price: number }

export default function NewTransactionPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customerId, setCustomerId] = useState('')
  const [productId, setProductId] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

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
    if (!pid || !customerId) return

    const customer = customers.find((c) => c.id === customerId)
    if (!customer?.default_tier_id) return

    const { data: prices } = await supabase
      .from('product_prices')
      .select('tier_id, price')
      .eq('product_id', pid)

    const matched = (prices as Price[])?.find(
      (p) => p.tier_id === customer.default_tier_id
    )
    if (matched) setUnitPrice(String(matched.price))
  }

  const handleCustomerChange = async (cid: string) => {
    setCustomerId(cid)
    if (!cid || !productId) return

    const customer = customers.find((c) => c.id === cid)
    if (!customer?.default_tier_id) return

    const { data: prices } = await supabase
      .from('product_prices')
      .select('tier_id, price')
      .eq('product_id', productId)

    const matched = (prices as Price[])?.find(
      (p) => p.tier_id === customer.default_tier_id
    )
    if (matched) setUnitPrice(String(matched.price))
  }

  const total = parseFloat(quantity || '0') * parseFloat(unitPrice || '0')

  const handleSave = async () => {
    if (!customerId || !productId || !quantity || !unitPrice) {
      return alert('거래처, 상품, 수량, 단가를 모두 입력해주세요.')
    }
    setLoading(true)

    const { error } = await supabase.from('transactions').insert({
      customer_id: customerId,
      product_id: productId,
      order_date: orderDate,
      quantity: parseInt(quantity),
      unit_price: parseFloat(unitPrice),
      total,
      shipment_status: '대기',
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
          <select value={productId} onChange={(e) => handleProductChange(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
            <option value="">상품 선택</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">주문일 *</label>
          <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">수량 *</label>
          <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">단가 * (자동 적용)</label>
          <input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
        </div>
        <div className="p-3 bg-gray-50 rounded-md">
          <span className="text-sm text-gray-600">합계: </span>
          <span className="font-bold text-lg">{total.toLocaleString()}원</span>
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
      </div>
    </div>
  )
}