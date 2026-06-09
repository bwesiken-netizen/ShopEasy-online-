import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, getDocs, where, limit, onSnapshot, orderBy } from 'firebase/firestore';
import { 
  Users, 
  Store, 
  ShoppingBag, 
  DollarSign, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  Award,
  ArrowUpRight,
  RefreshCw
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    activeSellers: 0,
    ordersToday: 0,
    revenueToday: 0,
    pendingApprovals: 0,
    openDisputes: 0
  });

  const [chartData, setChartData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [topSellers, setTopSellers] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardStats();
    
    // Set up real-time listener for the last 10 orders
    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      const ords: any[] = [];
      snapshot.forEach((doc) => {
        ords.push({ id: doc.id, ...doc.data() });
      });
      setRecentOrders(ords);
    }, (error) => {
      console.error("Error listening to recent orders in real-time in Admin Dashboard: ", error);
    });

    return () => unsubscribe();
  }, []);

  const fetchDashboardStats = async () => {
    setRefreshing(true);
    try {
      // 1. Fetch Users Count
      const usersSnap = await getDocs(collection(db, 'users'));
      const totalUsers = usersSnap.size;

      // 2. Fetch Active Sellers (stores where status == 'approved')
      const storesSnap = await getDocs(collection(db, 'stores'));
      let activeSellers = 0;
      let pendingApprovals = 0;
      const storesList: any[] = [];
      storesSnap.forEach(d => {
        const data = d.data();
        storesList.push({ id: d.id, ...data });
        if (data.status === 'approved') activeSellers++;
        if (data.status === 'pending_approval') pendingApprovals++;
      });

      // Sort stores/sellers by status == approved and totalSales descending to get product leaders
      const topSellersList = storesList
        .filter(s => s.status === 'approved')
        .sort((a, b) => (b.totalSales || 0) - (a.totalSales || 0))
        .slice(0, 5);
      setTopSellers(topSellersList);

      // 3. Process disputes (disputes collection or orders where status starts with dispute)
      const disputesSnap = await getDocs(collection(db, 'disputes'));
      let openDisputes = 0;
      disputesSnap.forEach(docSnap => {
        if (docSnap.data().status === 'open' || docSnap.data().status === 'pending') {
          openDisputes++;
        }
      });

      // 4. Load Products and get Top 5
      const productsSnap = await getDocs(collection(db, 'products'));
      const prodsList: any[] = [];
      productsSnap.forEach(d => {
        prodsList.push({ id: d.id, ...d.data() });
      });
      const sortedProds = prodsList
        .sort((a, b) => (b.sold || 0) - (a.sold || 0))
        .slice(0, 5);
      setTopProducts(sortedProds);

      // 5. Fetch Orders for Today and Revenue Metrics
      const ordersSnap = await getDocs(collection(db, 'orders'));
      let ordersToday = 0;
      let revenueToday = 0;
      
      const midnightToday = new Date();
      midnightToday.setHours(0,0,0,0);

      // For last 7 days chart setup
      const last7Days: { [key: string]: number } = {};
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        last7Days[dateKey] = 0;
      }

      ordersSnap.forEach((docRef) => {
        const ord = docRef.data();
        let orderDate = new Date();
        
        if (ord.createdAt) {
          if (ord.createdAt.seconds) {
            orderDate = new Date(ord.createdAt.seconds * 1000);
          } else {
            orderDate = new Date(ord.createdAt);
          }
        } else {
          return; // Skip if no date
        }

        const isToday = orderDate >= midnightToday;
        
        // Group last 7 days paid orders or status != cancelled
        if (ord.status !== 'cancelled') {
          const dateStr = orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (last7Days[dateStr] !== undefined) {
            last7Days[dateStr] += Number(ord.total || 0);
          }
        }

        if (isToday) {
          ordersToday++;
          // Revenue: sum of orders.total where cash checkout complete or confirmed
          if (ord.status !== 'cancelled') {
            revenueToday += Number(ord.total || 0);
          }
        }
      });

      // Map last 7 days chart values
      const chartMapped = Object.keys(last7Days).map(key => ({
        day: key,
        Revenue: last7Days[key]
      }));

      setChartData(chartMapped);
      setMetrics({
        totalUsers,
        activeSellers,
        ordersToday,
        revenueToday,
        pendingApprovals,
        openDisputes
      });

    } catch (err) {
      console.error("Error loaded production systems summary logs: ", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getOrderStatusBadgeColor = (status: string) => {
    const s = (status || 'pending').toLowerCase();
    if (s.startsWith('dispute')) return 'bg-amber-50 text-amber-800 border-amber-200';
    if (s === 'completed' || s === 'delivered') return 'bg-emerald-50 text-emerald-800 border-emerald-250';
    if (s === 'cancelled' || s === 'refunded') return 'bg-rose-50 text-rose-800 border-rose-200';
    return 'bg-blue-50 text-blue-800 border-blue-200';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 font-bold text-xs">
        <div className="w-8 h-8 border-3 border-rose-600 border-t-transparent rounded-full animate-spin mb-3.5" />
        Processing production metrics database...
      </div>
    );
  }

  return (
    <div className="space-y-6" id="admin-dashboard-root">
      
      {/* HUD Header Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-3xs flex-wrap gap-3">
        <div className="space-y-0.5">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Main Console Dashboard</h2>
          <p className="text-[10px] text-slate-450 font-bold uppercase">Real-time summaries aggregated across all active collection points</p>
        </div>
        <button
          onClick={fetchDashboardStats}
          disabled={refreshing}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 shadow-3xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Syncing...' : 'Force Sync'}
        </button>
      </div>

      {/* KPI Matrix row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5" id="kpi-scorecard-grid">
        {/* KPI 1 */}
        <div className="bg-white p-4.5 rounded-2.5xl border border-slate-100 shadow-3xs space-y-2 relative overflow-hidden">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-450">Total Users</span>
          </div>
          <span className="text-2xl font-black font-mono text-slate-900 block pt-1 leading-none">{metrics.totalUsers.toLocaleString()}</span>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-4.5 rounded-2.5xl border border-slate-100 shadow-3xs space-y-2 relative overflow-hidden">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <Store className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-450">Active Sellers</span>
          </div>
          <span className="text-2xl font-black font-mono text-slate-900 block pt-1 leading-none">{metrics.activeSellers.toLocaleString()}</span>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-4.5 rounded-2.5xl border border-slate-100 shadow-3xs space-y-2 relative overflow-hidden">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-450">Orders Today</span>
          </div>
          <span className="text-2xl font-black font-mono text-slate-900 block pt-1 leading-none">{metrics.ordersToday.toLocaleString()}</span>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-4.5 rounded-2.5xl border border-slate-100 shadow-3xs space-y-2 relative overflow-hidden">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#E6F4EA] rounded-xl text-emerald-700">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-450">Revenue Today</span>
          </div>
          <span className="text-2xl font-black font-mono text-emerald-800 block pt-1 leading-none">MWK {metrics.revenueToday.toLocaleString()}</span>
        </div>

        {/* KPI 5 */}
        <div className="bg-white p-4.5 rounded-2.5xl border border-slate-100 shadow-3xs space-y-2 relative overflow-hidden">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-450">Pending Shops</span>
          </div>
          <span className={`text-2xl font-black font-mono block pt-1 leading-none ${metrics.pendingApprovals > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {metrics.pendingApprovals}
          </span>
        </div>

        {/* KPI 6 */}
        <div className="bg-white p-4.5 rounded-2.5xl border border-slate-100 shadow-3xs space-y-2 relative overflow-hidden">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-50 rounded-xl text-red-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-450">Open Disputes</span>
          </div>
          <span className={`text-2xl font-black font-mono block pt-1 leading-none ${metrics.openDisputes > 0 ? 'text-red-650 font-black' : 'text-slate-900'}`}>
            {metrics.openDisputes}
          </span>
        </div>
      </div>

      {/* Revenue Chart Recharts Box */}
      <div className="bg-white p-4.5 rounded-2.5xl border border-slate-100 shadow-3xs space-y-3">
        <div className="flex items-center gap-1.5 border-b border-slate-50 pb-2">
          <TrendingUp className="w-4.5 h-4.5 text-rose-600" />
          <h3 className="font-extrabold text-slate-850 text-xs uppercase tracking-wide">Last 7 Days Sales Volume (MWK)</h3>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 'bold' }} stroke="#E2E8F0" />
              <YAxis tickFormater={(val: any) => val.toLocaleString()} tick={{ fontSize: 9, fill: '#64748B', fontWeight: 'bold' }} stroke="#E2E8F0" />
              <Tooltip 
                formatter={(val: any) => [`MWK ${val.toLocaleString()}`, 'Revenue']}
                contentStyle={{ borderRadius: '12px', fontSize: '11px', border: '1px solid #E2E8F0', fontWeight: 'bold', fontFamily: 'monospace' }}
              />
              <Bar dataKey="Revenue" fill="#E53935" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Leaderboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5.5">
        
        {/* Top 5 Products */}
        <div className="bg-white p-4.5 rounded-2.5xl border border-slate-100 shadow-3xs space-y-3.5">
          <div className="flex items-center gap-1.5 border-b border-slate-50 pb-2.5 justify-between">
            <span className="font-extrabold text-slate-850 text-xs uppercase tracking-wide flex items-center gap-1.5">
              <Award className="w-4.5 h-4.5 text-amber-500" /> Best Selling Products
            </span>
            <span className="text-[9.5px] text-slate-400 uppercase font-black">Times Ordered</span>
          </div>

          <div className="divide-y divide-slate-50">
            {topProducts.length === 0 ? (
              <p className="py-8 text-center text-slate-400 text-xs">No product listings found in records.</p>
            ) : (
              topProducts.map((prod, idx) => {
                const image = prod.imageUrl || prod.image || '📦';
                const isEmoji = image.length <= 4;
                return (
                  <div key={prod.id || idx} className="flex items-center gap-3.5 py-2 text-xs">
                    <span className="font-mono text-xs font-black text-slate-400 w-4">#{idx+1}</span>
                    <div className="w-9 h-9 bg-slate-50 border rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                      {isEmoji ? image : <img referrerPolicy="no-referrer" src={image} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-900 truncate">{prod.title || prod.name}</h4>
                      <span className="text-[10px] text-slate-450 uppercase font-sans font-bold">{prod.category || 'Local'}</span>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="font-mono font-black text-rose-600 text-[11px] block">{prod.sold || 0} sold</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top 5 Sellers */}
        <div className="bg-white p-4.5 rounded-2.5xl border border-slate-100 shadow-3xs space-y-3.5 font-sans">
          <div className="flex items-center gap-1.5 border-b border-slate-50 pb-2.5 justify-between">
            <span className="font-extrabold text-slate-850 text-xs uppercase tracking-wide flex items-center gap-1.5">
              <Store className="w-4.5 h-4.5 text-indigo-500" /> High-Volume Merchants
            </span>
            <span className="text-[9.5px] text-slate-400 uppercase font-black font-sans">Gross Volume</span>
          </div>

          <div className="divide-y divide-slate-50">
            {topSellers.length === 0 ? (
              <p className="py-8 text-center text-slate-400 text-xs">No active store profiles registered.</p>
            ) : (
              topSellers.map((s, idx) => (
                <div key={s.id || idx} className="flex items-center gap-3.5 py-2.5 text-xs">
                  <span className="font-mono text-xs font-black text-slate-400 w-4">#{idx+1}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-slate-900 truncate">{s.name}</h4>
                    <span className="text-[10px] text-slate-450 uppercase font-bold">{s.city || 'Malawi'}</span>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <span className="font-mono font-extrabold text-slate-900 text-[11.5px] block">MWK {(s.totalSales || 0).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Real-time onSnapshot orders section */}
      <div className="bg-white p-4.5 rounded-2.5xl border border-slate-100 shadow-3xs space-y-3.5">
        <div className="flex items-center gap-1.5 border-b border-slate-50 pb-2.5 justify-between">
          <span className="font-extrabold text-slate-850 text-xs uppercase tracking-wide flex items-center gap-1.5">
            <Clock className="w-4.5 h-4.5 text-rose-500" /> Recent Activity Feed (Live)
          </span>
          <span className="text-[9px] bg-red-50 text-red-700 px-2.5 py-0.5 rounded-full font-black animate-pulse uppercase tracking-wider">
            Live onSnapshot Connection
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[500px]">
             <thead>
               <tr className="text-slate-400 font-extrabold uppercase tracking-wider text-[9.5px] border-b border-slate-100 pb-2">
                 <th className="py-2">Order ID</th>
                 <th className="py-2">Buyer</th>
                 <th className="py-2">Merchant Store</th>
                 <th className="py-2">Total Amount</th>
                 <th className="py-2 text-right">Status</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-50 font-medium">
               {recentOrders.length === 0 ? (
                 <tr>
                   <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">Waiting for customer transactions...</td>
                 </tr>
               ) : (
                 recentOrders.map((ord) => (
                   <tr key={ord.id} className="hover:bg-slate-50/50 transition">
                     <td className="py-3 font-mono font-extrabold text-slate-900">#{ord.id?.slice(0, 7).toUpperCase()}</td>
                     <td className="py-3 text-slate-700">{ord.buyerName || 'ShopEasy Client'}</td>
                     <td className="py-3 text-slate-700">{ord.storeName || ord.sellerName || 'Local Partner'}</td>
                     <td className="py-3 font-mono font-bold text-slate-900">MWK {(ord.total || 0).toLocaleString()}</td>
                     <td className="py-3 text-right">
                       <span className={`text-[9.5px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${getOrderStatusBadgeColor(ord.status)}`}>
                         {ord.status || 'pending'}
                       </span>
                     </td>
                   </tr>
                 ))
               )}
             </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
