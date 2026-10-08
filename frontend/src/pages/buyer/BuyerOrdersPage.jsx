import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/axios'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import ErrorMessage from '../../components/ErrorMessage'
import LoadingSpinner from '../../components/LoadingSpinner'
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

export default function BuyerOrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true

    const loadOrders = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await api.get('/api/orders', {
          params: {
            role: 'buyer',
            page,
            per_page: PAGE_SIZE,
            ...(status ? { status } : {}),
          },
        })
        if (!active) return
        setOrders(response.data.orders ?? [])
        setPagination({
          pages: response.data.pages ?? 1,
          total: response.data.total ?? 0,
        })
      } catch (requestError) {
        if (active) {
          setError(requestError.response?.data?.error || 'Gagal memuat pesanan.')
          setOrders([])
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadOrders()
    return () => {
      active = false
    }
  }, [status, page, refreshKey])

  const changeStatus = (event) => {
    setStatus(event.target.value)
    setPage(1)
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Pesanan</h1>
        <p className="mt-1 text-sm text-slate-500">Lihat status dan rincian pesanan Anda.</p>
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
              <option key={orderStatus} value={orderStatus}>{labelStatus(orderStatus)}</option>
            ))}
          </select>
        </label>
        {!loading && !error && (
          <span className="text-sm text-slate-500">{pagination.total} pesanan</span>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoadingSpinner label="Memuat pesanan..." />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <ErrorMessage message={error} onRetry={() => setRefreshKey((current) => current + 1)} />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <EmptyState
            message={status ? 'Tidak ada pesanan dengan status ini' : 'Belum ada pesanan'}
            description="Pesanan yang dibuat akan tampil di sini."
          />
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <DataTable
              rows={orders}
              getRowKey={(order) => order.id}
              onRowClick={(order) => navigate(`/buyer/orders/${order.id}`)}
              columns={[
                {
                  key: 'order_number',
                  label: 'Nomor pesanan',
                  render: (order) => (
                    <Link
                      to={`/buyer/orders/${order.id}`}
                      className="font-medium text-emerald-700 hover:text-emerald-900 hover:underline"
                    >
                      {order.order_number}
                    </Link>
                  ),
                },
                { key: 'created_at', label: 'Tanggal', render: (order) => formatOrderDate(order.created_at) },
                { key: 'total_amount', label: 'Total', render: (order) => formatRupiah(order.total_amount) },
                {
                  key: 'status',
                  label: 'Status',
                  render: (order) => (
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {labelStatus(order.status)}
                    </span>
                  ),
                },
                {
                  key: 'detail',
                  label: '',
                  render: (order) => (
                    <Link
                      to={`/buyer/orders/${order.id}`}
                      aria-label={`Lihat pesanan ${order.order_number}`}
                      className="text-sm font-medium text-emerald-700 hover:underline"
                    >
                      Detail
                    </Link>
                  ),
                },
              ]}
            />
          </div>
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Sebelumnya
              </button>
              <span className="text-sm text-slate-600">Halaman {page} dari {pagination.pages}</span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))}
                disabled={page >= pagination.pages}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Selanjutnya
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
