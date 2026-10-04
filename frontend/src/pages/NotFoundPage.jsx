import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="text-center">
        <p className="text-sm font-semibold text-emerald-700">404</p>
        <h1 className="mt-2 text-2xl font-bold">Halaman tidak ditemukan</h1>
        <p className="mt-3 text-slate-600">
          Alamat yang Anda buka tidak tersedia.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-flex rounded-lg bg-emerald-700 px-4 py-2.5 font-medium text-white hover:bg-emerald-800"
        >
          Kembali ke halaman masuk
        </Link>
      </section>
    </main>
  )
}
