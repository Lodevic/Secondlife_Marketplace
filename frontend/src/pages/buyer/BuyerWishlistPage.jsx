import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/axios'
import EmptyState from '../../components/EmptyState'
import ErrorMessage from '../../components/ErrorMessage'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatRupiah, labelStatus } from '../../utils/dashboard'

function getMainImage(product) {
  const imageUrl = product?.main_image || product?.images?.[0]?.image_url || product?.image_url
  return imageUrl || 'https://placehold.co/600x400/e2e8f0/475569?text=SecondLife'
}

export default function BuyerWishlistPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  const fetchWishlist = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await api.get('/api/wishlist')
      setItems(response.data.wishlist ?? [])
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Gagal memuat wishlist.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWishlist()
  }, [])

  const handleRemove = async (productId) => {
    const confirmed = window.confirm('Hapus produk ini dari wishlist?')
    if (!confirmed) {
      return
    }

    setBusyAction(`remove-${productId}`)
    setActionError('')
    setActionMessage('')

    try {
      await api.delete(`/api/wishlist/${productId}`)
      setItems((current) => current.filter((item) => Number(item.product?.id) !== Number(productId)))
      setActionMessage('Produk berhasil dihapus dari wishlist.')
    } catch (requestError) {
      setActionError(requestError.response?.data?.error || 'Gagal menghapus produk dari wishlist.')
    } finally {
      setBusyAction('')
    }
  }

  const handleAddToCart = async (product) => {
    if (!product || product.status !== 'active' || Number(product.stock ?? 0) <= 0) {
      return
    }

    setBusyAction(`cart-${product.id}`)
    setActionError('')
    setActionMessage('')

    try {
      await api.post('/api/cart/items', {
        product_id: Number(product.id),
        quantity: 1,
      })
      setActionMessage('Produk berhasil ditambahkan ke keranjang.')
    } catch (requestError) {
      setActionError(requestError.response?.data?.error || 'Gagal menambahkan produk ke keranjang.')
    } finally {
      setBusyAction('')
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Wishlist</h1>
          <p className="mt-1 text-sm text-slate-500">Produk yang Anda simpan untuk dibeli nanti.</p>
        </div>
        <Link to="/buyer/products" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Lanjut belanja
        </Link>
      </div>

      {actionError && <ErrorMessage message={actionError} />}
      {actionMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {actionMessage}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoadingSpinner label="Memuat wishlist..." />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <ErrorMessage message={error} onRetry={fetchWishlist} />
        </div>
      ) : items.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const product = item.product
            const productId = Number(product?.id)
            const isUnavailable = product?.status !== 'active' || Number(product?.stock ?? 0) <= 0

            return (
              <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <img src={getMainImage(product)} alt={product?.name || 'Produk wishlist'} className="h-48 w-full object-cover" />
                <div className="space-y-3 p-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Wishlist</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">{product?.name || 'Produk'}</h2>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xl font-bold text-emerald-700">{formatRupiah(product?.price ?? 0)}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      {labelStatus(product?.status || 'active')}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600">Stok: {product?.stock ?? 0}</p>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleRemove(productId)}
                      disabled={busyAction === `remove-${productId}`}
                      className="flex-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyAction === `remove-${productId}` ? 'Menghapus...' : 'Hapus'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddToCart(product)}
                      disabled={isUnavailable || busyAction === `cart-${productId}`}
                      className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {busyAction === `cart-${productId}` ? 'Menambah...' : isUnavailable ? 'Tidak tersedia' : 'Tambah keranjang'}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <EmptyState
            message="Wishlist masih kosong"
            description="Tambahkan produk yang Anda sukai untuk ditandai dan dibeli nanti."
          />
          <div className="mt-4 text-center">
            <Link
              to="/buyer/products"
              className="inline-flex rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Jelajahi produk
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
