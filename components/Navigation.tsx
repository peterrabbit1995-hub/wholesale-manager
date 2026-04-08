'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const menuItems = [
  { href: '/dashboard', label: '홈' },
  { href: '/transactions', label: '거래' },
  { href: '/orders/parse', label: '주문인식' },
  { href: '/invoices', label: '명세서' },
  { href: '/payments', label: '입금' },
  { href: '/receivables', label: '미수금' },
  { href: '/customers', label: '거래처' },
  { href: '/products', label: '상품' },
  { href: '/aliases', label: '별칭' },
  { href: '/settings/company', label: '설정' },
]

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  // 페이지 이동 시 모바일 메뉴 자동 닫기
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // 로그인 페이지에서는 네비게이션 숨김
  if (pathname === '/login') return null

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex justify-between items-center h-14">
          {/* 로고 / 타이틀 */}
          <Link href="/dashboard" className="font-bold text-lg text-indigo-600">
            도매 관리
          </Link>

          {/* PC 메뉴 */}
          <div className="hidden md:flex items-center gap-1">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive(item.href)
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="ml-2 px-3 py-2 text-sm text-gray-500 hover:text-red-600"
            >
              로그아웃
            </button>
          </div>

          {/* 모바일 햄버거 버튼 */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 text-gray-600"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* 모바일 메뉴 */}
        {menuOpen && (
          <div className="md:hidden pb-3 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-sm font-medium ${
                  isActive(item.href)
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="block w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-red-600"
            >
              로그아웃
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
