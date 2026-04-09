'use client'

import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type Role = 'admin' | 'staff' | null

/**
 * 현재 로그인한 사용자의 역할(role)을 가져오는 훅.
 *
 * 반환값:
 *   - role: 'admin' | 'staff' | null
 *     · 'admin'  → 관리자
 *     · 'staff'  → 직원
 *     · null     → 비로그인 또는 user_roles에 행이 없음 (권한 없음)
 *   - loading: 초기 로딩 중 여부 (true이면 아직 모름, false이면 결정됨)
 *
 * 사용 예:
 *   const { role, loading } = useRole()
 *   if (loading) return <로딩스피너 />
 *   if (role !== 'admin') return <권한없음 />
 */
export function useRole() {
  const [role, setRole] = useState<Role>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (mounted) {
          setRole(null)
          setLoading(false)
        }
        return
      }

      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      if (mounted) {
        setRole((data?.role as Role) ?? null)
        setLoading(false)
      }
    }

    load()

    // 로그인/로그아웃 등 인증 상태가 바뀌면 다시 조회
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      load()
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return { role, loading }
}
