'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

type PriceTier = {
  id: string
  name: string
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

  useEffect(() => {
    loadData()
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
        <Link href="/customers" className="text-gray-500 mr-3">← 목록</Link>
        <h1 className="text-2xl font-bold">거래처 수정</h1>
      </div>
      <div className="space-y-4">
        {[
          { label: '상호명 *', value: name, setter: setName },
          { label: '대표자명', value: representative, setter: setRepresentative },
          { label: '연락처', value: phone, setter: setPhone },
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
        <button onClick={handleDelete}
          className="w-full py-2 px-4 bg-red-500 text-white rounded-md hover:bg-red-600">
          삭제
        </button>
      </div>
    </div>
  )
} 
