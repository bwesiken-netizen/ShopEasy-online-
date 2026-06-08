import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import MobileContainer from './components/MobileContainer';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuthStore } from './stores';

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

import Messages from './pages/Messages';
import Settings from './pages/Settings';
import Search from './pages/Search';
import CameraSearch from './pages/CameraSearch';
import SellerDashboard from './pages/SellerDashboard';
import AdminPanel from './pages/AdminPanel';

// Import Auth System Pages
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyOtp from './pages/VerifyOtp';
import ForgotPassword from './pages/ForgotPassword';
import CompleteProfile from './pages/CompleteProfile';

export default function App() {
  const { checkAuthSession } = useAuthStore();

  useEffect(() => {
    // Initial session loaded via verified Http cookies
    checkAuthSession();
  }, [checkAuthSession]);

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
          <Route 
            path="/account" 
            element={
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
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
            path="/seller-dashboard" 
            element={
              <ProtectedRoute allowedRoles={['seller', 'admin']} requireVerified={true}>
                <SellerDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin-panel" 
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
