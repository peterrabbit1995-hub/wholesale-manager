'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AdminGuard from '@/components/AdminGuard'
import { useToast } from '@/lib/ToastContext'
import Link from 'next/link'

type AliasRow = {
  id: string
  alias: string
  product_id: string
  product_name: string
}

export default function AliasesPage() {
  return (
    <AdminGuard>
      <AliasesPageContent />
    </AdminGuard>
  )
}

function AliasesPageContent() {
  const [aliases, setAliases] = useState<AliasRow[]>([])
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAliases()
  }, [])

  const loadAliases = async () => {
    const { data } = await supabase
      .from('product_aliases')
      .select('id, alias, product_id, products(name)')
      .order('alias')

    const rows: AliasRow[] = (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      alias: row.alias as string,
      product_id: row.product_id as string,
      product_name: (row.products as { name: string } | null)?.name || '(알 수 없음)',
    }))

    setAliases(rows)
    setLoading(false)
  }

  const deleteAlias = async (aliasId: string, aliasText: string) => {
    if (!confirm(`별칭 "${aliasText}"을(를) 삭제하시겠습니까?`)) return
    const { error } = await supabase.from('product_aliases').delete().eq('id', aliasId)
    if (error) return toast.error('삭제 실패: ' + error.message)
    loadAliases()
  }

  const filtered = aliases.filter((a) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return a.alias.toLowerCase().includes(q) || a.product_name.toLowerCase().includes(q)
  })

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <div className="flex items-center mb-6">
        <Link href="/products" className="text-gray-500 mr-3">&larr; 상품목록</Link>
        <h1 className="text-2xl font-bold">별칭 관리</h1>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        AI 주문인식에서 사용하는 상품 별칭 목록입니다. 별칭을 클릭하면 해당 상품 상세로 이동합니다.
      </p>

      {/* 검색 */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="상품명 또는 별칭으로 검색..."
        className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
      />

      {loading ? (
        <p className="text-sm text-gray-400">로딩 중...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400">
          {search ? '검색 결과가 없습니다.' : '등록된 별칭이 없습니다.'}
        </p>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-2">
            {search ? `${filtered.length}건 검색됨` : `총 ${aliases.length}건`}
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left py-2 px-3">별칭</th>
                <th className="text-left py-2 px-3">상품명</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3">
                    <Link
                      href={`/products/${a.product_id}`}
                      className="text-indigo-600 hover:underline font-medium"
                    >
                      {a.alias}
                    </Link>
                  </td>
                  <td className="py-2 px-3 text-gray-700">{a.product_name}</td>
                  <td className="py-2 px-1">
                    <button
                      onClick={() => deleteAlias(a.id, a.alias)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
