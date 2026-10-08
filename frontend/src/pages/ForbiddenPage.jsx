import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ForbiddenPage() {
  const { user } = useAuth()
  const homePath =
    user?.role === 'admin'
      ? '/admin/dashboard'
      : user?.role === 'buyer'
        ? '/buyer/dashboard'
        : '/seller/dashboard'

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="max-w-md text-center">
        <p className="text-sm font-semibold text-amber-700">403</p>
        <h1 className="mt-2 text-2xl font-bold">Akses tidak diizinkan</h1>
        <p className="mt-3 text-slate-600">
          Anda tidak memiliki akses ke halaman dashboard ini.
        </p>
        <Link
          to={homePath}
          className="mt-6 inline-flex rounded-lg bg-emerald-700 px-4 py-2.5 font-medium text-white hover:bg-emerald-800"
        >
          Kembali ke dashboard
        </Link>
      </section>
    </main>
  )
}
