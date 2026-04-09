'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatPhone } from '@/lib/utils'

export default function CompanySettingsPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [businessNumber, setBusinessNumber] = useState('')
  const [marginStartDate, setMarginStartDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
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
      setMarginStartDate(data.margin_start_date || '')
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setMessage('')

    const { data: existing } = await supabase
      .from('company_info')
      .select('id')
      .single()

    const payload = {
      name,
      phone,
      bank_account: bankAccount,
      business_number: businessNumber,
      margin_start_date: marginStartDate || null,
    }

    if (existing) {
      await supabase
        .from('company_info')
        .update(payload)
        .eq('id', existing.id)
    } else {
      await supabase
        .from('company_info')
        .insert(payload)
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
        <div>
          <label className="block text-sm font-medium text-gray-700">마진 계산 시작일</label>
          <input
            type="date"
            value={marginStartDate}
            onChange={(e) => setMarginStartDate(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <p className="mt-1 text-xs text-gray-500">
            대시보드 마진 분석은 이 날짜 이후의 거래만 사용합니다. 모든 상품의 원가 입력이 끝난 날짜를 지정해주세요.
          </p>
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
