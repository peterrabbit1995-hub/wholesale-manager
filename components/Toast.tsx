'use client'

import { useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export type ToastItem = {
  id: string
  message: string
  type: ToastType
}

const bgColors: Record<ToastType, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-blue-600',
}

export default function Toast({
  toast,
  onRemove,
}: {
  toast: ToastItem
  onRemove: (id: string) => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 3000)
    return () => clearTimeout(timer)
  }, [toast.id, onRemove])

  return (
    <div
      className={`${bgColors[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm animate-fade-in`}
    >
      {toast.message}
    </div>
  )
}
