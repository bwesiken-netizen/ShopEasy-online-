import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { 
  ShieldAlert, 
  LayoutDashboard, 
  Users, 
  Store, 
  ShoppingBag, 
  Receipt, 
  Tag, 
  CreditCard, 
  Settings, 
  FileText, 
  ArrowLeft, 
  Menu, 
  X,
  Lock 
} from 'lucide-react';

// Import local modular child views
import AdminDashboard from './admin/AdminDashboard';
import AdminUsers from './admin/AdminUsers';
import AdminSellers from './admin/AdminSellers';
import AdminProducts from './admin/AdminProducts';
import AdminOrders from './admin/AdminOrders';
import AdminCoupons from './admin/AdminCoupons';
import AdminPayouts from './admin/AdminPayouts';
import AdminSettings from './admin/AdminSettings';
import AdminLogs from './admin/AdminLogs';

export default function AdminPanel() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  
  // Mobile navigation drawer toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { label: 'Control Desk', path: '/admin', icon: LayoutDashboard },
    { label: 'User Registry', path: '/admin/users', icon: Users },
    { label: 'Seller Approvals', path: '/admin/sellers/pending', icon: Store },
    { label: 'Product Moderation', path: '/admin/products', icon: ShoppingBag },
    { label: 'Order Arbitration', path: '/admin/orders', icon: Receipt },
    { label: 'Promo Coupons', path: '/admin/coupons', icon: Tag },
    { label: 'Cash Disbursements', path: '/admin/payouts', icon: CreditCard },
    { label: 'System Overrides', path: '/admin/settings', icon: Settings },
    { label: 'Audit Ledger', path: '/admin/logs', icon: FileText },
  ];

  const currentPath = location.pathname.replace(/\/$/, "");

  const handleNavigatePath = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const renderActiveSubpage = () => {
    if (currentPath === '/admin' || currentPath === '') {
      return <AdminDashboard />;
    }
    if (currentPath === '/admin/users') {
      return <AdminUsers />;
    }
    if (currentPath === '/admin/sellers/pending' || currentPath === '/admin/sellers') {
      return <AdminSellers />;
    }
    if (currentPath === '/admin/products') {
      return <AdminProducts />;
    }
    if (currentPath === '/admin/orders') {
      return <AdminOrders />;
    }
    if (currentPath === '/admin/coupons') {
      return <AdminCoupons />;
    }
    if (currentPath === '/admin/payouts') {
      return <AdminPayouts />;
    }
    if (currentPath === '/admin/settings') {
      return <AdminSettings />;
    }
    if (currentPath === '/admin/logs') {
      return <AdminLogs />;
    }
    return <AdminDashboard />;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans selection:bg-rose-500 selection:text-white" id="admin-master-shell">
      
      {/* 1. MOBILE HEADER NAV BAR */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800 shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-500 animate-[bounce_2s_infinite]" />
          <span className="font-display font-black text-xs uppercase tracking-widest text-slate-100">ShopEasy Administration</span>
        </div>
        
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* 2. SIDEBAR NAVIGATION - DESKTOP & MOBILE DRAWER */}
      <aside className={`
        fixed inset-0 z-40 bg-slate-900 text-white p-5 flex flex-col justify-between border-r border-slate-800 shadow-xl transition-transform duration-300 ease-in-out shrink-0
        md:relative md:translate-x-0 md:w-64 md:h-screen md:flex
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="space-y-6">
          
          {/* Header Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center shadow-3xs">
                <ShieldAlert className="w-4.5 h-4.5 text-rose-500" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display font-black text-xs uppercase tracking-wider text-slate-50">ShopEasy Console</h1>
                <span className="text-[9px] uppercase font-bold text-slate-400 mt-0.5 tracking-wider block">Admin Zone</span>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-1 bg-slate-800 text-slate-400 rounded-lg"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Navigation Links list */}
          <nav className="space-y-1 font-semibold text-xs">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;

              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigatePath(item.path)}
                  className={`w-full py-2.5 px-3.5 rounded-xl flex items-center gap-3 transition duration-150 uppercase text-[10.5px] font-bold ${
                    isActive 
                      ? 'bg-rose-600 text-white shadow-3xs' 
                      : 'text-slate-400 hover:text-slate-105 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer actions */}
        <div className="pt-4 border-t border-slate-800 space-y-3.5">
          <div className="flex items-center gap-2.5 p-1">
             <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-black text-rose-500 border text-xs">
                {currentUser?.name?.slice(0, 2).toUpperCase() || 'AD'}
             </div>
             <div className="min-w-0">
                <span className="block font-bold text-slate-105 text-[11px] truncate">{currentUser?.name || 'Administrator'}</span>
                <span className="text-[8.5px] uppercase font-black text-slate-450 tracking-wide flex items-center gap-1 mt-0.5">
                   <Lock className="w-3 h-3 text-rose-500" /> Root Access
                </span>
             </div>
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-950 text-slate-205 text-slate-200 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 border border-slate-700/50 shadow-3xs"
          >
            <ArrowLeft className="w-4 h-4" /> Go to Marketplace
          </button>
        </div>
      </aside>

      {/* 3. SCROLLABLE CONTAINER WORKSPACE */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto select-none">
        
        {/* Banner Announcement Broadcaster notification */}
        <div className="bg-slate-900 border-b border-rose-550/30 text-rose-50 w-full py-1.5 px-4 text-center text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shrink-0">
          <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping shrink-0" />
          <span>PRODUCTION CONTROL: Real-time Cloud Firestore updates synced</span>
        </div>

        {/* Responsive Content space */}
        <div className="flex-1 p-4 sm:p-5.5 md:p-7 max-w-7xl mx-auto w-full space-y-6">
          {renderActiveSubpage()}
        </div>

      </main>

    </div>
  );
}
