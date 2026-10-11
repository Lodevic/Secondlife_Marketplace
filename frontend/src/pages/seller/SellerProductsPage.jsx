import { useState } from 'react'
import { Link } from 'react-router-dom'
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

function formatProductDate(value) {
  return value ? formatTanggalIndonesia(value.slice(0, 10)) : '—'
}

export default function SellerProductsPage() {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [archiveProduct, setArchiveProduct] = useState(null)
  const [actionError, setActionError] = useState('')
  const [archiving, setArchiving] = useState(false)
  const params = {
    page,
    per_page: PAGE_SIZE,
    ...(status ? { status } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  }
  const { data, loading, error, refetch } = useFetch('/api/seller/products', { params })
  const products = data?.products ?? []

  const changeStatus = (event) => {
    setStatus(event.target.value)
    setPage(1)
  }

  const changeSearch = (event) => {
    setSearch(event.target.value)
    setPage(1)
  }

  const confirmArchive = async () => {
    if (!archiveProduct) return

    setArchiving(true)
    setActionError('')
    try {
      await api.delete(`/api/products/${archiveProduct.id}`)
      setArchiveProduct(null)
      refetch()
    } catch (requestError) {
      setActionError(requestError.response?.data?.error || 'Gagal mengarsipkan produk.')
      setArchiveProduct(null)
    } finally {
      setArchiving(false)
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Produk</h1>
          <p className="mt-1 text-sm text-slate-500">Kelola produk yang dijual di toko Anda.</p>
        </div>
        <Link
          to="/seller/products/new"
          className="inline-flex rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
        >
          Tambah produk
        </Link>
      </header>

      {actionError && <ErrorMessage message={actionError} />}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="min-w-56 flex-1 text-sm font-medium text-slate-700">
          Cari produk
          <input
            type="search"
            value={search}
            onChange={changeSearch}
            placeholder="Nama produk"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Filter status
          <select
            value={status}
            onChange={changeStatus}
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">Semua status</option>
            {PRODUCT_STATUSES.map((productStatus) => (
              <option key={productStatus} value={productStatus}>
                {labelStatus(productStatus)}
              </option>
            ))}
          </select>
        </label>
        {!loading && !error && (
          <span className="pb-2 text-sm text-slate-500">{data?.total ?? 0} produk</span>
        )}
      </div>

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
            message={search || status ? 'Produk tidak ditemukan' : 'Belum ada produk'}
            description={
              search || status
                ? 'Coba ubah kata pencarian atau filter status.'
                : 'Produk toko Anda akan tampil di sini.'
            }
          />
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <DataTable
              rows={products}
              getRowKey={(product) => product.id}
              columns={[
                { key: 'name', label: 'Nama produk' },
                { key: 'price', label: 'Harga', render: (product) => formatRupiah(product.price) },
                { key: 'stock', label: 'Stok' },
                {
                  key: 'status',
                  label: 'Status',
                  render: (product) => <StatusBadge status={product.status} />,
                },
                { key: 'category', label: 'Kategori', render: (product) => product.category?.name || '—' },
                { key: 'created_at', label: 'Tanggal', render: (product) => formatProductDate(product.created_at) },
                {
                  key: 'actions',
                  label: 'Aksi',
                  render: (product) => (
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {product.status !== 'sold' && product.status !== 'archived' ? (
                        <>
                          <Link
                            to={`/seller/products/${product.id}/edit`}
                            className="font-medium text-emerald-700 hover:underline"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setActionError('')
                              setArchiveProduct(product)
                            }}
                            className="font-medium text-red-700 hover:underline"
                          >
                            Arsipkan
                          </button>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  ),
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
        open={Boolean(archiveProduct)}
        title="Arsipkan produk?"
        message={`Produk "${archiveProduct?.name ?? ''}" akan diarsipkan dan tidak lagi tersedia sebagai produk aktif.`}
        confirmLabel="Arsipkan"
        busy={archiving}
        onCancel={() => setArchiveProduct(null)}
        onConfirm={confirmArchive}
      />
    </section>
  )
}
