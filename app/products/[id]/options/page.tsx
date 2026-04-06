'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type ProductOption = {
  id: string
  option_name: string
  option_values: string
  is_required: boolean
  affects_price: boolean
}

type PriceTier = {
  id: string
  name: string
  level: number
}

type OptionPrice = {
  id: string
  option_name: string
  option_value: string
  tier_id: string
  price: number
}

export default function ProductOptionsPage() {
  const { id } = useParams()
  const [productName, setProductName] = useState('')
  const [options, setOptions] = useState<ProductOption[]>([])
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([])
  const [optionPrices, setOptionPrices] = useState<OptionPrice[]>([])

  // 새 옵션 입력용
  const [newName, setNewName] = useState('')
  const [newValues, setNewValues] = useState('')
  const [newRequired, setNewRequired] = useState(false)
  const [newAffectsPrice, setNewAffectsPrice] = useState(false)

  // 가격 편집용
  const [editingOptionName, setEditingOptionName] = useState<string | null>(null)
  const [priceMatrix, setPriceMatrix] = useState<Record<string, Record<string, string>>>({})

  const [loading, setLoading] = useState(false)

  const formatPrice = (value: string) => {
    const nums = value.replace(/[^0-9]/g, '')
    return nums ? Number(nums).toLocaleString() : ''
  }
  const rawPrice = (value: string) => value.replace(/,/g, '')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [{ data: product }, { data: opts }, { data: tiers }, { data: prices }] =
      await Promise.all([
        supabase.from('products').select('name').eq('id', id).single(),
        supabase.from('product_options').select('*').eq('product_id', id).order('created_at'),
        supabase.from('price_tiers').select('id, name, level').order('level'),
        supabase.from('option_prices').select('*').eq('product_id', id),
      ])

    if (product) setProductName(product.name)
    setOptions(opts || [])
    setPriceTiers(tiers || [])
    setOptionPrices(prices || [])
  }

  // 옵션 추가
  const handleAddOption = async () => {
    if (!newName.trim() || !newValues.trim()) {
      return alert('옵션명과 옵션값을 모두 입력해주세요.')
    }
    setLoading(true)

    const { error } = await supabase.from('product_options').insert({
      product_id: id,
      option_name: newName.trim(),
      option_values: newValues.trim(),
      is_required: newRequired,
      affects_price: newAffectsPrice,
    })

    if (error) {
      alert('저장 실패: ' + error.message)
    } else {
      setNewName('')
      setNewValues('')
      setNewRequired(false)
      setNewAffectsPrice(false)
      await loadData()
    }
    setLoading(false)
  }

  // 옵션 설정 수정 (필수여부, 가격영향)
  const handleUpdateOption = async (opt: ProductOption, field: 'is_required' | 'affects_price', value: boolean) => {
    const { error } = await supabase
      .from('product_options')
      .update({ [field]: value })
      .eq('id', opt.id)

    if (error) {
      alert('수정 실패: ' + error.message)
    } else {
      setOptions(prev => prev.map(o => o.id === opt.id ? { ...o, [field]: value } : o))
    }
  }

  // 옵션 삭제
  const handleDeleteOption = async (opt: ProductOption) => {
    if (!confirm(`"${opt.option_name}" 옵션을 삭제하시겠습니까?`)) return

    // 관련 옵션 가격도 삭제
    await supabase
      .from('option_prices')
      .delete()
      .eq('product_id', id)
      .eq('option_name', opt.option_name)

    const { error } = await supabase.from('product_options').delete().eq('id', opt.id)

    if (error) {
      alert('삭제 실패: ' + error.message)
    } else {
      await loadData()
    }
  }

  // 가격 편집 열기
  const openPriceEditor = (optionName: string, optionValues: string) => {
    const values = optionValues.split(',').map((v) => v.trim())
    const matrix: Record<string, Record<string, string>> = {}

    values.forEach((val) => {
      matrix[val] = {}
      priceTiers.forEach((tier) => {
        const existing = optionPrices.find(
          (p) => p.option_name === optionName && p.option_value === val && p.tier_id === tier.id
        )
        matrix[val][tier.id] = existing ? String(existing.price) : ''
      })
    })

    setPriceMatrix(matrix)
    setEditingOptionName(optionName)
  }

  // 가격 저장
  const handleSavePrices = async () => {
    if (!editingOptionName) return
    setLoading(true)

    // 기존 가격 삭제 후 재삽입
    await supabase
      .from('option_prices')
      .delete()
      .eq('product_id', id)
      .eq('option_name', editingOptionName)

    const rows: {
      product_id: string | string[]
      option_name: string
      option_value: string
      tier_id: string
      price: number
    }[] = []

    Object.entries(priceMatrix).forEach(([optionValue, tierPrices]) => {
      Object.entries(tierPrices).forEach(([tierId, price]) => {
        const cleanPrice = rawPrice(price)
        if (cleanPrice && parseFloat(cleanPrice) > 0) {
          rows.push({
            product_id: id as string,
            option_name: editingOptionName,
            option_value: optionValue,
            tier_id: tierId,
            price: parseFloat(cleanPrice),
          })
        }
      })
    })

    if (rows.length > 0) {
      const { error } = await supabase.from('option_prices').insert(rows)
      if (error) {
        alert('가격 저장 실패: ' + error.message)
        setLoading(false)
        return
      }
    }

    setEditingOptionName(null)
    setPriceMatrix({})
    await loadData()
    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6">
      <div className="flex items-center mb-6">
        <Link href={`/products/${id}`} className="text-gray-500 mr-3">← 상품 정보</Link>
        <h1 className="text-2xl font-bold">옵션 설정</h1>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-lg font-medium">{productName}</p>
      </div>

      {/* 새 옵션 추가 */}
      <div className="mb-8 p-4 bg-white rounded-lg shadow-sm border">
        <h2 className="text-sm font-medium text-gray-700 mb-3">옵션 추가</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">옵션명</label>
            <input
              type="text"
              placeholder="예: 경도, 사이즈, 색상"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">옵션값 (쉼표로 구분)</label>
            <input
              type="text"
              placeholder="예: Q, H, M, S"
              value={newValues}
              onChange={(e) => setNewValues(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={newRequired}
                onChange={(e) => setNewRequired(e.target.checked)}
                className="rounded"
              />
              필수 옵션
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={newAffectsPrice}
                onChange={(e) => setNewAffectsPrice(e.target.checked)}
                className="rounded"
              />
              가격 영향
            </label>
          </div>
          <button
            onClick={handleAddOption}
            disabled={loading}
            className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? '저장 중...' : '추가'}
          </button>
        </div>
      </div>

      {/* 기존 옵션 목록 */}
      <h2 className="text-sm font-medium text-gray-700 mb-3">
        설정된 옵션 ({options.length}건)
      </h2>
      {options.length === 0 ? (
        <p className="text-gray-400 text-sm">설정된 옵션이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {options.map((opt) => (
            <div key={opt.id} className="p-4 bg-white rounded-lg shadow-sm border">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{opt.option_name}</p>
                  <p className="text-sm text-gray-400 mt-1 bg-gray-50 px-2 py-1 rounded">{opt.option_values}</p>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={opt.is_required}
                        onChange={(e) => handleUpdateOption(opt, 'is_required', e.target.checked)}
                        className="rounded"
                      />
                      필수
                    </label>
                    <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={opt.affects_price}
                        onChange={(e) => handleUpdateOption(opt, 'affects_price', e.target.checked)}
                        className="rounded"
                      />
                      가격영향
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  {opt.affects_price && (
                    <button
                      onClick={() => openPriceEditor(opt.option_name, opt.option_values)}
                      className="px-3 py-1 bg-amber-50 text-amber-600 text-sm rounded-md hover:bg-amber-100"
                    >
                      가격설정
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteOption(opt)}
                    className="px-3 py-1 bg-red-50 text-red-600 text-sm rounded-md hover:bg-red-100"
                  >
                    삭제
                  </button>
                </div>
              </div>

              {/* 옵션 가격 매트릭스 (편집 모드) */}
              {editingOptionName === opt.option_name && (
                <div className="mt-4 pt-4 border-t">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    옵션별 가격 설정
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-2 py-1 font-medium">옵션값</th>
                          {priceTiers.map((t) => (
                            <th key={t.id} className="text-center px-2 py-1 font-medium">{t.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(priceMatrix).map(([optVal, tierPrices]) => (
                          <tr key={optVal} className="border-t">
                            <td className="px-2 py-1 font-medium">{optVal}</td>
                            {priceTiers.map((t) => (
                              <td key={t.id} className="px-1 py-1">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={tierPrices[t.id] || ''}
                                  onChange={(e) => {
                                    const updated = { ...priceMatrix }
                                    updated[optVal] = { ...updated[optVal], [t.id]: rawPrice(e.target.value) }
                                    setPriceMatrix(updated)
                                  }}
                                  onBlur={(e) => {
                                    const v = rawPrice(e.target.value)
                                    if (v) {
                                      const updated = { ...priceMatrix }
                                      updated[optVal] = { ...updated[optVal], [t.id]: formatPrice(v) }
                                      setPriceMatrix(updated)
                                    }
                                  }}
                                  onFocus={(e) => {
                                    const v = rawPrice(e.target.value)
                                    if (v) {
                                      const updated = { ...priceMatrix }
                                      updated[optVal] = { ...updated[optVal], [t.id]: v }
                                      setPriceMatrix(updated)
                                    }
                                  }}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-right text-sm"
                                  placeholder="0"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleSavePrices}
                      disabled={loading}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {loading ? '저장 중...' : '가격 저장'}
                    </button>
                    <button
                      onClick={() => { setEditingOptionName(null); setPriceMatrix({}) }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-md"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
