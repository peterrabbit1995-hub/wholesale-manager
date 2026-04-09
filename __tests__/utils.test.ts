import { describe, it, expect } from 'vitest'
import {
  formatPrice,
  rawPrice,
  displayPrice,
  formatPhone,
  paramToString,
  getName,
  TIER_LEVEL,
} from '@/lib/utils'

describe('formatPrice - 쉼표 포맷 적용', () => {
  it('숫자 문자열에 쉼표를 붙인다', () => {
    expect(formatPrice('1234567')).toBe('1,234,567')
  })

  it('쉼표가 이미 있어도 정상 처리한다', () => {
    expect(formatPrice('1,234,567')).toBe('1,234,567')
  })

  it('0은 그대로 0으로 반환한다', () => {
    expect(formatPrice('0')).toBe('0')
  })

  it('빈 문자열은 빈 문자열을 반환한다', () => {
    expect(formatPrice('')).toBe('')
  })

  it('숫자가 아닌 문자는 제거한다', () => {
    expect(formatPrice('1a2b3c')).toBe('123')
  })
})

describe('rawPrice - 쉼표 제거', () => {
  it('쉼표가 있는 가격 문자열에서 쉼표를 제거한다', () => {
    expect(rawPrice('1,234,567')).toBe('1234567')
  })

  it('쉼표 없는 숫자도 정상 처리한다', () => {
    expect(rawPrice('1234567')).toBe('1234567')
  })

  it('빈 문자열은 빈 문자열을 반환한다', () => {
    expect(rawPrice('')).toBe('')
  })
})

describe('displayPrice - 숫자를 가격 문자열로', () => {
  it('숫자를 쉼표 포맷으로 변환한다', () => {
    expect(displayPrice(1234567)).toBe('1,234,567')
  })

  it('null이면 "-"를 반환한다', () => {
    expect(displayPrice(null)).toBe('-')
  })

  it('0은 "0"으로 반환한다', () => {
    expect(displayPrice(0)).toBe('0')
  })
})

describe('formatPhone - 전화번호 포맷', () => {
  it('휴대폰 번호를 010-1234-5678 형식으로', () => {
    expect(formatPhone('01012345678')).toBe('010-1234-5678')
  })

  it('서울 지역번호(02)는 02-1234-5678 형식으로', () => {
    expect(formatPhone('0212345678')).toBe('02-1234-5678')
  })

  it('숫자가 아닌 문자는 제거한다', () => {
    expect(formatPhone('010-abcd-5678')).toBe('010-5678')
  })

  it('짧은 번호도 처리한다', () => {
    expect(formatPhone('010')).toBe('010')
  })
})

describe('paramToString - useParams id 배열 방어', () => {
  it('문자열은 그대로 반환한다', () => {
    expect(paramToString('abc')).toBe('abc')
  })

  it('배열이면 첫 번째 요소를 반환한다', () => {
    expect(paramToString(['abc', 'def'])).toBe('abc')
  })
})

describe('getName - Supabase join 결과에서 이름 추출', () => {
  it('단일 객체에서 name을 추출한다', () => {
    expect(getName({ name: '홍길동' })).toBe('홍길동')
  })

  it('배열이면 첫 번째 객체의 name을 추출한다', () => {
    expect(getName([{ name: '홍길동' }, { name: '김철수' }])).toBe('홍길동')
  })

  it('null이면 "-"를 반환한다', () => {
    expect(getName(null)).toBe('-')
  })

  it('빈 배열이면 "-"를 반환한다', () => {
    expect(getName([])).toBe('-')
  })
})

describe('TIER_LEVEL 상수', () => {
  it('COST는 0', () => {
    expect(TIER_LEVEL.COST).toBe(0)
  })

  it('CONSUMER는 1', () => {
    expect(TIER_LEVEL.CONSUMER).toBe(1)
  })
})
