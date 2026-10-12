import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/axios'
import ConfirmDialog from '../../components/ConfirmDialog'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import ErrorMessage from '../../components/ErrorMessage'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import useFetch from '../../hooks/useFetch'
import { formatRupiah, formatTanggalIndonesia } from '../../utils/dashboard'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function formatOrderDate(value) {
  return value ? formatTanggalIndonesia(value.slice(0, 10)) : '—'
}

export default function AdminOrderDetailPage() {
  const { id } = useParams()
  const { data, loading, error, refetch } = useFetch(`/api/orders/${id}`)
  const [confirmation, setConfirmation] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const order = data?.order

  const confirmPaymentAction = async () => {
    if (!order?.payment?.id || !confirmation) return
    setBusy(true)
    setActionError('')
    try {
      const endpoint = confirmation === 'confirm' ? 'confirm' : 'fail'
      await api.post(`/api/payments/${order.payment.id}/${endpoint}`)
      setConfirmation('')
      refetch()
    } catch (requestError) {
      setActionError(
        requestError.response?.data?.error || 'Gagal memperbarui pembayaran.',
      )
      setConfirmation('')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <LoadingSpinner label="Memuat detail pesanan..." />
      </section>
    )
  }

  if (error) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <ErrorMessage message={error} onRetry={refetch} />
      </section>
    )
  }

  if (!order) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <EmptyState message="Pesanan tidak ditemukan" />
      </div>
    )
  }

  return (
    <section className="space-y-6">
      <header>
        <Link to="/admin/orders" className="text-sm font-medium text-emerald-700 hover:underline">
          ← Kembali ke pesanan
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Pesanan {order.order_number}</h1>
            <p className="mt-1 text-sm text-slate-500">Dibuat {formatOrderDate(order.created_at)}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>
      </header>

      {actionError && <ErrorMessage message={actionError} />}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Item pesanan</h2>
        {order.items?.length ? (
          <DataTable
            rows={order.items}
            getRowKey={(item) => item.id}
            columns={[
              { key: 'product_name_snapshot', label: 'Produk' },
              { key: 'price', label: 'Harga', render: (item) => formatRupiah(item.price) },
              { key: 'quantity', label: 'Jumlah' },
              { key: 'subtotal', label: 'Subtotal', render: (item) => formatRupiah(item.subtotal) },
            ]}
          />
        ) : (
          <EmptyState compact message="Tidak ada item pada pesanan ini" />
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Rincian biaya</h2>
        <dl className="mt-4 space-y-3 text-sm">
          {[
            ['Subtotal', order.subtotal],
            ['Ongkir', order.shipping_cost],
            ['Fee platform', order.platform_fee],
            ['Diskon', order.discount],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 text-slate-600">
              <dt>{label}</dt>
              <dd className="font-medium text-slate-800">{formatRupiah(value)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t border-slate-100 pt-3 font-semibold text-slate-900">
            <dt>Total</dt>
            <dd>{formatRupiah(order.total_amount)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Pembayaran</h2>
        {order.payment ? (
          <>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Metode</dt>
                <dd className="mt-1 font-medium text-slate-800">{order.payment.payment_method || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Referensi</dt>
                <dd className="mt-1 break-all font-medium text-slate-800">{order.payment.payment_reference || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Jumlah</dt>
                <dd className="mt-1 font-medium text-slate-800">{formatRupiah(order.payment.amount)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd className="mt-1"><StatusBadge status={order.payment.status} /></dd>
              </div>
              <div>
                <dt className="text-slate-500">Dibayar pada</dt>
                <dd className="mt-1 font-medium text-slate-800">{formatDate(order.payment.paid_at)}</dd>
              </div>
            </dl>
            {order.payment.status === 'pending' && (
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setActionError('')
                    setConfirmation('confirm')
                  }}
                  className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
                >
                  Konfirmasi pembayaran
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionError('')
                    setConfirmation('fail')
                  }}
                  className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Gagalkan pembayaran
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Belum ada data pembayaran.</p>
        )}
      </section>

      {order.shipment && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Pengiriman</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            {[
              ['Kurir', order.shipment.courier],
              ['Nomor resi', order.shipment.tracking_number],
              ['Metode pengiriman', order.shipment.shipping_method],
              ['Status pengiriman', <StatusBadge status={order.shipment.status} />],
              ['Dikirim pada', formatDate(order.shipment.shipped_at)],
              ['Diterima pada', formatDate(order.shipment.delivered_at)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-500">{label}</dt>
                <dd className="mt-1 font-medium text-slate-800">{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation === 'confirm' ? 'Konfirmasi pembayaran?' : 'Gagalkan pembayaran?'}
        message={
          confirmation === 'confirm'
            ? `Pembayaran untuk pesanan ${order.order_number} akan dikonfirmasi.`
            : `Pembayaran untuk pesanan ${order.order_number} akan digagalkan. Pesanan dibatalkan dan stok dikembalikan.`
        }
        confirmLabel={confirmation === 'confirm' ? 'Konfirmasi pembayaran' : 'Gagalkan pembayaran'}
        busy={busy}
        onCancel={() => setConfirmation('')}
        onConfirm={confirmPaymentAction}
      />
    </section>
  )
}
