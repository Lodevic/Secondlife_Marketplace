import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/axios'
import EmptyState from '../../components/EmptyState'
import ErrorMessage from '../../components/ErrorMessage'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatRupiah } from '../../utils/dashboard'

const PAGE_SIZE = 12

function getProductImage(product) {
  const images = Array.isArray(product?.images) ? product.images : []
  const mainImage = images.find((image) => image.image_type === 'main') || images[0]
  return mainImage?.image_url || 'https://placehold.co/600x400/e2e8f0/475569?text=SecondLife'
}

export default function BuyerProductsPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [conditions, setConditions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, per_page: PAGE_SIZE })
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [conditionId, setConditionId] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [wishlistIds, setWishlistIds] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [busyAction, setBusyAction] = useState('')

  const filters = useMemo(
    () => ({
      search,
      category_id: categoryId || undefined,
      condition_id: conditionId || undefined,
      min_price: minPrice || undefined,
      max_price: maxPrice || undefined,
    }),
    [search, categoryId, conditionId, minPrice, maxPrice],
  )

  useEffect(() => {
    const fetchCatalogOptions = async () => {
      try {
        const [categoriesResponse, conditionsResponse] = await Promise.all([
          api.get('/api/categories'),
          api.get('/api/conditions'),
        ])
        setCategories(categoriesResponse.data.categories ?? [])
        setConditions(conditionsResponse.data.conditions ?? [])
      } catch (catalogError) {
        setError(catalogError.response?.data?.error || 'Gagal memuat filter produk.')
      }
    }

    fetchCatalogOptions()
  }, [])

  useEffect(() => {
    const fetchWishlist = async () => {
      try {
        const response = await api.get('/api/wishlist')
        setWishlistIds((response.data.wishlist ?? []).map((item) => Number(item.product?.id)))
      } catch {
        setWishlistIds([])
      }
    }

    fetchWishlist()
  }, [])

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true)
      setError('')
      setActionError('')

      try {
        const response = await api.get('/api/products', {
          params: {
            page,
            per_page: PAGE_SIZE,
            status: 'active',
            ...filters,
          },
        })

        setProducts(response.data.products ?? [])
        setPagination({
          page: response.data.page ?? 1,
          pages: response.data.pages ?? 1,
          total: response.data.total ?? 0,
          per_page: response.data.per_page ?? PAGE_SIZE,
        })
      } catch (fetchError) {
        setError(fetchError.response?.data?.error || 'Gagal memuat produk.')
        setProducts([])
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [page, filters, refreshKey])

  const canResetFilters = Boolean(search || categoryId || conditionId || minPrice || maxPrice)

  const handleResetFilters = () => {
    setSearch('')
    setCategoryId('')
    setConditionId('')
    setMinPrice('')
    setMaxPrice('')
    setPage(1)
  }

  const handleWishlist = async (product) => {
    setBusyAction(`wishlist-${product.id}`)
    setActionError('')
    setActionMessage('')

    try {
      await api.post('/api/wishlist', { product_id: Number(product.id) })
      setWishlistIds((current) => [...new Set([...current, Number(product.id)])])
      setActionMessage('Produk berhasil ditambahkan ke wishlist.')
      setRefreshKey((current) => current + 1)
    } catch (requestError) {
      setActionError(requestError.response?.data?.error || 'Gagal menambahkan produk ke wishlist.')
    } finally {
      setBusyAction('')
    }
  }

  const handleAddToCart = async (product) => {
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
      setActionError(requestError.response?.data?.error || 'Gagal menambahkan ke keranjang.')
    } finally {
      setBusyAction('')
    }
  }

  const handleStartChat = async (product) => {
    if (!product?.seller_id) {
      return
    }

    setBusyAction(`chat-${product.id}`)
    setActionError('')
    setActionMessage('')

    try {
      const response = await api.post('/api/chats', {
        seller_id: Number(product.seller_id),
        product_id: Number(product.id),
      })
      const chatId = response.data?.chat?.id
      if (chatId) {
        navigate(`/buyer/chats/${chatId}`)
      }
    } catch (requestError) {
      setActionError(requestError.response?.data?.error || 'Gagal membuka chat dengan penjual.')
    } finally {
      setBusyAction('')
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Belanja</h1>
          <p className="mt-1 text-sm text-slate-500">Temukan produk yang sesuai dengan kebutuhan Anda.</p>
        </div>
        <Link to="/buyer/wishlist" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
          Lihat wishlist
        </Link>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari produk..."
            className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">Semua kategori</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={conditionId}
            onChange={(event) => setConditionId(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">Semua kondisi</option>
            {conditions.map((condition) => (
              <option key={condition.id} value={condition.id}>
                {condition.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              placeholder="Harga min"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
            <input
              type="number"
              min="0"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder="Harga max"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
        </div>

        {canResetFilters && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleResetFilters}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset filter
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <ErrorMessage message={actionError} />
      )}
      {actionMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {actionMessage}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoadingSpinner label="Memuat produk..." />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <ErrorMessage message={error} onRetry={() => {
            setPage(1)
            setRefreshKey((current) => current + 1)
          }} />
        </div>
      ) : products.length ? (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => {
              const productId = Number(product.id)
              const inWishlist = wishlistIds.includes(productId)
              const isSoldOut = Number(product.stock ?? 0) <= 0 || product.status !== 'active'
              const hasSellerInfo = Boolean(product.seller_id)

              return (
                <article key={product.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <img
                    src={getProductImage(product)}
                    alt={product.name}
                    className="h-48 w-full object-cover"
                  />
                  <div className="space-y-3 p-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                        {product.category_name || 'Produk'}
                      </p>
                      <h2 className="mt-1 line-clamp-2 text-lg font-semibold text-slate-900">{product.name}</h2>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xl font-bold text-emerald-700">
                        {formatRupiah(product.price ?? 0)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        {product.stock ?? 0} stok
                      </span>
                    </div>

                    <div className="space-y-1 text-sm text-slate-600">
                      <p>Lokasi: {product.location || 'Belum diketahui'}</p>
                      <p>Kondisi: {product.condition_name || product.condition?.name || 'Belum ditentukan'}</p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleWishlist(product)}
                        disabled={inWishlist || busyAction === `wishlist-${product.id}`}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                          inWishlist
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-emerald-600 text-emerald-700 hover:bg-emerald-50'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {busyAction === `wishlist-${product.id}` ? 'Memproses...' : inWishlist ? 'Sudah di wishlist' : 'Wishlist'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddToCart(product)}
                        disabled={isSoldOut || busyAction === `cart-${product.id}`}
                        className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {busyAction === `cart-${product.id}` ? 'Menambah...' : 'Tambah keranjang'}
                      </button>
                    </div>

                    {hasSellerInfo && (
                      <button
                        type="button"
                        onClick={() => handleStartChat(product)}
                        disabled={busyAction === `chat-${product.id}`}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction === `chat-${product.id}` ? 'Membuka chat...' : 'Chat penjual'}
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Sebelumnya
              </button>
              <span className="text-sm text-slate-600">
                Halaman {page} dari {pagination.pages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))}
                disabled={page >= pagination.pages}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Selanjutnya
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <EmptyState
            message="Produk tidak ditemukan"
            description="Coba ubah kata kunci atau filter yang Anda gunakan."
          />
        </div>
      )}
    </section>
  )
}
