// AI 주문 메시지 파싱 — JSON 추출/검증 로직
// (Anthropic 호출은 route handler에서 직접 수행, 이 파일은 응답 처리만 담당)

export type ParsedOrderItem = {
  product_id: string | null
  product_name: string
  original_text?: string
  options: Record<string, string> | null
  quantity: number
  unit_price: number | null
}

export type ParseOrderResult =
  | { ok: true; items: ParsedOrderItem[] }
  | { ok: false; error: string; raw?: string }

/**
 * AI 응답(content 배열)에서 JSON 배열을 추출해 파싱
 *
 * - content가 비어있으면 에러
 * - text 부분에 [ ... ] JSON 배열이 없으면 에러
 * - JSON.parse 실패도 에러
 * - 성공하면 items 배열 반환
 */
export function parseAiOrderResponse(
  content: Array<{ type: string; text?: string }> | null | undefined
): ParseOrderResult {
  if (!content || content.length === 0) {
    return { ok: false, error: 'AI가 빈 응답을 반환했습니다.' }
  }

  const first = content[0]
  const text = first && first.type === 'text' && typeof first.text === 'string' ? first.text : ''

  if (!text) {
    return { ok: false, error: 'AI가 빈 응답을 반환했습니다.' }
  }

  // JSON 배열만 추출
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    return { ok: false, error: 'AI 응답을 파싱할 수 없습니다.', raw: text }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed)) {
      return { ok: false, error: 'AI 응답이 배열이 아닙니다.', raw: text }
    }
    return { ok: true, items: parsed as ParsedOrderItem[] }
  } catch {
    return { ok: false, error: 'AI 응답 JSON 파싱 실패', raw: text }
  }
}
