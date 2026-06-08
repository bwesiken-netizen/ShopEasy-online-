import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCartStore, useAuthStore } from '../stores';
import { 
  Sparkles, Shield, Compass, Award, Tag, Flame, Users, Grid, 
  Search, ArrowUpDown, ChevronRight, Check, Heart, Plus, ShoppingBag, 
  HelpCircle, RefreshCw, Layers, Database
} from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { SEED_CATEGORIES, SEED_PRODUCTS, FirestoreProduct } from '../data/seedData';
import { seedMarketplaceFirestore } from '../utils/dbSeeder';

// Complete List of EXACTLY 20 Categories
const TWENTY_CATEGORIES = [
  { slug: 'automotive', name: 'Automotive', emoji: '🚗' },
  { slug: 'appliances', name: 'Appliances', emoji: '🔌' },
  { slug: 'womens-clothing', name: "Women's Clothing", emoji: '👗' },
  { slug: 'mens-clothing', name: "Men's Clothing", emoji: '👕' },
  { slug: 'toys-games', name: 'Toys & Games', emoji: '🧸' },
  { slug: 'furniture', name: 'Furniture', emoji: '🛋️' },
  { slug: 'beauty-health', name: 'Beauty & Health', emoji: '💄' },
  { slug: 'shoes', name: 'Shoes', emoji: '👟' },
  { slug: 'hair-wigs', name: 'Hair & Wigs', emoji: '💇‍♀️' },
  { slug: 'pet-supplies', name: 'Pet Supplies', emoji: '🐶' },
  { slug: 'jewelry', name: 'Jewelry', emoji: '👑' },
  { slug: 'cell-phones', name: 'Cell Phones', emoji: '📱' },
  { slug: 'electronics', name: 'Electronics', emoji: '💻' },
  { slug: 'tools', name: 'Tools', emoji: '🔧' },
  { slug: 'baby-maternity', name: 'Baby & Maternity', emoji: '👶' },
  { slug: 'bags-luggage', name: 'Bags & Luggage', emoji: '🧳' },
  { slug: 'food-groceries', name: 'Food & Groceries', emoji: '🍎' },
  { slug: 'farming-supplies', name: 'Farming Supplies', emoji: '🌽' },
  { slug: 'building-materials', name: 'Building Materials', emoji: '🧱' },
  { slug: 'books-stationery', name: 'Books & Stationery', emoji: '📚' }
];

export default function Shop() {
  const navigate = useNavigate();
  const { addItem, items: cartItems } = useCartStore();
  const { user } = useAuthStore();

  // Selected state
  const [activeCategorySlug, setActiveCategorySlug] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('For You'); // For You | New Arrivals | Computer & Accessories | Kitchen & Dining | Clothing
  
  // Products storage
  const [products, setProducts] = useState<FirestoreProduct[]>(SEED_PRODUCTS);
  const [loading, setLoading] = useState<boolean>(true);
  const [dbStatus, setDbStatus] = useState<string>('loading'); // loading | empty | active
  const [seedingLoading, setSeedingLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Trigger floating alert
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Format currency MWK
  const formatMWK = (val: number) => {
    return 'MWK ' + Math.round(val).toLocaleString();
  };

  // Load products from Firestore
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const prodCollection = collection(db, 'products');
      const snapshot = await getDocs(prodCollection);

      if (snapshot.empty) {
        setDbStatus('empty');
        // Fallback directly to high-fidelity seed fallbacks
        setProducts(SEED_PRODUCTS);
      } else {
        const loaded: FirestoreProduct[] = [];
        snapshot.forEach((doc) => {
          loaded.push({ id: doc.id, ...doc.data() } as FirestoreProduct);
        });
        setProducts(loaded);
        setDbStatus('active');
      }
    } catch (err) {
      console.warn("Could not retrieve Firestore products, using high-fidelity local dataset:", err);
      setProducts(SEED_PRODUCTS);
      setDbStatus('offline_fallback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Quick seed handler
  const handleDatabaseSeed = async () => {
    try {
      setSeedingLoading(true);
      triggerToast("⏳ Populating database collections...");
      const result = await seedMarketplaceFirestore(true); // force write
      if (result?.success) {
        triggerToast("🎉 Database seeded successfully!");
        await fetchProducts();
      } else {
        triggerToast("Error seeding: " + result?.message);
      }
    } catch (err) {
      triggerToast("Failed writing to database.");
    } finally {
      setSeedingLoading(false);
    }
  };

  // Category list filter
  const currentCategoryObj = TWENTY_CATEGORIES.find(c => c.slug === activeCategorySlug);

  // Recommendations tab filter helper
  // Tab options: For You | New Arrivals | Computer & Accessories | Kitchen & Dining | Clothing
  const getTabFilteredProducts = (list: FirestoreProduct[]) => {
    let filtered = [...list];

    // Filter by Top category selector first
    if (activeCategorySlug !== 'all') {
      filtered = filtered.filter(p => p.category === activeCategorySlug);
    }

    // Apply the tab specific filter
    if (activeTab === 'New Arrivals') {
      // Sort newest (based on ID or fake date)
      filtered.sort((a, b) => b.id.localeCompare(a.id));
    } else if (activeTab === 'Computer & Accessories') {
      filtered = filtered.filter(p => p.category === 'cell-phones' || p.category === 'electronics');
    } else if (activeTab === 'Kitchen & Dining') {
      filtered = filtered.filter(p => p.category === 'appliances' || p.category === 'furniture');
    } else if (activeTab === 'Clothing') {
      filtered = filtered.filter(p => p.category === 'womens-clothing' || p.category === 'mens-clothing' || p.category === 'shoes' || p.category === 'hair-wigs');
    }

    return filtered;
  };

  const filteredRecommendedList = getTabFilteredProducts(products);

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F7F9] font-sans pb-20">
      
      {/* Dynamic Toast Message */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 border border-neutral-800 text-white font-extrabold text-[10px] uppercase tracking-wider py-2.5 px-5 rounded-full shadow-2xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#E53935] animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. BLUE HIGH-CONTRAST TOP BANNER */}
      <div 
        className="bg-gradient-to-r from-blue-700 to-blue-650 text-white py-2.5 px-4 text-center font-bold text-xs select-none shadow-xs flex items-center justify-center gap-1.5 shrink-0"
        id="free-delivery-banner"
      >
        <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>Free local delivery on Choice items 🇲🇼</span>
        <span className="bg-amber-400 text-neutral-900 font-sans px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ml-1">CHOICE</span>
      </div>

      {/* 2. SUB-BAR NAVIGATORS (Bulk Saver hub & Top Rankings hubs links) */}
      <div className="bg-white border-b border-neutral-100 py-2.5 px-3 flex gap-2 overflow-x-auto scrollbar-none shrink-0 shadow-2xs">
        <button
          onClick={() => navigate('/shop/rankings')}
          className="flex items-center gap-1.5 py-1.5 px-3 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 shrink-0 text-amber-900 text-[10px] font-black uppercase transition-all"
          id="see-rankings-nav-btn"
        >
          <span>🏆 Top Rankings</span>
          <ChevronRight className="h-3 w-3" />
        </button>

        <button
          onClick={() => navigate('/shop/bulk')}
          className="flex items-center gap-1.5 py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 shrink-0 text-emerald-900 text-[10px] font-black uppercase transition-all"
          id="see-bulk-nav-btn"
        >
          <span>📦 Bulk Saver Hub</span>
          <ChevronRight className="h-3 w-3" />
        </button>

        {dbStatus === 'empty' && (
          <button
            onClick={handleDatabaseSeed}
            disabled={seedingLoading}
            className="flex items-center gap-1 py-1.5 px-3 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 shrink-0 text-red-700 text-[10px] font-black uppercase transition-all animate-pulse"
            id="seed-quick-sidebar-btn"
          >
            <Database className="h-3 w-3" />
            <span>{seedingLoading ? "Seeding..." : "Seed Firestore DB"}</span>
          </button>
        )}
      </div>

      {/* 3. HORIZONTAL TAB BAR */}
      <div className="bg-white sticky top-0 z-10 border-b border-neutral-100 flex overflow-x-auto scrollbar-none shrink-0 shadow-3xs" id="shop-tabs-row">
        {[
          'For You', 
          'New Arrivals', 
          'Computer & Accessories', 
          'Kitchen & Dining', 
          'Clothing'
        ].map((tab) => {
          const isSelected = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3.5 px-5 font-black text-[10px] uppercase tracking-wider transition-all border-b-2 whitespace-nowrap shrink-0 ${
                isSelected 
                  ? 'border-[#E53935] text-[#E53935] bg-red-50/10' 
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
              id={`tab-pill-${tab.replace(/\s+/g, '-').toLowerCase()}`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* 4. MAIN THREE-COLUMN/SPLIT VIEWPORT LAYOUT */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT SIDEBAR: Sticky independently scrollable list of 20 categories */}
        <div 
          className="w-20 sm:w-24 bg-white border-r border-neutral-100 flex flex-col overflow-y-auto shrink-0 select-none scrollbar-none py-1"
          style={{ height: 'calc(100vh - 170px)' }}
          id="shop-categories-sidebar-scroller"
        >
          {/* "All" button */}
          <button
            onClick={() => setActiveCategorySlug('all')}
            className={`flex flex-col items-center justify-center py-4 px-1 gap-1 border-b border-neutral-50 transition-all ${
              activeCategorySlug === 'all'
                ? 'bg-[#E53935]/5 border-l-4 border-l-[#E53935] text-[#E53935]'
                : 'text-neutral-500 hover:bg-neutral-50'
            }`}
            id="cat-sidebar-pill-all"
          >
            <span className="text-lg">🛍️</span>
            <span className="text-[8px] font-black uppercase text-center leading-tight tracking-tight break-words max-w-[65px]">
              All Items
            </span>
          </button>

          {/* List of 20 categories */}
          {TWENTY_CATEGORIES.map((cat) => {
            const isSelected = activeCategorySlug === cat.slug;
            return (
              <button
                key={cat.slug}
                onClick={() => setActiveCategorySlug(cat.slug)}
                className={`flex flex-col items-center justify-center py-4 px-1.5 gap-1 border-b border-neutral-50 transition-all ${
                  isSelected
                    ? 'bg-[#E53935]/5 border-l-4 border-l-[#E53935] text-[#E53935]'
                    : 'text-neutral-500 hover:bg-neutral-50'
                }`}
                id={`cat-sidebar-pill-${cat.slug}`}
              >
                <div className="text-xl leading-none">{cat.emoji}</div>
                <span className="text-[8px] font-bold text-center leading-tight tracking-tight break-words max-w-[68px]">
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* RIGHT PANEL: Recommended grid (scrollable container) */}
        <div 
          className="flex-1 overflow-y-auto p-3 flex flex-col gap-3"
          style={{ height: 'calc(100vh - 170px)' }}
          id="shop-recommended-pane"
        >
          {/* Category Banner Title inside Right Panel */}
          <div className="flex items-center justify-between bg-white rounded-2xl border border-neutral-100 p-3 shadow-3xs">
            <div>
              <span className="text-[7px] uppercase font-black tracking-widest text-[#E53935]">AIS Recommended</span>
              <h2 className="font-display font-black text-xs text-neutral-900 uppercase">
                {activeCategorySlug === 'all' ? 'Featured Products' : currentCategoryObj?.name} {currentCategoryObj?.emoji}
              </h2>
            </div>

            {/* If specific category is selection, provide explicit Link or Button to open that full Category Page */}
            {activeCategorySlug !== 'all' && (
              <Link
                to={`/shop/category/${activeCategorySlug}`}
                className="py-1 px-2.5 bg-[#E53935] text-white text-[9px] font-black uppercase tracking-wider rounded-lg hover:bg-red-700 transition-all flex items-center gap-0.5 whitespace-nowrap"
                id="visit-category-page-btn"
              >
                <span>Filters</span>
                <ChevronRight className="h-3 w-3 shrink-0" />
              </Link>
            )}
          </div>

          {/* Seeding suggestion banner in recommended panel if DB is blank */}
          {dbStatus === 'empty' && (
            <div className="bg-yellow-50 border border-yellow-250 p-3.5 rounded-2xl flex flex-col gap-2">
              <div className="text-[9px] font-extrabold text-amber-800 uppercase tracking-wide">
                📢 FIRESTORE IS VACANT
              </div>
              <p className="text-[9px] text-neutral-600 leading-relaxed font-bold">
                Your sandbox instance is empty. You can browse via fallbacks OR seed real mock collections under standard schema.
              </p>
              <button
                onClick={handleDatabaseSeed}
                disabled={seedingLoading}
                className="w-full py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-[9px] font-black uppercase tracking-wider rounded-lg transition-all"
              >
                {seedingLoading ? "Seeding..." : "Populate Firestore Database Now"}
              </button>
            </div>
          )}

          {/* Recommended Product Grid: 2 Column Layout with Mobile first metrics */}
          {loading ? (
            <div className="grid grid-cols-2 gap-2.5">
              {[1, 2, 3, 4].map(idx => (
                <div key={idx} className="bg-white rounded-2xl p-2.5 border border-neutral-100 h-44 animate-pulse">
                  <div className="h-20 bg-neutral-100 rounded-xl" />
                  <div className="h-3 bg-neutral-150 rounded mt-3 w-4/5" />
                  <div className="h-3 bg-neutral-150 rounded mt-2.5 w-2/4" />
                </div>
              ))}
            </div>
          ) : filteredRecommendedList.length === 0 ? (
            <div className="bg-white border select-none border-neutral-100 rounded-3xl p-8 text-center flex flex-col items-center justify-center gap-1">
              <span className="text-4xl">🌵</span>
              <h4 className="font-display font-black text-xs text-neutral-900 uppercase mt-2">No Items Found</h4>
              <p className="text-[9px] text-neutral-500 max-w-xs leading-relaxed font-bold">
                No matching products found under this specific combination of recommendations. Try selecting "All Items" on the left!
              </p>
              <button
                onClick={() => {
                  setActiveCategorySlug('all');
                  setActiveTab('For You');
                }}
                className="mt-3.5 text-[9px] font-black bg-[#E53935] text-white py-2 px-4 rounded-full uppercase"
              >
                Clear Selections
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5" id="shop-recommended-grid">
              {filteredRecommendedList.map((prod) => {
                const inCartItem = cartItems.find((i) => i.productId === prod.id);
                return (
                  <div
                    key={prod.id}
                    onClick={() => navigate(`/product/${prod.id}`)}
                    className="bg-white rounded-2xl border border-neutral-100 shadow-3xs overflow-hidden flex flex-col group cursor-pointer justify-between border-b-2 hover:border-[#E53935] transition-all"
                    id={`shop-recommended-card-${prod.id}`}
                  >
                    <div>
                      {/* Product display and badge */}
                      <div className="relative h-24 bg-neutral-50/70 py-4 flex items-center justify-center text-4xl select-none shrink-0">
                        {prod.images?.[0] || prod.imageUrl || '📦'}

                        {/* Choice badge */}
                        {prod.isChoice && (
                          <span className="absolute top-1.5 left-1.5 text-[7px] font-black tracking-widest bg-blue-600 text-white py-0.5 px-1.5 rounded uppercase font-sans whitespace-nowrap shadow-xs">
                            Choice
                          </span>
                        )}

                        {/* Discount Ribbon */}
                        {prod.discountPercent > 0 && (
                          <span className="absolute top-1.5 right-1.5 text-[7px] font-black bg-[#E53935] text-white py-0.5 px-1.5 rounded">
                            -{prod.discountPercent}%
                          </span>
                        )}

                        {/* Bulk indication */}
                        {prod.isBulk && (
                          <span className="absolute bottom-1.5 left-1.5 text-[6px] font-black tracking-wider bg-emerald-600 text-white py-0.5 px-1.5 rounded uppercase">
                            Bulk Saver
                          </span>
                        )}
                      </div>

                      <div className="p-2.5">
                        <span className="text-[7.5px] font-extrabold uppercase text-[#E53935] leading-none mb-1 block">
                          {prod.categoryName}
                        </span>
                        <h4 className="text-[10px] font-black text-neutral-950 line-clamp-2 leading-snug group-hover:text-[#E53935] transition-colors">
                          {prod.title || prod.name}
                        </h4>

                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-amber-400 text-xs">★</span>
                          <span className="text-[9px] font-extrabold text-neutral-800">{prod.rating || '4.5'}</span>
                          <span className="text-[8px] text-neutral-400">({prod.sold || 45} sold)</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 pt-0 border-t border-neutral-50/60 mt-1 flex items-center justify-between">
                      <div className="flex flex-col">
                        {prod.originalPrice && prod.originalPrice > prod.price && (
                          <span className="text-[7.5px] text-neutral-400 font-bold line-through leading-none">
                            {formatMWK(prod.originalPrice)}
                          </span>
                        )}
                        <span className="font-mono text-[10.5px] font-black text-neutral-900 leading-none">
                          {formatMWK(prod.price)}
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addItem({
                            id: prod.id,
                            storeId: prod.sellerId,
                            storeName: prod.sellerName,
                            name: prod.title || prod.name,
                            description: prod.description || '',
                            price: prod.price,
                            imageUrl: prod.imageUrl || prod.images?.[0] || '📦',
                            city: prod.sellerCity || prod.city,
                            stock: prod.stock,
                            active: prod.isActive ?? true,
                            featured: prod.isFeatured ?? false,
                            category: prod.categoryName || prod.category,
                            createdAt: prod.createdAt
                          }, 1);
                          triggerToast("Added item to shopping basket!");
                        }}
                        className={`h-6 w-6 rounded-full flex items-center justify-center transition-all ${
                          inCartItem
                            ? 'bg-emerald-500 text-white'
                            : 'bg-neutral-100 hover:bg-[#E53935] hover:text-white text-neutral-700'
                        }`}
                        title="Add to Cart"
                      >
                        {inCartItem ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick security warning footer inside panels */}
          <div className="text-center py-3 border-t border-neutral-100/50 mt-2 select-none">
            <span className="text-[7.5px] font-extrabold text-neutral-400 uppercase tracking-widest block">
              🔒 Standard local SSL merchant security
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
