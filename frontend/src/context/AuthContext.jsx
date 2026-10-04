import { createContext, useContext, useEffect, useState } from 'react'
import { api, clearAuthTokens, getAccessToken, saveAuthTokens } from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    const restoreSession = async () => {
      if (!getAccessToken()) {
        setLoading(false)
        return
      }

      try {
        const response = await api.get('/api/auth/me')
        setUser(response.data.user)
      } catch (error) {
        if (error.response?.status === 401) {
          clearAuthTokens()
        } else {
          setAuthError(
            error.response?.data?.error || 'Sesi tidak dapat dipulihkan. Coba lagi.',
          )
        }
      } finally {
        setLoading(false)
      }
    }

    restoreSession()
  }, [])

  const login = async (email, password) => {
    setAuthError('')
    const response = await api.post('/api/auth/login', { email, password })
    saveAuthTokens(response.data.access_token, response.data.refresh_token)

    try {
      const currentUser = await api.get('/api/auth/me')
      setUser(currentUser.data.user)
      return currentUser.data.user
    } catch (error) {
      clearAuthTokens()
      setUser(null)
      throw error
    }
  }

  const logout = () => {
    clearAuthTokens()
    setUser(null)
    setAuthError('')
  }

  return (
    <AuthContext.Provider value={{ user, loading, authError, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider')
  }
  return context
}
