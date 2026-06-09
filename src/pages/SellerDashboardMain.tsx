import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, limit, orderBy } from 'firebase/firestore';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, 
  ShoppingBag, 
  Package, 
  Clock, 
  Star, 
  Users, 
  Plus, 
  ClipboardCheck, 
  Ticket, 
  AlertTriangle, 
  ArrowRight,
  RefreshCw,
  DollarSign
} from 'lucide-react';

interface Stats {
  totalSales: number;
  ordersTodayCount: number;
  activeProductsCount: number;
  pendingOrdersCount: number;
  rating: number;
  followers: number;
}

export default function SellerDashboardMain() {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalSales: 0,
    ordersTodayCount: 0,
    activeProductsCount: 0,
    pendingOrdersCount: 0,
    rating: 0,
    followers: 0
  });

  const [chartData, setChartData] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!uid) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Store Profile
        const storeDoc = await getDoc(doc(db, 'stores', uid));
        const storeData = storeDoc.exists() ? storeDoc.data() : null;
        setStore(storeData);

        // 2. Query Products Count
        const prodQuery = query(collection(db, 'products'), where('storeId', '==', uid), where('isActive', '==', true));
        const prodSnap = await getDocs(prodQuery);
        const activeProductsCount = prodSnap.size;

        // Find low stock products
        const lowStockList: any[] = [];
        prodSnap.forEach((doc) => {
          const p = doc.data();
          if (p.stock !== undefined && p.stock < 5) {
            lowStockList.push({ id: doc.id, ...p });
          }
        });
        setLowStockProducts(lowStockList);

        // 3. Query All Orders belonging to this Seller Store
        const ordQuery = query(collection(db, 'orders'), where('storeId', '==', uid));
        const ordSnap = await getDocs(ordQuery);

        let totalSalesSum = 0;
        let pendingOrdersCount = 0;
        let ordersTodayCount = 0;
        const allOrdersList: any[] = [];

        // Midnight for Today
        const midnight = new Date();
        midnight.setHours(0, 0, 0, 0);

        // Track last 7 days of completed orders
        const dailyCompSales: { [dateStr: string]: number } = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateString = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          dailyCompSales[dateString] = 0;
        }

        ordSnap.forEach((doc) => {
          const ord = doc.data();
          const ordWithId = { id: doc.id, ...ord };
          allOrdersList.push(ordWithId);

          // Created timestamp check
          let ordDate = new Date();
          if (ord.createdAt) {
            ordDate = ord.createdAt.seconds 
              ? new Date(ord.createdAt.seconds * 1000) 
              : new Date(ord.createdAt);
          }

          // Orders Today
          if (ordDate >= midnight) {
            ordersTodayCount++;
          }

          // Pending vs Completed Sales
          if (ord.status === 'processing') {
            pendingOrdersCount++;
          }

          if (ord.status === 'completed') {
            totalSalesSum += (ord.total || 0);
            
            const dateStr = ordDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (dailyCompSales[dateStr] !== undefined) {
              dailyCompSales[dateStr] += (ord.total || 0);
            }
          }
        });

        // Map sales chart array
        const formattedChart = Object.keys(dailyCompSales).map((key) => ({
          date: key,
          Amount: dailyCompSales[key]
        }));
        setChartData(formattedChart);

        // Set Recent Orders (last 5)
        const recent = allOrdersList
          .sort((a, b) => {
            const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime();
            const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime();
            return timeB - timeA;
          })
          .slice(0, 5);
        setRecentOrders(recent);

        // Update Stats Object
        setStats({
          totalSales: totalSalesSum,
          ordersTodayCount,
          activeProductsCount,
          pendingOrdersCount,
          rating: storeData?.rating || 0,
          followers: storeData?.followerCount || 0
        });

      } catch (err) {
        console.error("Error loaded seller statistics metrics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [uid]);

  // Format Malawi Currency values
  const formatMWK = (value: number) => {
    return 'MWK ' + value.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500" id="main-dash-loader">
        <div className="w-8 h-8 border-3 border-red-650 border-red-600 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs font-semibold">Tikalambula ziwerengero zanu... Loading statistics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5" id="seller-dash-main">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-800 text-white rounded-2xl p-4.5 shadow-md flex justify-between items-center relative overflow-hidden border border-slate-750">
        <div className="absolute right-[-10px] top-[-10px] text-7xl opacity-10 select-none">
          🏪
        </div>
        <div className="space-y-1">
          <span className="text-[10px] bg-red-600 text-white font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider">
            Approved Retailer
          </span>
          <h2 className="text-lg font-bold tracking-tight text-white mt-1">
            Welcome, {store?.name || 'ShopEasy Seller'}! 👋
          </h2>
          <p className="text-[10.5px] text-slate-300">
            {store?.city} Fulfillment Hub • Manage products, verify orders, and process payouts.
          </p>
        </div>
      </div>

      {/* 2x3 Grid Stats Cards */}
      <div className="grid grid-cols-2 gap-3.5">
        
        {/* Total Sales */}
        <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-3xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Sales</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs">💰</div>
          </div>
          <div className="mt-2.5">
            <h4 className="font-mono font-bold text-slate-900 text-sm">{formatMWK(stats.totalSales)}</h4>
            <span className="text-[9px] text-slate-400">Total completed earnings</span>
          </div>
        </div>

        {/* Orders Today */}
        <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-3xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Orders Today</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs">🛍️</div>
          </div>
          <div className="mt-2.5">
            <h4 className="font-bold text-slate-900 text-base font-mono">{stats.ordersTodayCount}</h4>
            <span className="text-[9px] text-slate-400">Since 12:00 AM midnight</span>
          </div>
        </div>

        {/* Active Products */}
        <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-3xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Products Live</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs">📦</div>
          </div>
          <div className="mt-2.5">
            <h4 className="font-bold text-slate-900 text-base font-mono">{stats.activeProductsCount}</h4>
            <span className="text-[9px] text-slate-400">In-stock active listings</span>
          </div>
        </div>

        {/* Pending Orders */}
        <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-3xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Orders</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg text-xs">⏳</div>
          </div>
          <div className="mt-2.5">
            <h4 className="font-bold text-slate-900 text-base font-mono">{stats.pendingOrdersCount}</h4>
            <span className="text-[9px] text-slate-400">Awaiting ready dispatch</span>
          </div>
        </div>

        {/* Store Rating */}
        <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-3xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Store Rating</span>
            <div className="p-1.5 bg-yellow-50 text-yellow-500 rounded-lg text-xs">⭐</div>
          </div>
          <div className="mt-2.5">
            <h4 className="font-bold text-slate-900 text-base font-mono flex items-center gap-1">
              {stats.rating > 0 ? stats.rating.toFixed(1) : 'New'} <span className="text-[11px] text-slate-400">/ 5.0</span>
            </h4>
            <span className="text-[9px] text-slate-400">Average buyer reviews</span>
          </div>
        </div>

        {/* Followers */}
        <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-3xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Store Followers</span>
            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs">👥</div>
          </div>
          <div className="mt-2.5">
            <h4 className="font-bold text-slate-900 text-base font-mono">{stats.followers}</h4>
            <span className="text-[9px] text-slate-400">Followed ShopEasy buyers</span>
          </div>
        </div>

      </div>

      {/* Sales Chart LineChart */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-3xs">
        <h4 className="font-bold text-slate-850 text-xs uppercase font-mono tracking-wider flex items-center gap-1.5 mb-3.5">
          <TrendingUp className="w-4.5 h-4.5 text-emerald-500" /> Cumulative Sales (Last 7 Days)
        </h4>

        <div className="w-full h-44 text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} tickFormatter={(val) => `K${val / 1000}k`} />
              <Tooltip 
                formatter={(value: any) => [`MWK ${value.toLocaleString()}`, 'Sales']}
                contentStyle={{ fontSize: '10px', background: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} 
              />
              <Line 
                type="monotone" 
                dataKey="Amount" 
                stroke="#dc2626" 
                strokeWidth={2.5} 
                dot={{ r: 3, stroke: '#fff', strokeWidth: 1.5, fill: '#dc2626' }}
                activeDot={{ r: 5 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Low Stock Indicators */}
      {lowStockProducts.length > 0 && (
        <div className="bg-red-50 border border-red-150 p-4 rounded-2xl space-y-2.5">
          <div className="flex items-center gap-1.5 text-red-800">
            <AlertTriangle className="w-5 h-5 text-red-650 animate-pulse" />
            <span className="font-extrabold text-xs uppercase tracking-wider">⚠️ Low Stock Warnings</span>
          </div>

          <div className="space-y-1.5">
            {lowStockProducts.map((p) => (
              <div key={p.id} className="bg-white border border-red-100 rounded-xl p-2.5 flex justify-between items-center text-xs shadow-3xs">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{p.imageUrl || '📦'}</span>
                  <div>
                    <h5 className="font-bold text-slate-900 line-clamp-1">{p.title || p.name}</h5>
                    <span className="text-[9.5px] text-red-600 font-bold font-mono">Only {p.stock} units remaining!</span>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/seller/products/edit/${p.id}`)}
                  className="bg-red-600 hover:bg-red-700 font-bold text-[10px] text-white px-2.5 py-1 rounded-md transition"
                >
                  Update Stock
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Access Actions Panels */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-3xs">
        <h4 className="font-bold text-slate-850 text-xs uppercase font-mono tracking-wider mb-2.5">
          Quick Merchant Actions
        </h4>
        <div className="grid grid-cols-3 gap-2 text-center text-[10.5px]">
          
          <button 
            onClick={() => navigate('/seller/products/new')}
            className="flex flex-col items-center justify-center p-3 bg-red-50/50 hover:bg-red-50 rounded-2xl border border-red-100 text-red-900 font-bold transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5 text-red-600 mb-1" />
            <span>List Product</span>
          </button>

          <button 
            onClick={() => navigate('/seller/orders')}
            className="flex flex-col items-center justify-center p-3 bg-indigo-50/40 hover:bg-indigo-50 rounded-2xl border border-indigo-100 text-indigo-900 font-bold transition-all hover:-translate-y-0.5"
          >
            <ShoppingBag className="w-5 h-5 text-indigo-600 mb-1" />
            <span>Fulfill Orders</span>
          </button>

          <button 
            onClick={() => navigate('/seller/coupons')}
            className="flex flex-col items-center justify-center p-3 bg-amber-50/40 hover:bg-amber-50 rounded-2xl border border-amber-100 text-amber-900 font-bold transition-all hover:-translate-y-0.5"
          >
            <Ticket className="w-5 h-5 text-amber-600 mb-1" />
            <span>Give Coupons</span>
          </button>

        </div>
      </div>

      {/* Recent Orders List */}
      <div className="bg-white rounded-2xl p-4.5 border border-slate-100 shadow-3xs space-y-3.5">
        <div className="flex justify-between items-center">
          <h4 className="font-bold text-slate-850 text-xs uppercase font-mono tracking-wider flex items-center gap-1.5">
            <ClipboardCheck className="w-4.5 h-4.5 text-slate-500" /> Recent Buyer Orders
          </h4>
          <button 
            onClick={() => navigate('/seller/orders')} 
            className="text-[10.5px] text-indigo-600 font-extrabold hover:underline flex items-center gap-0.5"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            No orders received yet. Once local buyers purchase, they appear here!
          </div>
        ) : (
          <div className="divide-y divide-slate-100 space-y-2.5">
            {recentOrders.map((ord) => {
              const bName = ord.buyerName?.split(' ')[0] || 'Buyer';
              
              const isComp = ord.status === 'completed';
              const isProc = ord.status === 'processing';
              const isCan = ord.status === 'cancelled';

              return (
                <div key={ord.id} className="flex items-center justify-between pt-2.5 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl bg-slate-50 p-1.5 rounded-lg border">🛒</span>
                    <div>
                      <h4 className="font-bold text-slate-800 flex items-center gap-1">
                        #{ord.id.slice(0, 7).toUpperCase()} <span className="text-[10px] text-slate-400 font-normal">by {bName}</span>
                      </h4>
                      <span className="text-[10.5px] font-bold text-red-600 block mt-0.5 font-mono">
                        {formatMWK(ord.total || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className={`text-[9.5px] px-2 py-0.5 font-extrabold rounded-full uppercase ${
                      isComp ? 'bg-emerald-50 text-emerald-800' : isProc ? 'bg-amber-50 text-amber-800' : isCan ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-800'
                    }`}>
                      {ord.status}
                    </span>
                    
                    <button
                      onClick={() => navigate('/seller/orders')}
                      className="text-[10px] text-indigo-600 font-semibold hover:underline"
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
