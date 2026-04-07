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
  const [costPrice, setCostPrice] = useState('')
  const [options, setOptions] = useState<Record<string, string> | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [invoiceId, setInvoiceId] = useState<string | null>(null)

  const isLocked = invoiceId !== null

  const formatPrice = (value: string) => {
    const nums = value.replace(/[^0-9]/g, '')
    return nums ? Number(nums).toLocaleString() : ''
  }

  const rawPrice = (value: string) => value.replace(/,/g, '')

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
      setUnitPrice(t.unit_price ? Number(t.unit_price).toLocaleString() : '')
      setCostPrice(t.cost_price ? String(t.cost_price) : '')
      setOptions(t.options || null)
      setNote(t.note || '')
      setInvoiceId(t.invoice_id || null)
    }
    setCustomers(c || [])
    setProducts(p || [])
  }

  const total = parseFloat(quantity || '0') * parseFloat(rawPrice(unitPrice) || '0')

  const handleSave = async () => {
    setLoading(true)
    const { error } = await supabase.from('transactions').update({
      customer_id: customerId,
      product_id: productId,
      order_date: orderDate,
      quantity: parseInt(quantity),
      unit_price: parseFloat(rawPrice(unitPrice)),
      cost_price: costPrice ? parseFloat(rawPrice(costPrice)) : null,
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
        {isLocked && (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-md">
            <p className="text-amber-800 font-medium">명세서에 포함된 거래입니다</p>
            <p className="text-amber-600 text-sm mt-1">
              수정/삭제하려면 연결된 명세서를 먼저 삭제해주세요.
            </p>
            <Link
              href={`/invoices/${invoiceId}`}
              className="inline-block mt-2 text-sm text-indigo-600 hover:text-indigo-800 underline"
            >
              연결된 명세서 보기 →
            </Link>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700">거래처</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
            disabled={isLocked}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:text-gray-500">
            <option value="">거래처 선택</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">상품</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}
            disabled={isLocked}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:text-gray-500">
            <option value="">상품 선택</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {options && Object.keys(options).length > 0 && (
          <div className="p-3 bg-gray-50 rounded-md">
            <p className="text-sm font-medium text-gray-700 mb-1">선택된 옵션</p>
            {Object.entries(options).map(([name, value]) => (
              <p key={name} className="text-sm text-gray-600">{name}: {value}</p>
            ))}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">주문일</label>
          <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)}
            disabled={isLocked}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:text-gray-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">수량</label>
          <input type="text" inputMode="numeric" value={quantity}
            onChange={(e) => setQuantity(e.target.value.replace(/[^0-9-]/g, ''))}
            disabled={isLocked}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:text-gray-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">단가</label>
          <input type="text" inputMode="numeric" value={unitPrice}
            onChange={(e) => setUnitPrice(rawPrice(e.target.value))}
            onBlur={() => { if (unitPrice) setUnitPrice(formatPrice(unitPrice)) }}
            onFocus={() => { if (unitPrice) setUnitPrice(rawPrice(unitPrice)) }}
            disabled={isLocked}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:text-gray-500" />
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
        {!isLocked && (
          <>
            <button onClick={handleSave} disabled={loading}
              className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
              {loading ? '저장 중...' : '저장하기'}
            </button>
            <button onClick={handleDelete}
              className="w-full py-2 px-4 bg-red-500 text-white rounded-md hover:bg-red-600">
              삭제
            </button>
          </>
        )}
      </div>
    </div>
  )
}
