-- 임시 저장 테이블: 페이지별로 작업 중인 데이터를 보관
-- 예: 주문 인식에서 AI가 파싱한 결과, 거래 입력에서 입력한 목록
CREATE TABLE IF NOT EXISTS draft_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,           -- 'orders/parse' 또는 'transactions/new'
  customer_id UUID,
  data JSONB NOT NULL DEFAULT '{}', -- 임시 저장할 데이터
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, page_key)         -- 사용자당 페이지당 1개만
);

-- RLS 활성화
ALTER TABLE draft_data ENABLE ROW LEVEL SECURITY;

-- 본인 데이터만 접근 가능
CREATE POLICY "Users can manage own drafts"
  ON draft_data FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
