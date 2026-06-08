import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../stores';
import { ChevronLeft, Award, Flame, Star, ShoppingCart, Check, Plus } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { SEED_PRODUCTS, FirestoreProduct } from '../data/seedData';

type RankingTab = 'All' | 'Electronics' | 'Fashion' | 'Food' | 'Phones';

export default function TopRankings() {
  const navigate = useNavigate();
  const { addItem, items: cartItems } = useCartStore();
  const [activeTab, setActiveTab] = useState<RankingTab>('All');
  const [products, setProducts] = useState<FirestoreProduct[]>(SEED_PRODUCTS);
  const [loading, setLoading] = useState<boolean>(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Fetch products from firestore to rank them
  const fetchRankings = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'products')
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setProducts(SEED_PRODUCTS);
      } else {
        const list: FirestoreProduct[] = [];
        snap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as FirestoreProduct);
        });
        setProducts(list);
      }
    } catch (err) {
      console.warn("Could not query Firestore for rankings, using seed fallback:", err);
      setProducts(SEED_PRODUCTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRankings();
  }, []);

  const formatMWK = (val: number) => {
    return 'MWK ' + Math.round(val).toLocaleString();
  };

  // Categorize for rankings tabs
  const getTabFilteredRankedProducts = () => {
    let list = [...products];

    if (activeTab === 'Electronics') {
      list = list.filter(p => p.category === 'electronics' || p.category === 'appliances');
    } else if (activeTab === 'Fashion') {
      list = list.filter(p => p.category === 'womens-clothing' || p.category === 'mens-clothing' || p.category === 'shoes' || p.category === 'hair-wigs' || p.category === 'jewelry');
    } else if (activeTab === 'Food') {
      list = list.filter(p => p.category === 'food-groceries' || p.category === 'farming-supplies');
    } else if (activeTab === 'Phones') {
      list = list.filter(p => p.category === 'cell-phones');
    }

    // Sort by sold quantity DESC
    return list.sort((a, b) => (b.sold || 0) - (a.sold || 0));
  };

  const rankedProductsList = getTabFilteredRankedProducts();

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F7F9] font-sans pb-24">
      
      {/* Toast box popup */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#212121] text-white py-2 px-5 rounded-full text-[10px] uppercase font-black font-sans shadow-xl">
          {toastMsg}
        </div>
      )}

      {/* HEADER ROW */}
      <div 
        className="sticky top-0 z-20 bg-white border-b border-neutral-150 py-3.5 px-3 flex items-center gap-3 shadow-3xs shrink-0"
        id="rankings-header-row"
      >
        <button
          onClick={() => navigate('/shop')}
          className="p-1.5 bg-neutral-50 rounded-xl hover:bg-neutral-150 transition-all border border-neutral-200 text-neutral-800 flex items-center text-[9px] font-black uppercase tracking-wider gap-0.5"
          id="rankings-back-btn"
        >
          <ChevronLeft className="h-4 w-4 stroke-[2.5px]" />
          <span>Shop</span>
        </button>

        <div>
          <span className="text-[7px] uppercase font-black text-rose-600 tracking-widest block leading-none">
            AIS Malawi Leaderboard
          </span>
          <h1 className="font-display font-black text-xs text-neutral-900 uppercase tracking-tight mt-0.5">
            🏆 Top Sellers Today
          </h1>
        </div>
      </div>

      {/* RANKINGS TABS ROW */}
      <div 
        className="bg-white border-b border-neutral-100 flex overflow-x-auto scrollbar-none shrink-0"
        id="rankings-category-tabs"
      >
        {(['All', 'Electronics', 'Fashion', 'Food', 'Phones'] as RankingTab[]).map(tab => {
          const isSelected = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                triggerToast(`Pivoted to: ${tab} Rankings`);
              }}
              className={`py-3.5 px-5 font-black text-[10px] uppercase tracking-wider border-b-2 transition-all whitespace-nowrap flex-1 text-center ${
                isSelected 
                  ? 'border-rose-600 text-rose-600 bg-rose-50/5' 
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* QUICK INFO BANNER */}
      <div className="bg-amber-50/70 border-b border-amber-150 py-2.5 px-3.5 flex items-center gap-2 text-amber-900 text-[9px] font-bold shrink-0">
        <Flame className="h-3.5 w-3.5 text-amber-500 shrink-0 fill-amber-500 animate-pulse" />
        <span>Rankings are updated hourly based on sales volume within Blantyre, Lilongwe, Mzuzu, and Zomba.</span>
      </div>

      {/* DISPLAY LIST AREA */}
      <div className="flex-1 p-3.5">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map(idx => (
              <div key={idx} className="bg-white rounded-2xl p-3 border border-neutral-100 h-16 animate-pulse" />
            ))}
          </div>
        ) : rankedProductsList.length === 0 ? (
          <div className="bg-white rounded-3xl border border-neutral-150 p-8 text-center flex flex-col items-center justify-center gap-1 mt-6">
            <span className="text-3xl">🏜️</span>
            <h3 className="font-display font-black text-xs text-neutral-900 uppercase">Leaderboard Empty</h3>
            <p className="text-[9px] text-neutral-500 max-w-xs leading-relaxed font-black">
              No sales have been registered under this specific category filter yet today.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5" id="rankings-list-rows">
            {rankedProductsList.map((item, index) => {
              const rank = index + 1;
              const inCart = cartItems.find(i => i.productId === item.id);

              // Rank style parameters
              let rankStyle = "bg-neutral-100 text-neutral-700 border-neutral-200";
              let medalIcon = "";
              if (rank === 1) {
                rankStyle = "bg-amber-100 text-amber-800 border-amber-300 font-black shadow-xs ring-2 ring-amber-200";
                medalIcon = "🥇";
              } else if (rank === 2) {
                rankStyle = "bg-slate-100 text-slate-800 border-slate-300 font-black shadow-xs ring-2 ring-slate-150";
                medalIcon = "🥈";
              } else if (rank === 3) {
                rankStyle = "bg-amber-600/10 text-amber-900 border-amber-650/40 font-black shadow-xs ring-2 ring-amber-600/5";
                medalIcon = "🥉";
              }

              return (
                <div
                  key={item.id}
                  onClick={() => navigate(`/product/${item.id}`)}
                  className="bg-white rounded-2xl border border-neutral-100 shadow-3xs p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:border-rose-600 transition-all border-b-2"
                  id={`ranking-row-#${rank}-${item.id}`}
                >
                  <div className="flex items-center gap-3">
                    
                    {/* Rank Badge Indicator */}
                    <div className={`h-8 w-8 rounded-xl border flex flex-col items-center justify-center text-[11px] font-sans font-black tracking-tighter shrink-0 ${rankStyle}`}>
                      {medalIcon ? (
                        <div className="flex flex-col items-center leading-none">
                          <span className="text-[12px]">{medalIcon}</span>
                        </div>
                      ) : (
                        <span>#{rank}</span>
                      )}
                    </div>

                    {/* Small product Icon/Thumb */}
                    <div className="h-12 w-12 rounded-xl bg-neutral-50 flex items-center justify-center text-2xl select-none shrink-0 border border-neutral-100">
                      {item.images?.[0] || item.imageUrl || '📦'}
                    </div>

                    {/* Meta info */}
                    <div className="flex flex-col">
                      <span className="text-[7.5px] uppercase font-black text-rose-600 leading-none mb-1">
                        {item.categoryName}
                      </span>
                      <h4 className="text-[10px] font-black text-neutral-900 leading-snug line-clamp-1 max-w-[150px] sm:max-w-[200px]">
                        {item.title || item.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 leading-none">
                        <span className="font-mono text-[9.5px] font-mono font-bold text-neutral-500">
                          {formatMWK(item.price)}
                        </span>
                        <span className="text-[7px] text-neutral-400 font-extrabold uppercase leading-none bg-neutral-50 py-0.5 px-1.5 rounded-full border border-neutral-100">
                          {item.sellerCity || item.city}
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* Sold details count block */}
                  <div className="flex items-center gap-3.5 pl-2">
                    <div className="text-right flex flex-col shrink-0">
                      <span className="text-[10.5px] font-sans font-black text-neutral-950 block leading-none">
                        {item.sold || (45 + rank * 5)}
                      </span>
                      <span className="text-[7px] text-neutral-400 font-extrabold uppercase mt-1 block">
                        Sold Today
                      </span>
                    </div>

                    {/* Buy controls */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addItem({
                          id: item.id,
                          storeId: item.sellerId || item.storeId,
                          storeName: item.sellerName || item.storeName,
                          name: item.title || item.name,
                          description: item.description || '',
                          price: item.price,
                          imageUrl: item.imageUrl || item.images?.[0] || '📦',
                          city: item.sellerCity || item.city,
                          stock: item.stock,
                          active: item.isActive ?? true,
                          featured: item.isFeatured ?? false,
                          category: item.categoryName || item.category,
                          createdAt: item.createdAt
                        }, 1);
                        triggerToast("Added to shopping cart!");
                      }}
                      className={`h-7 w-7 rounded-full flex items-center justify-center transition-all ${
                        inCart
                          ? 'bg-emerald-500 text-white'
                          : 'bg-neutral-100 hover:bg-rose-600 hover:text-white text-neutral-700'
                      }`}
                    >
                      {inCart ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
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
