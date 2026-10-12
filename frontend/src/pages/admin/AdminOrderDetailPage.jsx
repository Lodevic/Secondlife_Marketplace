import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/axios'
import ConfirmDialog from '../../components/ConfirmDialog'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import ErrorMessage from '../../components/ErrorMessage'
import ExportMenu from '../../components/ExportMenu'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import '../../styles/print.css'
import useFetch from '../../hooks/useFetch'
import { exportWord, escapeHtml, printDocument } from '../../utils/exportUtils'
import { formatRupiah, formatTanggalIndonesia, labelStatus } from '../../utils/dashboard'

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

function documentTimestamp() {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date())
}

function htmlValue(value) {
  return escapeHtml(value === null || value === undefined || value === '' ? '-' : value)
}

function buildOrderWordBody(order, createdAt) {
  const items = order.items ?? []
  const payment = order.payment
  const shipment = order.shipment
  const address =
    typeof order.address === 'string' && order.address.trim()
      ? `<h2>Alamat</h2><p>${htmlValue(order.address)}</p>`
      : ''
  const itemRows = items
    .map(
      (item) =>
        `<tr><td>${htmlValue(item.product_name_snapshot)}</td><td>${htmlValue(formatRupiah(item.price))}</td><td>${htmlValue(item.quantity)}</td><td>${htmlValue(formatRupiah(item.subtotal))}</td></tr>`,
    )
    .join('')
  const paymentRows = payment
    ? `<table><tbody>
      <tr><th>Metode</th><td>${htmlValue(payment.payment_method)}</td></tr>
      <tr><th>Referensi</th><td>${htmlValue(payment.payment_reference)}</td></tr>
      <tr><th>Status</th><td>${htmlValue(labelStatus(payment.status))}</td></tr>
      <tr><th>Waktu bayar</th><td>${htmlValue(formatDate(payment.paid_at))}</td></tr>
    </tbody></table>`
    : '<p>-</p>'
  const shipmentRows = shipment
    ? `<table><tbody>
      <tr><th>Kurir</th><td>${htmlValue(shipment.courier)}</td></tr>
      <tr><th>Resi</th><td>${htmlValue(shipment.tracking_number)}</td></tr>
      <tr><th>Status</th><td>${htmlValue(labelStatus(shipment.status))}</td></tr>
    </tbody></table>`
    : ''
  const costs = [
    ['Subtotal', order.subtotal],
    ['Ongkir', order.shipping_cost],
    ['Fee platform', order.platform_fee],
    ['Diskon', order.discount],
    ['Total', order.total_amount],
  ]
    .map(([label, value]) => `<tr><th>${label}</th><td>${htmlValue(formatRupiah(value))}</td></tr>`)
    .join('')

  return `<h1>Detail Pesanan</h1>
    <table><tbody>
      <tr><th>Nomor pesanan</th><td>${htmlValue(order.order_number)}</td></tr>
      <tr><th>Tanggal</th><td>${htmlValue(formatDate(order.created_at))}</td></tr>
      <tr><th>Status</th><td>${htmlValue(labelStatus(order.status))}</td></tr>
      <tr><th>ID pembeli</th><td>${htmlValue(order.buyer_id)}</td></tr>
    </tbody></table>
    ${address}
    <h2>Item</h2>
    <table><thead><tr><th>Nama produk</th><th>Harga</th><th>Qty</th><th>Subtotal</th></tr></thead><tbody>${itemRows}</tbody></table>
    <h2>Rincian biaya</h2>
    <table><tbody>${costs}</tbody></table>
    <h2>Pembayaran</h2>${paymentRows}
    ${shipment ? `<h2>Pengiriman</h2>${shipmentRows}` : ''}
    <p>Dokumen dibuat: ${htmlValue(createdAt)}</p>`
}

export default function AdminOrderDetailPage() {
  const { id } = useParams()
  const { data, loading, error, refetch } = useFetch(`/api/orders/${id}`)
  const [confirmation, setConfirmation] = useState('')
  const [actionError, setActionError] = useState('')
  const [exportError, setExportError] = useState('')
  const [createdAt, setCreatedAt] = useState(documentTimestamp)
  const [busy, setBusy] = useState(false)
  const order = data?.order

  const exportPdf = async () => {
    setExportError('')
    setCreatedAt(documentTimestamp())
    try {
      await printDocument()
    } catch (exportException) {
      setExportError(exportException.message || 'Gagal membuka dialog cetak.')
    }
  }

  const exportDoc = () => {
    setExportError('')
    const generatedAt = documentTimestamp()
    setCreatedAt(generatedAt)
    try {
      exportWord(
        `pesanan-${order.order_number}.doc`,
        'Detail Pesanan',
        buildOrderWordBody(order, generatedAt),
      )
    } catch (exportException) {
      setExportError(exportException.message || 'Gagal mengekspor detail pesanan.')
    }
  }

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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link to="/admin/orders" className="text-sm font-medium text-emerald-700 hover:underline print:hidden">
              ← Kembali ke pesanan
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Pesanan {order.order_number}</h1>
                <p className="mt-1 text-sm text-slate-500">Dibuat {formatOrderDate(order.created_at)}</p>
              </div>
              <StatusBadge status={order.status} />
            </div>
          </div>
          <ExportMenu
            onPdf={exportPdf}
            onWord={exportDoc}
            disabled={loading || Boolean(error) || !order}
          />
        </div>
      </header>

      {actionError && <ErrorMessage message={actionError} />}
      {exportError && <ErrorMessage message={exportError} />}

      <div className="print-document hidden">
        <h1>Detail Pesanan</h1>
        <p>Nomor pesanan: {order.order_number}</p>
        <p>Tanggal: {formatDate(order.created_at)}</p>
        <p>Status: {labelStatus(order.status)}</p>
        <p>ID pembeli: {order.buyer_id}</p>
        {typeof order.address === 'string' && order.address.trim() && (
          <p>Alamat: {order.address}</p>
        )}
        <h2>Item</h2>
        {order.items?.length ? (
          <DataTable
            rows={order.items}
            getRowKey={(item) => item.id}
            columns={[
              { key: 'product_name_snapshot', label: 'Nama produk' },
              { key: 'price', label: 'Harga', render: (item) => formatRupiah(item.price) },
              { key: 'quantity', label: 'Qty' },
              { key: 'subtotal', label: 'Subtotal', render: (item) => formatRupiah(item.subtotal) },
            ]}
          />
        ) : (
          <p>-</p>
        )}
        <h2>Rincian biaya</h2>
        <dl>
          {[
            ['Subtotal', order.subtotal],
            ['Ongkir', order.shipping_cost],
            ['Fee platform', order.platform_fee],
            ['Diskon', order.discount],
            ['Total', order.total_amount],
          ].map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{formatRupiah(value)}</dd></div>
          ))}
        </dl>
        <h2>Pembayaran</h2>
        {order.payment ? (
          <dl>
            <div><dt>Metode</dt><dd>{order.payment.payment_method || '—'}</dd></div>
            <div><dt>Referensi</dt><dd>{order.payment.payment_reference || '—'}</dd></div>
            <div><dt>Status</dt><dd>{labelStatus(order.payment.status)}</dd></div>
            <div><dt>Waktu bayar</dt><dd>{formatDate(order.payment.paid_at)}</dd></div>
          </dl>
        ) : <p>-</p>}
        {order.shipment && (
          <>
            <h2>Pengiriman</h2>
            <dl>
              <div><dt>Kurir</dt><dd>{order.shipment.courier || '—'}</dd></div>
              <div><dt>Resi</dt><dd>{order.shipment.tracking_number || '—'}</dd></div>
              <div><dt>Status</dt><dd>{labelStatus(order.shipment.status)}</dd></div>
            </dl>
          </>
        )}
        <p>Dokumen dibuat: {createdAt}</p>
      </div>

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
