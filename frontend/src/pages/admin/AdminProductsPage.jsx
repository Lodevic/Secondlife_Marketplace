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
import { formatRupiah, formatTanggalIndonesia, labelStatus } from '../../utils/dashboard'

const PAGE_SIZE = 10
const PRODUCT_STATUSES = ['draft', 'pending', 'active', 'sold', 'archived', 'rejected']

function formatDate(value) {
  return value ? formatTanggalIndonesia(value.slice(0, 10)) : '—'
}

function getActions(status) {
  if (status === 'active') {
    return [
      { status: 'rejected', label: 'Nonaktifkan' },
      { status: 'archived', label: 'Arsipkan' },
    ]
  }
  if (status === 'sold') return []
  return [{ status: 'active', label: 'Aktifkan kembali' }]
}

export default function AdminProductsPage() {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [confirmation, setConfirmation] = useState(null)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const params = {
    page,
    per_page: PAGE_SIZE,
    ...(status ? { status } : {}),
    ...(appliedSearch ? { search: appliedSearch } : {}),
  }
  const { data, loading, error, refetch } = useFetch('/api/admin/products', { params })
  const products = data?.products ?? []

  const submitSearch = (event) => {
    event.preventDefault()
    setAppliedSearch(search.trim())
    setPage(1)
  }

  const confirmStatusChange = async () => {
    if (!confirmation) return
    setBusy(true)
    setActionError('')
    try {
      await api.patch(`/api/admin/products/${confirmation.id}/status`, {
        status: confirmation.action.status,
      })
      setConfirmation(null)
      refetch()
    } catch (requestError) {
      setActionError(
        requestError.response?.data?.error || 'Gagal mengubah status produk.',
      )
      setConfirmation(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Produk</h1>
        <p className="mt-1 text-sm text-slate-500">Tinjau dan kelola status produk marketplace.</p>
      </header>

      {actionError && <ErrorMessage message={actionError} />}

      <form
        onSubmit={submitSearch}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <label className="min-w-56 flex-1 text-sm font-medium text-slate-700">
          Cari produk
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nama produk"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Status
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">Semua status</option>
            {PRODUCT_STATUSES.map((item) => (
              <option key={item} value={item}>{labelStatus(item)}</option>
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
          <span className="pb-2 text-sm text-slate-500">{data?.total ?? 0} produk</span>
        )}
      </form>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoadingSpinner label="Memuat produk..." />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <ErrorMessage message={error} onRetry={refetch} />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <EmptyState
            message={appliedSearch || status ? 'Produk tidak ditemukan' : 'Belum ada produk'}
            description="Coba ubah kata pencarian atau filter status."
          />
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <DataTable
              rows={products}
              getRowKey={(item) => item.id}
              columns={[
                {
                  key: 'main_image',
                  label: 'Foto',
                  render: (item) =>
                    item.main_image ? (
                      <img
                        src={item.main_image}
                        alt={item.name}
                        className="h-12 w-12 rounded-md object-cover"
                      />
                    ) : (
                      <span className="text-slate-400">—</span>
                    ),
                },
                { key: 'name', label: 'Nama' },
                { key: 'store_name', label: 'Toko' },
                { key: 'category', label: 'Kategori', render: (item) => item.category?.name || '—' },
                { key: 'condition', label: 'Kondisi', render: (item) => item.condition?.name || '—' },
                { key: 'price', label: 'Harga', render: (item) => formatRupiah(item.price) },
                { key: 'stock', label: 'Stok' },
                { key: 'status', label: 'Status', render: (item) => <StatusBadge status={item.status} /> },
                { key: 'created_at', label: 'Tanggal', render: (item) => formatDate(item.created_at) },
                {
                  key: 'actions',
                  label: 'Aksi',
                  render: (item) => {
                    const actions = getActions(item.status)
                    return actions.length ? (
                      <div className="flex flex-col items-start gap-1">
                        {actions.map((action) => (
                          <button
                            key={action.status}
                            type="button"
                            onClick={() => {
                              setActionError('')
                              setConfirmation({ ...item, action })
                            }}
                            className="font-medium text-emerald-700 hover:underline"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
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
        title={`${confirmation?.action.label ?? 'Ubah'} produk?`}
        message={`Status produk "${confirmation?.name ?? ''}" akan diubah menjadi ${labelStatus(confirmation?.action.status ?? '')}.`}
        confirmLabel={confirmation?.action.label ?? 'Ubah'}
        busy={busy}
        onCancel={() => setConfirmation(null)}
        onConfirm={confirmStatusChange}
      />
    </section>
  )
}
