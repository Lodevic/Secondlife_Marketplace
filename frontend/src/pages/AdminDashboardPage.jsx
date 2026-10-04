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

function QueuePanel({
  title,
  count,
  countLabel,
  secondaryCount,
  secondaryCountLabel,
  loading,
  error,
  refetch,
  rows,
  columns,
  description,
}) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {!loading && !error && (
          <div className="flex flex-wrap justify-end gap-1">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-700">
              {countLabel}: {count}
            </span>
            {secondaryCountLabel && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-700">
                {secondaryCountLabel}: {secondaryCount}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="mt-3">
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorMessage message={error} onRetry={refetch} />
        ) : rows?.length ? (
          <DataTable rows={rows} columns={columns} />
        ) : (
          <EmptyState compact description={description} />
        )}
      </div>
      {!loading && !error && rows?.length > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          Maksimal 10 item terbaru · hanya baca
        </p>
      )}
    </section>
  )
}

export default function AdminDashboardPage() {
  const summary = useFetch('/api/dashboard/admin/summary')
  const moderation = useFetch('/api/dashboard/admin/moderation-queue')
  const topSellers = useFetch('/api/dashboard/admin/top-sellers', {
    params: { limit: 5 },
  })
  const topProducts = useFetch('/api/dashboard/admin/top-products', {
    params: { limit: 5 },
  })

  const [period, setPeriod] = useState('day')
  const defaultRange = initialDateRange()
  const [startDate, setStartDate] = useState(defaultRange.start)
  const [endDate, setEndDate] = useState(defaultRange.end)
  const dateError = !startDate || !endDate
    ? 'Pilih tanggal awal dan akhir.'
    : startDate > endDate
      ? 'Tanggal awal tidak boleh setelah tanggal akhir.'
      : ''
  const trend = useFetch('/api/dashboard/admin/sales-trend', {
    params: { period, start_date: startDate, end_date: endDate },
    enabled: !dateError,
  })

  const trendData = trend.data?.data
  const paymentQueue = moderation.data?.payments
  const reportQueue = moderation.data?.reports
  const storeQueue = moderation.data?.stores
  const sellerRows = topSellers.data?.sellers
  const productRows = topProducts.data?.products

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard admin</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pantau transaksi, ekosistem, dan antrean yang perlu ditinjau.
        </p>
      </header>

      {summary.loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((card) => (
            <div
              key={card}
              className="rounded-xl border border-slate-200 bg-white"
            >
              <LoadingSpinner />
            </div>
          ))}
        </div>
      ) : summary.error ? (
        <ErrorMessage message={summary.error} onRetry={summary.refetch} />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Nilai transaksi (GMV)"
            value={formatRupiah(summary.data.gmv)}
            detail="Total pembayaran dari pesanan selesai, termasuk ongkir dan biaya."
            highlighted
          />
          <StatCard
            title="Pendapatan komisi platform"
            value={formatRupiah(summary.data.platform_revenue)}
            detail="Biaya platform dari seluruh pesanan selesai."
          />
          <StatCard
            title="Pesanan selesai"
            value={summary.data.total_completed_orders}
            detail="Pesanan dengan status selesai."
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.75fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Tren transaksi</h2>
          <p className="mt-1 text-xs text-slate-500">
            GMV dan komisi platform menurut tanggal pembuatan pesanan (UTC)
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
                  aria-label="Tanggal awal tren transaksi"
                />
              </label>
              <label className="flex items-center gap-2">
                <span>Sampai</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1.5"
                  aria-label="Tanggal akhir tren transaksi"
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
              <LoadingSpinner label="Memuat tren transaksi..." />
            ) : trend.error ? (
              <ErrorMessage message={trend.error} onRetry={trend.refetch} />
            ) : Array.isArray(trendData) ? (
              <SalesChart
                data={trendData}
                period={period}
                series={[
                  {
                    dataKey: 'gmv',
                    name: 'GMV (Rp)',
                    color: '#047857',
                    format: 'currency',
                  },
                  {
                    dataKey: 'platform_fee',
                    name: 'Komisi platform (Rp)',
                    color: '#94a3b8',
                    format: 'currency',
                  },
                ]}
              />
            ) : (
              <EmptyState description="Data tren belum dapat ditampilkan." />
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Pengguna</h2>
          <p className="mt-1 text-xs text-slate-500">
            Komposisi akun di platform
          </p>
          {summary.loading ? (
            <LoadingSpinner />
          ) : summary.error ? (
            <div className="mt-4">
              <ErrorMessage message={summary.error} onRetry={summary.refetch} />
            </div>
          ) : (
            <>
              <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Berdasarkan peran
              </h3>
              <ul className="mt-2 divide-y divide-slate-100">
                {Object.entries(summary.data.users.by_role).map(
                  ([role, count]) => (
                    <li
                      key={role}
                      className="flex justify-between gap-3 py-2 text-sm"
                    >
                      <span className="text-slate-600">{labelStatus(role)}</span>
                      <span className="font-medium tabular-nums text-slate-800">
                        {count}
                      </span>
                    </li>
                  ),
                )}
              </ul>
              <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Berdasarkan status
              </h3>
              <ul className="mt-2 divide-y divide-slate-100">
                {Object.entries(summary.data.users.by_status).map(
                  ([status, count]) => (
                    <li
                      key={status}
                      className="flex justify-between gap-3 py-2 text-sm"
                    >
                      <span className="text-slate-600">
                        {labelStatus(status)}
                      </span>
                      <span className="font-medium tabular-nums text-slate-800">
                        {count}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">
              Antrean pemantauan
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Tinjau pembayaran, laporan, dan pendaftaran toko.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
            Hanya baca
          </span>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          <QueuePanel
            title="Pembayaran tertunda"
            count={paymentQueue?.pending_count}
            countLabel="Menunggu pembayaran"
            rows={paymentQueue?.items}
            loading={moderation.loading}
            error={moderation.error}
            refetch={moderation.refetch}
            description="Belum ada pembayaran tertunda."
            columns={[
              { key: 'order_number', label: 'Pesanan' },
              {
                key: 'amount',
                label: 'Nilai pembayaran',
                render: (row) => formatRupiah(row.amount),
              },
            ]}
          />
          <QueuePanel
            title="Laporan"
            count={reportQueue?.pending_count}
            countLabel="Menunggu"
            secondaryCount={reportQueue?.investigating_count}
            secondaryCountLabel="Sedang ditinjau"
            rows={reportQueue?.items}
            loading={moderation.loading}
            error={moderation.error}
            refetch={moderation.refetch}
            description="Belum ada laporan pada status yang tersedia."
            columns={[
              {
                key: 'target',
                label: 'Laporan',
                render: (row) => (
                  <div>
                    <p className="font-medium text-slate-700">{row.reason}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {labelStatus(row.target_type)} #{row.target_id}
                    </p>
                  </div>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => labelStatus(row.status),
              },
            ]}
          />
          <QueuePanel
            title="Toko menunggu"
            count={storeQueue?.pending_count}
            countLabel="Menunggu peninjauan"
            rows={storeQueue?.items}
            loading={moderation.loading}
            error={moderation.error}
            refetch={moderation.refetch}
            description="Belum ada toko yang menunggu peninjauan."
            columns={[
              { key: 'store_name', label: 'Nama toko' },
              { key: 'seller_name', label: 'Penjual' },
              {
                key: 'created_at',
                label: 'Diajukan',
                render: (row) => formatTanggalIndonesia(row.created_at.slice(0, 10)),
              },
            ]}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
          <span className="text-sm font-medium text-slate-700">
            Ulasan tersembunyi
          </span>
          {moderation.loading ? (
            <span className="text-xs text-slate-500">Memuat...</span>
          ) : moderation.error ? (
            <div className="w-full">
              <ErrorMessage
                message={moderation.error}
                onRetry={moderation.refetch}
              />
            </div>
          ) : (
            <span className="text-sm font-semibold tabular-nums text-slate-800">
              {moderation.data.hidden_reviews_count}
            </span>
          )}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <StatusPanel
          title="Status toko"
          subtitle="Jumlah toko menurut status"
          counts={summary.data?.stores_by_status}
          loading={summary.loading}
          error={summary.error}
          refetch={summary.refetch}
        />
        <StatusPanel
          title="Status produk"
          subtitle="Jumlah produk menurut status"
          counts={summary.data?.products_by_status}
          loading={summary.loading}
          error={summary.error}
          refetch={summary.refetch}
        />
        <StatusPanel
          title="Status pesanan"
          subtitle="Jumlah pesanan · seluruh waktu"
          counts={summary.data?.orders_by_status}
          loading={summary.loading}
          error={summary.error}
          refetch={summary.refetch}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Penjual teratas</h2>
          <p className="mt-1 text-xs text-slate-500">
            Berdasarkan pesanan selesai · pendapatan adalah subtotal barang
          </p>
          <div className="mt-4">
            {topSellers.loading ? (
              <LoadingSpinner />
            ) : topSellers.error ? (
              <ErrorMessage
                message={topSellers.error}
                onRetry={topSellers.refetch}
              />
            ) : sellerRows?.length ? (
              <DataTable
                rows={sellerRows}
                getRowKey={(row) => row.seller_id}
                columns={[
                  { key: 'store_name', label: 'Nama toko' },
                  {
                    key: 'total_revenue',
                    label: 'Pendapatan',
                    render: (row) => formatRupiah(row.total_revenue),
                  },
                  { key: 'orders', label: 'Pesanan' },
                ]}
              />
            ) : (
              <EmptyState description="Belum ada rincian penjual, pendapatan, dan pesanan." />
            )}
          </div>
        </section>

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
      </div>
      <p className="text-xs text-slate-400">
        Tren berdasarkan waktu UTC.
        {!dateError &&
          ` Periode grafik: ${formatPeriode(startDate, period)} – ${formatPeriode(endDate, period)}.`}
      </p>
    </section>
  )
}
