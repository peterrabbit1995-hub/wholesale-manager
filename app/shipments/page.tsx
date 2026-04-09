'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/lib/ToastContext'
import { getName } from '@/lib/utils'
import Link from 'next/link'

type Transaction = {
  id: string
  order_date: string
  quantity: number
  unit_price: number
  total: number
  customer_id: string
  product_id: string
  options: Record<string, string> | null
  customers: { name: string } | { name: string }[] | null
  products: { name: string } | { name: string }[] | null
}

type ShippedTransaction = Transaction & {
  shipment_id: string
  shipped_at: string
  courier: string
  tracking_number: string | null
  delivery_method: string | null
  note: string | null
}

type GroupedByCustomer<T> = {
  customerId: string
  customerName: string
  transactions: T[]
}

type Tab = 'pending' | 'shipped'

// 인라인 편집 대상 필드
type EditField = 'tracking' | 'note'

export default function ShipmentsPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('pending')
  const [pendingGroups, setPendingGroups] = useState<GroupedByCustomer<Transaction>[]>([])
  const [shippedGroups, setShippedGroups] = useState<GroupedByCustomer<ShippedTransaction>[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [shippedCount, setShippedCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // 대기 탭 state
  const [pendingSelected, setPendingSelected] = useState<Set<string>>(new Set())
  const [courier, setCourier] = useState('로젠택배')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  // 완료 탭 state
  const [shippedSelected, setShippedSelected] = useState<Set<string>>(new Set())
  const [editingFields, setEditingFields] = useState<Record<string, string>>({})
  const [cancelling, setCancelling] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // 편집 키: shipmentId + field → "shipmentId:tracking" 또는 "shipmentId:note"
  const editKey = (shipmentId: string, field: EditField) => `${shipmentId}:${field}`

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([loadPending(), loadShipped()])
    setLoading(false)
  }

  const loadPending = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('id, order_date, quantity, unit_price, total, customer_id, product_id, options, customers(name), products(name)')
      .not('invoice_id', 'is', null)
      .eq('shipment_status', '대기')
      .order('order_date', { ascending: true })

    const txs = data || []
    setPendingGroups(groupByCustomer(txs))
    setPendingCount(txs.length)
    setPendingSelected(new Set())
  }

  const loadShipped = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, order_date, quantity, unit_price, total, customer_id, product_id, options, customers(name), products(name), shipments(id, shipped_at, courier, tracking_number, delivery_method, note)')
      .eq('shipment_status', '완료')
      .order('order_date', { ascending: false })

    if (error) {
      console.error('loadShipped error:', error)
      setShippedGroups([])
      setShippedCount(0)
      return
    }

    const rows: ShippedTransaction[] = (data || [])
      .filter((tx: Record<string, unknown>) => {
        const ships = tx.shipments as unknown[]
        return ships && ships.length > 0
      })
      .map((tx: Record<string, unknown>) => {
        const ships = tx.shipments as Record<string, unknown>[]
        const s = ships[0]
        return {
          id: tx.id as string,
          order_date: tx.order_date as string,
          quantity: tx.quantity as number,
          unit_price: tx.unit_price as number,
          total: tx.total as number,
          customer_id: tx.customer_id as string,
          product_id: tx.product_id as string,
          options: tx.options as Record<string, string> | null,
          customers: tx.customers as { name: string } | { name: string }[] | null,
          products: tx.products as { name: string } | { name: string }[] | null,
          shipment_id: s.id as string,
          shipped_at: s.shipped_at as string,
          courier: s.courier as string,
          tracking_number: s.tracking_number as string | null,
          delivery_method: s.delivery_method as string | null,
          note: s.note as string | null,
        }
      })

    setShippedGroups(groupByCustomer(rows))
    setShippedCount(rows.length)
    setShippedSelected(new Set())
  }

  function groupByCustomer<T extends { customer_id: string; customers: { name: string } | { name: string }[] | null }>(
    txs: T[]
  ): GroupedByCustomer<T>[] {
    const map = new Map<string, GroupedByCustomer<T>>()
    for (const tx of txs) {
      if (!map.has(tx.customer_id)) {
        map.set(tx.customer_id, {
          customerId: tx.customer_id,
          customerName: getName(tx.customers),
          transactions: [],
        })
      }
      map.get(tx.customer_id)!.transactions.push(tx)
    }
    return Array.from(map.values()).sort((a, b) => a.customerName.localeCompare(b.customerName))
  }

  // === 안내 메시지 생성 ===
  const buildNotifyText = (tx: ShippedTransaction) => {
    const productName = getName(tx.products)
    const optionText = tx.options
      ? ' (' + Object.entries(tx.options).map(([k, v]) => `${k}: ${v}`).join(', ') + ')'
      : ''
    const label = `${productName}${optionText} ${tx.quantity}개`

    if (tx.tracking_number) {
      return `${label} 발송했습니다. 송장번호: ${tx.tracking_number} 배송조회: https://www.ilogen.com/web/personal/trace/${tx.tracking_number}`
    }
    return `${label} 발송완료`
  }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const copyOneNotify = (tx: ShippedTransaction) => {
    copyToClipboard(buildNotifyText(tx), tx.shipment_id)
  }

  const copyGroupNotify = (group: GroupedByCustomer<ShippedTransaction>) => {
    const txs = group.transactions
    // 송장번호가 모두 같으면 묶어서 표시
    const trackingNumbers = new Set(txs.map(t => t.tracking_number || ''))
    if (trackingNumbers.size === 1) {
      const items = txs.map(tx => {
        const name = getName(tx.products)
        const opt = tx.options
          ? ' (' + Object.entries(tx.options).map(([k, v]) => `${k}: ${v}`).join(', ') + ')'
          : ''
        return `${name}${opt} ${tx.quantity}개`
      }).join('\n')

      const tracking = txs[0].tracking_number
      const text = tracking
        ? `${items}\n발송했습니다. 송장번호: ${tracking}\n배송조회: https://www.ilogen.com/web/personal/trace/${tracking}`
        : `${items}\n발송완료`
      copyToClipboard(text, `group:${group.customerId}`)
    } else {
      // 송장번호가 다르면 개별로
      const text = txs.map(buildNotifyText).join('\n')
      copyToClipboard(text, `group:${group.customerId}`)
    }
  }

  // === 대기 탭: 선택 ===
  const togglePendingCustomer = (group: GroupedByCustomer<Transaction>) => {
    const ids = group.transactions.map(t => t.id)
    const allSel = ids.every(id => pendingSelected.has(id))
    setPendingSelected(prev => {
      const next = new Set(prev)
      if (allSel) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }

  const togglePendingOne = (id: string) => {
    setPendingSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const togglePendingAll = () => {
    const allIds = pendingGroups.flatMap(g => g.transactions.map(t => t.id))
    const allSel = allIds.length > 0 && allIds.every(id => pendingSelected.has(id))
    setPendingSelected(allSel ? new Set() : new Set(allIds))
  }

  // === 완료 탭: 선택 ===
  const toggleShippedCustomer = (group: GroupedByCustomer<ShippedTransaction>) => {
    const ids = group.transactions.map(t => t.shipment_id)
    const allSel = ids.every(id => shippedSelected.has(id))
    setShippedSelected(prev => {
      const next = new Set(prev)
      if (allSel) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }

  const toggleShippedOne = (shipmentId: string) => {
    setShippedSelected(prev => {
      const next = new Set(prev)
      if (next.has(shipmentId)) next.delete(shipmentId)
      else next.add(shipmentId)
      return next
    })
  }

  const toggleShippedAll = () => {
    const allIds = shippedGroups.flatMap(g => g.transactions.map(t => t.shipment_id))
    const allSel = allIds.length > 0 && allIds.every(id => shippedSelected.has(id))
    setShippedSelected(allSel ? new Set() : new Set(allIds))
  }

  // === 대기 탭: 발송 처리 ===
  const handleShip = async () => {
    if (pendingSelected.size === 0) return toast.error('발송할 거래를 선택해주세요.')
    if (!courier.trim()) return toast.error('택배사를 입력해주세요.')
    if (!confirm(`${pendingSelected.size}건을 발송 처리하시겠습니까?`)) return

    setSaving(true)
    const now = new Date().toISOString().split('T')[0]
    const hasTracking = !!trackingNumber.trim()
    const deliveryMethod = hasTracking ? '택배' : '직접수령'
    let failCount = 0

    for (const txId of pendingSelected) {
      const tx = pendingGroups.flatMap(g => g.transactions).find(t => t.id === txId)
      if (!tx) continue

      const { error } = await supabase.from('shipments').insert({
        transaction_id: txId,
        shipped_quantity: tx.quantity,
        shipped_at: now,
        courier: courier.trim(),
        tracking_number: hasTracking ? trackingNumber.trim() : null,
        delivery_method: deliveryMethod,
        note: note.trim() || null,
        notified: false,
      })

      if (error) { failCount++; continue }

      await supabase.from('transactions').update({ shipment_status: '완료' }).eq('id', txId)
    }

    if (failCount > 0) toast.error(`${pendingSelected.size - failCount}건 성공, ${failCount}건 실패`)
    else toast.success(`${pendingSelected.size}건 발송 완료`)

    setTrackingNumber('')
    setNote('')
    setSaving(false)
    await loadAll()
  }

  // === 완료 탭: 일괄 취소 ===
  const handleBulkCancel = async () => {
    if (shippedSelected.size === 0) return toast.error('취소할 거래를 선택해주세요.')
    if (!confirm(`${shippedSelected.size}건의 발송을 취소하시겠습니까?`)) return

    setCancelling(true)
    const allTxs = shippedGroups.flatMap(g => g.transactions)

    for (const shipmentId of shippedSelected) {
      const tx = allTxs.find(t => t.shipment_id === shipmentId)
      if (!tx) continue
      await supabase.from('shipments').delete().eq('id', shipmentId)
      await supabase.from('transactions').update({ shipment_status: '대기' }).eq('id', tx.id)
    }

    toast.success(`${shippedSelected.size}건 발송 취소 완료`)
    setCancelling(false)
    await loadAll()
  }

  // === 완료 탭: 인라인 편집 (송장번호 + 비고 공용) ===
  const startEdit = (shipmentId: string, field: EditField, current: string | null) => {
    setEditingFields(prev => ({ ...prev, [editKey(shipmentId, field)]: current || '' }))
  }

  const saveField = async (tx: ShippedTransaction, field: EditField) => {
    const key = editKey(tx.shipment_id, field)
    const newVal = (editingFields[key] || '').trim()

    const updateData: Record<string, unknown> = {}
    if (field === 'tracking') {
      updateData.tracking_number = newVal || null
      updateData.delivery_method = newVal ? '택배' : '직접수령'
    } else {
      updateData.note = newVal || null
    }

    const { error } = await supabase.from('shipments').update(updateData).eq('id', tx.shipment_id)
    if (error) {
      toast.error('저장 실패: ' + error.message)
      return
    }

    setEditingFields(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    await loadShipped()
  }

  const cancelEdit = (shipmentId: string, field: EditField) => {
    setEditingFields(prev => {
      const next = { ...prev }
      delete next[editKey(shipmentId, field)]
      return next
    })
  }

  // 탭별 집계
  const pendingAllIds = pendingGroups.flatMap(g => g.transactions.map(t => t.id))
  const pendingAllSelected = pendingAllIds.length > 0 && pendingAllIds.every(id => pendingSelected.has(id))
  const shippedAllIds = shippedGroups.flatMap(g => g.transactions.map(t => t.shipment_id))
  const shippedAllSelected = shippedAllIds.length > 0 && shippedAllIds.every(id => shippedSelected.has(id))

  const methodBadge = (method: string | null) => {
    if (method === '택배') return 'bg-blue-100 text-blue-700'
    if (method === '직접수령') return 'bg-amber-100 text-amber-700'
    return 'bg-gray-100 text-gray-600'
  }

  // 인라인 편집 가능한 셀 렌더링
  const renderEditableCell = (
    tx: ShippedTransaction,
    field: EditField,
    value: string | null,
    placeholder: string,
  ) => {
    const key = editKey(tx.shipment_id, field)
    const isEditing = key in editingFields

    return (
      <td
        className={`py-2 px-2 ${isEditing ? '' : 'cursor-pointer'}`}
        onClick={() => { if (!isEditing) startEdit(tx.shipment_id, field, value) }}
      >
        {isEditing ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editingFields[key]}
              onChange={(e) => setEditingFields(prev => ({ ...prev, [key]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveField(tx, field)
                if (e.key === 'Escape') cancelEdit(tx.shipment_id, field)
              }}
              autoFocus
              placeholder={placeholder}
              className="w-28 px-1 py-0.5 border border-indigo-300 rounded text-sm"
            />
            <button onClick={() => saveField(tx, field)} className="text-indigo-600 text-xs">저장</button>
            <button onClick={() => cancelEdit(tx.shipment_id, field)} className="text-gray-400 text-xs">취소</button>
          </div>
        ) : value ? (
          <span className="text-indigo-600 hover:underline">{value}</span>
        ) : (
          <span className="text-indigo-400 text-xs">{placeholder}</span>
        )}
      </td>
    )
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <div className="flex items-center mb-6">
        <Link href="/transactions" className="text-gray-500 mr-3">&larr; 거래목록</Link>
        <h1 className="text-2xl font-bold">발송 관리</h1>
      </div>

      {/* 탭 */}
      <div className="flex border-b mb-4">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'pending'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          대기 ({pendingCount}건)
        </button>
        <button
          onClick={() => setTab('shipped')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'shipped'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          완료 ({shippedCount}건)
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">로딩 중...</p>
      ) : (
        <>
          {/* ===== 대기 탭 ===== */}
          {tab === 'pending' && (
            pendingGroups.length === 0 ? (
              <p className="text-sm text-gray-400">발송 대기 중인 거래가 없습니다.</p>
            ) : (
              <>
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pendingAllSelected}
                      onChange={togglePendingAll}
                      className="rounded border-gray-300"
                    />
                    전체 선택 ({pendingAllIds.length}건)
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    <input
                      type="text"
                      value={courier}
                      onChange={(e) => setCourier(e.target.value)}
                      placeholder="택배사"
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm w-32"
                    />
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="송장번호 (없으면 직접수령)"
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm flex-1"
                    />
                  </div>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="비고 (퀵 기사명, 메모 등)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <button
                    onClick={handleShip}
                    disabled={saving || pendingSelected.size === 0}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm"
                  >
                    {saving ? '처리 중...' : `발송 처리 (${pendingSelected.size}건)`}
                  </button>
                </div>

                {pendingGroups.map((group) => {
                  const groupIds = group.transactions.map(t => t.id)
                  const groupAllSel = groupIds.every(id => pendingSelected.has(id))
                  const groupSomeSel = groupIds.some(id => pendingSelected.has(id)) && !groupAllSel
                  return (
                    <div key={group.customerId} className="mb-4 border rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={groupAllSel}
                          ref={(el) => { if (el) el.indeterminate = groupSomeSel }}
                          onChange={() => togglePendingCustomer(group)}
                          className="rounded border-gray-300"
                        />
                        <span className="font-medium text-sm">{group.customerName}</span>
                        <span className="text-xs text-gray-500">({group.transactions.length}건)</span>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="w-10 py-2 px-2"></th>
                            <th className="text-left py-2 px-2">상품명</th>
                            <th className="text-left py-2 px-1">옵션</th>
                            <th className="text-right py-2 px-2">수량</th>
                            <th className="text-right py-2 px-2">거래일</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.transactions.map((tx) => (
                            <tr key={tx.id} className={`border-b hover:bg-gray-50 ${pendingSelected.has(tx.id) ? 'bg-indigo-50' : ''}`}>
                              <td className="py-2 px-2 text-center">
                                <input type="checkbox" checked={pendingSelected.has(tx.id)} onChange={() => togglePendingOne(tx.id)} className="rounded border-gray-300" />
                              </td>
                              <td className="py-2 px-2">{getName(tx.products)}</td>
                              <td className="py-2 px-1 text-xs text-gray-500">
                                {tx.options ? Object.entries(tx.options).map(([k, v]) => `${k}: ${v}`).join(', ') : '-'}
                              </td>
                              <td className="py-2 px-2 text-right">{tx.quantity}</td>
                              <td className="py-2 px-2 text-right text-gray-500">{tx.order_date}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </>
            )
          )}

          {/* ===== 완료 탭 ===== */}
          {tab === 'shipped' && (
            shippedGroups.length === 0 ? (
              <p className="text-sm text-gray-400">발송 완료된 거래가 없습니다.</p>
            ) : (
              <>
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border flex items-center justify-between flex-wrap gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shippedAllSelected}
                      onChange={toggleShippedAll}
                      className="rounded border-gray-300"
                    />
                    전체 선택 ({shippedAllIds.length}건)
                  </label>
                  <button
                    onClick={handleBulkCancel}
                    disabled={cancelling || shippedSelected.size === 0}
                    className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 text-sm whitespace-nowrap"
                  >
                    {cancelling ? '취소 중...' : `선택 취소 (${shippedSelected.size}건)`}
                  </button>
                </div>

                {shippedGroups.map((group) => {
                  const groupIds = group.transactions.map(t => t.shipment_id)
                  const groupAllSel = groupIds.every(id => shippedSelected.has(id))
                  const groupSomeSel = groupIds.some(id => shippedSelected.has(id)) && !groupAllSel
                  return (
                    <div key={group.customerId} className="mb-4 border rounded-lg overflow-hidden">
                      <div className="bg-green-50 px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={groupAllSel}
                            ref={(el) => { if (el) el.indeterminate = groupSomeSel }}
                            onChange={() => toggleShippedCustomer(group)}
                            className="rounded border-gray-300"
                          />
                          <span className="font-medium text-sm">{group.customerName}</span>
                          <span className="text-xs text-gray-500">({group.transactions.length}건)</span>
                        </div>
                        <button
                          onClick={() => copyGroupNotify(group)}
                          className="px-2 py-1 text-xs bg-white border border-green-300 text-green-700 rounded hover:bg-green-50"
                        >
                          {copiedId === `group:${group.customerId}` ? '복사됨!' : '전체 안내 복사'}
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-gray-50">
                              <th className="w-10 py-2 px-2"></th>
                              <th className="text-left py-2 px-2">상품명</th>
                              <th className="text-left py-2 px-1">옵션</th>
                              <th className="text-right py-2 px-2">수량</th>
                              <th className="text-left py-2 px-2">택배사</th>
                              <th className="text-left py-2 px-2">송장번호</th>
                              <th className="text-center py-2 px-1">방식</th>
                              <th className="text-left py-2 px-2">비고</th>
                              <th className="text-right py-2 px-2">발송일</th>
                              <th className="w-16"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.transactions.map((tx) => (
                              <tr key={tx.shipment_id} className={`border-b hover:bg-gray-50 ${shippedSelected.has(tx.shipment_id) ? 'bg-red-50' : ''}`}>
                                <td className="py-2 px-2 text-center">
                                  <input type="checkbox" checked={shippedSelected.has(tx.shipment_id)} onChange={() => toggleShippedOne(tx.shipment_id)} className="rounded border-gray-300" />
                                </td>
                                <td className="py-2 px-2">{getName(tx.products)}</td>
                                <td className="py-2 px-1 text-xs text-gray-500">
                                  {tx.options ? Object.entries(tx.options).map(([k, v]) => `${k}: ${v}`).join(', ') : '-'}
                                </td>
                                <td className="py-2 px-2 text-right">{tx.quantity}</td>
                                <td className="py-2 px-2 text-gray-600">{tx.courier}</td>
                                {renderEditableCell(tx, 'tracking', tx.tracking_number, '송장번호 입력')}
                                <td className="py-2 px-1 text-center">
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${methodBadge(tx.delivery_method)}`}>
                                    {tx.delivery_method || '-'}
                                  </span>
                                </td>
                                {renderEditableCell(tx, 'note', tx.note, '비고 입력')}
                                <td className="py-2 px-2 text-right text-gray-500">{tx.shipped_at}</td>
                                <td className="py-2 px-1 text-center">
                                  <button
                                    onClick={() => copyOneNotify(tx)}
                                    className="text-xs text-green-600 hover:text-green-800 whitespace-nowrap"
                                  >
                                    {copiedId === tx.shipment_id ? '복사됨!' : '안내 복사'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </>
            )
          )}
        </>
      )}
    </div>
  )
}
