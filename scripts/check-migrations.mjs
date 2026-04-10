// 마이그레이션 3개(20260411/12/13) 적용 여부 확인
// 실행: node scripts/check-migrations.mjs
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function q(path) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  return { status: res.status, body: await res.text() };
}

const checks = [];

// 1. is_active 컬럼 존재 여부 (20260411)
for (const t of ['customers', 'products', 'invoices', 'payments', 'price_tiers']) {
  const r = await q(`${t}?select=is_active&limit=0`);
  checks.push({
    migration: '20260411',
    check: `${t}.is_active 컬럼`,
    ok: r.status === 200,
    detail: r.status === 200 ? 'OK' : r.body.slice(0, 120),
  });
}

// 2. user_roles 테이블 존재 여부 (20260413)
const r2 = await q('user_roles?select=user_id&limit=0');
checks.push({
  migration: '20260413',
  check: 'user_roles 테이블',
  // 200 = 존재 + 빈결과, 401 = RLS차단(존재), 404 = 없음
  ok: r2.status === 200 || r2.status === 401,
  detail: `HTTP ${r2.status}: ${r2.body.slice(0, 120)}`,
});

// 3. is_admin 함수 존재 여부 (20260413)
const r3 = await fetch(`${URL}/rest/v1/rpc/is_admin`, {
  method: 'POST',
  headers: {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ uid: '00000000-0000-0000-0000-000000000000' }),
});
const r3body = await r3.text();
checks.push({
  migration: '20260413',
  check: 'is_admin() 함수',
  ok: r3.status === 200,
  detail: `HTTP ${r3.status}: ${r3body.slice(0, 120)}`,
});

// 4. RLS 확인 (20260412): anon키로 customers 조회 → 빈배열이면 RLS 켜짐
//    (RLS 꺼져있으면 anon도 데이터를 보게 됨)
const r4 = await q('customers?select=id&limit=1');
let rlsNote;
if (r4.status !== 200) {
  rlsNote = `HTTP ${r4.status}: ${r4.body.slice(0, 120)}`;
} else {
  const rows = JSON.parse(r4.body);
  rlsNote = rows.length === 0
    ? '빈 배열 반환 (RLS 켜져서 anon 차단됨 — 정상)'
    : `⚠️ anon이 ${rows.length}행 조회됨 (RLS 꺼져있거나 anon 허용 정책 있음)`;
}
checks.push({
  migration: '20260412',
  check: 'customers RLS 활성화',
  ok: r4.status === 200 && JSON.parse(r4.body || '[]').length === 0,
  detail: rlsNote,
});

console.log('\n=== 마이그레이션 적용 확인 ===\n');
for (const c of checks) {
  const mark = c.ok ? '✅' : '❌';
  console.log(`${mark} [${c.migration}] ${c.check}`);
  console.log(`   ${c.detail}`);
}
const failed = checks.filter(c => !c.ok).length;
console.log(`\n결과: ${checks.length - failed}/${checks.length} 통과`);
