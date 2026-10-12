import { useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import ErrorMessage from '../../components/ErrorMessage'
import LoadingSpinner from '../../components/LoadingSpinner'
import Pagination from '../../components/Pagination'
import StatusBadge from '../../components/StatusBadge'
import useFetch from '../../hooks/useFetch'
import { formatRupiah, formatTanggalIndonesia, labelStatus } from '../../utils/dashboard'

const PAGE_SIZE = 10
const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
]

function formatDate(value) {
  return value ? formatTanggalIndonesia(value.slice(0, 10)) : '—'
}

export default function AdminOrdersPage() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const params = {
    role: 'admin',
    page,
    per_page: PAGE_SIZE,
    ...(status ? { status } : {}),
  }
  const { data, loading, error, refetch } = useFetch('/api/orders', { params })
  const orders = data?.orders ?? []

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Pesanan</h1>
        <p className="mt-1 text-sm text-slate-500">Lihat semua pesanan marketplace.</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-medium text-slate-700">
          Filter status
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
            className="ml-3 rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">Semua status</option>
            {ORDER_STATUSES.map((item) => (
              <option key={item} value={item}>{labelStatus(item)}</option>
            ))}
          </select>
        </label>
        {!loading && !error && (
          <span className="text-sm text-slate-500">{data?.total ?? 0} pesanan</span>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoadingSpinner label="Memuat pesanan..." />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <ErrorMessage message={error} onRetry={refetch} />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <EmptyState
            message={status ? 'Tidak ada pesanan dengan status ini' : 'Belum ada pesanan'}
            description="Pesanan akan tampil di sini setelah dibuat."
          />
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <DataTable
              rows={orders}
              getRowKey={(item) => item.id}
              columns={[
                { key: 'order_number', label: 'Nomor pesanan' },
                { key: 'buyer_id', label: 'Pembeli (ID)' },
                { key: 'total_amount', label: 'Total', render: (item) => formatRupiah(item.total_amount) },
                { key: 'status', label: 'Status', render: (item) => <StatusBadge status={item.status} /> },
                { key: 'created_at', label: 'Tanggal', render: (item) => formatDate(item.created_at) },
                {
                  key: 'detail',
                  label: '',
                  render: (item) => (
                    <Link
                      to={`/admin/orders/${item.id}`}
                      className="font-medium text-emerald-700 hover:underline"
                    >
                      Lihat detail
                    </Link>
                  ),
                },
              ]}
            />
          </div>
          <Pagination
            page={page}
            pages={data?.pages ?? 1}
            total={data?.total ?? 0}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  )
}
