'use client'

import Link from 'next/link'
import { useRole } from '@/lib/useRole'

/**
 * 관리자 전용 페이지를 감싸는 가드 컴포넌트.
 *
 * 동작:
 *   - 역할 조회 중 → 로딩 스피너
 *   - admin     → children 그대로 렌더
 *   - 그 외(staff, null) → "권한 없음" 안내 + 발송 페이지로 이동 버튼
 *
 * 사용 예:
 *   export default function CustomersPage() {
 *     return (
 *       <AdminGuard>
 *         <CustomersPageContent />
 *       </AdminGuard>
 *     )
 *   }
 */
export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { role, loading } = useRole()

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-6 text-center text-gray-400 text-sm">
        로딩 중...
      </div>
    )
  }

  if (role !== 'admin') {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-lg shadow-md text-center">
        <div className="text-5xl mb-3">🔒</div>
        <h1 className="text-xl font-bold mb-2">권한이 없습니다</h1>
        <p className="text-sm text-gray-500 mb-5">
          이 페이지는 관리자만 접근할 수 있어요.
        </p>
        <Link
          href="/shipments"
          className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
        >
          발송 페이지로 이동
        </Link>
      </div>
    )
  }

  return <>{children}</>
}
