import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useCartStore, useNotificationStore, useAuthStore } from '../stores';
import { 
  ShoppingBag, Search, Camera, Bell, Home as HomeIcon, 
  Compass, ShoppingCart, User as UserIcon, Plus, X, 
  Award, Store, MessageSquare, ShieldAlert, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

interface MobileContainerProps {
  children: React.ReactNode;
}

export default function MobileContainer({ children }: MobileContainerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const { items } = useCartStore();
  const { notifications, markAllRead } = useNotificationStore();
  const { user } = useAuthStore();
  
  const [showCenterMenu, setShowCenterMenu] = useState(false);
  const [cameraScanActive, setCameraScanActive] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [realUnreadCount, setRealUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setRealUnreadCount(0);
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRealUnreadCount(snapshot.size);
    }, (error) => {
      console.warn("Error listening to real-time notification counts:", error);
    });
    return () => unsubscribe();
  }, [user]);

  const unreadNotifications = user ? realUnreadCount : notifications.filter((n) => !n.read).length;
  const cartCount = items.reduce((acc, item) => acc + item.quantity, 0);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchVal.trim())}`);
    }
  };

  const handleBellClick = () => {
    navigate('/messages');
  };

  // Simulate local camera scanning for Malawian barcoded items or ShopEasy seller coupons
  const triggerCameraScan = () => {
    setCameraScanActive(true);
    setTimeout(() => {
      setCameraScanActive(false);
      // Automatically add a sample potato
      navigate('/product/p_1');
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex justify-center items-center py-0 sm:py-6 lg:py-10">
      
      {/* Phone Silhouette Container Wrapper */}
      <div className="w-full max-w-[480px] h-[100vh] sm:h-[840px] bg-white text-[#212121] flex flex-col relative sm:rounded-[40px] sm:shadow-2xl overflow-hidden border-0 sm:border-[8px] border-neutral-950">
        
        {/* Top Camera Notch Decorator */}
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-40 h-5 bg-neutral-950 rounded-b-2xl z-50">
          <div className="w-3 h-3 rounded-full bg-neutral-900 absolute left-4 top-1" />
          <div className="w-16 h-1 bg-neutral-800 absolute left-1/2 -translate-x-1/2 top-1.5 rounded-full" />
        </div>

        {/* 1. TOP BAR */}
        {!isHomePage && !location.pathname.startsWith('/search') && (
          <header className="sticky top-0 z-40 bg-white border-b border-neutral-100 flex flex-col pt-3 sm:pt-6 pb-2.5 px-4 gap-2">
            <div className="flex items-center justify-between">
              {/* Logo ShopEasy */}
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => navigate('/')}>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E53935] text-white font-bold leading-none">
                  SE
                </div>
                <div>
                  <span className="font-display text-lg font-extrabold tracking-tight">
                    Shop<span className="text-[#E53935]">Easy</span>
                  </span>
                  <span className="ml-1 text-[8px] font-black font-mono tracking-widest text-[#FFB300] bg-amber-50 px-1 border border-amber-200 rounded">
                    MW
                  </span>
                </div>
              </div>

              {/* Right side controls: Bell, Flag, Settings Gear */}
              <div className="flex items-center gap-1">
                <button 
                  onClick={handleBellClick}
                  className="relative p-1.5 rounded-full hover:bg-neutral-50 transition-colors"
                  title={`${unreadNotifications} unread notifications`}
                >
                  <Bell className="h-5 w-5 text-neutral-700" />
                  {unreadNotifications > 0 && (
                    <span className="absolute top-0 right-0 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#E53935] text-[9px] font-black text-white font-mono animate-bounce">
                      {unreadNotifications}
                    </span>
                  )}
                </button>

                <span className="text-lg select-none px-1" title="Malawi">🇲🇼</span>

                <button 
                  onClick={() => navigate('/settings')}
                  className="p-1.5 rounded-full hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900 transition-colors"
                  title="Settings"
                >
                  <Settings className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            {/* Search bar inside header with Camera icon and Search button */}
            <div className="flex items-center gap-2 w-full" id="global-search-bar-form">
              <div className="relative flex-grow">
                {/* Camera icon on the left, tapping opens /search/camera */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/search/camera');
                  }}
                  title="Photo Camera Search"
                  className="absolute left-3.5 top-2.5 text-neutral-500 hover:text-[#E53935] transition-colors z-10"
                >
                  <Camera className="h-4.5 w-4.5" />
                </button>
                <input
                  type="text"
                  placeholder="Search ShopEasy..."
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  onClick={() => navigate('/search')}
                  readOnly
                  className="w-full text-xs font-semibold rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-[#212121] cursor-pointer hover:bg-neutral-100 focus:outline-none transition-all"
                />
              </div>
              <button
                type="button"
                onClick={() => navigate(searchVal.trim() ? `/search?q=${encodeURIComponent(searchVal.trim())}` : '/search')}
                className="bg-neutral-900 hover:bg-black text-white text-[9.5px] font-black uppercase tracking-wider py-2.5 px-4 rounded-full transition-all shrink-0 shadow-3xs"
              >
                Search
              </button>
            </div>
          </header>
        )}

        {/* Camera Scanner Simulation overlay */}
        <AnimatePresence>
          {cameraScanActive && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-neutral-900/90 z-50 flex flex-col justify-center items-center text-white px-6 text-center"
            >
              <div className="relative w-64 h-64 border-2 border-dashed border-[#FFB300] rounded-2xl flex items-center justify-center overflow-hidden">
                <span className="text-4xl animate-bounce">🥔</span>
                {/* Horizontal scanner light line */}
                <div className="absolute w-full h-1 bg-[#E53935] left-0 top-0 animate-[scan_2s_ease-in-out_infinite]" />
              </div>
              <h3 className="mt-6 font-display font-bold text-lg text-[#FFB300]">Scanning Malawian Catalog...</h3>
              <p className="mt-1 text-xs text-neutral-300">Searching barcodes in Lilongwe / Blantyre database</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2. CORE ROUTE SCROLLABLE WORKSPACE */}
        <div className={`flex-1 overflow-y-auto bg-[#F5F5F5] ${isHomePage ? 'pb-0' : 'pb-24'}`}>
          {children}
        </div>

        {/* 3. BOTTOM ROUTE NAVIGATION */}
        {!isHomePage && (
          <nav className="absolute bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-100 flex justify-between items-center px-4 py-2">
            
            <NavLink 
              to="/" 
              className={({ isActive }) => 
                `flex flex-col items-center flex-1 py-1 text-[10px] font-bold ${
                  isActive ? 'text-[#E53935]' : 'text-neutral-400'
                }`
              }
            >
              <HomeIcon className="h-5 w-5 mb-0.5" />
              <span>Home</span>
            </NavLink>

            <NavLink 
              to="/shop" 
              className={({ isActive }) => 
                `flex flex-col items-center flex-1 py-1 text-[10px] font-bold ${
                  isActive ? 'text-[#E53935]' : 'text-neutral-400'
                }`
              }
            >
              <Compass className="h-5 w-5 mb-0.5" />
              <span>Shop</span>
            </NavLink>

            {/* Center special red button */}
            <div className="flex-1 flex justify-center -mt-6">
              <button
                onClick={() => setShowCenterMenu(!showCenterMenu)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E53935] text-white shadow-lg shadow-[#E53935]/30 hover:bg-red-700 transition-all transform active:scale-95"
                title="ShopEasy menu shortcuts"
              >
                <Plus className={`h-6 w-6 transition-transform duration-200 ${showCenterMenu ? 'rotate-45' : ''}`} />
              </button>
            </div>

            <NavLink 
              to="/cart" 
              className={({ isActive }) => 
                `flex flex-col items-center flex-1 py-1 text-[10px] font-bold relative ${
                  isActive ? 'text-[#E53935]' : 'text-neutral-400'
                }`
              }
            >
              <ShoppingCart className="h-5 w-5 mb-0.5" />
              <span>Cart</span>
              {cartCount > 0 && (
                <span className="absolute top-0 right-3 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#FFB300] text-[9px] font-black text-neutral-900 font-mono">
                  {cartCount}
                </span>
              )}
            </NavLink>

            <NavLink 
              to="/account" 
              className={({ isActive }) => 
                `flex flex-col items-center flex-1 py-1 text-[10px] font-bold ${
                  isActive ? 'text-[#E53935]' : 'text-neutral-400'
                }`
              }
            >
              <UserIcon className="h-5 w-5 mb-0.5" />
              <span>Account</span>
            </NavLink>

          </nav>
        )}

        {/* Bottom center shortcut popup drawer */}
        <AnimatePresence>
          {!isHomePage && showCenterMenu && (
            <>
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCenterMenu(false)}
                className="absolute inset-0 bg-black z-40"
              />
              {/* Menu Container */}
              <motion.div 
                initial={{ y: 200, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 200, opacity: 0 }}
                className="absolute bottom-20 left-4 right-4 bg-white rounded-3xl p-5 shadow-2xl z-50 border border-neutral-100 flex flex-col gap-4 text-[#212121]"
              >
                <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                  <h4 className="font-display font-extrabold text-sm text-neutral-900">ShopEasy Malawi Shortcuts</h4>
                  <button onClick={() => setShowCenterMenu(false)} className="p-1 rounded-full bg-neutral-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => { setShowCenterMenu(false); navigate('/seller-dashboard'); }}
                    className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-3 hover:border-[#FFB300] transition-colors text-left"
                  >
                    <Store className="h-5 w-5 text-[#FFB300]" />
                    <div>
                      <span className="block text-xs font-extrabold">Seller Depot</span>
                      <span className="text-[10px] text-neutral-500 font-medium">Post local farm goods</span>
                    </div>
                  </button>

                  <button 
                    onClick={() => { setShowCenterMenu(false); navigate('/account'); }}
                    className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-3 hover:border-[#E53935] transition-colors text-left"
                  >
                    <Award className="h-5 w-5 text-[#E53935]" />
                    <div>
                      <span className="block text-xs font-extrabold">Daily Coins</span>
                      <span className="text-[10px] text-neutral-500 font-medium">{user?.coins || 0} Reward Coins</span>
                    </div>
                  </button>

                  <button 
                    onClick={() => { setShowCenterMenu(false); navigate('/messages'); }}
                    className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-3 hover:border-yellow-500 transition-colors text-left"
                  >
                    <MessageSquare className="h-5 w-5 text-amber-500" />
                    <div>
                      <span className="block text-xs font-extrabold">Chat Box</span>
                      <span className="text-[10px] text-neutral-500 font-medium">Talk to buyers/sellers</span>
                    </div>
                  </button>

                  <button 
                    onClick={() => { setShowCenterMenu(false); navigate('/admin-panel'); }}
                    className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-3 hover:border-rose-500 transition-colors text-left"
                  >
                    <ShieldAlert className="h-5 w-5 text-rose-500" />
                    <div>
                      <span className="block text-xs font-extrabold">Admin Area</span>
                      <span className="text-[10px] text-neutral-500 font-medium">Platform stats</span>
                    </div>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
