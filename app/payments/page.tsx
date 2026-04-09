'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/lib/ToastContext'
import { formatPrice, rawPrice, getName } from '@/lib/utils'

type Customer = { id: string; name: string }
type Payment = {
  id: string
  payment_date: string
  amount: number
  note: string
  customers: { name: string } | { name: string }[] | null
}

export default function PaymentsPage() {
  const toast = useToast()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  // 입력 폼
  const [customerId, setCustomerId] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('customers').select('id, name').order('name'),
      supabase.from('payments')
        .select('id, payment_date, amount, note, customers(name)')
        .order('payment_date', { ascending: false })
        .limit(50),
    ])
    setCustomers(c || [])
    setPayments(p || [])
    setLoading(false)
  }

  const handleSave = async () => {
    if (!customerId || !amount) {
      return toast.error('거래처와 입금액을 입력해주세요.')
    }
    if (parseFloat(rawPrice(amount)) <= 0) {
      return toast.error('입금액은 0보다 커야 합니다.')
    }
    setSaving(true)

    const { error } = await supabase.from('payments').insert({
      customer_id: customerId,
      payment_date: paymentDate,
      amount: parseFloat(rawPrice(amount)),
      note,
    })

    if (error) {
      toast.error('저장 실패: ' + error.message)
    } else {
      setAmount('')
      setNote('')
      await loadData()
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 입금 기록을 삭제하시겠습니까?')) return
    const { error } = await supabase.from('payments').delete().eq('id', id)
    if (error) {
      toast.error('삭제 실패: ' + error.message)
    } else {
      setPayments(prev => prev.filter(p => p.id !== id))
    }
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6">
      <h1 className="text-2xl font-bold mb-6">입금 관리</h1>

      {/* 입금 등록 폼 */}
      <div className="p-4 bg-white rounded-lg shadow-sm border mb-8 space-y-4">
        <h2 className="text-sm font-medium text-gray-700">입금 등록</h2>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm text-gray-600">거래처 *</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
              <option value="">거래처 선택</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm text-gray-600">입금일 *</label>
            <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm text-gray-600">입금액 (원) *</label>
            <input type="text" inputMode="numeric" value={formatPrice(amount)}
              onChange={(e) => setAmount(rawPrice(e.target.value))}
              placeholder="0"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-gray-600">메모</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="예: 3월분 입금"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
          {saving ? '저장 중...' : '입금 등록'}
        </button>
      </div>

      {/* 입금 목록 */}
      <h2 className="text-sm font-medium text-gray-700 mb-3">최근 입금 내역</h2>
      {loading ? (
        <p>불러오는 중...</p>
      ) : payments.length === 0 ? (
        <p className="text-gray-500">입금 내역이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <div className="flex-1 p-4 bg-white rounded-lg shadow-sm border">
                <div className="flex justify-between">
                  <span className="font-medium">{getName(p.customers)}</span>
                  <span className="font-medium text-green-600">+{p.amount?.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-500 text-sm">{p.payment_date}</span>
                  <span className="text-gray-400 text-sm">{p.note || ''}</span>
                </div>
              </div>
              <button onClick={() => handleDelete(p.id)}
                className="px-3 py-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md text-sm">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
