import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import MobileContainer from './components/MobileContainer';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuthStore } from './stores';
import { db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Hammer } from 'lucide-react';

// Import All 11 Local Marketplace Pages
import Home from './pages/Home';
import Shop from './pages/Shop';
import CategoryPage from './pages/CategoryPage';
import TopRankings from './pages/TopRankings';
import BulkSaver from './pages/BulkSaver';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderSuccess from './pages/OrderSuccess';
import Account from './pages/Account';

import MyOrders from './pages/MyOrders';
import OrderDetail from './pages/OrderDetail';
import DisputePage from './pages/Dispute';

import Wishlist from './pages/Wishlist';
import FollowedStores from './pages/FollowedStores';
import Coupons from './pages/Coupons';
import SaleCoupons from './pages/SaleCoupons';

import Messages from './pages/Messages';
import ChatDetail from './pages/ChatDetail';
import MessageOrders from './pages/MessageOrders';
import MessagePromotions from './pages/MessagePromotions';
import NotificationSettings from './pages/NotificationSettings';
import Settings from './pages/Settings';
import EditProfile from './pages/EditProfile';
import Addresses from './pages/Addresses';
import RecentlyViewed from './pages/RecentlyViewed';
import Search from './pages/Search';
import CameraSearch from './pages/CameraSearch';
import SellerDashboard from './pages/SellerDashboard';
import SellerSetup from './pages/SellerSetup';
import AdminPanel from './pages/AdminPanel';

// Import Coins & Loyalty Rewards Pages
import CoinsDashboard from './pages/CoinsDashboard';
import PlayEarn from './pages/PlayEarn';
import GoGoMatch from './pages/GoGoMatch';
import MergeBoss from './pages/MergeBoss';
import Leaderboard from './pages/Leaderboard';

// Import Auth System Pages
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyOtp from './pages/VerifyOtp';
import ForgotPassword from './pages/ForgotPassword';
import CompleteProfile from './pages/CompleteProfile';

export default function App() {
  const { checkAuthSession, user } = useAuthStore();
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    // Initial session loaded via verified Http cookies
    checkAuthSession();

    // Listen for maintenance configurations dynamically
    const unsubscribe = onSnapshot(doc(db, 'config', 'appSettings'), (snap) => {
      if (snap.exists()) {
        setMaintenance(snap.data().maintenanceMode === true);
      }
    }, (error) => {
      console.warn("Could not load global configs: ", error);
    });

    return () => unsubscribe();
  }, [checkAuthSession]);

  if (maintenance && user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans">
        <div className="w-16 h-16 bg-rose-600/20 border border-rose-500/30 rounded-3xl flex items-center justify-center mb-6 animate-pulse">
          <Hammer className="w-7 h-7 text-rose-500" />
        </div>
        <h1 className="text-lg font-black uppercase tracking-tight mb-2">System Maintenance</h1>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed mb-6 font-semibold">
          🔧 ShopEasy is under maintenance. Overhaul checks are currently ongoing. We will be back online soon!
        </p>
        <span className="text-[9.5px] uppercase font-black tracking-widest text-slate-500">ShopEasy Systems Administration</span>
      </div>
    );
  }

  return (
    <Router>
      <MobileContainer>
        <Routes>
          {/* Public Views */}
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/shop/category/:slug" element={<CategoryPage />} />
          <Route path="/shop/rankings" element={<TopRankings />} />
          <Route path="/shop/bulk" element={<BulkSaver />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/settings" element={<Settings />} />
          <Route 
            path="/settings/profile" 
            element={
              <ProtectedRoute>
                <EditProfile />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings/addresses" 
            element={
              <ProtectedRoute>
                <Addresses />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings/viewed" 
            element={
              <ProtectedRoute>
                <RecentlyViewed />
              </ProtectedRoute>
            } 
          />
          <Route path="/search" element={<Search />} />
          <Route path="/search/camera" element={<CameraSearch />} />
          
          {/* Auth Flow Views */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Login />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/complete-profile" element={<CompleteProfile />} />

          {/* Secure/Protected Private Views */}
          <Route 
            path="/checkout" 
            element={
              <ProtectedRoute requireVerified={true}>
                <Checkout />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/order-success" 
            element={
              <ProtectedRoute requireVerified={true}>
                <OrderSuccess />
              </ProtectedRoute>
            } 
          />
          <Route path="/account" element={<Account />} />
          
          {/* Coins & Loyalty Rewards Routes */}
          <Route 
            path="/coins" 
            element={
              <ProtectedRoute>
                <CoinsDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/coins/play-earn" 
            element={
              <ProtectedRoute>
                <PlayEarn />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/coins/gogo-match" 
            element={
              <ProtectedRoute>
                <GoGoMatch />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/coins/merge-boss" 
            element={
              <ProtectedRoute>
                <MergeBoss />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/coins/leaderboard" 
            element={
              <ProtectedRoute>
                <Leaderboard />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/account/orders" 
            element={
              <ProtectedRoute>
                <MyOrders />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/account/orders/:orderId" 
            element={
              <ProtectedRoute>
                <OrderDetail />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/account/orders/:orderId/dispute" 
            element={
              <ProtectedRoute>
                <DisputePage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/account/wishlist" 
            element={
              <ProtectedRoute>
                <Wishlist />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/account/followed-stores" 
            element={
              <ProtectedRoute>
                <FollowedStores />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/account/coupons" 
            element={
              <ProtectedRoute>
                <Coupons />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/sale/coupons" 
            element={
              <SaleCoupons />
            } 
          />
          <Route 
            path="/messages" 
            element={
              <ProtectedRoute>
                <Messages />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/messages/orders" 
            element={
              <ProtectedRoute>
                <MessageOrders />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/messages/promotions" 
            element={
              <ProtectedRoute>
                <MessagePromotions />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/messages/:conversationId" 
            element={
              <ProtectedRoute>
                <ChatDetail />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings/notifications" 
            element={
              <ProtectedRoute>
                <NotificationSettings />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/seller-dashboard" 
            element={
              <ProtectedRoute allowedRoles={['seller', 'admin']} requireVerified={true}>
                <SellerDashboard subpage="dashboard" />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/seller/setup" 
            element={
              <ProtectedRoute allowedRoles={['seller', 'admin']} requireVerified={true}>
                <SellerSetup />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/seller/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['seller', 'admin']} requireVerified={true}>
                <SellerDashboard subpage="dashboard" />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/seller/products" 
            element={
              <ProtectedRoute allowedRoles={['seller', 'admin']} requireVerified={true}>
                <SellerDashboard subpage="products" />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/seller/products/new" 
            element={
              <ProtectedRoute allowedRoles={['seller', 'admin']} requireVerified={true}>
                <SellerDashboard subpage="product-new" />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/seller/products/edit/:id" 
            element={
              <ProtectedRoute allowedRoles={['seller', 'admin']} requireVerified={true}>
                <SellerDashboard subpage="product-edit" />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/seller/orders" 
            element={
              <ProtectedRoute allowedRoles={['seller', 'admin']} requireVerified={true}>
                <SellerDashboard subpage="orders" />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/seller/coupons" 
            element={
              <ProtectedRoute allowedRoles={['seller', 'admin']} requireVerified={true}>
                <SellerDashboard subpage="coupons" />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/seller/payouts" 
            element={
              <ProtectedRoute allowedRoles={['seller', 'admin']} requireVerified={true}>
                <SellerDashboard subpage="payouts" />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/*" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminPanel />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </MobileContainer>
    </Router>
  );
}
