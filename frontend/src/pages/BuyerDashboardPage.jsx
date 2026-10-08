import DataTable from '../components/DataTable'
import EmptyState from '../components/EmptyState'
import ErrorMessage from '../components/ErrorMessage'
import LoadingSpinner from '../components/LoadingSpinner'
import StatCard from '../components/StatCard'
import useFetch from '../hooks/useFetch'
import { formatRupiah, labelStatus } from '../utils/dashboard'

function normalizeOrders(items = []) {
  return items.map((order) => ({
    ...order,
    statusLabel: labelStatus(order.status),
    totalAmount: order.total_amount ?? order.totalAmount ?? 0,
  }))
}

export default function BuyerDashboardPage() {
  const orders = useFetch('/api/orders', { params: { role: 'buyer', page: 1, per_page: 5 } })
  const wishlist = useFetch('/api/wishlist')
  const cart = useFetch('/api/cart')
  const offers = useFetch('/api/offers', { params: { role: 'buyer' } })

  const orderRows = normalizeOrders(orders.data?.orders ?? [])
  const wishlistItems = wishlist.data?.wishlist ?? []
  const cartItems = cart.data?.cart?.items ?? []
  const offerRows = offers.data?.offers ?? []

  const pendingCount = orderRows.filter((item) => item.status !== 'cancelled' && item.status !== 'completed').length
  const totalSpent = orderRows.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0)

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard pembeli</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pantau pesanan, penawaran, wishlist, dan keranjang Anda.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        {orders.loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-4">
            <LoadingSpinner label="Memuat ringkasan pembeli..." />
          </div>
        ) : (
          <>
            <StatCard
              title="Total pesanan"
              value={orders.data?.total ?? 0}
              detail="Semua pesanan yang pernah dibuat."
            />
            <StatCard
              title="Pesanan aktif"
              value={pendingCount}
              detail="Pesanan yang masih belum selesai."
            />
            <StatCard
              title="Wishlist"
              value={wishlistItems.length}
              detail="Produk yang Anda simpan."
            />
            <StatCard
              title="Total belanja"
              value={formatRupiah(totalSpent)}
              detail="Akumulasi nilai pesanan terbaru."
              highlighted
            />
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Pesanan terbaru</h2>
              <p className="mt-1 text-xs text-slate-500">Status dan total pesanan Anda.</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
              {orderRows.length} item
            </span>
          </div>
          <div className="mt-4">
            {orders.loading ? (
              <LoadingSpinner />
            ) : orders.error ? (
              <ErrorMessage message={orders.error} onRetry={orders.refetch} />
            ) : orderRows.length ? (
              <DataTable
                rows={orderRows}
                getRowKey={(row) => row.id}
                columns={[
                  { key: 'order_number', label: 'Order' },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (row) => (
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {row.statusLabel}
                      </span>
                    ),
                  },
                  {
                    key: 'totalAmount',
                    label: 'Total',
                    render: (row) => formatRupiah(row.totalAmount),
                  },
                ]}
              />
            ) : (
              <EmptyState description="Belum ada pesanan yang dibuat." />
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Wishlist</h2>
          <p className="mt-1 text-xs text-slate-500">Produk yang Anda simpan untuk dibeli nanti.</p>
          <div className="mt-4">
            {wishlist.loading ? (
              <LoadingSpinner />
            ) : wishlist.error ? (
              <ErrorMessage message={wishlist.error} onRetry={wishlist.refetch} />
            ) : wishlistItems.length ? (
              <ul className="space-y-3">
                {wishlistItems.slice(0, 5).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                    <div>
                      <p className="font-medium text-slate-800">{item.product?.name || 'Produk'}</p>
                      <p className="text-xs text-slate-500">{item.product?.status ? labelStatus(item.product.status) : 'Aktif'}</p>
                    </div>
                    <span className="font-medium text-slate-900">{formatRupiah(item.product?.price ?? 0)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState description="Wishlist Anda masih kosong." />
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Keranjang</h2>
          <p className="mt-1 text-xs text-slate-500">Jumlah item yang siap dibayar.</p>
          <div className="mt-4">
            {cart.loading ? (
              <LoadingSpinner />
            ) : cart.error ? (
              <ErrorMessage message={cart.error} onRetry={cart.refetch} />
            ) : cartItems.length ? (
              <ul className="space-y-3">
                {cartItems.slice(0, 5).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                    <div>
                      <p className="font-medium text-slate-800">{item.product?.name || 'Produk'}</p>
                      <p className="text-xs text-slate-500">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-medium text-slate-900">{formatRupiah(item.subtotal ?? 0)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState description="Keranjang Anda masih kosong." />
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Penawaran</h2>
          <p className="mt-1 text-xs text-slate-500">Perkembangan tawaran yang sedang aktif.</p>
          <div className="mt-4">
            {offers.loading ? (
              <LoadingSpinner />
            ) : offers.error ? (
              <ErrorMessage message={offers.error} onRetry={offers.refetch} />
            ) : offerRows.length ? (
              <ul className="space-y-3">
                {offerRows.slice(0, 5).map((offer) => (
                  <li key={offer.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                    <div>
                      <p className="font-medium text-slate-800">{offer.product?.name || 'Produk'}</p>
                      <p className="text-xs text-slate-500">{offer.status ? labelStatus(offer.status) : 'Status tidak tersedia'}</p>
                    </div>
                    <span className="font-medium text-slate-900">{formatRupiah(offer.amount ?? 0)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState description="Belum ada penawaran yang dibuat." />
            )}
          </div>
        </section>
      </div>
    </section>
  )
}
