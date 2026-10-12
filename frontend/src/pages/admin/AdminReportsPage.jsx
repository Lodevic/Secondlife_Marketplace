import { useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import ErrorMessage from '../../components/ErrorMessage'
import ExportMenu from '../../components/ExportMenu'
import LoadingSpinner from '../../components/LoadingSpinner'
import Pagination from '../../components/Pagination'
import StatusBadge from '../../components/StatusBadge'
import useFetch from '../../hooks/useFetch'
import { exportCsv } from '../../utils/exportUtils'
import { formatTanggalIndonesia, labelStatus } from '../../utils/dashboard'

const PAGE_SIZE = 10
const REPORT_STATUSES = ['pending', 'investigating', 'resolved', 'rejected']
const TARGET_TYPES = ['product', 'seller', 'transaction', 'user']
const REPORT_STATUS_LABELS = {
  pending: 'Menunggu',
  investigating: 'Sedang ditinjau',
  resolved: 'Selesai ditinjau',
  rejected: 'Ditolak',
}

function formatDate(value) {
  return value ? formatTanggalIndonesia(value.slice(0, 10)) : '—'
}

function fileDate() {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 10)
}

export default function AdminReportsPage() {
  const [status, setStatus] = useState('')
  const [targetType, setTargetType] = useState('')
  const [page, setPage] = useState(1)
  const [exportError, setExportError] = useState('')
  const params = {
    page,
    per_page: PAGE_SIZE,
    ...(status ? { status } : {}),
    ...(targetType ? { target_type: targetType } : {}),
  }
  const { data, loading, error, refetch } = useFetch('/api/reports', { params })
  const reports = data?.reports ?? []
  const total = data?.pagination?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const exportReports = () => {
    setExportError('')
    try {
      exportCsv(
        `daftar-laporan-${fileDate()}.csv`,
        [
          { header: 'ID', accessor: 'id' },
          { header: 'Jenis target', accessor: (report) => labelStatus(report.target_type) },
          { header: 'ID target', accessor: 'target_id' },
          { header: 'Alasan', accessor: 'reason' },
          { header: 'ID pelapor', accessor: 'reporter_id' },
          { header: 'Status', accessor: (report) => labelStatus(report.status) },
          { header: 'Tanggal', accessor: (report) => formatDate(report.created_at) },
        ],
        reports,
      )
    } catch (exportException) {
      setExportError(exportException.message || 'Gagal mengekspor daftar laporan.')
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Laporan</h1>
          <p className="mt-1 text-sm text-slate-500">Tinjau laporan yang dikirim pengguna.</p>
        </div>
        <ExportMenu
          onCsv={exportReports}
          disabled={loading || Boolean(error) || reports.length === 0}
        />
      </header>

      {exportError && <ErrorMessage message={exportError} />}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <label className="text-sm font-medium text-slate-700">
            Status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
              className="ml-3 rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Semua status</option>
              {REPORT_STATUSES.map((item) => (
                <option key={item} value={item}>{REPORT_STATUS_LABELS[item]}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Target
            <select
              value={targetType}
              onChange={(event) => {
                setTargetType(event.target.value)
                setPage(1)
              }}
              className="ml-3 rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Semua target</option>
              {TARGET_TYPES.map((item) => (
                <option key={item} value={item}>{labelStatus(item)}</option>
              ))}
            </select>
          </label>
        </div>
        {!loading && !error && <span className="text-sm text-slate-500">{total} laporan</span>}
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoadingSpinner label="Memuat laporan..." />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <ErrorMessage message={error} onRetry={refetch} />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <EmptyState
            message={status || targetType ? 'Laporan tidak ditemukan' : 'Belum ada laporan'}
            description="Laporan yang masuk akan tampil di sini."
          />
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <DataTable
              rows={reports}
              getRowKey={(item) => item.id}
              columns={[
                { key: 'id', label: 'ID' },
                { key: 'target_type', label: 'Jenis target', render: (item) => labelStatus(item.target_type) },
                { key: 'target_id', label: 'ID target' },
                { key: 'reason', label: 'Alasan' },
                { key: 'reporter_id', label: 'Pelapor (ID)' },
                { key: 'status', label: 'Status', render: (item) => <StatusBadge status={item.status} /> },
                { key: 'created_at', label: 'Tanggal', render: (item) => formatDate(item.created_at) },
                {
                  key: 'detail',
                  label: '',
                  render: (item) => (
                    <Link
                      to={`/admin/reports/${item.id}`}
                      className="font-medium text-emerald-700 hover:underline"
                    >
                      Lihat detail
                    </Link>
                  ),
                },
              ]}
            />
          </div>
          <Pagination page={page} pages={pages} total={total} onPageChange={setPage} />
        </>
      )}
    </section>
  )
}
