'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

type Customer = { id: string; name: string }
type Product = { id: string; name: string }

export default function TransactionDetailPage() {
  const router = useRouter()
  const { id } = useParams()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customerId, setCustomerId] = useState('')
  const [productId, setProductId] = useState('')
  const [orderDate, setOrderDate] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [{ data: t }, { data: c }, { data: p }] = await Promise.all([
      supabase.from('transactions').select('*').eq('id', id).single(),
      supabase.from('customers').select('id, name').order('name'),
      supabase.from('products').select('id, name').order('name'),
    ])
    if (t) {
      setCustomerId(t.customer_id || '')
      setProductId(t.product_id || '')
      setOrderDate(t.order_date || '')
      setQuantity(String(t.quantity || ''))
      setUnitPrice(String(t.unit_price || ''))
      setNote(t.note || '')
    }
    setCustomers(c || [])
    setProducts(p || [])
  }

  const total = parseFloat(quantity || '0') * parseFloat(unitPrice || '0')

  const handleSave = async () => {
    setLoading(true)
    const { error } = await supabase.from('transactions').update({
      customer_id: customerId,
      product_id: productId,
      order_date: orderDate,
      quantity: parseInt(quantity),
      unit_price: parseFloat(unitPrice),
      total,
      note,
    }).eq('id', id)

    if (error) {
      alert('저장 실패: ' + error.message)
    } else {
      alert('저장되었습니다!')
    }
    setLoading(false)
  }

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    await supabase.from('transactions').delete().eq('id', id)
    router.push('/transactions')
  }

  return (
    <div className="max-w-lg mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <div className="flex items-center mb-6">
        <Link href="/transactions" className="text-gray-500 mr-3">← 목록</Link>
        <h1 className="text-2xl font-bold">거래 수정</h1>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">거래처</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
            <option value="">거래처 선택</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">상품</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
            <option value="">상품 선택</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">주문일</label>
          <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">수량</label>
          <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">단가</label>
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
        <button onClick={handleDelete}
          className="w-full py-2 px-4 bg-red-500 text-white rounded-md hover:bg-red-600">
          삭제
        </button>
      </div>
    </div>
  )
}
