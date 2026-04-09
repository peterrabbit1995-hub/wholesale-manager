// 가격 등급 레벨 상수
export const TIER_LEVEL = {
  COST: 0,       // 원가
  CONSUMER: 1,   // 소비자가
} as const

// 가격 포맷: "1234567" → "1,234,567"
export const formatPrice = (value: string): string => {
  const nums = value.replace(/[^0-9]/g, '')
  return nums ? Number(nums).toLocaleString() : ''
}

// 가격에서 쉼표 제거: "1,234,567" → "1234567"
export const rawPrice = (value: string): string => value.replace(/,/g, '')

// 숫자를 가격 문자열로: 1234567 → "1,234,567"
export const displayPrice = (v: number | null): string =>
  v != null ? v.toLocaleString() : '-'

// 한국 전화번호 포맷: "01012345678" → "010-1234-5678"
export const formatPhone = (value: string): string => {
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

// useParams()의 id를 안전하게 string으로 변환
export const paramToString = (value: string | string[]): string =>
  Array.isArray(value) ? value[0] : value

// Supabase join 결과에서 이름 추출 (단일 객체 또는 배열)
export const getName = (
  field: { name: string } | { name: string }[] | null
): string => {
  if (!field) return '-'
  if (Array.isArray(field)) return field[0]?.name || '-'
  return field.name
}
