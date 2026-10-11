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

function formatOrderDate(value) {
  return value ? formatTanggalIndonesia(value.slice(0, 10)) : '—'
}

export default function SellerOrdersPage() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const params = { role: 'seller', page, per_page: PAGE_SIZE, ...(status ? { status } : {}) }
  const { data, loading, error, refetch } = useFetch('/api/orders', { params })
  const orders = data?.orders ?? []

  const changeStatus = (event) => {
    setStatus(event.target.value)
    setPage(1)
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Pesanan</h1>
        <p className="mt-1 text-sm text-slate-500">Lihat pesanan yang melibatkan produk toko Anda.</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-medium text-slate-700">
          Filter status
          <select
            value={status}
            onChange={changeStatus}
            className="ml-3 rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">Semua status</option>
            {ORDER_STATUSES.map((orderStatus) => (
              <option key={orderStatus} value={orderStatus}>
                {labelStatus(orderStatus)}
              </option>
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
            description="Pesanan yang melibatkan produk toko Anda akan tampil di sini."
          />
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <DataTable
              rows={orders}
              getRowKey={(order) => order.id}
              columns={[
                { key: 'order_number', label: 'Nomor pesanan' },
                { key: 'created_at', label: 'Tanggal', render: (order) => formatOrderDate(order.created_at) },
                {
                  key: 'total_amount',
                  label: 'Total',
                  render: (order) => formatRupiah(order.total_amount),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (order) => <StatusBadge status={order.status} />,
                },
                {
                  key: 'items',
                  label: 'Item',
                  render: (order) => order.items?.length ?? 0,
                },
                {
                  key: 'detail',
                  label: '',
                  render: (order) => (
                    <Link
                      to={`/seller/orders/${order.id}`}
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
