'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

type PriceTier = {
  id: string
  name: string
}

type PriceHistoryItem = {
  id: string
  old_price: number
  new_price: number
  created_at: string
  product_id: string
  product_name: string
}

export default function CustomerDetailPage() {
  const router = useRouter()
  const { id } = useParams()
  const [name, setName] = useState('')
  const [representative, setRepresentative] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [businessNumber, setBusinessNumber] = useState('')
  const [address, setAddress] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [defaultTierId, setDefaultTierId] = useState('')
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([])
  const [loading, setLoading] = useState(false)
  const [priceHistory, setPriceHistory] = useState<PriceHistoryItem[]>([])

const formatPhone = (value: string) => {
    const nums = value.replace(/[^0-9]/g, '')
    if (nums.startsWith('02')) {
      if (nums.length <= 2) return nums
      if (nums.length <= 6) return `${nums.slice(0, 2)}-${nums.slice(2)}`
      return `${nums.slice(0, 2)}-${nums.slice(2, 6)}-${nums.slice(6, 10)}`
    }
    if (nums.length <= 3) return nums
    if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`
    return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7, 11)}`
  }

  useEffect(() => {
    loadData()
    loadPriceHistory()
  }, [])

  const loadData = async () => {
    const [{ data: customer }, { data: tiers }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id).single(),
      supabase.from('price_tiers').select('id, name').order('level'),
    ])
    if (customer) {
      setName(customer.name || '')
      setRepresentative(customer.representative || '')
      setPhone(customer.phone || '')
      setEmail(customer.email || '')
      setBusinessNumber(customer.business_number || '')
      setAddress(customer.address || '')
      setBankAccount(customer.bank_account || '')
      setDefaultTierId(customer.default_tier_id || '')
    }
    setPriceTiers(tiers || [])
  }

  const loadPriceHistory = async () => {
    const { data } = await supabase
      .from('price_history')
      .select('id, old_price, new_price, created_at, product_id, products(name)')
      .eq('customer_id', id)
      .eq('change_type', 'special')
      .order('created_at', { ascending: false })
      .limit(20)

    const rows: PriceHistoryItem[] = (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      old_price: row.old_price as number,
      new_price: row.new_price as number,
      created_at: row.created_at as string,
      product_id: row.product_id as string,
      product_name: (row.products as { name: string } | null)?.name || '(알 수 없음)',
    }))

    setPriceHistory(rows)
  }

  const handleSave = async () => {
    setLoading(true)
    const { error } = await supabase.from('customers').update({
      name, representative, phone, email,
      business_number: businessNumber,
      address, bank_account: bankAccount,
      default_tier_id: defaultTierId || null,
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
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (error) {
      alert('삭제 실패: ' + error.message)
    } else {
      router.push('/customers')
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <div className="flex items-center mb-6">
        <Link href="/customers" className="text-gray-500 mr-3">&larr; 목록</Link>
        <h1 className="text-2xl font-bold">거래처 수정</h1>
      </div>
      <div className="space-y-4">
        {[
          { label: '상호명 *', value: name, setter: setName },
          { label: '대표자명', value: representative, setter: setRepresentative },
          { label: '연락처', value: phone, setter: (v: string) => setPhone(formatPhone(v)) },
          { label: '이메일', value: email, setter: setEmail },
          { label: '사업자등록번호', value: businessNumber, setter: setBusinessNumber },
          { label: '주소', value: address, setter: setAddress },
          { label: '계좌번호', value: bankAccount, setter: setBankAccount },
        ].map(({ label, value, setter }) => (
          <div key={label}>
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            <input
              type="text"
              value={value}
              onChange={(e) => setter(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        ))}
        <div>
          <label className="block text-sm font-medium text-gray-700">기본 가격 등급</label>
          <select
            value={defaultTierId}
            onChange={(e) => setDefaultTierId(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">등급 선택</option>
            {priceTiers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <button onClick={handleSave} disabled={loading}
          className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
          {loading ? '저장 중...' : '저장하기'}
        </button>
        <Link
          href={`/customers/${id}/prices`}
          className="block w-full py-2 px-4 bg-amber-500 text-white rounded-md hover:bg-amber-600 text-center"
        >
          특별단가 설정
        </Link>
        <button onClick={handleDelete}
          className="w-full py-2 px-4 bg-red-500 text-white rounded-md hover:bg-red-600">
          삭제
        </button>

        {/* 특별단가 변동 이력 */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h2 className="text-lg font-bold mb-3">특별단가 변동 이력</h2>
          {priceHistory.length === 0 ? (
            <p className="text-sm text-gray-400">특별단가 변동 이력이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {priceHistory.map((h) => {
                const old = Number(h.old_price)
                const now = Number(h.new_price)
                let desc = ''
                if (old === 0) {
                  desc = `특별단가 설정 ${now.toLocaleString()}원`
                } else if (now === 0) {
                  desc = `특별단가 해제 (${old.toLocaleString()}원)`
                } else {
                  desc = `${old.toLocaleString()} → ${now.toLocaleString()}원`
                }
                return (
                  <div key={h.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md text-sm">
                    <span className="text-xs text-gray-500 shrink-0">
                      {new Date(h.created_at).toLocaleDateString('ko-KR')}
                    </span>
                    <span className="font-medium shrink-0">{h.product_name}</span>
                    <span className="text-gray-600">{desc}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
