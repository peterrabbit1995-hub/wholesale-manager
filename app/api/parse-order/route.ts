import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'

function createSupabaseServer(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}

export async function POST(request: Request) {
  const { message, customerId } = await request.json()

  if (!message || !customerId) {
    return Response.json({ error: '메시지와 거래처를 입력해주세요.' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
  }

  const cookieStore = await cookies()
  const supabase = createSupabaseServer(cookieStore)

  // 상품 목록 조회
  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .order('name')

  if (!products || products.length === 0) {
    return Response.json({ error: '등록된 상품이 없습니다.' }, { status: 400 })
  }

  // 상품 옵션 조회
  const { data: productOptions } = await supabase
    .from('product_options')
    .select('product_id, option_name, option_values')

  // 거래처 가격 정보 조회 (특별단가 + 등급단가)
  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, default_tier_id')
    .eq('id', customerId)
    .single()

  const productListText = products.map(p => {
    const opts = productOptions?.filter(o => o.product_id === p.id) || []
    const optText = opts.map(o => `  - ${o.option_name}: ${o.option_values}`).join('\n')
    return `- ${p.name} (ID: ${p.id})${optText ? '\n' + optText : ''}`
  }).join('\n')

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const systemPrompt = `당신은 도매 거래 주문 메시지를 분석하는 AI입니다.
카카오톡 등으로 받은 주문 메시지에서 상품명, 수량, 옵션, 단가 정보를 추출해주세요.

## 등록된 상품 목록
${productListText}

## 규칙
1. 메시지에서 언급된 상품을 위 상품 목록에서 찾아 매칭해주세요.
2. 약어나 줄임말도 최대한 매칭해주세요 (예: "까무이클리어" → "까무이 클리어", "통상대" → 해당 상품).
3. 수량이 음수거나 "반품"이 언급되면 quantity를 음수로 표시해주세요.
4. 단가가 언급되면 숫자로 변환해주세요 (예: "3.9만원" → 39000).
5. 옵션이 있는 상품의 경우 옵션 정보도 추출해주세요.
6. 매칭할 수 없는 상품은 product_id를 null로, product_name에 원문 그대로 넣어주세요.

## 응답 형식
반드시 아래 JSON 배열 형식으로만 응답해주세요. 다른 텍스트 없이 JSON만 출력하세요.
[
  {
    "product_id": "매칭된 상품 UUID 또는 null",
    "product_name": "상품명",
    "options": { "옵션명": "옵션값" } 또는 null,
    "quantity": 숫자(반품은 음수),
    "unit_price": 단가숫자 또는 null
  }
]`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // JSON 파싱 시도
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return Response.json({ error: 'AI 응답을 파싱할 수 없습니다.', raw: text }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    return Response.json({ items: parsed, customerName: customer?.name })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류'
    return Response.json({ error: 'AI 호출 실패: ' + message }, { status: 500 })
  }
}
