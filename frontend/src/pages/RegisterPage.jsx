import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const roleOptions = [
  {
    value: 'buyer',
    title: 'Pembeli (Buyer)',
    description: 'Belanja kebutuhan Anda dan kelola wishlist serta pesanan.',
  },
  {
    value: 'seller',
    title: 'Penjual (Seller)',
    description: 'Kelola toko, produk, dan pesanan Anda.',
  },
]

function getDashboardPath(role) {
  if (!role) return '/login'
  if (role === 'buyer') return '/buyer/dashboard'
  if (role === 'seller') return '/seller/dashboard'
  if (role === 'admin') return '/admin/dashboard'
  return '/login'
}

export default function RegisterPage() {
  const { user, register, login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'buyer',
  })
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return <Navigate to={getDashboardPath(user.role)} replace />
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setErrorMessage('')

    const trimmedName = form.name.trim()
    const trimmedEmail = form.email.trim()

    if (!trimmedName || !trimmedEmail || !form.password || !form.confirmPassword) {
      setErrorMessage('Semua field wajib diisi.')
      setSubmitting(false)
      return
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(trimmedEmail)) {
      setErrorMessage('Format email tidak valid.')
      setSubmitting(false)
      return
    }

    if (form.password.length < 8) {
      setErrorMessage('Kata sandi minimal 8 karakter.')
      setSubmitting(false)
      return
    }

    if (form.password !== form.confirmPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok.')
      setSubmitting(false)
      return
    }

    try {
      await register({
        name: trimmedName,
        email: trimmedEmail,
        phone: form.phone.trim() || undefined,
        password: form.password,
        role: form.role,
      })

      const loggedInUser = await login(trimmedEmail, form.password)

      if (loggedInUser.role === 'buyer') {
        navigate('/buyer/dashboard', { replace: true })
      } else if (loggedInUser.role === 'seller') {
        navigate('/seller/create-store', { replace: true })
      } else {
        navigate('/login', { replace: true })
      }
    } catch (error) {
      setErrorMessage(error.response?.data?.error || 'Registrasi gagal. Silakan coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <div className="mb-6">
          <p className="mb-2 text-sm font-semibold text-emerald-700">SecondLife Marketplace</p>
          <h1 className="text-2xl font-bold text-slate-900">Daftar akun baru</h1>
          <p className="mt-2 text-sm text-slate-500">
            Pilih peran Anda untuk mulai berbelanja atau menjual.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            {roleOptions.map((option) => {
              const selected = form.role === option.value

              return (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-xl border p-4 transition ${
                    selected
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={selected}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-4 w-4 rounded-full border ${
                        selected ? 'border-emerald-700 bg-emerald-700' : 'border-slate-300 bg-white'
                      }`}
                    />
                    <span className="font-medium text-slate-900">{option.title}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{option.description}</p>
                </label>
              )
            })}
          </div>

          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
              Nama lengkap
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium">
              Nomor telepon <span className="text-slate-500">(opsional)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                Kata sandi
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={8}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium">
                Konfirmasi kata sandi
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                minLength={8}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
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
            {submitting ? 'Mendaftar...' : 'Daftar'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Sudah punya akun?{' '}
          <Link to="/login" className="font-semibold text-emerald-700 hover:text-emerald-800">
            Masuk
          </Link>
        </p>
      </section>
    </main>
  )
}
