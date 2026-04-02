import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="max-w-lg mx-auto mt-10 p-6">
      <h1 className="text-2xl font-bold mb-6">도매상 관리 시스템</h1>
      <div className="space-y-3">
        <Link
          href="/transactions"
          className="block p-4 bg-white rounded-lg shadow-md hover:bg-gray-50"
        >
          📋 거래 관리
        </Link>
        <Link
          href="/customers"
          className="block p-4 bg-white rounded-lg shadow-md hover:bg-gray-50"
        >
          👥 거래처 관리
        </Link>
        <Link
          href="/products"
          className="block p-4 bg-white rounded-lg shadow-md hover:bg-gray-50"
        >
          📦 상품 관리
        </Link>
        <Link
          href="/settings/company"
          className="block p-4 bg-white rounded-lg shadow-md hover:bg-gray-50"
        >
          ⚙️ 회사 정보 설정
        </Link>
      </div>
    </div>
  )
}
