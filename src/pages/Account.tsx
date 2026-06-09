import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { useI18nStore } from '../i18n';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { 
  User, Award, Settings2, Heart, Store, Ticket, Clock, Star, 
  ChevronRight, CreditCard, ShoppingBag, Truck, CheckCircle, RotateCcw, 
  HelpCircle, Sparkles, Loader2, ArrowRight, ShieldCheck 
} from 'lucide-react';

export default function Account() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { t, language } = useI18nStore();

  const [loadingCount, setLoadingCount] = useState(false);
  const [counts, setCounts] = useState({
    toPay: 0,
    processing: 0,
    ready: 0,
    completed: 0,
    returns: 0
  });

  const [activeTab, setActiveTab] = useState<'coins' | 'ledger'>('coins');
  const [becomingSeller, setBecomingSeller] = useState(false);

  useEffect(() => {
    async function loadOrderCounts() {
      if (!user?.uid) return;
      setLoadingCount(true);
      try {
        const ordersCol = collection(db, 'orders');
        const q = query(ordersCol, where('buyerId', '==', user.uid));
        const snap = await getDocs(q);
        
        let toPayVal = 0;
        let processingVal = 0;
        let readyVal = 0;
        let completedVal = 0;
        let returnsVal = 0;

        snap.forEach((docSnap) => {
          const ord = docSnap.data();
          if (ord.status === 'pending') toPayVal++;
          else if (ord.status === 'processing') processingVal++;
          else if (ord.status === 'ready' || ord.status === 'shipping' || ord.status === 'shipped') readyVal++;
          else if (ord.status === 'completed' || ord.status === 'delivered') completedVal++;
          else if (ord.status === 'disputed' || ord.status === 'cancelled') returnsVal++;
        });

        setCounts({
          toPay: toPayVal,
          processing: processingVal,
          ready: readyVal,
          completed: completedVal,
          returns: returnsVal
        });
      } catch (err) {
        console.error("Failed to query order counts:", err);
      } finally {
        setLoadingCount(false);
      }
    }

    loadOrderCounts();
  }, [user?.uid]);

  const handleBecomeSeller = async () => {
    if (!user?.uid) return;
    setBecomingSeller(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { role: 'seller' });
      
      // Update local state is crucial
      if (useAuthStore.getState().user) {
        useAuthStore.setState({
          user: {
            ...useAuthStore.getState().user!,
            role: 'seller'
          }
        });
      }

      alert("Mwasankha bwino! You are now a registered ShopEasy Seller. Please reload or navigate to your Seller Dashboard to post farm produce.");
      navigate('/seller-dashboard');
    } catch (err) {
      console.error("Failed to upgrade to seller:", err);
      alert("Upgrade failed. Check connection.");
    } finally {
      setBecomingSeller(false);
    }
  };

  const handleLogout = async () => {
    const isConfirmed = window.confirm(t('confirmLogout'));
    if (!isConfirmed) return;
    try {
      await logout();
      navigate('/login');
    } catch (e) {
      navigate('/login');
    }
  };

  // 1. NOT LOGGED IN LAYOUT
  if (!user) {
    return (
      <div className="flex flex-col min-h-screen bg-neutral-50 p-4 animate-[fadeIn_0.3s_ease]" id="account-logged-out-view">
        {/* LOGO HERO CARD */}
        <div className="bg-white rounded-3xl border border-neutral-100 p-8 shadow-sm flex flex-col items-center text-center gap-4 mt-4" id="se-logo-hero">
          <div className="h-20 w-20 rounded-full bg-[#E53935]/5 flex items-center justify-center border-2 border-[#E53935]/20" id="se-logo-wrapper">
            <span className="text-3xl font-black text-[#E53935] tracking-tighter select-none font-display">SE</span>
          </div>
          <div>
            <h2 className="font-display font-black text-lg text-neutral-900 leading-tight">
              ShopEasy Malawi
            </h2>
            <p className="text-xs text-neutral-450 font-semibold mt-1">
              Sign in for the best experience & secure escrow tracking.
            </p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="w-full h-11 bg-[#E53935] hover:bg-[#c62828] text-white text-xs font-black uppercase rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1 mt-2"
            id="signin-register-btn"
          >
            <span>Sign In / Register</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* ORDER QUICK ICONS (DISABLED) */}
        <div className="bg-white rounded-3xl border border-neutral-100 p-4 shadow-sm mt-4" id="disabled-order-row">
          <div className="flex justify-between items-center mb-3 px-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">My Orders</span>
            <span className="text-[8px] font-extrabold text-neutral-400 uppercase">Connect to view status</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {[
              { label: 'To Pay', icon: <CreditCard className="h-5 w-5" /> },
              { label: 'Processing', icon: <ShoppingBag className="h-5 w-5" /> },
              { label: 'Ready', icon: <Truck className="h-5 w-5" /> },
              { label: 'Completed', icon: <CheckCircle className="h-5 w-5" /> },
              { label: 'Returns', icon: <RotateCcw className="h-5 w-5" /> }
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={() => navigate('/login')}
                className="flex flex-col items-center gap-1 py-2 rounded-xl hover:bg-neutral-50 active:scale-95 transition-all text-neutral-400"
                id={`disabled-order-btn-${idx}`}
              >
                {item.icon}
                <span className="text-[9px] font-bold leading-none">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* FEATURE TILES (2x3 GRID - FOR NOT LOGGED IN USER) */}
        <div className="bg-white rounded-3xl border border-neutral-100 p-4 shadow-sm mt-4" id="disabled-features">
          <span className="block text-[10px] font-black uppercase tracking-wider text-neutral-400 mb-3 px-1">
            Explore Services
          </span>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { id: 'wishlist', label: 'Wishlist', icon: <Heart className="h-4.5 w-4.5 text-red-500 fill-red-500" /> },
              { id: 'coupons', label: 'Coupons', icon: <Ticket className="h-4.5 w-4.5 text-amber-500" /> },
              { id: 'stores', label: 'Followed Stores', icon: <Store className="h-4.5 w-4.5 text-blue-500" /> },
              { id: 'history', label: 'History', icon: <Clock className="h-4.5 w-4.5 text-emerald-500" /> },
              { id: 'coins', label: 'Coins', icon: <Award className="h-4.5 w-4.5 text-orange-500" /> },
              { id: 'reviews', label: 'My Reviews', icon: <Star className="h-4.5 w-4.5 text-purple-500" /> }
            ].map((tile) => (
              <button
                key={tile.id}
                onClick={() => navigate('/login')}
                className="flex flex-col items-center justify-center p-3.5 bg-neutral-50 border border-neutral-100 rounded-2xl hover:border-neutral-200 transition-all text-neutral-600 gap-2 text-center shadow-3xs"
                id={`disabled-tile-${tile.id}`}
              >
                {tile.icon}
                <span className="text-[10px] font-extrabold leading-none">{tile.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* CHAKUPITA SALE BANNER (ACTIVE BY DEFAULT) */}
        <div className="bg-gradient-to-br from-[#E53935] to-[#c62828] rounded-3xl p-5 text-white shadow-md mt-4 relative overflow-hidden" id="sale-banner">
          <div className="absolute right-[-10px] bottom-[-15px] text-7xl opacity-20 select-none font-mono">
            🛍️
          </div>
          <div>
            <span className="text-[8px] font-black uppercase tracking-widest text-[#FFB300] bg-white/10 px-2 py-0.5 rounded-full border border-white/20">
              Chakupita MW Mega Promotion
            </span>
            <h3 className="text-base font-black font-display tracking-tight mt-2.5 leading-snug">
              Up to 60% Off on Farm Groceries & Lake Chambo Fishes!
            </h3>
            <p className="text-[10px] text-neutral-200 mt-1 font-medium leading-relaxed">
              Meet sellers directly at local pickup hubs across Blantyre, Lilongwe & Zomba.
            </p>
            <button
              onClick={() => navigate('/shop')}
              className="mt-4 bg-[#FFB300] hover:bg-amber-500 text-neutral-905 text-[10px] font-black uppercase px-4 py-2 rounded-full shadow-sm transition-all"
            >
              Start Exploring →
            </button>
          </div>
        </div>

        {/* BOTTOM METRIC APP SENSE */}
        <div className="text-center py-8 text-neutral-400 text-[10px]" id="auth-onboarding-footer">
          <span>ShopEasy MW applet v1.2 • Zero credit risk direct escrow</span>
        </div>
      </div>
    );
  }

  // 2. LOGGED IN LAYOUT
  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 p-4 animate-[fadeIn_0.3s_ease]" id="account-logged-in-view">
      
      {/* HERO SECTION USER PROFILE */}
      <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-sm flex items-center justify-between gap-4 mt-2" id="hero-profile-card">
        <div className="flex items-center gap-3">
          {/* Avatar editable - links to Settings/Profile */}
          <div 
            onClick={() => navigate('/settings/profile')}
            className="relative h-14 w-14 rounded-full overflow-hidden border-2 border-[#E53935]/20 group cursor-pointer shrink-0"
            id="profile-avatar-clickable"
          >
            <img 
              src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'} 
              alt="Profile" 
              className="h-full w-full object-cover group-hover:scale-105 transition-all"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-bold font-display">
              EDIT
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1">
              <h2 className="font-display font-black text-sm text-neutral-900 leading-tight">
                Muli bwanji, {user.name || 'ShopEasy Member'}!
              </h2>
            </div>
            <p className="text-[10px] text-neutral-400 font-bold block mt-0.5">
              {user.phone || 'No Phone Verified'} • {user.city || user.location || 'Malawi'}
            </p>
            <span className="inline-block mt-1.5 text-[8px] font-black uppercase text-[#E53935] bg-red-50 border border-red-100 px-2 py-0.5 rounded-full tracking-wider">
              {user.role === 'seller' ? 'ShopEasy Seller • ' + t('verified') : 'Platform Buyer'}
            </span>
          </div>
        </div>

        {/* Settings button */}
        <button
          onClick={() => navigate('/settings')}
          className="p-2.5 rounded-full border border-neutral-150 hover:bg-neutral-50 cursor-pointer active:scale-95 transition-all text-neutral-500"
          id="profile-settings-btn"
        >
          <Settings2 className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* QUICK COINS WALLET PILL */}
      <div 
        onClick={() => navigate('/coins')}
        className="bg-gradient-to-br from-amber-400 to-amber-600 rounded-3xl p-5 text-white shadow-md mt-4 relative overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300" 
        id="loyalty-coins-pill"
      >
        <div className="absolute right-[-15px] top-[-10px] text-7xl opacity-15 select-none font-mono">
          🪙
        </div>
        <div className="flex justify-between items-center z-10 relative">
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-100 flex items-center gap-1 leading-none">
              <Award className="h-3.5 w-3.5 text-white" />
              <span>{t('loyaltyWallet')}</span>
            </span>
            <h3 className="mt-1 font-mono text-2xl font-black">{user.coins || 0} COINS</h3>
            <p className="text-[9.5px] text-neutral-100 mt-1 font-semibold leading-relaxed max-w-[200px]">
              Tap to check in daily, play Match-3/Merge, and win rewards!
            </p>
          </div>

          <div 
            className="text-[9px] font-black bg-white/20 hover:bg-white/30 text-white uppercase px-3 py-1.5 rounded-full border border-white/20 select-none transition-all"
          >
            Open Dashboard →
          </div>
        </div>
      </div>

      {/* FUNCTIONAL ORDER QUICK ICONS WITH REAL COUNTS */}
      <div className="bg-white rounded-3xl border border-neutral-100 p-4 shadow-sm mt-4" id="functional-order-box">
        <div className="flex justify-between items-center mb-3.5 px-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-450">My Purchase Status</span>
          <button 
            onClick={() => navigate('/account/orders')} 
            className="text-[9px] font-black text-[#E53935] uppercase hover:underline"
          >
            All Orders →
          </button>
        </div>
        
        {loadingCount ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-5 w-5 animate-spin text-[#E53935]" />
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {[
              { label: 'To Pay', count: counts.toPay, icon: <CreditCard className="h-5 w-5 text-neutral-600" /> },
              { label: 'Processing', count: counts.processing, icon: <ShoppingBag className="h-5 w-5 text-neutral-600" /> },
              { label: 'Ready', count: counts.ready, icon: <Truck className="h-5 w-5 text-neutral-600" /> },
              { label: 'Completed', count: counts.completed, icon: <CheckCircle className="h-5 w-5 text-neutral-600" /> },
              { label: 'Returns', count: counts.returns, icon: <RotateCcw className="h-5 w-5 text-neutral-600" /> }
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={() => navigate('/account/orders')}
                className="flex flex-col items-center gap-1.5 py-1.5 rounded-2xl hover:bg-neutral-50 relative active:scale-95 transition-all"
                id={`functional-order-${idx}`}
              >
                {item.icon}
                <span className="text-[9px] font-black text-neutral-700 leading-none">{item.label}</span>
                {item.count > 0 && (
                  <span className="absolute -top-1 -right-1.5 bg-[#E53935] text-white font-mono font-black text-[8px] h-4.5 min-w-4.5 px-1 rounded-full flex items-center justify-center border-2 border-white leading-none">
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* COMPACT BECOME A SELLER / MY STORE ROW CARD */}
      {user.role !== 'seller' ? (
        <div className="bg-white rounded-3xl border border-neutral-100 p-4.5 shadow-sm mt-4 flex justify-between items-center gap-4" id="become-seller-banner">
          <div className="flex-1 space-y-0.5">
            <h4 className="font-display font-black text-xs text-neutral-900 uppercase tracking-tight">
              {t('becomeSeller')}
            </h4>
            <p className="text-[10px] text-neutral-500 font-semibold leading-relaxed">
              Have farm items or lake fish to post? Register seller role to reach buyers directly in major Malawian cities.
            </p>
          </div>
          <button
            onClick={handleBecomeSeller}
            disabled={becomingSeller}
            className="bg-[#E53935] hover:bg-[#c62828] text-white text-[10px] font-black uppercase px-4 h-9 rounded-full shadow-sm hover:scale-102 transition-all flex items-center justify-center gap-1 shrink-0"
          >
            {becomingSeller ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span>Onboard</span>
            )}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-neutral-100 p-4.5 shadow-sm mt-4 flex justify-between items-center gap-4" id="seller-dashboard-banner">
          <div className="flex-1 space-y-0.5">
            <div className="flex items-center gap-1 text-emerald-600">
              <ShieldCheck className="h-4 w-4" />
              <h4 className="font-display font-black text-xs uppercase tracking-tight">
                {t('myStore')}
              </h4>
            </div>
            <p className="text-[10px] text-neutral-500 font-semibold leading-relaxed">
              Your registered Malawian store is active. Manage products, update stock or dispatch center orders.
            </p>
          </div>
          <button
            onClick={() => navigate('/seller-dashboard')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase px-4 h-9 rounded-full shadow-sm hover:scale-102 transition-all flex items-center justify-center gap-1 shrink-0"
          >
            <span>My Store →</span>
          </button>
        </div>
      )}

      {/* FEATURE TILES (2x3 GRID - FUNCTIONAL FOR LOGGED IN USER) */}
      <div className="bg-white rounded-3xl border border-neutral-100 p-4 shadow-sm mt-4" id="explore-services-box">
        <span className="block text-[10px] font-black uppercase tracking-wider text-neutral-450 mb-3 px-1">
          Explore Services
        </span>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { id: 'wishlist', label: 'Wishlist', path: '/account/wishlist', icon: <Heart className="h-4.5 w-4.5 text-red-500 fill-red-500" /> },
            { id: 'coupons', label: 'Coupons', path: '/account/coupons', icon: <Ticket className="h-4.5 w-4.5 text-amber-500" /> },
            { id: 'stores', label: 'Followed Stores', path: '/account/followed-stores', icon: <Store className="h-4.5 w-4.5 text-blue-500" /> },
            { id: 'history', label: 'History (Recents)', path: '/settings/viewed', icon: <Clock className="h-4.5 w-4.5 text-emerald-500" /> },
            { id: 'coins', label: 'Coins Ledger', path: '/coins', icon: <Award className="h-4.5 w-4.5 text-orange-500 font-bold" /> },
            { id: 'reviews', label: 'My Reviews', path: '/account/orders', icon: <Star className="h-4.5 w-4.5 text-purple-500" /> }
          ].map((tile) => (
            <button
              key={tile.id}
              onClick={() => {
                navigate(tile.path);
              }}
              className="flex flex-col items-center justify-center p-3.5 bg-neutral-50 border border-neutral-100 rounded-2xl hover:border-neutral-200 hover:-translate-y-0.5 transition-all text-neutral-700 gap-2 text-center shadow-3xs"
              id={`service-tile-${tile.id}`}
            >
              {tile.icon}
              <span className="text-[10px] font-black leading-none">{tile.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* LOGOUT QUICK LINKS RAILS */}
      <div className="flex flex-col gap-2.5 mt-4" id="danger-links-group">
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 p-3.5 bg-neutral-100 hover:bg-neutral-200/80 rounded-full text-xs font-black text-red-600 transition-all font-display mt-2 cursor-pointer select-none"
          id="profile-logout-btn"
        >
          <span>Logout of ShopEasy</span>
        </button>
      </div>

    </div>
  );
}
