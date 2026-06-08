import React, { useState } from 'react';
import { useAuthStore, useNotificationStore } from '../stores';
import { SAMPLE_PRODUCTS } from '../data/malawiProducts';
import { User, Award, Bell, ListTodo, Settings2, LogOut, CheckSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Account() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { notifications, markAsRead } = useNotificationStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'orders'>('profile');

  // Simulated previous order list in Malawi
  const [mockOrders] = useState([
    {
      id: 'ord_910',
      productName: 'Aroma Kilombero Rice (5kg)',
      storeName: 'Limbe Golden Farm Store',
      total: 11500,
      status: 'completed',
      date: '2026-06-01',
      delivery: 'pickup'
    },
    {
      id: 'ord_911',
      productName: 'Fresh Lake Chambo (Medium)',
      storeName: 'Lake Side Chambo Kings',
      total: 8000,
      status: 'processing',
      date: '2026-06-07',
      delivery: 'delivery'
    }
  ]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex flex-col gap-4 p-4 animate-[fadeIn_0.3s_ease]">
      
      {/* 1. HERO CAPTION PROFILE PROFILE CARD */}
      <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-sm flex flex-col items-center gap-3 text-center">
        <div className="h-16 w-16 rounded-full bg-[#E53935]/10 flex items-center justify-center text-4xl border-2 border-[#E53935]">
          👤
        </div>
        <div>
          <h2 className="font-display font-black text-base text-neutral-900 leading-tight">
            {user?.name || 'ShopEasy Member'}
          </h2>
          <p className="text-xs text-neutral-450 font-semibold block mt-0.5">
            {user?.phone || 'No phone verified'} • {user?.location || 'Malawi'}
          </p>
          <span className="inline-block mt-2 text-[9px] font-black uppercase text-[#E53935] bg-red-50 border border-red-200 px-3 py-1 rounded-full tracking-wider">
            {user?.role === 'seller' ? 'ShopEasy Seller' : 'Platform Buyer'}
          </span>
        </div>
      </div>

      {/* 2. SUB NAVIGATION TABS */}
      <div className="grid grid-cols-3 gap-1 bg-white border border-neutral-100 p-1.5 rounded-full shadow-sm">
        <button
          onClick={() => setActiveTab('profile')}
          className={`py-2 text-[10px] sm:text-xs font-black rounded-full transition-all ${
            activeTab === 'profile' 
              ? 'bg-[#E53935] text-white' 
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          My Coins
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`py-2 text-[10px] sm:text-xs font-black rounded-full transition-all relative ${
            activeTab === 'notifications' 
              ? 'bg-[#E53935] text-white' 
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          Alerts
          {notifications.filter(n => !n.read).length > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#FFB300] animate-ping" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`py-2 text-[10px] sm:text-xs font-black rounded-full transition-all ${
            activeTab === 'orders' 
              ? 'bg-[#E53935] text-white' 
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          My Orders
        </button>
      </div>

      {/* 3. CONDITIONAL RENDER WORKSHOPS */}

      {/* TAB A: COINS & LOYALTY LOG */}
      {activeTab === 'profile' && (
        <div className="flex flex-col gap-3">
          <div className="bg-gradient-to-br from-amber-400 to-amber-600 rounded-3xl p-5 text-white shadow-md flex justify-between items-center relative overflow-hidden">
            <div className="absolute right-[-15px] top-[-10px] text-8xl opacity-15 select-none font-mono">
              🪙
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-amber-100 tracking-widest flex items-center gap-1">
                <Award className="h-3.5 w-3.5 text-white" />
                Loyalty Wallet Balance
              </span>
              <h3 className="mt-1 font-mono text-3xl font-black">{user?.coins || 0}</h3>
              <p className="text-[10px] text-neutral-100 mt-1.5 font-medium leading-relaxed">
                Save coins to redeem discounts on farm groceries and local fish.
              </p>
            </div>
          </div>

          <h4 className="font-display font-extrabold text-xs text-neutral-550 uppercase tracking-wider mt-2">
            Coin rewards ledger
          </h4>

          <div className="flex flex-col gap-2">
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="block text-xs font-extrabold text-neutral-800">Welcome Bonus</span>
                <span className="text-[10px] text-neutral-400 font-medium">Earned on ShopEasy registration</span>
              </div>
              <span className="font-mono text-xs font-black text-emerald-600">+100 coins</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="block text-xs font-extrabold text-neutral-800 font-sans">Spent coins on Groceries</span>
                <span className="text-[10px] text-neutral-400 font-medium">Easter holiday discount coupon applied</span>
              </div>
              <span className="font-mono text-xs font-black text-rose-600">-15 coins</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB B: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="flex flex-col gap-2.5">
          {notifications.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-3xl border border-neutral-100 p-4">
              <span className="text-4xl text-neutral-300">📭</span>
              <p className="text-xs text-neutral-500 font-medium mt-2">No alerts yet in Malawi marketplace.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div 
                key={notif.id}
                onClick={() => markAsRead(notif.id)}
                className={`p-4 rounded-3xl border shadow-sm transition-all flex gap-3 cursor-pointer ${
                  notif.read 
                    ? 'bg-white border-neutral-100 opacity-75' 
                    : 'bg-red-50/20 border-[#E53935]/20'
                }`}
              >
                <div className="text-2xl pt-0.5 select-none">
                  {notif.type === 'coin' ? '🪙' : notif.type === 'order' ? '📦' : '💬'}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="block text-xs font-extrabold text-neutral-900">{notif.title}</span>
                    {!notif.read && (
                      <span className="text-[8px] font-black uppercase text-[#E53935] bg-red-50 px-1 border border-red-100 rounded">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-600 font-medium mt-1 leading-relaxed">
                    {notif.body}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB C: PREVIOUS ORDERS HISTORY */}
      {activeTab === 'orders' && (
        <div className="flex flex-col gap-3">
          {mockOrders.map((ord) => (
            <div 
              key={ord.id}
              className="bg-white rounded-3xl border border-neutral-100 p-4 shadow-sm flex flex-col gap-3"
            >
              <div className="flex justify-between items-center pb-2.5 border-b border-neutral-100">
                <span className="font-mono text-xs font-black text-[#E53935]">{ord.id}</span>
                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                  ord.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                    : 'bg-amber-50 text-amber-700 border border-amber-150'
                }`}>
                  {ord.status}
                </span>
              </div>

              <div>
                <h4 className="text-xs font-extrabold text-neutral-900">{ord.productName}</h4>
                <p className="text-[10px] text-neutral-450 mt-0.5 font-bold uppercase">{ord.storeName}</p>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-dashed border-neutral-100">
                  <span className="text-[10px] text-neutral-400 font-medium">Handoff: <strong className="text-neutral-700 lowercase">{ord.delivery}</strong></span>
                  <span className="font-mono text-xs font-black text-neutral-800">
                    MWK {ord.total.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QUICK WORKSPACE REDIRECT LINKS */}
      <div className="flex flex-col gap-2 mt-2">
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center justify-between p-4 bg-white rounded-2xl border border-neutral-100 hover:bg-neutral-50 text-xs font-extrabold text-neutral-700 transition-all shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <Settings2 className="h-4.5 w-4.5 text-neutral-400" />
            <span>Marketplace Settings</span>
          </div>
          <span className="text-neutral-400">→</span>
        </button>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2.5 p-3.5 bg-neutral-100 hover:bg-neutral-200 rounded-full text-xs font-black text-red-600 transition-all font-display mt-4"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout of ShopEasy</span>
        </button>
      </div>

    </div>
  );
}
