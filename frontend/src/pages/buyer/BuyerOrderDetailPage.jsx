import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/axios'
import EmptyState from '../../components/EmptyState'
import ErrorMessage from '../../components/ErrorMessage'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatRupiah, formatTanggalIndonesia, labelStatus } from '../../utils/dashboard'

const TIMELINE = [
  'pending_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'completed',
]

const BUYER_ACTIONS = {
  pending_payment: {
    endpoint: 'cancel',
    label: 'Batalkan pesanan',
    confirmation: 'Yakin ingin membatalkan pesanan ini?',
  },
  shipped: {
    endpoint: 'receive',
    label: 'Terima barang',
    confirmation: 'Konfirmasi bahwa barang sudah Anda terima?',
  },
  delivered: {
    endpoint: 'complete',
    label: 'Selesaikan pesanan',
    confirmation: 'Yakin ingin menyelesaikan pesanan ini?',
  },
}

function orderDate(value) {
  return value ? formatTanggalIndonesia(value.slice(0, 10)) : '—'
}

function paymentStatusLabel(status) {
  const labels = {
    pending: 'Menunggu konfirmasi admin',
    paid: 'Dibayar',
    failed: 'Gagal',
    expired: 'Kedaluwarsa',
    refunded: 'Dikembalikan',
  }
  return labels[status] || labelStatus(status)
}

function shipmentStatusLabel(status) {
  const labels = {
    waiting: 'Menunggu pengiriman',
    picked_up: 'Telah diambil kurir',
    in_transit: 'Dalam perjalanan',
    delivered: 'Terkirim',
    failed: 'Pengiriman gagal',
  }
  return labels[status] || labelStatus(status)
}

export default function BuyerOrderDetailPage() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadOrder = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get(`/api/orders/${id}`)
      setOrder(response.data.order ?? null)
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Gagal memuat detail pesanan.')
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadOrder()
  }, [loadOrder, refreshKey])

  const handleAction = async () => {
    const action = BUYER_ACTIONS[order?.status]
    if (!action || !window.confirm(action.confirmation)) return

    setBusy(true)
    setActionError('')
    try {
      await api.post(`/api/orders/${id}/${action.endpoint}`)
      await loadOrder()
    } catch (requestError) {
      setActionError(requestError.response?.data?.error || 'Aksi pesanan gagal.')
    } finally {
      setBusy(false)
    }
  }

  const timelineIndex = order ? TIMELINE.indexOf(order.status) : -1
  const timelineStatuses = order?.status === 'cancelled'
    ? ['pending_payment', 'cancelled']
    : TIMELINE
  const currentTimelineIndex = order?.status === 'cancelled' ? 1 : timelineIndex

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/buyer/orders" className="text-sm font-medium text-emerald-700 hover:underline">
            ← Kembali ke pesanan
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Detail pesanan</h1>
        </div>
        {order && BUYER_ACTIONS[order.status] && (
          <button
            type="button"
            onClick={handleAction}
            disabled={busy}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
              order.status === 'pending_payment'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-emerald-700 hover:bg-emerald-800'
            }`}
          >
            {busy ? 'Memproses...' : BUYER_ACTIONS[order.status].label}
          </button>
        )}
      </header>

      {actionError && <ErrorMessage message={actionError} />}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoadingSpinner label="Memuat detail pesanan..." />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <ErrorMessage message={error} onRetry={() => setRefreshKey((current) => current + 1)} />
        </div>
      ) : !order ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <EmptyState message="Pesanan tidak tersedia" />
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Nomor pesanan</p>
                <p className="text-lg font-semibold text-slate-900">{order.order_number}</p>
                <p className="mt-1 text-sm text-slate-500">Dibuat {orderDate(order.created_at)}</p>
              </div>
              <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800">
                {labelStatus(order.status)}
              </span>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">Status pesanan</h2>
            <ol className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {timelineStatuses.map((status, index) => {
                const isCurrent = index === currentTimelineIndex
                const isPast = currentTimelineIndex >= 0 && index < currentTimelineIndex
                return (
                  <li key={status} className="flex items-center gap-2 text-sm">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        isCurrent || isPast
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isPast ? '✓' : index + 1}
                    </span>
                    <span className={isCurrent ? 'font-semibold text-emerald-800' : 'text-slate-600'}>
                      {labelStatus(status)}
                    </span>
                  </li>
                )
              })}
            </ol>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">Item pesanan</h2>
            {order.items?.length ? (
              <div className="mt-3 divide-y divide-slate-100">
                {order.items.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium text-slate-800">{item.product_name_snapshot}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatRupiah(item.price)} × {item.quantity}
                      </p>
                    </div>
                    <p className="font-semibold text-slate-900">{formatRupiah(item.subtotal)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="Detail item tidak tersedia" compact />
            )}
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900">Rincian biaya</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-slate-600">Subtotal</dt><dd>{formatRupiah(order.subtotal)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-600">Biaya pengiriman</dt><dd>{formatRupiah(order.shipping_cost)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-600">Biaya platform</dt><dd>{formatRupiah(order.platform_fee)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-600">Diskon</dt><dd>−{formatRupiah(order.discount)}</dd></div>
                <div className="flex justify-between gap-3 border-t border-slate-200 pt-3 text-base font-semibold">
                  <dt>Total</dt><dd className="text-emerald-700">{formatRupiah(order.total_amount)}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900">Alamat pengiriman</h2>
              {order.address ? (
                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  <p className="font-medium text-slate-800">{order.address.label} · {order.address.recipient_name}</p>
                  <p>{order.address.phone}</p>
                  <p>{order.address.address}, {order.address.city}, {order.address.province} {order.address.postal_code}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Informasi alamat tidak disertakan oleh API.</p>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900">Pembayaran</h2>
              {order.payment ? (
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-slate-600">Metode</dt><dd>{order.payment.payment_method}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-600">Status</dt><dd>{paymentStatusLabel(order.payment.status)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-600">Referensi</dt><dd className="break-all text-right">{order.payment.payment_reference}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-600">Jumlah</dt><dd>{formatRupiah(order.payment.amount)}</dd></div>
                </dl>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Informasi pembayaran belum tersedia.</p>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900">Pengiriman</h2>
              {order.shipment ? (
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-slate-600">Kurir</dt><dd>{order.shipment.courier}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-600">Nomor resi</dt><dd>{order.shipment.tracking_number}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-600">Metode</dt><dd>{order.shipment.shipping_method}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-600">Status</dt><dd>{shipmentStatusLabel(order.shipment.status)}</dd></div>
                </dl>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Informasi pengiriman belum tersedia.</p>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  )
}
