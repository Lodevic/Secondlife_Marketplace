import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/axios'
import EmptyState from '../../components/EmptyState'
import ErrorMessage from '../../components/ErrorMessage'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatRupiah } from '../../utils/dashboard'

const PAYMENT_METHODS = [{ value: 'transfer', label: 'Transfer bank (simulasi)' }]

const EMPTY_ADDRESS = {
  label: '',
  recipient_name: '',
  phone: '',
  address: '',
  city: '',
  province: '',
  postal_code: '',
  is_default: false,
}

function getErrorMessage(error, fallback) {
  return error.response?.data?.error || fallback
}

export default function BuyerCartPage() {
  const [cart, setCart] = useState(null)
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [busyAction, setBusyAction] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [preview, setPreview] = useState(null)
  const [addressId, setAddressId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('transfer')
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS)
  const [completedOrders, setCompletedOrders] = useState(null)
  const items = cart?.items ?? []

  useEffect(() => {
    let active = true

    const loadCartAndAddresses = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const [cartResponse, addressesResponse] = await Promise.all([
          api.get('/api/cart'),
          api.get('/api/addresses'),
        ])
        if (!active) return

        setCart(cartResponse.data.cart)
        const loadedAddresses = addressesResponse.data.addresses ?? []
        setAddresses(loadedAddresses)
        setAddressId((current) => (
          loadedAddresses.some((address) => String(address.id) === current)
            ? current
            : String(loadedAddresses.find((address) => address.is_default)?.id ?? loadedAddresses[0]?.id ?? '')
        ))
      } catch (error) {
        if (active) {
          setLoadError(getErrorMessage(error, 'Gagal memuat keranjang dan alamat.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadCartAndAddresses()
    return () => {
      active = false
    }
  }, [refreshKey])

  const updateQuantity = async (item, quantity) => {
    setBusyAction(`quantity-${item.id}`)
    setActionError('')
    setActionMessage('')
    try {
      const response = await api.patch(`/api/cart/items/${item.id}`, { quantity })
      setCart(response.data.cart)
      setPreview(null)
    } catch (error) {
      setActionError(getErrorMessage(error, 'Gagal mengubah jumlah produk.'))
    } finally {
      setBusyAction('')
    }
  }

  const removeItem = async (item) => {
    if (!window.confirm(`Hapus "${item.product?.name || 'produk'}" dari keranjang?`)) return

    setBusyAction(`remove-${item.id}`)
    setActionError('')
    setActionMessage('')
    try {
      const response = await api.delete(`/api/cart/items/${item.id}`)
      setCart(response.data.cart)
      setPreview(null)
      setActionMessage('Produk dihapus dari keranjang.')
    } catch (error) {
      setActionError(getErrorMessage(error, 'Gagal menghapus produk dari keranjang.'))
    } finally {
      setBusyAction('')
    }
  }

  const clearCart = async () => {
    if (!window.confirm('Hapus semua produk dari keranjang?')) return

    setBusyAction('clear')
    setActionError('')
    setActionMessage('')
    try {
      const response = await api.delete('/api/cart')
      setCart(response.data.cart ?? { items: [], total: '0.00', current_total: '0.00' })
      setPreview(null)
      setActionMessage('Keranjang berhasil dikosongkan.')
    } catch (error) {
      setActionError(getErrorMessage(error, 'Gagal mengosongkan keranjang.'))
    } finally {
      setBusyAction('')
    }
  }

  const loadCheckoutPreview = async () => {
    setBusyAction('preview')
    setActionError('')
    setActionMessage('')
    try {
      const response = await api.post('/api/checkout/preview')
      setPreview(response.data)
    } catch (error) {
      setPreview(null)
      setActionError(getErrorMessage(error, 'Gagal menyiapkan checkout.'))
    } finally {
      setBusyAction('')
    }
  }

  const createAddress = async (event) => {
    event.preventDefault()
    setBusyAction('address')
    setActionError('')
    setActionMessage('')
    try {
      const response = await api.post('/api/addresses', {
        ...addressForm,
        is_default: addresses.length === 0 || addressForm.is_default,
      })
      const createdAddress = response.data.address
      const updatedAddresses = [
        ...(createdAddress.is_default
          ? addresses.map((address) => ({ ...address, is_default: false }))
          : addresses),
        createdAddress,
      ]
      setAddresses(updatedAddresses)
      setAddressId(String(createdAddress.id))
      setAddressForm(EMPTY_ADDRESS)
      setShowAddressForm(false)
      setActionMessage('Alamat berhasil disimpan.')
    } catch (error) {
      setActionError(getErrorMessage(error, 'Gagal menyimpan alamat.'))
    } finally {
      setBusyAction('')
    }
  }

  const submitCheckout = async () => {
    if (!preview?.can_checkout || !addressId || !paymentMethod) return

    setBusyAction('checkout')
    setActionError('')
    setActionMessage('')
    try {
      const response = await api.post('/api/orders/checkout', {
        address_id: Number(addressId),
        payment_method: paymentMethod,
      })
      setCompletedOrders(response.data.orders ?? [])
      setCart({ items: [], total: '0.00', current_total: '0.00' })
      setPreview(null)
    } catch (error) {
      setActionError(getErrorMessage(error, 'Checkout gagal diproses.'))
    } finally {
      setBusyAction('')
    }
  }

  if (completedOrders) {
    return (
      <section className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Checkout berhasil</h1>
          <p className="mt-1 text-sm text-slate-600">
            Pembayaran masih simulasi dan pesanan menunggu konfirmasi admin.
          </p>
        </header>
        <div className="space-y-3">
          {completedOrders.map((order) => (
            <article key={order.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Nomor pesanan</p>
                  <p className="font-semibold text-slate-900">{order.order_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Total pesanan</p>
                  <p className="text-lg font-bold text-emerald-700">{formatRupiah(order.total_amount)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
        <Link
          to="/buyer/orders"
          className="inline-flex rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
        >
          Lihat pesanan
        </Link>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Keranjang</h1>
          <p className="mt-1 text-sm text-slate-500">Tinjau produk dan lanjutkan ke checkout.</p>
        </div>
        <Link to="/buyer/products" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
          Lanjut belanja
        </Link>
      </header>

      {actionError && <ErrorMessage message={actionError} />}
      {actionMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {actionMessage}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoadingSpinner label="Memuat keranjang..." />
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <ErrorMessage message={loadError} onRetry={() => setRefreshKey((current) => current + 1)} />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <EmptyState message="Keranjang masih kosong" description="Pilih produk untuk mulai berbelanja." />
          <div className="mt-4 text-center">
            <Link
              to="/buyer/products"
              className="inline-flex rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Jelajahi produk
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {items.map((item) => {
              const currentPrice = item.product?.price ?? item.price_snapshot
              const priceChanged = Number(currentPrice) !== Number(item.price_snapshot)
              const itemBusy = busyAction === `quantity-${item.id}` || busyAction === `remove-${item.id}`

              return (
                <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-slate-900">{item.product?.name || 'Produk'}</h2>
                      <p className="mt-1 text-sm text-slate-600">Harga sekarang: {formatRupiah(currentPrice)}</p>
                      {priceChanged && (
                        <p className="mt-1 text-sm text-amber-700">
                          Harga berubah dari {formatRupiah(item.price_snapshot)} menjadi {formatRupiah(currentPrice)}.
                        </p>
                      )}
                      <p className="mt-1 text-sm text-slate-600">
                        Subtotal: {formatRupiah(item.current_subtotal ?? item.subtotal)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item, item.quantity - 1)}
                        disabled={item.quantity <= 1 || itemBusy}
                        aria-label={`Kurangi jumlah ${item.product?.name || 'produk'}`}
                        className="h-9 w-9 rounded-lg border border-slate-300 text-lg text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        −
                      </button>
                      <span className="min-w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item, item.quantity + 1)}
                        disabled={itemBusy}
                        aria-label={`Tambah jumlah ${item.product?.name || 'produk'}`}
                        className="h-9 w-9 rounded-lg border border-slate-300 text-lg text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item)}
                        disabled={itemBusy}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-sm text-slate-500">Total keranjang (harga sekarang)</p>
              <p className="text-xl font-bold text-emerald-700">
                {formatRupiah(cart?.current_total ?? cart?.total ?? '0')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={clearCart}
                disabled={busyAction === 'clear'}
                className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {busyAction === 'clear' ? 'Menghapus...' : 'Kosongkan keranjang'}
              </button>
              <button
                type="button"
                onClick={loadCheckoutPreview}
                disabled={busyAction === 'preview'}
                className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {busyAction === 'preview' ? 'Memeriksa...' : 'Lanjut ke checkout'}
              </button>
            </div>
          </div>

          {preview && (
            <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Ringkasan checkout</h2>
                <p className="mt-1 text-sm text-slate-500">Harga dan subtotal mengikuti hasil pemeriksaan backend.</p>
              </div>

              {preview.stores?.map((store) => (
                <div key={store.store_id} className="rounded-lg border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-800">{store.store_name}</h3>
                  <ul className="mt-3 divide-y divide-slate-100">
                    {store.items?.map((storeItem) => (
                      <li key={storeItem.item_id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                        <span className="text-slate-700">
                          {storeItem.product_name} × {storeItem.quantity} · {formatRupiah(storeItem.current_price)}
                        </span>
                        <span className="font-medium text-slate-900">{formatRupiah(storeItem.subtotal)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-sm font-semibold">
                    <span>Subtotal toko</span>
                    <span>{formatRupiah(store.subtotal)}</span>
                  </div>
                </div>
              ))}

              <div className="flex justify-between border-t border-slate-200 pt-4 font-semibold">
                <span>Total preview</span>
                <span>{formatRupiah(preview.total)}</span>
              </div>

              {preview.warnings?.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <h3 className="font-medium text-amber-900">Peringatan checkout</h3>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-800">
                    {preview.warnings.map((warning, index) => <li key={`${warning.item_id}-${index}`}>{warning.message}</li>)}
                  </ul>
                </div>
              )}

              {!preview.can_checkout && (
                <ErrorMessage
                  message={`Checkout belum dapat dilakukan: ${preview.warnings?.map((warning) => warning.message).join('; ') || 'periksa kembali produk di keranjang.'}`}
                />
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Alamat pengiriman
                  {addresses.length ? (
                    <select
                      value={addressId}
                      onChange={(event) => setAddressId(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    >
                      {addresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.label} — {address.recipient_name}, {address.city}
                          {address.is_default ? ' (Utama)' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="mt-1 block text-sm font-normal text-slate-500">Belum ada alamat tersimpan.</span>
                  )}
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Metode pembayaran
                  <select
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method.value} value={method.value}>{method.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              {!showAddressForm && addresses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAddressForm(true)}
                  className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                >
                  {addresses.length ? 'Tambah alamat baru' : 'Tambah alamat'}
                </button>
              )}

              {(showAddressForm || addresses.length === 0) && (
                <form onSubmit={createAddress} className="space-y-3 rounded-lg border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-900">Alamat baru</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ['label', 'Label alamat', 'Rumah'],
                      ['recipient_name', 'Nama penerima', 'Nama lengkap'],
                      ['phone', 'Nomor telepon', '08...'],
                      ['city', 'Kota', 'Kota'],
                      ['province', 'Provinsi', 'Provinsi'],
                      ['postal_code', 'Kode pos', 'Kode pos'],
                    ].map(([field, label, placeholder]) => (
                      <label key={field} className="text-sm font-medium text-slate-700">
                        {label}
                        <input
                          required
                          value={addressForm[field]}
                          onChange={(event) => setAddressForm((current) => ({ ...current, [field]: event.target.value }))}
                          placeholder={placeholder}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                        />
                      </label>
                    ))}
                    <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                      Alamat lengkap
                      <textarea
                        required
                        value={addressForm.address}
                        onChange={(event) => setAddressForm((current) => ({ ...current, address: event.target.value }))}
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={addressForm.is_default || addresses.length === 0}
                      disabled={addresses.length === 0}
                      onChange={(event) => setAddressForm((current) => ({ ...current, is_default: event.target.checked }))}
                      className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                    />
                    Jadikan alamat utama
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={busyAction === 'address'}
                      className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      {busyAction === 'address' ? 'Menyimpan...' : 'Simpan alamat'}
                    </button>
                    {addresses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAddressForm(false)}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Batal
                      </button>
                    )}
                  </div>
                </form>
              )}

              <button
                type="button"
                onClick={submitCheckout}
                disabled={!preview.can_checkout || !addressId || !paymentMethod || busyAction === 'checkout'}
                className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {busyAction === 'checkout' ? 'Memproses pesanan...' : 'Bayar dan buat pesanan'}
              </button>
            </section>
          )}
        </>
      )}
    </section>
  )
}
