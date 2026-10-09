import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/axios'
import ConfirmDialog from '../../components/ConfirmDialog'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import ErrorMessage from '../../components/ErrorMessage'
import FormField from '../../components/FormField'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'
import useFetch from '../../hooks/useFetch'
import { formatRupiah, formatTanggalIndonesia, labelStatus } from '../../utils/dashboard'

const SHIPMENT_STATUSES = ['picked_up', 'in_transit', 'failed']
const SHIPMENT_STATUS_LABELS = {
  picked_up: 'Diambil kurir',
  in_transit: 'Dalam perjalanan',
  failed: 'Gagal',
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatOrderDate(value) {
  return value ? formatTanggalIndonesia(value.slice(0, 10)) : '—'
}

function getRequestError(error, fallback) {
  return error.response?.data?.error || fallback
}

export default function SellerOrderDetailPage() {
  const { id } = useParams()
  const { data, loading, error, refetch } = useFetch(`/api/orders/${id}`)
  const [actionError, setActionError] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [shipForm, setShipForm] = useState({
    courier: '',
    tracking_number: '',
    shipping_method: '',
  })
  const [shipmentStatus, setShipmentStatus] = useState(SHIPMENT_STATUSES[0])
  const [shipFormError, setShipFormError] = useState('')
  const order = data?.order

  const updateShipField = (event) => {
    const { name, value } = event.target
    setShipForm((current) => ({ ...current, [name]: value }))
    setShipFormError('')
  }

  const openShipConfirmation = (event) => {
    event.preventDefault()
    if (Object.values(shipForm).some((value) => !value.trim())) {
      setShipFormError('Courier, nomor resi, dan metode pengiriman wajib diisi.')
      return
    }
    setShipFormError('')
    setActionError('')
    setConfirmation('ship')
  }

  const confirmAction = async () => {
    if (!order) return
    setBusy(true)
    setActionError('')
    try {
      if (confirmation === 'process') {
        await api.post(`/api/orders/${order.id}/process`)
      } else if (confirmation === 'ship') {
        await api.post(`/api/orders/${order.id}/ship`, {
          courier: shipForm.courier.trim(),
          tracking_number: shipForm.tracking_number.trim(),
          shipping_method: shipForm.shipping_method.trim(),
        })
      } else if (confirmation === 'shipment') {
        await api.patch(`/api/orders/${order.id}/shipment`, { status: shipmentStatus })
      }
      setConfirmation('')
      setShipFormError('')
      refetch()
    } catch (requestError) {
      setActionError(getRequestError(requestError, 'Gagal memperbarui pesanan.'))
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
        <Link to="/seller/orders" className="text-sm font-medium text-emerald-700 hover:underline">
          ← Kembali ke pesanan
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Pesanan {order.order_number}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Dibuat {formatOrderDate(order.created_at)}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>
      </header>

      {actionError && <ErrorMessage message={actionError} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard title="Total pesanan" value={formatRupiah(order.total_amount)} highlighted />
        <StatCard title="Status pesanan" value={<StatusBadge status={order.status} />} />
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
            ['Biaya pengiriman', order.shipping_cost],
            ['Biaya platform', order.platform_fee],
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
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Metode</dt>
              <dd className="mt-1 font-medium text-slate-800">{order.payment.payment_method || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Referensi</dt>
              <dd className="mt-1 break-all font-medium text-slate-800">
                {order.payment.payment_reference || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Jumlah</dt>
              <dd className="mt-1 font-medium text-slate-800">
                {formatRupiah(order.payment.amount)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="mt-1"><StatusBadge status={order.payment.status} /></dd>
            </div>
            <div>
              <dt className="text-slate-500">Dibayar pada</dt>
              <dd className="mt-1 font-medium text-slate-800">
                {formatDateTime(order.payment.paid_at)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Belum ada data pembayaran.</p>
        )}
      </section>

      {order.shipment && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Pengiriman</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Kurir</dt>
              <dd className="mt-1 font-medium text-slate-800">{order.shipment.courier || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Nomor resi</dt>
              <dd className="mt-1 break-all font-medium text-slate-800">
                {order.shipment.tracking_number || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Metode pengiriman</dt>
              <dd className="mt-1 font-medium text-slate-800">
                {order.shipment.shipping_method || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Status pengiriman</dt>
              <dd className="mt-1"><StatusBadge status={order.shipment.status} /></dd>
            </div>
            <div>
              <dt className="text-slate-500">Dikirim pada</dt>
              <dd className="mt-1 font-medium text-slate-800">
                {formatDateTime(order.shipment.shipped_at)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Diterima pada</dt>
              <dd className="mt-1 font-medium text-slate-800">
                {formatDateTime(order.shipment.delivered_at)}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {order.status === 'paid' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setActionError('')
              setConfirmation('process')
            }}
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Proses pesanan
          </button>
        </div>
      )}

      {order.status === 'processing' && (
        <form
          onSubmit={openShipConfirmation}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Kirim pesanan</h2>
            <p className="mt-1 text-sm text-slate-500">
              Isi seluruh informasi pengiriman. Pengiriman akan dimulai setelah konfirmasi.
            </p>
          </div>
          {shipFormError && <ErrorMessage message={shipFormError} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Kurir"
              name="courier"
              value={shipForm.courier}
              onChange={updateShipField}
              required
            />
            <FormField
              label="Nomor resi"
              name="tracking_number"
              value={shipForm.tracking_number}
              onChange={updateShipField}
              required
            />
            <FormField
              label="Metode pengiriman"
              name="shipping_method"
              value={shipForm.shipping_method}
              onChange={updateShipField}
              required
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Lanjutkan kirim
          </button>
        </form>
      )}

      {order.status === 'shipped' && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Perbarui status pengiriman</h2>
            <p className="mt-1 text-sm text-slate-500">
              Pilih status pengiriman terbaru lalu konfirmasi perubahan.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full max-w-sm">
              <FormField
                label="Status pengiriman"
                name="shipment_status"
                as="select"
                value={shipmentStatus}
                onChange={(event) => setShipmentStatus(event.target.value)}
                options={SHIPMENT_STATUSES.map((status) => ({
                  value: status,
                  label: SHIPMENT_STATUS_LABELS[status] || labelStatus(status),
                }))}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setActionError('')
                setConfirmation('shipment')
              }}
              className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Perbarui status
            </button>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={Boolean(confirmation)}
        title={
          confirmation === 'process'
            ? 'Proses pesanan?'
            : confirmation === 'ship'
              ? 'Kirim pesanan?'
              : 'Perbarui status pengiriman?'
        }
        message={
          confirmation === 'process'
            ? `Pesanan ${order.order_number} akan diubah ke status diproses.`
            : confirmation === 'ship'
              ? `Pesanan ${order.order_number} akan dikirim dengan ${shipForm.courier} dan nomor resi ${shipForm.tracking_number}.`
              : `Status pengiriman akan diubah menjadi ${shipmentStatus}.`
        }
        confirmLabel={
          confirmation === 'process'
            ? 'Proses'
            : confirmation === 'ship'
              ? 'Kirim'
              : 'Perbarui'
        }
        busy={busy}
        onCancel={() => setConfirmation('')}
        onConfirm={confirmAction}
      />
    </section>
  )
}
