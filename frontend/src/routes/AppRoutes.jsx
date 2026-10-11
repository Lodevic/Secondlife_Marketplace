import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import ProtectedRoute from '../components/ProtectedRoute'
import AdminDashboardPage from '../pages/AdminDashboardPage'
import BuyerDashboardPage from '../pages/BuyerDashboardPage'
import BuyerCartPage from '../pages/buyer/BuyerCartPage'
import BuyerChatPage from '../pages/buyer/BuyerChatPage'
import BuyerOrderDetailPage from '../pages/buyer/BuyerOrderDetailPage'
import BuyerOrdersPage from '../pages/buyer/BuyerOrdersPage'
import BuyerProductsPage from '../pages/buyer/BuyerProductsPage'
import BuyerWishlistPage from '../pages/buyer/BuyerWishlistPage'
import LoginPage from '../pages/LoginPage'
import NotFoundPage from '../pages/NotFoundPage'
import RegisterPage from '../pages/RegisterPage'
import SellerDashboardPage from '../pages/SellerDashboardPage'
import SellerOrderDetailPage from '../pages/seller/SellerOrderDetailPage'
import SellerOrdersPage from '../pages/seller/SellerOrdersPage'
import SellerProductFormPage from '../pages/seller/SellerProductFormPage'
import SellerProductsPage from '../pages/seller/SellerProductsPage'
import SellerStorePage from '../pages/seller/SellerStorePage'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/buyer/products" element={<ProtectedRoute allowedRoles={['buyer']}><DashboardLayout><BuyerProductsPage /></DashboardLayout></ProtectedRoute>} />
      <Route path="/buyer/wishlist" element={<ProtectedRoute allowedRoles={['buyer']}><DashboardLayout><BuyerWishlistPage /></DashboardLayout></ProtectedRoute>} />
      <Route path="/buyer/cart" element={<ProtectedRoute allowedRoles={['buyer']}><DashboardLayout><BuyerCartPage /></DashboardLayout></ProtectedRoute>} />
      <Route path="/buyer/orders" element={<ProtectedRoute allowedRoles={['buyer']}><DashboardLayout><BuyerOrdersPage /></DashboardLayout></ProtectedRoute>} />
      <Route path="/buyer/orders/:id" element={<ProtectedRoute allowedRoles={['buyer']}><DashboardLayout><BuyerOrderDetailPage /></DashboardLayout></ProtectedRoute>} />
      <Route path="/buyer/chats" element={<ProtectedRoute allowedRoles={['buyer']}><DashboardLayout><BuyerChatPage /></DashboardLayout></ProtectedRoute>} />
      <Route path="/buyer/chats/:id" element={<ProtectedRoute allowedRoles={['buyer']}><DashboardLayout><BuyerChatPage /></DashboardLayout></ProtectedRoute>} />
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
        path="/seller/products"
        element={
          <ProtectedRoute allowedRoles={['seller']}>
            <DashboardLayout>
              <SellerProductsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/seller/products/new"
        element={
          <ProtectedRoute allowedRoles={['seller']}>
            <DashboardLayout>
              <SellerProductFormPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/seller/products/:id/edit"
        element={
          <ProtectedRoute allowedRoles={['seller']}>
            <DashboardLayout>
              <SellerProductFormPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/seller/orders"
        element={
          <ProtectedRoute allowedRoles={['seller']}>
            <DashboardLayout>
              <SellerOrdersPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/seller/orders/:id"
        element={
          <ProtectedRoute allowedRoles={['seller']}>
            <DashboardLayout>
              <SellerOrderDetailPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/seller/store"
        element={
          <ProtectedRoute allowedRoles={['seller']}>
            <DashboardLayout>
              <SellerStorePage />
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
