import { describe, it, expect } from 'vitest'
import { parseAiOrderResponse } from '@/lib/parseOrder'

describe('parseAiOrderResponse - AI 주문 응답 파싱', () => {
  it('정상 JSON 배열 응답을 파싱한다', () => {
    const content = [
      {
        type: 'text',
        text: `[
          {
            "product_id": "abc-123",
            "product_name": "까무이 클리어",
            "original_text": "까무이클리어 m 5개",
            "options": { "사이즈": "M" },
            "quantity": 5,
            "unit_price": 39000
          }
        ]`,
      },
    ]

    const result = parseAiOrderResponse(content)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.items).toHaveLength(1)
      expect(result.items[0].product_name).toBe('까무이 클리어')
      expect(result.items[0].quantity).toBe(5)
      expect(result.items[0].original_text).toBe('까무이클리어 m 5개')
      expect(result.items[0].options).toEqual({ 사이즈: 'M' })
    }
  })

  it('original_text 필드가 포함되어 있는지 확인', () => {
    const content = [
      {
        type: 'text',
        text: '[{"product_id":"a","product_name":"상품A","original_text":"원문표현","options":null,"quantity":1,"unit_price":1000}]',
      },
    ]
    const result = parseAiOrderResponse(content)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.items[0].original_text).toBe('원문표현')
    }
  })

  it('반품은 quantity가 음수로 파싱된다', () => {
    const content = [
      {
        type: 'text',
        text: '[{"product_id":"a","product_name":"상품A","original_text":"반품 3개","options":null,"quantity":-3,"unit_price":1000}]',
      },
    ]
    const result = parseAiOrderResponse(content)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.items[0].quantity).toBe(-3)
    }
  })

  it('AI 응답이 빈 배열일 때 에러 반환', () => {
    const result = parseAiOrderResponse([])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('빈 응답')
    }
  })

  it('AI 응답이 null일 때 에러 반환', () => {
    const result = parseAiOrderResponse(null)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('빈 응답')
    }
  })

  it('AI 응답 text가 빈 문자열일 때 에러 반환', () => {
    const content = [{ type: 'text', text: '' }]
    const result = parseAiOrderResponse(content)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('빈 응답')
    }
  })

  it('JSON 배열이 없으면 파싱 실패', () => {
    const content = [{ type: 'text', text: '죄송합니다. 파싱할 수 없습니다.' }]
    const result = parseAiOrderResponse(content)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('파싱할 수 없습니다')
      expect(result.raw).toBe('죄송합니다. 파싱할 수 없습니다.')
    }
  })

  it('text 앞뒤에 설명이 있어도 JSON 배열만 추출한다', () => {
    const content = [
      {
        type: 'text',
        text: '다음과 같이 분석했습니다:\n[{"product_id":"a","product_name":"X","options":null,"quantity":1,"unit_price":1000}]\n끝.',
      },
    ]
    const result = parseAiOrderResponse(content)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.items).toHaveLength(1)
    }
  })

  it('망가진 JSON은 파싱 실패', () => {
    const content = [{ type: 'text', text: '[{broken json}]' }]
    const result = parseAiOrderResponse(content)
    expect(result.ok).toBe(false)
  })

  it('text 타입이 아닌 content는 빈 응답으로 처리', () => {
    const content = [{ type: 'image' }]
    const result = parseAiOrderResponse(content)
    expect(result.ok).toBe(false)
  })
})
