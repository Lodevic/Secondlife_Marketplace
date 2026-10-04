import { useState } from 'react'
import DataTable from '../components/DataTable'
import EmptyState from '../components/EmptyState'
import ErrorMessage from '../components/ErrorMessage'
import LoadingSpinner from '../components/LoadingSpinner'
import SalesChart from '../components/SalesChart'
import StatCard from '../components/StatCard'
import useFetch from '../hooks/useFetch'
import {
  formatPeriode,
  formatRupiah,
  formatTanggalIndonesia,
  labelStatus,
} from '../utils/dashboard'

function initialDateRange() {
  const now = new Date()
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 29)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

function StatusPanel({ title, subtitle, counts, loading, error, refetch }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="mt-4">
          <ErrorMessage message={error} onRetry={refetch} />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {Object.entries(counts || {}).map(([status, count]) => (
            <li
              key={status}
              className="flex items-center justify-between gap-4 py-2 text-sm"
            >
              <span className="text-slate-600">{labelStatus(status)}</span>
              <span className="font-medium tabular-nums text-slate-800">
                {count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function SellerDashboardPage() {
  const summary = useFetch('/api/dashboard/seller/summary')
  const [period, setPeriod] = useState('day')
  const defaultRange = initialDateRange()
  const [startDate, setStartDate] = useState(defaultRange.start)
  const [endDate, setEndDate] = useState(defaultRange.end)
  const [thresholdInput, setThresholdInput] = useState('3')
  const [threshold, setThreshold] = useState(3)
  const dateError = !startDate || !endDate
    ? 'Pilih tanggal awal dan akhir.'
    : startDate > endDate
      ? 'Tanggal awal tidak boleh setelah tanggal akhir.'
      : ''
  const validThreshold =
    thresholdInput.trim() !== '' &&
    Number.isInteger(Number(thresholdInput)) &&
    Number(thresholdInput) >= 0

  const trend = useFetch('/api/dashboard/seller/sales-trend', {
    params: { period, start_date: startDate, end_date: endDate },
    enabled: !dateError,
  })
  const topProducts = useFetch('/api/dashboard/seller/top-products', {
    params: { limit: 5 },
  })
  const lowStock = useFetch('/api/dashboard/seller/low-stock', {
    params: { threshold },
  })

  const trendData = trend.data?.data
  const productRows = topProducts.data?.products
  const lowStockRows = lowStock.data?.products

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard penjual</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ringkasan penjualan dan prioritas untuk langkah berikutnya.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.6fr)]">
        {summary.loading ? (
          <section className="rounded-xl border border-emerald-900 bg-emerald-900">
            <LoadingSpinner label="Memuat pendapatan..." />
          </section>
        ) : summary.error ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">Total pendapatan</h2>
            <div className="mt-4">
              <ErrorMessage message={summary.error} onRetry={summary.refetch} />
            </div>
          </section>
        ) : (
          <StatCard
            title="Total pendapatan"
            value={formatRupiah(summary.data.total_revenue)}
            detail={`${summary.data.orders_by_status.completed} pesanan selesai. Subtotal barang, tidak termasuk ongkir dan biaya.`}
            highlighted
          />
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-900">Perlu ditindak</h2>
              <p className="mt-1 text-xs text-slate-500">
                Prioritas pesanan dan negosiasi Anda
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
              Prioritas
            </span>
          </div>
          {summary.loading ? (
            <LoadingSpinner />
          ) : summary.error ? (
            <div className="mt-3">
              <ErrorMessage message={summary.error} onRetry={summary.refetch} />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              <li className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="text-slate-700">Perlu diproses</span>
                <span className="font-semibold tabular-nums text-slate-900">
                  {summary.data.needs_action.paid}
                </span>
              </li>
              <li className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="text-slate-700">Perlu dikirim</span>
                <span className="font-semibold tabular-nums text-slate-900">
                  {summary.data.needs_action.processing}
                </span>
              </li>
              <li className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="text-slate-700">Penawaran menunggu</span>
                <span className="font-semibold tabular-nums text-slate-900">
                  {summary.data.pending_offers}
                </span>
              </li>
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.75fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Tren penjualan</h2>
          <p className="mt-1 text-xs text-slate-500">
            Pendapatan dan jumlah pesanan selesai menurut tanggal pembuatan
            pesanan (UTC)
          </p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div className="inline-flex rounded-lg bg-slate-100 p-1">
              {[
                { value: 'day', label: 'Harian' },
                { value: 'month', label: 'Bulanan' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={period === option.value}
                  onClick={() => setPeriod(option.value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    period === option.value
                      ? 'bg-white text-emerald-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <label className="flex items-center gap-2">
                <span>Dari</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1.5"
                  aria-label="Tanggal awal tren penjualan"
                />
              </label>
              <label className="flex items-center gap-2">
                <span>Sampai</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1.5"
                  aria-label="Tanggal akhir tren penjualan"
                />
              </label>
            </div>
          </div>
          {dateError ? (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {dateError}
            </p>
          ) : (
            <p className="mt-3 text-xs text-slate-500">
              {formatTanggalIndonesia(startDate)} –{' '}
              {formatTanggalIndonesia(endDate)}
            </p>
          )}
          <div className="mt-3">
            {dateError ? null : trend.loading ? (
              <LoadingSpinner label="Memuat tren penjualan..." />
            ) : trend.error ? (
              <ErrorMessage message={trend.error} onRetry={trend.refetch} />
            ) : Array.isArray(trendData) ? (
              <SalesChart
                data={trendData}
                period={period}
                series={[
                  {
                    dataKey: 'revenue',
                    name: 'Pendapatan (Rp)',
                    color: '#047857',
                    format: 'currency',
                  },
                  {
                    dataKey: 'orders',
                    name: 'Pesanan (jumlah)',
                    color: '#94a3b8',
                    format: 'count',
                    axis: 'right',
                  },
                ]}
              />
            ) : (
              <EmptyState description="Data tren belum dapat ditampilkan." />
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Kualitas pengalaman</h2>
          <p className="mt-1 text-xs text-slate-500">
            Rata-rata penilaian pembeli
          </p>
          {summary.loading ? (
            <LoadingSpinner />
          ) : summary.error ? (
            <div className="mt-4">
              <ErrorMessage message={summary.error} onRetry={summary.refetch} />
            </div>
          ) : (
            <>
              <dl className="mt-4 divide-y divide-slate-100">
                {[
                  ['Produk', summary.data.reviews.average_product_rating],
                  ['Penjual', summary.data.reviews.average_seller_rating],
                  ['Pengiriman', summary.data.reviews.average_shipping_rating],
                ].map(([label, rating]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <dt className="text-slate-600">{label}</dt>
                    <dd className="font-medium tabular-nums text-slate-900">
                      {summary.data.reviews.count
                        ? (
                            <>
                              {Number(rating).toFixed(1)}{' '}
                              <span className="text-amber-500">★</span>
                            </>
                          )
                        : '-'}{' '}
                    </dd>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 py-3 text-sm">
                  <dt className="text-slate-600">Jumlah ulasan</dt>
                  <dd className="font-medium tabular-nums text-slate-900">
                    {summary.data.reviews.count}
                  </dd>
                </div>
              </dl>
              {!summary.data.reviews.count && (
                <EmptyState
                  compact
                  description="Belum ada ulasan yang tercatat."
                />
              )}
            </>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StatusPanel
          title="Status pesanan"
          subtitle="Jumlah pesanan menurut tahapnya · seluruh waktu"
          counts={summary.data?.orders_by_status}
          loading={summary.loading}
          error={summary.error}
          refetch={summary.refetch}
        />
        <StatusPanel
          title="Status produk"
          subtitle="Jumlah produk menurut status publikasinya"
          counts={summary.data?.products_by_status}
          loading={summary.loading}
          error={summary.error}
          refetch={summary.refetch}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Produk terlaris</h2>
          <p className="mt-1 text-xs text-slate-500">
            Berdasarkan pesanan selesai · pendapatan adalah subtotal barang
          </p>
          <div className="mt-4">
            {topProducts.loading ? (
              <LoadingSpinner />
            ) : topProducts.error ? (
              <ErrorMessage
                message={topProducts.error}
                onRetry={topProducts.refetch}
              />
            ) : productRows?.length ? (
              <DataTable
                rows={productRows}
                getRowKey={(row) => row.product_id}
                columns={[
                  { key: 'name', label: 'Nama produk' },
                  { key: 'total_quantity', label: 'Terjual' },
                  {
                    key: 'total_revenue',
                    label: 'Pendapatan',
                    render: (row) => formatRupiah(row.total_revenue),
                  },
                ]}
              />
            ) : (
              <EmptyState description="Belum ada rincian produk, jumlah terjual, dan pendapatan." />
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Stok menipis</h2>
              <p className="mt-1 text-xs text-slate-500">
                Produk dengan stok pada atau di bawah ambang
              </p>
            </div>
            <div className="flex items-end gap-2">
              <label className="grid gap-1 text-xs text-slate-500">
                Ambang stok
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={thresholdInput}
                  onChange={(event) => setThresholdInput(event.target.value)}
                  className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
                  aria-label="Ambang stok menipis"
                />
              </label>
              <button
                type="button"
                disabled={!validThreshold || Number(thresholdInput) === threshold}
                onClick={() => setThreshold(Number(thresholdInput))}
                className="rounded-md bg-emerald-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Terapkan
              </button>
            </div>
          </div>
          {!validThreshold && (
            <p role="alert" className="mt-2 text-xs text-red-700">
              Ambang harus berupa bilangan bulat minimal 0.
            </p>
          )}
          <div className="mt-4">
            {lowStock.loading ? (
              <LoadingSpinner />
            ) : lowStock.error ? (
              <ErrorMessage message={lowStock.error} onRetry={lowStock.refetch} />
            ) : lowStockRows?.length ? (
              <DataTable
                rows={lowStockRows}
                getRowKey={(row) => row.product_id}
                columns={[
                  { key: 'name', label: 'Nama produk' },
                  { key: 'stock', label: 'Stok' },
                ]}
              />
            ) : (
              <EmptyState
                description={`Tidak ada produk aktif dengan stok pada atau di bawah ambang ${threshold}.`}
              />
            )}
          </div>
        </section>
      </div>
      <p className="text-xs text-slate-400">
        Tren berdasarkan waktu UTC.
        {!dateError &&
          ` Periode grafik: ${formatPeriode(startDate, period)} – ${formatPeriode(endDate, period)}.`}
      </p>
    </section>
  )
}
