'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useRole } from '@/lib/useRole'

// adminOnly: true 이면 관리자에게만 보임. false 이면 직원에게도 보임.
const allMenuItems = [
  { href: '/dashboard', label: '홈', adminOnly: true },
  { href: '/transactions', label: '거래', adminOnly: true },
  { href: '/orders/parse', label: '주문인식', adminOnly: true },
  { href: '/shipments', label: '발송', adminOnly: false },
  { href: '/invoices', label: '명세서', adminOnly: true },
  { href: '/payments', label: '입금', adminOnly: true },
  { href: '/receivables', label: '미수금', adminOnly: true },
  { href: '/customers', label: '거래처', adminOnly: true },
  { href: '/products', label: '상품', adminOnly: true },
  { href: '/aliases', label: '별칭', adminOnly: true },
  { href: '/export', label: '내보내기', adminOnly: true },
  { href: '/settings/company', label: '설정', adminOnly: true },
]

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { role } = useRole()
  const [menuOpen, setMenuOpen] = useState(false)

  // 역할에 따라 메뉴 필터링
  // - admin : 전체
  // - staff : adminOnly=false 만 (= 발송)
  // - null  : 아무것도 안 보임 (로그아웃 버튼만 남음)
  const menuItems = allMenuItems.filter((item) => {
    if (role === 'admin') return true
    if (role === 'staff') return !item.adminOnly
    return false
  })

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
