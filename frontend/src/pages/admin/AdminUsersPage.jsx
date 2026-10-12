import { useState } from 'react'
import { api } from '../../api/axios'
import ConfirmDialog from '../../components/ConfirmDialog'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import ErrorMessage from '../../components/ErrorMessage'
import LoadingSpinner from '../../components/LoadingSpinner'
import Pagination from '../../components/Pagination'
import StatusBadge from '../../components/StatusBadge'
import useFetch from '../../hooks/useFetch'
import { useAuth } from '../../context/AuthContext'
import { formatTanggalIndonesia, labelStatus } from '../../utils/dashboard'

const PAGE_SIZE = 10
const USER_ROLES = ['buyer', 'seller', 'admin']
const USER_STATUSES = ['active', 'suspended', 'blocked']
const USER_STATUS_LABELS = {
  active: 'Aktif',
  suspended: 'Ditangguhkan',
  blocked: 'Diblokir',
}

function formatDate(value) {
  return value ? formatTanggalIndonesia(value.slice(0, 10)) : '—'
}

function defaultNextStatus(status) {
  return status === 'active' ? 'suspended' : 'active'
}

export default function AdminUsersPage() {
  const { user } = useAuth()
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState({})
  const [page, setPage] = useState(1)
  const [confirmation, setConfirmation] = useState(null)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const params = {
    page,
    per_page: PAGE_SIZE,
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(appliedSearch ? { search: appliedSearch } : {}),
  }
  const { data, loading, error, refetch } = useFetch('/api/admin/users', { params })
  const users = data?.users ?? []

  const submitSearch = (event) => {
    event.preventDefault()
    setAppliedSearch(search.trim())
    setPage(1)
  }

  const updateFilter = (setter) => (event) => {
    setter(event.target.value)
    setPage(1)
  }

  const confirmStatusChange = async () => {
    if (!confirmation) return
    setBusy(true)
    setActionError('')
    try {
      await api.patch(`/api/admin/users/${confirmation.id}`, {
        status: confirmation.nextStatus,
      })
      setConfirmation(null)
      refetch()
    } catch (requestError) {
      setActionError(
        requestError.response?.data?.error || 'Gagal mengubah status pengguna.',
      )
      setConfirmation(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Pengguna</h1>
        <p className="mt-1 text-sm text-slate-500">Kelola akun pengguna marketplace.</p>
      </header>

      {actionError && <ErrorMessage message={actionError} />}

      <form
        onSubmit={submitSearch}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <label className="min-w-56 flex-1 text-sm font-medium text-slate-700">
          Cari nama atau email
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nama atau email"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Peran
          <select
            value={role}
            onChange={updateFilter(setRole)}
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">Semua peran</option>
            {USER_ROLES.map((item) => (
              <option key={item} value={item}>{labelStatus(item)}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Status
          <select
            value={status}
            onChange={updateFilter(setStatus)}
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">Semua status</option>
            {USER_STATUSES.map((item) => (
              <option key={item} value={item}>{USER_STATUS_LABELS[item]}</option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          Cari
        </button>
        {!loading && !error && (
          <span className="pb-2 text-sm text-slate-500">{data?.total ?? 0} pengguna</span>
        )}
      </form>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoadingSpinner label="Memuat pengguna..." />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <ErrorMessage message={error} onRetry={refetch} />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <EmptyState
            message={appliedSearch || role || status ? 'Pengguna tidak ditemukan' : 'Belum ada pengguna'}
            description="Coba ubah kata pencarian atau filter."
          />
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <DataTable
              rows={users}
              getRowKey={(item) => item.id}
              columns={[
                { key: 'name', label: 'Nama' },
                { key: 'email', label: 'Email' },
                { key: 'phone', label: 'Telepon', render: (item) => item.phone || '—' },
                { key: 'role', label: 'Peran', render: (item) => labelStatus(item.role) },
                { key: 'status', label: 'Status', render: (item) => <StatusBadge status={item.status} /> },
                { key: 'created_at', label: 'Tanggal daftar', render: (item) => formatDate(item.created_at) },
                {
                  key: 'actions',
                  label: 'Aksi',
                  render: (item) => {
                    const isCurrentUser = String(item.id) === String(user?.id)
                    const disabled = item.role === 'admin' || isCurrentUser
                    const nextStatus =
                      selectedStatuses[item.id] ?? defaultNextStatus(item.status)
                    return (
                      <div className="flex min-w-52 items-center gap-2">
                        <select
                          aria-label={`Status baru untuk ${item.name}`}
                          value={nextStatus}
                          onChange={(event) =>
                            setSelectedStatuses((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          disabled={disabled}
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs disabled:bg-slate-100"
                        >
                          {USER_STATUSES.map((option) => (
                            <option key={option} value={option}>{USER_STATUS_LABELS[option]}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            setActionError('')
                            setConfirmation({ ...item, nextStatus })
                          }}
                          className="font-medium text-emerald-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                        >
                          Ubah
                        </button>
                      </div>
                    )
                  },
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

      <ConfirmDialog
        open={Boolean(confirmation)}
        title="Ubah status pengguna?"
        message={`Status akun ${confirmation?.name ?? ''} akan diubah menjadi ${USER_STATUS_LABELS[confirmation?.nextStatus] ?? confirmation?.nextStatus ?? ''}.`}
        confirmLabel="Ubah status"
        busy={busy}
        onCancel={() => setConfirmation(null)}
        onConfirm={confirmStatusChange}
      />
    </section>
  )
}
