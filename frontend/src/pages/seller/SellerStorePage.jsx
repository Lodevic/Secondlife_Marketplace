import { useState } from 'react'
import { api } from '../../api/axios'
import EmptyState from '../../components/EmptyState'
import ErrorMessage from '../../components/ErrorMessage'
import FormField from '../../components/FormField'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import useFetch from '../../hooks/useFetch'
import { formatTanggalIndonesia } from '../../utils/dashboard'

const INITIAL_FORM = {
  store_name: '',
  description: '',
  logo: '',
}

const STORE_NOT_FOUND_ERROR = 'Toko seller tidak ditemukan'

function isValidLogoValue(value) {
  return value.length <= 500
}

function formatStoreDate(value) {
  return value ? formatTanggalIndonesia(value.slice(0, 10)) : '—'
}

export default function SellerStorePage() {
  const { data, loading, error, refetch } = useFetch('/api/stores/me')
  const [createdStore, setCreatedStore] = useState(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: '' }))
  }

  const submitStore = async (event) => {
    event.preventDefault()
    setSubmitError('')
    const errors = {}

    if (!form.store_name.trim()) {
      errors.store_name = 'Nama toko wajib diisi.'
    } else if (form.store_name.trim().length > 120) {
      errors.store_name = 'Nama toko maksimal 120 karakter.'
    }
    if (!isValidLogoValue(form.logo)) {
      errors.logo = 'Logo maksimal 500 karakter.'
    }

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    try {
      const response = await api.post('/api/stores', {
        store_name: form.store_name.trim(),
        description: form.description.trim() || null,
        logo: form.logo.trim() || null,
      })
      setCreatedStore(response.data.store)
      setSubmitError('')
    } catch (requestError) {
      setSubmitError(
        requestError.response?.data?.error || 'Gagal membuat toko. Silakan coba lagi.',
      )
    } finally {
      setSaving(false)
    }
  }

  const store = data?.store || createdStore
  if (store) {
    return <StoreDetails store={store} />
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <LoadingSpinner label="Memeriksa toko..." />
      </section>
    )
  }

  if (error && error !== STORE_NOT_FOUND_ERROR) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <ErrorMessage message={error} onRetry={refetch} />
      </section>
    )
  }

  if (data && !data.store) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <ErrorMessage
          message="Respons API toko tidak memuat data toko."
          onRetry={refetch}
        />
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Buat toko</h1>
        <p className="mt-1 text-sm text-slate-500">
          Lengkapi informasi awal toko Anda. Toko baru akan menunggu peninjauan admin.
        </p>
      </header>

      {submitError && <ErrorMessage message={submitError} />}

      <form
        onSubmit={submitStore}
        noValidate
        className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
      >
        <FormField
          label="Nama toko"
          name="store_name"
          value={form.store_name}
          onChange={handleChange}
          required
          error={fieldErrors.store_name}
          hint="Wajib diisi, maksimal 120 karakter."
        />
        <FormField
          label="Deskripsi"
          name="description"
          as="textarea"
          value={form.description}
          onChange={handleChange}
          hint="Opsional."
        />
        <FormField
          label="Logo"
          name="logo"
          value={form.logo}
          onChange={handleChange}
          error={fieldErrors.logo}
          hint="Opsional. API menerima string maksimal 500 karakter tanpa validasi format URL."
        />
        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Buat toko'}
          </button>
        </div>
      </form>
    </section>
  )
}

function StoreDetails({ store }) {
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Toko</h1>
        <p className="mt-1 text-sm text-slate-500">Informasi toko seller Anda.</p>
      </header>

      {store.status === 'pending' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Toko Anda sedang menunggu peninjauan admin.
        </div>
      )}

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-5 sm:flex-row">
          {store.logo ? (
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <img
                src={store.logo}
                alt={`Logo ${store.store_name}`}
                className="h-full w-full object-contain"
                onError={(event) => {
                  event.currentTarget.hidden = true
                }}
              />
            </div>
          ) : (
            <div className="w-full sm:w-40">
              <EmptyState compact message="Logo belum tersedia" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="break-words text-xl font-semibold text-slate-900">
                {store.store_name}
              </h2>
              <StatusBadge status={store.status} />
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {store.description || 'Belum ada deskripsi toko.'}
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-500">Rating rata-rata</dt>
            <dd className="mt-1 font-medium text-slate-900">{store.rating_avg ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Tanggal dibuat</dt>
            <dd className="mt-1 font-medium text-slate-900">
              {formatStoreDate(store.created_at)}
            </dd>
          </div>
        </dl>
      </article>

      <p className="text-sm text-slate-500">
        Informasi toko hanya dapat dilihat di halaman ini karena API saat ini belum menyediakan
        endpoint untuk mengubah toko.
      </p>
    </section>
  )
}
