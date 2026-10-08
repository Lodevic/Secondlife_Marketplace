import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { clearAuthTokens } from '../api/axios'

export default function LoginPage() {
  const { authError, login, logout } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState(authError)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (authError) {
      setErrorMessage(authError)
    }
  }, [authError])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setErrorMessage('')

    try {
      const user = await login(email, password)
      if (user.role === 'buyer') {
        navigate('/buyer/dashboard', { replace: true })
      } else if (user.role === 'seller') {
        navigate('/seller/dashboard', { replace: true })
      } else if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else {
        logout()
        setErrorMessage('Peran pengguna tidak valid untuk dashboard web.')
      }
    } catch (error) {
      clearAuthTokens()
      setErrorMessage(
        error.response?.data?.error || 'Login gagal. Periksa koneksi dan coba lagi.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold text-emerald-700">
            SecondLife Marketplace
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Masuk ke dashboard</h1>
          <p className="mt-2 text-sm text-slate-500">
            Masuk untuk mengakses dashboard buyer, seller, atau admin.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
              Kata sandi
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {errorMessage && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Belum punya akun?{' '}
          <Link to="/register" className="font-semibold text-emerald-700 hover:text-emerald-800">
            Daftar sekarang
          </Link>
        </p>
      </section>
    </main>
  )
}
