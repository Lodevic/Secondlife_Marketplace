import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/axios'
import EmptyState from '../../components/EmptyState'
import ErrorMessage from '../../components/ErrorMessage'
import FormField from '../../components/FormField'
import LoadingSpinner from '../../components/LoadingSpinner'
import useFetch from '../../hooks/useFetch'
import { labelStatus } from '../../utils/dashboard'

const PRODUCT_STATUSES = ['draft', 'pending', 'active', 'rejected']

const EMPTY_FORM = {
  category_id: '',
  condition_id: '',
  name: '',
  description: '',
  price: '',
  stock: '0',
  year_used: '',
  location: '',
  status: 'draft',
  main_image_url: '',
  gallery_image_urls: '',
}

function getImageUrls(value) {
  return value
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean)
}

function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && value.length <= 1000
  } catch {
    return false
  }
}

function getRequestError(error, fallback) {
  return error.response?.data?.error || fallback
}

export default function SellerProductFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)
  const productFetch = useFetch(id ? `/api/products/${id}` : '', { enabled: isEditing })
  const categoriesFetch = useFetch('/api/categories')
  const conditionsFetch = useFetch('/api/conditions')
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [saving, setSaving] = useState(false)
  const product = productFetch.data?.product
  const categories = categoriesFetch.data?.categories ?? []
  const conditions = conditionsFetch.data?.conditions ?? []
  const loading =
    categoriesFetch.loading || conditionsFetch.loading || (isEditing && productFetch.loading)
  const loadError = categoriesFetch.error || conditionsFetch.error || productFetch.error
  const activeCategories = categories.filter((category) => category.status === 'active')

  useEffect(() => {
    if (!product) return
    const mainImage =
      product.images?.find((image) => image.image_type === 'main') || product.images?.[0]
    setForm({
      category_id: String(product.category_id ?? ''),
      condition_id: String(product.condition_id ?? ''),
      name: product.name ?? '',
      description: product.description ?? '',
      price: product.price ?? '',
      stock: String(product.stock ?? 0),
      year_used: product.year_used == null ? '' : String(product.year_used),
      location: product.location ?? '',
      status: product.status ?? 'draft',
      main_image_url: mainImage?.image_url ?? '',
      gallery_image_urls: '',
    })
  }, [product])

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: '' }))
  }

  const retryLoad = () => {
    categoriesFetch.refetch()
    conditionsFetch.refetch()
    if (isEditing) productFetch.refetch()
  }

  const validateForm = () => {
    const errors = {}
    const price = Number(form.price)
    const stock = Number(form.stock)
    const galleryUrls = getImageUrls(form.gallery_image_urls)

    if (!form.name.trim()) errors.name = 'Nama produk wajib diisi.'
    if (!form.description.trim()) errors.description = 'Deskripsi wajib diisi.'
    if (!form.category_id) errors.category_id = 'Pilih kategori produk.'
    if (!form.condition_id) errors.condition_id = 'Pilih kondisi barang.'
    if (!form.location.trim()) errors.location = 'Lokasi wajib diisi.'
    if (!form.price.trim() || !Number.isFinite(price) || price <= 0) {
      errors.price = 'Harga harus berupa angka lebih dari 0.'
    }
    if (!/^\d+$/.test(form.stock) || !Number.isInteger(stock) || stock < 0) {
      errors.stock = 'Stok harus berupa bilangan bulat minimal 0.'
    }
    if (form.year_used !== '' && (!/^\d+$/.test(form.year_used) || Number(form.year_used) < 0)) {
      errors.year_used = 'Lama pemakaian harus berupa bilangan bulat minimal 0.'
    }
    if (!isEditing && !isHttpUrl(form.main_image_url.trim())) {
      errors.main_image_url = 'Masukkan URL gambar utama HTTP atau HTTPS yang valid.'
    }
    if (galleryUrls.some((url) => !isHttpUrl(url))) {
      errors.gallery_image_urls = 'Setiap URL gambar tambahan harus berupa URL HTTP atau HTTPS yang valid.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submitForm = async (event) => {
    event.preventDefault()
    setSubmitError('')
    if (!validateForm()) return
    if (isEditing && product?.status === 'sold') {
      setSubmitError('Produk yang sudah terjual tidak dapat diedit.')
      return
    }

    const galleryUrls = getImageUrls(form.gallery_image_urls)
    const payload = {
      category_id: Number(form.category_id),
      condition_id: Number(form.condition_id),
      name: form.name.trim(),
      description: form.description.trim(),
      price: form.price.trim(),
      stock: Number(form.stock),
      year_used: form.year_used === '' ? null : Number(form.year_used),
      location: form.location.trim(),
      status: form.status,
    }

    setSaving(true)
    try {
      if (isEditing) {
        await api.put(`/api/products/${id}`, payload)
        for (let index = 0; index < galleryUrls.length; index += 1) {
          try {
            await api.post(`/api/products/${id}/images`, {
              image_url: galleryUrls[index],
              image_type: 'gallery',
            })
          } catch (requestError) {
            setForm((current) => ({
              ...current,
              gallery_image_urls: galleryUrls.slice(index).join('\n'),
            }))
            throw new Error(
              `Produk berhasil diperbarui, tetapi gambar tambahan belum seluruhnya tersimpan. ${
                getRequestError(requestError, 'Gagal menambahkan gambar.')
              }`,
            )
          }
        }
      } else {
        await api.post('/api/products', {
          ...payload,
          images: [
            { image_url: form.main_image_url.trim(), image_type: 'main' },
            ...galleryUrls.map((image_url) => ({ image_url, image_type: 'gallery' })),
          ],
        })
      }
      navigate('/seller/products')
    } catch (requestError) {
      setSubmitError(
        requestError.message?.startsWith('Produk berhasil diperbarui')
          ? requestError.message
          : getRequestError(requestError, 'Gagal menyimpan produk.'),
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <LoadingSpinner label={isEditing ? 'Memuat produk...' : 'Memuat pilihan produk...'} />
      </section>
    )
  }

  if (loadError) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <ErrorMessage message={loadError} onRetry={retryLoad} />
      </section>
    )
  }

  if (isEditing && !product) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <EmptyState message="Produk tidak ditemukan" description="Produk ini tidak tersedia untuk diedit." />
      </div>
    )
  }

  if (isEditing && product.status === 'sold') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <EmptyState
          message="Produk sudah terjual"
          description="Produk berstatus terjual tidak dapat diedit."
        />
        <div className="mt-4 text-center">
          <Link to="/seller/products" className="text-sm font-medium text-emerald-700 hover:underline">
            Kembali ke produk
          </Link>
        </div>
      </div>
    )
  }

  if (activeCategories.length === 0 || conditions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <EmptyState
          message="Pilihan produk belum tersedia"
          description="Kategori aktif dan kondisi barang diperlukan untuk mengisi form produk."
        />
        <div className="mt-4 text-center">
          <Link to="/seller/products" className="text-sm font-medium text-emerald-700 hover:underline">
            Kembali ke produk
          </Link>
        </div>
      </div>
    )
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link to="/seller/products" className="text-sm font-medium text-emerald-700 hover:underline">
          ← Kembali ke produk
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">
          {isEditing ? 'Edit produk' : 'Tambah produk'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Isi informasi produk dengan data yang benar.
        </p>
      </header>

      {submitError && <ErrorMessage message={submitError} />}

      <form
        onSubmit={submitForm}
        noValidate
        className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <FormField
            label="Nama produk"
            name="name"
            value={form.name}
            onChange={updateField}
            required
            error={fieldErrors.name}
          />
          <FormField
            label="Kategori"
            name="category_id"
            as="select"
            value={form.category_id}
            onChange={updateField}
            required
            error={fieldErrors.category_id}
            options={activeCategories.map((category) => ({
              value: String(category.id),
              label: category.name,
            }))}
          />
          <FormField
            label="Kondisi barang"
            name="condition_id"
            as="select"
            value={form.condition_id}
            onChange={updateField}
            required
            error={fieldErrors.condition_id}
            options={conditions.map((condition) => ({
              value: String(condition.id),
              label: condition.name,
            }))}
          />
          <FormField
            label="Harga (Rp)"
            name="price"
            type="number"
            min="0.01"
            step="0.01"
            value={form.price}
            onChange={updateField}
            required
            error={fieldErrors.price}
          />
          <FormField
            label="Stok"
            name="stock"
            type="number"
            min="0"
            step="1"
            value={form.stock}
            onChange={updateField}
            required
            error={fieldErrors.stock}
          />
          <FormField
            label="Lama pemakaian (tahun)"
            name="year_used"
            type="number"
            min="0"
            step="1"
            value={form.year_used}
            onChange={updateField}
            error={fieldErrors.year_used}
          />
          <FormField
            label="Lokasi"
            name="location"
            value={form.location}
            onChange={updateField}
            required
            error={fieldErrors.location}
          />
          <FormField
            label="Status"
            name="status"
            as="select"
            value={form.status}
            onChange={updateField}
            options={PRODUCT_STATUSES.map((status) => ({
              value: status,
              label: labelStatus(status),
            }))}
          />
        </div>

        <FormField
          label="Deskripsi"
          name="description"
          as="textarea"
          value={form.description}
          onChange={updateField}
          required
          error={fieldErrors.description}
        />

        {!isEditing ? (
          <FormField
            label="URL gambar utama"
            name="main_image_url"
            type="url"
            value={form.main_image_url}
            onChange={updateField}
            required
            hint="Gunakan URL gambar yang diawali http:// atau https://."
            error={fieldErrors.main_image_url}
          />
        ) : (
          <div>
            <p className="text-sm font-medium text-slate-700">Gambar utama</p>
            {form.main_image_url ? (
              <a
                href={form.main_image_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block break-all text-sm text-emerald-700 hover:underline"
              >
                {form.main_image_url}
              </a>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Belum ada gambar utama.</p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Gambar yang sudah tersimpan tidak dapat diganti melalui endpoint edit produk.
            </p>
          </div>
        )}

        <FormField
          label="URL gambar tambahan"
          name="gallery_image_urls"
          as="textarea"
          value={form.gallery_image_urls}
          onChange={updateField}
          rows={3}
          hint="Opsional; satu URL HTTP/HTTPS per baris."
          error={fieldErrors.gallery_image_urls}
        />

        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
          <Link
            to="/seller/products"
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan produk'}
          </button>
        </div>
      </form>
    </section>
  )
}
