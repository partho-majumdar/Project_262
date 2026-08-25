import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import PublicLayout from './layouts/PublicLayout';
import CustomerLayout from './layouts/CustomerLayout';
import SellerLayout from './layouts/SellerLayout';
import AdminLayout from './layouts/AdminLayout';

// Customer Pages
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ProfilePage from './pages/ProfilePage';
import CategoriesPage from './pages/CategoriesPage';
import CategoryDetailPage from './pages/CategoryDetailPage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import WishlistPage from './pages/WishlistPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import OrdersHistoryPage from './pages/OrdersHistoryPage';
import OrderTrackingPage from './pages/OrderTrackingPage';
import PurchaseHistoryPage from './pages/PurchaseHistoryPage';
import RewardsPage from './pages/RewardsPage';
import SettingsPage from './pages/SettingsPage';
import CustomerDashboardPage from './pages/CustomerDashboardPage';
import AiAssistantPage from './pages/AiAssistantPage';
import StorePage from './pages/StorePage';
import NotFoundPage from './pages/NotFoundPage';

// Seller Pages
import SellerRegistrationPage from './pages/SellerRegistrationPage';
import SellerDashboardPage from './pages/SellerDashboardPage';
import InventoryManagementPage from './pages/InventoryManagementPage';

// Admin Pages
import AdminDashboardPage from './pages/AdminDashboardPage';

// Protection Guard
import ProtectedRoute from './components/common/ProtectedRoute';
import RootRedirector from './components/common/RootRedirector';

export default function App() {
  return (
    <Routes>
      {/* ROOT LANDING ROUTE REDIRECTOR */}
      <Route path="/" element={<RootRedirector />} />
      <Route path="/landing" element={<Navigate to="/" replace />} />
      <Route path="/welcome" element={<Navigate to="/" replace />} />

      {/* PORTAL 0: PUBLIC PORTAL LAYOUT */}
      <Route element={<PublicLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/seller/register" element={<SellerRegistrationPage />} />
      </Route>

      {/* PORTAL 1: CUSTOMER PORTAL LAYOUT */}
      <Route element={<CustomerLayout />}>
        {/* Public Catalog Routes */}
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/categories/:slug" element={<CategoryDetailPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:slug" element={<ProductDetailPage />} />
        <Route path="/stores/:slug" element={<StorePage />} />

        {/* Authenticated Customer Protected Routes */}
        <Route 
          path="/customer/dashboard" 
          element={
            <ProtectedRoute>
              <CustomerDashboardPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <CustomerDashboardPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/home" 
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/ai-assistant" 
          element={
            <ProtectedRoute>
              <AiAssistantPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/cart" 
          element={
            <ProtectedRoute>
              <CartPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/wishlist" 
          element={
            <ProtectedRoute>
              <WishlistPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/coupons" 
          element={
            <ProtectedRoute>
              <RewardsPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/checkout" 
          element={
            <ProtectedRoute>
              <CheckoutPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/orders" 
          element={
            <ProtectedRoute>
              <OrdersHistoryPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/orders/tracking" 
          element={
            <ProtectedRoute>
              <OrderTrackingPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/orders/history" 
          element={
            <ProtectedRoute>
              <PurchaseHistoryPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/orders/confirmation/:orderNumber" 
          element={
            <ProtectedRoute>
              <OrderConfirmationPage />
            </ProtectedRoute>
          } 
        />
      </Route>

      {/* PORTAL 2: SELLER CENTRAL PORTAL LAYOUT */}
      <Route 
        element={
          <ProtectedRoute allowedRoles={['ROLE_SELLER', 'ROLE_ADMIN']}>
            <SellerLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/seller/dashboard" element={<SellerDashboardPage />} />
        <Route path="/seller/inventory" element={<InventoryManagementPage />} />
      </Route>

      {/* PORTAL 3: EXECUTIVE ADMIN COMMAND PORTAL LAYOUT */}
      <Route 
        element={
          <ProtectedRoute allowedRoles={['ROLE_ADMIN']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
      </Route>

      {/* 404 Catch All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
