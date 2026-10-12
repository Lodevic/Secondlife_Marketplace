import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/axios'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import ErrorMessage from '../../components/ErrorMessage'
import FormField from '../../components/FormField'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import useFetch from '../../hooks/useFetch'
import { formatTanggalIndonesia, labelStatus } from '../../utils/dashboard'

const REPORT_STATUSES = ['pending', 'investigating', 'resolved', 'rejected']
const REPORT_STATUS_LABELS = {
  pending: 'Menunggu',
  investigating: 'Sedang ditinjau',
  resolved: 'Selesai ditinjau',
  rejected: 'Ditolak',
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function formatReportDate(value) {
  return value ? formatTanggalIndonesia(value.slice(0, 10)) : '—'
}

export default function AdminReportDetailPage() {
  const { id } = useParams()
  const { data, loading, error, refetch } = useFetch(`/api/reports/${id}`)
  const report = data?.report
  const [status, setStatus] = useState('')
  const [resolutionNote, setResolutionNote] = useState('')
  const [confirmation, setConfirmation] = useState(false)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (report) {
      setStatus(report.status)
      setResolutionNote(report.resolution_note ?? '')
    }
  }, [report])

  const confirmUpdate = async () => {
    if (!report) return
    setBusy(true)
    setActionError('')
    try {
      await api.patch(`/api/reports/${report.id}`, {
        status,
        resolution_note: resolutionNote.trim() || null,
      })
      setConfirmation(false)
      refetch()
    } catch (requestError) {
      setActionError(
        requestError.response?.data?.error || 'Gagal memperbarui laporan.',
      )
      setConfirmation(false)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <LoadingSpinner label="Memuat detail laporan..." />
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

  if (!report) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <EmptyState message="Laporan tidak ditemukan" />
      </div>
    )
  }

  return (
    <section className="space-y-6">
      <header>
        <Link to="/admin/reports" className="text-sm font-medium text-emerald-700 hover:underline">
          ← Kembali ke laporan
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Laporan #{report.id}</h1>
            <p className="mt-1 text-sm text-slate-500">Dibuat {formatReportDate(report.created_at)}</p>
          </div>
          <StatusBadge status={report.status} />
        </div>
      </header>

      {actionError && <ErrorMessage message={actionError} />}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Informasi laporan</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          {[
            ['Pelapor (ID)', report.reporter_id],
            ['Jenis target', labelStatus(report.target_type)],
            ['ID target', report.target_id],
            ['Alasan', report.reason],
            ['Deskripsi', report.description || '—'],
            ['Status', <StatusBadge status={report.status} />],
            ['Dibuat pada', formatDate(report.created_at)],
            ['Ditangani oleh (ID)', report.handled_by ?? '—'],
            ['Ditangani pada', formatDate(report.handled_at)],
            ['Catatan penyelesaian', report.resolution_note || '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-slate-500">{label}</dt>
              <dd className="mt-1 whitespace-pre-wrap font-medium text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Perbarui status</h2>
          <p className="mt-1 text-sm text-slate-500">Perubahan akan mencatat admin dan waktu penanganan.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Status laporan"
            name="report_status"
            as="select"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={REPORT_STATUSES.map((item) => ({
              value: item,
              label: REPORT_STATUS_LABELS[item],
            }))}
          />
          <FormField
            label="Catatan penyelesaian"
            name="resolution_note"
            as="textarea"
            value={resolutionNote}
            onChange={(event) => setResolutionNote(event.target.value)}
            rows={4}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setActionError('')
            setConfirmation(true)
          }}
          className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
        >
          Simpan perubahan
        </button>
      </section>

      <ConfirmDialog
        open={confirmation}
        title="Perbarui laporan?"
        message={`Status laporan #${report.id} akan diubah menjadi ${REPORT_STATUS_LABELS[status]}.`}
        confirmLabel="Simpan perubahan"
        busy={busy}
        onCancel={() => setConfirmation(false)}
        onConfirm={confirmUpdate}
      />
    </section>
  )
}
