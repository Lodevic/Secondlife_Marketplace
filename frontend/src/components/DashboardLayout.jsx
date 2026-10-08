import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const roleMenus = {
  buyer: [
    { label: 'Dashboard', path: '/buyer/dashboard', active: true },
    { label: 'Belanja', path: '/buyer/products', active: true },
    { label: 'Wishlist', path: '/buyer/wishlist', active: true },
    { label: 'Keranjang', path: '/buyer/cart', active: true },
    { label: 'Pesanan', path: '/buyer/orders', active: true },
    { label: 'Chat', path: '/buyer/chats', active: true },
    { label: 'Penawaran', active: false },
  ],
  seller: [
    { label: 'Dashboard', path: '/seller/dashboard', active: true },
    { label: 'Produk', active: false },
    { label: 'Pesanan', active: false },
    { label: 'Toko', active: false },
  ],
  admin: [
    { label: 'Dashboard', path: '/admin/dashboard', active: true },
    { label: 'Pengguna', active: false },
    { label: 'Produk', active: false },
    { label: 'Pesanan', active: false },
    { label: 'Laporan', active: false },
  ],
}

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const menus = roleMenus[user.role] || []

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="w-full border-b border-slate-200 bg-white p-5 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="mb-5 text-lg font-bold text-emerald-700">
          SecondLife
          <span className="block text-xs font-medium text-slate-500">
            Marketplace
          </span>
        </div>
        <nav aria-label="Menu dashboard" className="flex gap-2 overflow-x-auto md:block md:space-y-1">
          {menus.map((menu) =>
            menu.active ? (
              <NavLink
                key={menu.label}
                to={menu.path}
                className={({ isActive }) =>
                  `block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                {menu.label}
              </NavLink>
            ) : (
              <div
                key={menu.label}
                className="flex min-w-max items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400"
                aria-disabled="true"
              >
                <span>{menu.label}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">
                  Segera hadir
                </span>
              </div>
            ),
          )}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-3 md:px-8">
          <span className="text-sm text-slate-500">
            {user.role === 'admin'
              ? 'Administrator'
              : user.role === 'seller'
                ? 'Seller'
                : 'Pembeli'}
          </span>
          <div className="flex items-center gap-3">
            <span className="max-w-40 truncate text-sm font-medium text-slate-700">
              {user.name}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Keluar
            </button>
          </div>
        </header>
        <main className="p-5 md:p-8">{children}</main>
      </div>
    </div>
  )
}
