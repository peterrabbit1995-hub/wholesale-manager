 'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function CompanySettingsPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [businessNumber, setBusinessNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
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
    loadCompanyInfo()
  }, [])

  const loadCompanyInfo = async () => {
    const { data } = await supabase
      .from('company_info')
      .select('*')
      .single()

    if (data) {
      setName(data.name || '')
      setPhone(data.phone || '')
      setBankAccount(data.bank_account || '')
      setBusinessNumber(data.business_number || '')
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setMessage('')

    const { data: existing } = await supabase
      .from('company_info')
      .select('id')
      .single()

    if (existing) {
      await supabase
        .from('company_info')
        .update({ name, phone, bank_account: bankAccount, business_number: businessNumber })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('company_info')
        .insert({ name, phone, bank_account: bankAccount, business_number: businessNumber })
    }

    setMessage('저장되었습니다!')
    setLoading(false)
  }

  return (
    <div className="max-w-lg mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">회사 정보 설정</h1>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">상호/회사명</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">연락처</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">계좌번호</label>
          <input
            type="text"
            value={bankAccount}
            onChange={(e) => setBankAccount(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">사업자등록번호</label>
          <input
            type="text"
            value={businessNumber}
            onChange={(e) => setBusinessNumber(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        {message && <div className="text-green-600 text-sm">{message}</div>}
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  )
}
