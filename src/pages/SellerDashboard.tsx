import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuthStore } from '../stores';

// Subpage Component Imports
import SellerDashboardMain from './SellerDashboardMain';
import SellerProducts from './SellerProducts';
import SellerProductForm from './SellerProductForm';
import SellerOrders from './SellerOrders';
import SellerCoupons from './SellerCoupons';
import SellerPayouts from './SellerPayouts';

import { 
  Store as StoreIcon, 
  Package, 
  ShoppingBag, 
  Ticket, 
  Wallet, 
  MessageSquare, 
  UserPlus, 
  LogOut, 
  ArrowLeft,
  Settings,
  Menu,
  X,
  ShieldCheck,
  LayoutDashboard
} from 'lucide-react';

interface SellerDashboardProps {
  subpage?: 'dashboard' | 'products' | 'product-new' | 'product-edit' | 'orders' | 'coupons' | 'payouts';
}

export default function SellerDashboard({ subpage = 'dashboard' }: SellerDashboardProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const uid = auth.currentUser?.uid || user?.uid;

  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<any>(null);
  
  // Mobile responsive sidebar drawer toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    const checkApprovalGuard = async () => {
      try {
        const snap = await getDoc(doc(db, 'stores', uid));
        if (snap.exists()) {
          const storeData = snap.data();
          setStore(storeData);
          
          // Guard: Redirect to onboarding setup if status is not fully approved
          if (storeData.status !== 'approved') {
            navigate('/seller/setup');
          }
        } else {
          // No store registered yet
          navigate('/seller/setup');
        }
      } catch (err) {
        console.error("Error loaded store details during guard validation:", err);
      } finally {
        setLoading(false);
      }
    };

    checkApprovalGuard();
  }, [uid, navigate]);

  const handleSignOut = async () => {
    if (window.confirm("Do you want to sign out from your merchant portal?")) {
      await auth.signOut();
      navigate('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center" id="dash-scaffold-loader">
        <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 text-sm font-semibold font-sans">Checking Merchant Guard Clearance...</p>
      </div>
    );
  }

  // Define sidebar menu options
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/seller/dashboard' },
    { id: 'products', label: 'My Products', icon: Package, path: '/seller/products' },
    { id: 'orders', label: 'Fulfill Orders', icon: ShoppingBag, path: '/seller/orders' },
    { id: 'coupons', label: 'Store Coupons', icon: Ticket, path: '/seller/coupons' },
    { id: 'payouts', label: 'Earnings & Payouts', icon: Wallet, path: '/seller/payouts' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" id="seller-dashboard-layout">
      
      {/* 1. Header Navigation Bar */}
      <div className="bg-slate-900 border-b border-slate-800 text-white py-4 px-4 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-2.5">
          {/* Mobile menu toggle button */}
          <button 
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1 px-1.5 hover:bg-slate-800 rounded-lg text-slate-300 md:hidden transition"
          >
            {mobileMenuOpen ? <X className="w-5.5 h-5.5" /> : <Menu className="w-5.5 h-5.5" />}
          </button>

          <span className="font-bold text-white font-sans text-sm md:text-base flex items-center gap-1.5 select-none tracking-tight">
            <StoreIcon className="w-5.5 h-5.5 text-red-500 animate-pulse shrink-0" /> ShopEasy Seller Hub
          </span>
        </div>

        {/* Desktop Quick status row */}
        <div className="flex items-center gap-4.5 text-xs text-slate-350 select-none">
          <div className="hidden sm:flex items-center gap-1 text-emerald-400 font-extrabold uppercase tracking-wide text-[10px] bg-slate-850 py-1 px-2.5 rounded-full border border-slate-800 shadow-3xs">
            <ShieldCheck className="w-3.5 h-3.5" /> Active Store Verified
          </div>
          <button
            onClick={() => navigate('/account')}
            className="text-slate-200 font-semibold hover:text-white flex items-center gap-1 hover:underline transition"
          >
            <ArrowLeft className="w-4 h-4" /> Standard Shop
          </button>
        </div>
      </div>

      <div className="flex flex-1 relative">
        
        {/* 2. Responsive Side Navigation Bar */}
        {/* Desktop view */}
        <div className="hidden md:flex flex-col w-56 bg-slate-900 text-slate-300 border-r border-slate-800 p-4.5 space-y-7 shrink-0 min-h-screen">
          <div className="space-y-1 select-none">
            <p className="text-[9.5px] uppercase tracking-widest text-slate-500 font-bold block">Fulfillment Terminal</p>
            <h4 className="font-extrabold text-sm text-slate-100 truncate">{store?.name || 'Local Store'}</h4>
          </div>

          <div className="space-y-2 flex-1">
            {menuItems.map((item) => {
              const isActive = subpage === item.id || (item.id === 'products' && (subpage === 'product-new' || subpage === 'product-edit'));
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    navigate(item.path);
                  }}
                  className={`w-full text-left font-bold text-xs py-3 px-3.5 rounded-xl uppercase tracking-wider flex items-center gap-3 transition ${
                    isActive 
                      ? 'bg-red-650 bg-red-650 bg-red-650 bg-red-600 text-white shadow-3xs hover:bg-red-700' 
                      : 'hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <item.icon className="w-4.5 h-4.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* Scoped chat redirect link */}
            <button
              onClick={() => navigate('/messages')}
              className="w-full text-left font-bold text-xs py-3 px-3.5 rounded-xl uppercase tracking-wider flex items-center gap-3 hover:text-white hover:bg-slate-800 transition"
            >
              <MessageSquare className="w-4.5 h-4.5" />
              <span>Buyer Chats</span>
            </button>
          </div>

          {/* Footer action */}
          <button
            onClick={handleSignOut}
            className="w-full text-left font-black text-xs text-rose-400 hover:text-rose-500 py-3 px-3.5 rounded-xl transition flex items-center gap-3 uppercase tracking-wider border-t border-slate-800 pt-5"
          >
            <LogOut className="w-4.5 h-4.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Mobile slide-out drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            {/* Backdrop overlay */}
            <div 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" 
              onClick={() => setMobileMenuOpen(false)}
            />
            
            {/* Drawer container */}
            <div className="relative flex flex-col w-56 bg-slate-900 text-slate-300 p-4 space-y-6 shadow-2xl h-full animate-[slideIn_0.2s_ease-out]">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest block font-mono">Store Engine</span>
                  <h4 className="font-bold text-xs text-slate-100 truncate">{store?.name || 'Local Store'}</h4>
                </div>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"
                >
                  <X className="w-5.5 h-5.5" />
                </button>
              </div>

              <div className="space-y-2 flex-1">
                {menuItems.map((item) => {
                  const isActive = subpage === item.id || (item.id === 'products' && (subpage === 'product-new' || subpage === 'product-edit'));
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate(item.path);
                      }}
                      className={`w-full text-left font-bold text-xs py-3 px-3.5 rounded-xl uppercase tracking-wider flex items-center gap-3 transition ${
                        isActive 
                          ? 'bg-red-650 bg-red-600 text-white shadow-3xs' 
                          : 'hover:text-white hover:bg-slate-850 hover:bg-slate-800'
                      }`}
                    >
                      <item.icon className="w-4.5 h-4.5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}

                {/* Scoped chat redirect link */}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/messages');
                  }}
                  className="w-full text-left font-bold text-xs py-3 px-3.5 rounded-xl uppercase tracking-wider flex items-center gap-3 transition hover:text-white hover:bg-slate-800"
                >
                  <MessageSquare className="w-4.5 h-4.5" />
                  <span>Buyer Chats</span>
                </button>
              </div>

              {/* Drawer footer link */}
              <button
                onClick={handleSignOut}
                className="w-full text-left font-semibold text-xs text-rose-400 hover:text-rose-500 py-3.5 px-3 rounded-xl transition flex items-center gap-3 border-t border-slate-800 uppercase tracking-wider"
              >
                <LogOut className="w-4.5 h-4.5" />
                <span>Sign Out Account</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Main Dashboard body router */}
        <div className="flex-1 p-4 max-w-lg mx-auto md:max-w-none md:p-6 pb-24 overflow-x-hidden">
          {subpage === 'dashboard' && <SellerDashboardMain />}
          {subpage === 'products' && <SellerProducts />}
          {(subpage === 'product-new' || subpage === 'product-edit') && <SellerProductForm />}
          {subpage === 'orders' && <SellerOrders />}
          {subpage === 'coupons' && <SellerCoupons />}
          {subpage === 'payouts' && <SellerPayouts />}
        </div>

      </div>
    </div>
  );
}
