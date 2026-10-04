import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import PublicLayout from './layouts/PublicLayout';
import CustomerLayout from './layouts/CustomerLayout';
import SellerLayout from './layouts/SellerLayout';
import AdminLayout from './layouts/AdminLayout';

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
import CustomerSupportPage from './pages/CustomerSupportPage';
import AiAssistantPage from './pages/AiAssistantPage';
import StorePage from './pages/StorePage';
import GroupDealsPage from './pages/GroupDealsPage';
import GroupDealDetailPage from './pages/GroupDealDetailPage';
import GroupBuyGroupPage from './pages/GroupBuyGroupPage';
import GroupBuyJoinPage from './pages/GroupBuyJoinPage';
import MyGroupsPage from './pages/MyGroupsPage';
import WholesaleDealsPage from './pages/WholesaleDealsPage';
import WholesalePoolDetailPage from './pages/WholesalePoolDetailPage';
import MyWholesalePage from './pages/MyWholesalePage';
import ReverseDealsPage from './pages/ReverseDealsPage';
import ReverseOfferDetailPage from './pages/ReverseOfferDetailPage';
import MyReverseDemandPage from './pages/MyReverseDemandPage';
import GroupReverseDealsPage from './pages/GroupReverseDealsPage';
import GroupReverseDetailPage from './pages/GroupReverseDetailPage';
import GroupReverseCreatePage from './pages/GroupReverseCreatePage';
import MyGroupReversePage from './pages/MyGroupReversePage';
import GroupBuyingAuctionsPage from './pages/GroupBuyingAuctionsPage';
import GroupBuyingAuctionDetailPage from './pages/GroupBuyingAuctionDetailPage';
import MyAuctionBidsPage from './pages/MyAuctionBidsPage';
import AuctionMarketplacePage from './pages/AuctionMarketplacePage';
import ProxyAuctionDetailPage from './pages/ProxyAuctionDetailPage';
import MyBidsPage from './pages/MyBidsPage';
import NotFoundPage from './pages/NotFoundPage';

import SellerRegistrationPage from './pages/SellerRegistrationPage';
import SellerApplicationPage from './pages/SellerApplicationPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import SellerDashboardPage from './pages/SellerDashboardPage';
import SellerSupportPage from './pages/SellerSupportPage';
import InventoryManagementPage from './pages/InventoryManagementPage';

import AdminDashboardPage from './pages/AdminDashboardPage';

import ProtectedRoute, { CustomerOnlyRoute } from './components/common/ProtectedRoute';
import RootRedirector from './components/common/RootRedirector';

import { Roles } from './constants/roles';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirector />} />
      <Route path="/landing" element={<Navigate to="/" replace />} />
      <Route path="/welcome" element={<Navigate to="/" replace />} />

      <Route element={<PublicLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/seller/register" element={<SellerRegistrationPage />} />
        <Route path="/seller/apply" element={<SellerApplicationPage />} />
        <Route
          path="/seller/pending-approval"
          element={
            <ProtectedRoute>
              <PendingApprovalPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route element={<CustomerLayout />}>
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/categories/:slug" element={<CategoryDetailPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:slug" element={<ProductDetailPage />} />
        <Route path="/stores/:slug" element={<StorePage />} />

        <Route path="/group-deals" element={<GroupDealsPage />} />
        <Route path="/group-deals/:campaignId" element={<GroupDealDetailPage />} />
        <Route path="/group-buy/groups/:groupId" element={<GroupBuyGroupPage />} />
        <Route path="/group-buy/join/:inviteCode" element={<GroupBuyJoinPage />} />
        <Route
          path="/group-buy/my-groups"
          element={
            <CustomerOnlyRoute>
              <MyGroupsPage />
            </CustomerOnlyRoute>
          }
        />

        <Route path="/wholesale" element={<WholesaleDealsPage />} />
        <Route path="/wholesale/pools/:poolId" element={<WholesalePoolDetailPage />} />
        <Route
          path="/wholesale/my-reservations"
          element={
            <CustomerOnlyRoute>
              <MyWholesalePage />
            </CustomerOnlyRoute>
          }
        />

        <Route path="/reverse-group-buying" element={<ReverseDealsPage />} />
        <Route path="/reverse-group-buying/offers/:offerId" element={<ReverseOfferDetailPage />} />
        <Route
          path="/reverse-group-buying/my-demand"
          element={
            <CustomerOnlyRoute>
              <MyReverseDemandPage />
            </CustomerOnlyRoute>
          }
        />

        {/* Customer-created group buying, where customers pool a quantity first and sellers
            bid for the whole block. The mirror image of the seller-initiated route above. */}
        <Route path="/group-reverse" element={<GroupReverseDealsPage />} />
        <Route path="/group-reverse/:demandId" element={<GroupReverseDetailPage />} />
        <Route
          path="/group-reverse/new"
          element={
            <CustomerOnlyRoute>
              <GroupReverseCreatePage />
            </CustomerOnlyRoute>
          }
        />
        <Route
          path="/group-reverse/my/demands"
          element={
            <CustomerOnlyRoute>
              <MyGroupReversePage />
            </CustomerOnlyRoute>
          }
        />

        {/* Sealed-bid proxy auctions. A separate mechanism from the collective
            /group-buying-auctions above, which clears many customers at a shared quantity. */}
        <Route path="/auctions" element={<AuctionMarketplacePage />} />
        <Route path="/auctions/:auctionId" element={<ProxyAuctionDetailPage />} />
        <Route
          path="/auctions/my-bids"
          element={
            <CustomerOnlyRoute>
              <MyBidsPage />
            </CustomerOnlyRoute>
          }
        />

        <Route path="/group-buying-auctions" element={<GroupBuyingAuctionsPage />} />
        <Route path="/group-buying-auctions/:auctionId" element={<GroupBuyingAuctionDetailPage />} />
        <Route
          path="/group-buying-auctions/my-bids"
          element={
            <CustomerOnlyRoute>
              <MyAuctionBidsPage />
            </CustomerOnlyRoute>
          }
        />

        <Route
          path="/customer/dashboard"
          element={
            <CustomerOnlyRoute>
              <CustomerDashboardPage />
            </CustomerOnlyRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <CustomerOnlyRoute>
              <CustomerDashboardPage />
            </CustomerOnlyRoute>
          }
        />
        <Route
          path="/support"
          element={
            <CustomerOnlyRoute>
              <CustomerSupportPage />
            </CustomerOnlyRoute>
          }
        />
        <Route
          path="/home"
          element={
            <CustomerOnlyRoute>
              <HomePage />
            </CustomerOnlyRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <CustomerOnlyRoute>
              <ProfilePage />
            </CustomerOnlyRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <CustomerOnlyRoute>
              <SettingsPage />
            </CustomerOnlyRoute>
          }
        />
        <Route
          path="/ai-assistant"
          element={
            <CustomerOnlyRoute>
              <AiAssistantPage />
            </CustomerOnlyRoute>
          }
        />
        <Route
          path="/cart"
          element={
            <CustomerOnlyRoute>
              <CartPage />
            </CustomerOnlyRoute>
          }
        />
        <Route
          path="/wishlist"
          element={
            <CustomerOnlyRoute>
              <WishlistPage />
            </CustomerOnlyRoute>
          }
        />
        <Route
          path="/coupons"
          element={
            <CustomerOnlyRoute>
              <RewardsPage />
            </CustomerOnlyRoute>
          }
        />
        <Route
          path="/checkout"
          element={
            <CustomerOnlyRoute>
              <CheckoutPage />
            </CustomerOnlyRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <CustomerOnlyRoute>
              <OrdersHistoryPage />
            </CustomerOnlyRoute>
          }
        />
        <Route
          path="/orders/tracking"
          element={
            <CustomerOnlyRoute>
              <OrderTrackingPage />
            </CustomerOnlyRoute>
          }
        />
        <Route
          path="/orders/history"
          element={
            <CustomerOnlyRoute>
              <PurchaseHistoryPage />
            </CustomerOnlyRoute>
          }
        />
        <Route
          path="/orders/confirmation/:orderNumber"
          element={
            <CustomerOnlyRoute>
              <OrderConfirmationPage />
            </CustomerOnlyRoute>
          }
        />
      </Route>

      <Route
        element={
          <ProtectedRoute
            allowedRoles={[Roles.SELLER, Roles.ADMIN]}
            requireApprovedSeller
          >
            <SellerLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/seller/dashboard" element={<SellerDashboardPage />} />
        <Route path="/seller/inventory" element={<InventoryManagementPage />} />
        <Route path="/seller/support" element={<SellerSupportPage />} />
      </Route>

      <Route
        element={
          <ProtectedRoute allowedRoles={[Roles.ADMIN]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
