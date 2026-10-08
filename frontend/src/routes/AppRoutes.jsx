import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import ProtectedRoute from '../components/ProtectedRoute'
import AdminDashboardPage from '../pages/AdminDashboardPage'
import BuyerDashboardPage from '../pages/BuyerDashboardPage'
import LoginPage from '../pages/LoginPage'
import NotFoundPage from '../pages/NotFoundPage'
import RegisterPage from '../pages/RegisterPage'
import SellerDashboardPage from '../pages/SellerDashboardPage'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/buyer/dashboard"
        element={
          <ProtectedRoute allowedRoles={['buyer']}>
            <DashboardLayout>
              <BuyerDashboardPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/seller/dashboard"
        element={
          <ProtectedRoute allowedRoles={['seller']}>
            <DashboardLayout>
              <SellerDashboardPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <DashboardLayout>
              <AdminDashboardPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
