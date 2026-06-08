import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Search as SearchIcon, ArrowLeft, Camera, Trash2, X, 
  ChevronDown, ChevronUp, Check, RefreshCw 
} from 'lucide-react';
import { useCartStore, useAuthStore } from '../stores';
import { SEED_PRODUCTS } from '../data/seedData';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, setDoc, limit } from 'firebase/firestore';

interface SearchResultProduct {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  images?: string[];
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  category?: string;
  categoryName?: string;
  sellerId?: string;
  sellerName?: string;
  sellerCity?: string;
  city?: string;
  stock: number;
  sold?: number;
  rating?: number;
  reviewCount?: number;
  freeDelivery?: boolean;
  isBulk?: boolean;
  isChoice?: boolean;
  isActive?: boolean;
  searchKeywords?: string[];
  createdAt?: string;
}

export default function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';

  const { user } = useAuthStore();
  const { addItem, items: cartItems } = useCartStore();

  // Search input state
  const [inputValue, setInputValue] = useState(queryParam);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sale countdown state
  const [countdown, setCountdown] = useState('02:14:05');

  // Search history state
  const [historyChips, setHistoryChips] = useState<string[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Search results state
  const [results, setResults] = useState<SearchResultProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<'loading' | 'firestore' | 'fallback'>('loading');

  // Filters and sorting state
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'free_delivery' | 'under_50k' | 'rating_4' | 'on_sale'>('all');
  const [selectedSort, setSelectedSort] = useState<'best' | 'price_asc' | 'price_desc' | 'sold_desc'>('best');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync query parameter with input value
  useEffect(() => {
    setInputValue(queryParam);
    if (queryParam) {
      executeSearch(queryParam);
    }
  }, [queryParam]);

  // Ticking Countdown
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      // Ends at end of current local day
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const diffMs = endOfDay.getTime() - now.getTime();
      
      if (diffMs <= 0) {
        setCountdown('00:00:00');
        return;
      }
      
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      const s = Math.floor((diffMs % 60000) / 1000);
      setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync Search History from LocalStorage and Firestore
  useEffect(() => {
    async function loadSearchHistory() {
      // 1. Initial load from localstorage
      const localHistoryRaw = localStorage.getItem('shopeasy_search_history');
      let localHistory: string[] = [];
      if (localHistoryRaw) {
        try {
          localHistory = JSON.parse(localHistoryRaw);
        } catch (e) {
          console.error(e);
        }
      }

      setHistoryChips(localHistory);

      // 2. Cross-device sync if user is logged in
      if (user?.uid) {
        try {
          const snap = await getDocs(collection(db, 'users', user.uid, 'searchHistory'));
          const firestoreTerms: string[] = [];
          snap.forEach((doc) => {
            const data = doc.data();
            if (data.query) {
              firestoreTerms.push(data.query);
            }
          });

          // Merge: most recent first, unique items
          const merged = Array.from(new Set([...firestoreTerms, ...localHistory])).slice(0, 15);
          setHistoryChips(merged);
          localStorage.setItem('shopeasy_search_history', JSON.stringify(merged));
        } catch (error) {
          console.warn("Could not retrieve Firestore searchHistory subcollection:", error);
        }
      }
    }
    
    // Only load if search query is empty (we are on the landing search page)
    if (!queryParam) {
      loadSearchHistory();
    }
  }, [user?.uid, queryParam]);

  // Execute actual keyword search
  const executeSearch = async (searchTerm: string) => {
    const kw = searchTerm.toLowerCase().trim();
    if (!kw) return;

    setLoading(true);

    // Save term to history
    saveSearchTerm(searchTerm);

    try {
      // Perform array-contains search based on Firestore index schema
      const prodCollection = collection(db, 'products');
      const q = query(
        prodCollection,
        where('searchKeywords', 'array-contains', kw),
        limit(40)
      );
      
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const firestoreList: SearchResultProduct[] = [];
        snapshot.forEach((doc) => {
          firestoreList.push({ id: doc.id, ...doc.data() } as SearchResultProduct);
        });

        // Ensure we filter out any inactive rows
        const activeList = firestoreList.filter(p => p.isActive !== false);
        setResults(activeList);
        setDbStatus('firestore');
      } else {
        // Fallback: Check checking locally and check if firestore collection has items
        const rawCollectionSnap = await getDocs(collection(db, 'products'));
        if (!rawCollectionSnap.empty) {
          const allDocs: SearchResultProduct[] = [];
          rawCollectionSnap.forEach(d => {
            allDocs.push({ id: d.id, ...d.data() } as SearchResultProduct);
          });
          
          // Fuzzy search in title, description, category, tags
          const localMatch = allDocs.filter(p => matchLocalText(p, kw) && p.isActive !== false);
          setResults(localMatch);
          setDbStatus('firestore');
        } else {
          // Absolute offline fallback
          const localOnly = SEED_PRODUCTS.filter(p => matchLocalText(p, kw));
          setResults(localOnly);
          setDbStatus('fallback');
        }
      }
    } catch (e) {
      console.warn("Error running Firestore array query, running safe local filter:", e);
      // Fallback with zero database errors
      const localOnly = SEED_PRODUCTS.filter(p => matchLocalText(p, kw));
      setResults(localOnly);
      setDbStatus('fallback');
    } finally {
      setLoading(false);
    }
  };

  const matchLocalText = (p: any, kw: string): boolean => {
    const titleMatch = (p.title || p.name || '').toLowerCase().includes(kw);
    const descMatch = (p.description || '').toLowerCase().includes(kw);
    const catMatch = (p.categoryName || p.category || '').toLowerCase().includes(kw);
    const tagMatch = (p.tags || []).some((t: string) => t.toLowerCase().includes(kw));
    return titleMatch || descMatch || catMatch || tagMatch;
  };

  // Helper to persist search keywords
  const saveSearchTerm = async (term: string) => {
    const cleaned = term.trim();
    if (!cleaned) return;

    // Update locally
    const filteredOld = historyChips.filter(c => c.toLowerCase() !== cleaned.toLowerCase());
    const updated = [cleaned, ...filteredOld].slice(0, 15);
    setHistoryChips(updated);
    localStorage.setItem('shopeasy_search_history', JSON.stringify(updated));

    // Update in Firestore for cross-device synchronization
    if (user?.uid) {
      try {
        const id = cleaned.toLowerCase().replace(/[^a-z0-9]/g, '_');
        await setDoc(doc(db, 'users', user.uid, 'searchHistory', id), {
          query: cleaned,
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn("Could not save to user searchHistory in Firestore:", e);
      }
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setSearchParams({ q: inputValue.trim() });
    }
  };

  const clearSingleHistory = async (e: React.MouseEvent, chipValue: string) => {
    e.stopPropagation();
    const updated = historyChips.filter(c => c !== chipValue);
    setHistoryChips(updated);
    localStorage.setItem('shopeasy_search_history', JSON.stringify(updated));

    if (user?.uid) {
      try {
        const id = chipValue.toLowerCase().replace(/[^a-z0-9]/g, '_');
        // Delete document (setting to null or deleting)
        const docRef = doc(db, 'users', user.uid, 'searchHistory', id);
        await setDoc(docRef, { query: '' }); // mock soft remove or clear
      } catch (err) {
        console.warn("Could not delete from Firestore:", err);
      }
    }
  };

  const clearAllHistory = async () => {
    setHistoryChips([]);
    localStorage.removeItem('shopeasy_search_history');

    if (user?.uid) {
      try {
        const snap = await getDocs(collection(db, 'users', user.uid, 'searchHistory'));
        snap.forEach(async (document) => {
          await setDoc(doc(db, 'users', user.uid, 'searchHistory', document.id), { query: '' });
        });
      } catch (e) {
        console.warn(e);
      }
    }
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Run Category Card click
  const handleCategoryCardClick = (catName: string) => {
    setSearchParams({ q: catName });
  };

  // Perform Filtering & Sorting client-side
  const getProcessedResults = () => {
    let filtered = [...results];

    // Apply Filter Chips
    if (selectedFilter === 'free_delivery') {
      filtered = filtered.filter(p => p.freeDelivery === true);
    } else if (selectedFilter === 'under_50k') {
      filtered = filtered.filter(p => p.price < 50000);
    } else if (selectedFilter === 'rating_4') {
      filtered = filtered.filter(p => (p.rating || 4.5) >= 4.0);
    } else if (selectedFilter === 'on_sale') {
      filtered = filtered.filter(p => (p.discountPercent || 0) > 0 || (p.originalPrice && p.originalPrice > p.price));
    }

    // Apply Sorting Options
    if (selectedSort === 'price_asc') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (selectedSort === 'price_desc') {
      filtered.sort((a, b) => b.price - a.price);
    } else if (selectedSort === 'sold_desc') {
      filtered.sort((a, b) => (b.sold || 0) - (a.sold || 0));
    }

    return filtered;
  };

  const finalResultList = getProcessedResults();

  // Focus input on load if empty
  useEffect(() => {
    if (!queryParam && inputRef.current) {
      inputRef.current.focus();
    }
  }, [queryParam]);

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F5] uppercase" id="shopeasy-search-workspace">
      
      {/* 1. HEADER SEARCH ROW - STICKY TOP */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-100 p-4 shrink-0 flex items-center gap-2" id="search-header-panel">
        <button 
          onClick={() => navigate(-1)} 
          className="p-1.5 rounded-full hover:bg-neutral-50 border border-neutral-150 transition-colors"
          title="Back"
        >
          <ArrowLeft className="h-4.5 w-4.5 text-neutral-800" />
        </button>

        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-1.5">
          <div className="relative flex-grow">
            {/* Camera left utility */}
            <button
              type="button"
              onClick={() => navigate('/search/camera')}
              title="Camera Scan Search"
              className="absolute left-3 top-2.5 text-neutral-500 hover:text-[#E53935] transition-colors"
            >
              <Camera className="h-4.5 w-4.5" />
            </button>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search ShopEasy..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full text-xs font-bold rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-3 text-neutral-900 focus:outline-none focus:border-[#E53935] focus:bg-white transition-all"
            />
            {inputValue && (
              <button
                type="button"
                onClick={() => setInputValue('')}
                className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          
          <button
            type="submit"
            className="bg-neutral-950 border border-neutral-950 hover:bg-black text-white text-[9px] font-black uppercase tracking-widest py-2.5 px-4 rounded-full transition-all shrink-0"
          >
            Search
          </button>
        </form>
      </header>

      {/* TOAST NOTIFICATION CONTAINER */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#212121] text-white text-[10px] font-black uppercase tracking-wider px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
          {toastMessage}
        </div>
      )}

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 overflow-y-auto p-4 pb-28">
        
        {!queryParam ? (
          /* ==============================================
             STATE A: FOCUS LANDING & RECENT HISTORY VIEW
             ============================================== */
          <div className="flex flex-col gap-5 animate-[fadeIn_0.2s_ease]" id="landing-focus-view">
            
            {/* CHAKUPITA SALE Countdown banner */}
            <div className="bg-gradient-to-r from-neutral-950 via-[#E53935] to-neutral-950 text-white rounded-2xl px-4 py-3 border border-neutral-900/10 shadow-sm flex items-center justify-between" id="landing-promo-timer">
              <div className="flex items-center gap-2">
                <span className="text-sm">🔥</span>
                <div>
                  <h4 className="text-[10px] font-black tracking-wider text-white">Chakupita Flash Sale</h4>
                  <p className="text-[8px] text-red-100 font-extrabold font-sans">Lilongwe & Blantyre clearance specials</p>
                </div>
              </div>
              <div className="bg-white/10 px-3 py-1 rounded-full border border-white/15 text-center shrink-0">
                <span className="block text-[7px] text-red-50 font-black uppercase select-none">Ends In:</span>
                <span className="font-mono text-xs font-black text-white">{countdown}</span>
              </div>
            </div>

            {/* SEARCH HISTORY */}
            {historyChips.length > 0 && (
              <div className="bg-white rounded-3xl p-4 border border-neutral-100 shadow-3xs" id="recent-search-history-panel">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-extrabold text-[11px] text-neutral-850 tracking-wide uppercase flex items-center gap-1.5">
                    Search history
                  </h3>
                  <button 
                    type="button" 
                    onClick={clearAllHistory}
                    className="p-1 text-neutral-450 hover:text-[#E53935] transition-colors"
                    title="Clear all history"
                    id="clear-all-history-btn"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Horizontally wrapping list with show-more option */}
                <div className="flex flex-wrap gap-1.5" id="history-chips-container">
                  {historyChips
                    .slice(0, showAllHistory ? 15 : 5)
                    .map((chip, idx) => (
                      <div 
                        key={idx}
                        onClick={() => setSearchParams({ q: chip })}
                        className="inline-flex items-center gap-1 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 py-1.5 px-3 rounded-full text-[9.5px] font-bold text-neutral-800 cursor-pointer transition-colors"
                      >
                        <span>{chip}</span>
                        <button
                          type="button"
                          onClick={(e) => clearSingleHistory(e, chip)}
                          className="p-0.5 rounded-full hover:bg-neutral-200 text-neutral-400 hover:text-neutral-700 transition"
                          title="Remove single"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}

                  {/* Show more / show less action trigger */}
                  {historyChips.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAllHistory(!showAllHistory)}
                      className="inline-flex items-center gap-1 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 py-1.5 px-3.5 rounded-full text-[9px] font-black text-neutral-700 cursor-pointer transition-all"
                    >
                      {showAllHistory ? (
                        <>
                          <span>show less</span>
                          <ChevronUp className="h-3 w-3" />
                        </>
                      ) : (
                        <>
                          <span>▼ show more</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* DISCOVER MORE CATEGORIES */}
            <div className="bg-white rounded-3xl p-4 border border-neutral-100 shadow-3xs" id="discover-categories-panel">
              <h3 className="font-display font-extrabold text-[11px] text-neutral-850 tracking-wide uppercase mb-3">
                Discover more
              </h3>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { name: 'Monitors', icon: '🖥️', promo: 'Coupons available' },
                  { name: 'Phones', icon: '📱', promo: 'Save MWK 12,000' },
                  { name: 'Laptops', icon: '💻', promo: 'Sale -7% now' },
                  { name: 'Headphones', icon: '🎧', promo: 'Coupons available' },
                  { name: 'Gaming Phones', icon: '🎮', promo: 'Sale -7% now' },
                  { name: 'Tablets', icon: '📟', promo: 'Save MWK 12,000' }
                ].map((cat, i) => (
                  <div
                    key={i}
                    onClick={() => handleCategoryCardClick(cat.name)}
                    className="p-3 bg-neutral-50/50 hover:bg-white rounded-2xl border border-neutral-100 hover:border-[#E53935]/40 flex flex-col items-center justify-center text-center cursor-pointer transition-all shadow-4xs hover:shadow-2xs"
                  >
                    <div className="text-3xl mb-1.5 select-none">{cat.icon}</div>
                    <span className="block text-[10.5px] font-black text-neutral-900 leading-tight uppercase font-sans">
                      {cat.name}
                    </span>
                    <span className="mt-1 block text-[7.5px] font-black uppercase text-[#E53935] bg-red-50/50 px-1.5 py-0.5 rounded border border-red-50 whitespace-nowrap">
                      {cat.promo}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ) : (
          /* ==============================================
             STATE B: SEARCH QUERY ACTIVE RESULTS DISPLAY
             ============================================== */
          <div className="flex flex-col gap-3 animate-[fadeIn_0.2s_ease]" id="active-results-view">
            
            {/* 1. Filter Chips (Horizontal Slider Row) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none" id="results-filter-chips">
              {[
                { id: 'all', label: 'All' },
                { id: 'free_delivery', label: 'Free Delivery' },
                { id: 'under_50k', label: 'Under MWK 50,000' },
                { id: 'rating_4', label: '⭐4+' },
                { id: 'on_sale', label: 'On Sale' }
              ].map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setSelectedFilter(chip.id as any)}
                  className={`py-2 px-3.5 rounded-full text-[9px] font-black uppercase tracking-wider whitespace-nowrap border transition-all active:scale-95 ${
                    selectedFilter === chip.id
                      ? 'bg-neutral-900 border-neutral-900 text-white shadow-2xs'
                      : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* 2. Sort Selection Bar */}
            <div className="bg-white rounded-2xl border border-neutral-100 p-2.5 shadow-4xs shrink-0 flex items-center justify-between text-neutral-700" id="results-sort-bar">
              <span className="text-[8.5px] font-black uppercase text-neutral-400 select-none">Sort By &middot;</span>
              
              <div className="flex items-center gap-3">
                {[
                  { id: 'best', label: 'Best Match' },
                  { id: 'price_asc', label: 'Price ↑' },
                  { id: 'price_desc', label: 'Price ↓' },
                  { id: 'sold_desc', label: 'Most Orders' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedSort(opt.id as any)}
                    className={`text-[9.5px] font-black uppercase pb-0.5 border-b-2 transition-colors ${
                      selectedSort === opt.id
                        ? 'text-[#E53935] border-[#E53935]'
                        : 'text-neutral-550 border-transparent hover:text-neutral-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Result count text */}
            <div className="flex items-center justify-between text-neutral-500 text-[9px] px-1 font-extrabold uppercase">
              <span>{finalResultList.length} results for "{queryParam}"</span>
              <span className="font-mono text-[8px] bg-neutral-100 px-1 border border-neutral-250 text-neutral-450 rounded lowercase select-none">
                source: {dbStatus === 'firestore' ? 'firestore' : 'offline fallback'}
              </span>
            </div>

            {/* 4. Loader & Display Grids */}
            {loading ? (
              <div className="flex flex-col items-center justify-center p-16 gap-3">
                <RefreshCw className="h-7 w-7 text-[#E53935] animate-spin" />
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest animate-pulse">
                  Querying Malawian Database...
                </span>
              </div>
            ) : finalResultList.length === 0 ? (
              /* EMPTY RESULT STATE WITH SUGGESTIONS */
              <div className="bg-white rounded-3xl p-8 border border-neutral-100 text-center shadow-3xs flex flex-col items-center" id="search-empty-state">
                <span className="text-4xl">🔍</span>
                <h4 className="mt-4 font-display font-black text-xs text-neutral-900 uppercase">
                  No results for "{queryParam}"
                </h4>
                <p className="text-[10.5px] text-neutral-500 mt-2 leading-relaxed max-w-xs normal-case">
                  We couldn't locate matching items in our database. Perhaps check for typos or verify index seeder seeding under settings.
                </p>
                
                <div className="w-full border-t border-neutral-100 mt-6 pt-5">
                  <span className="block text-[9px] font-black text-neutral-400 mb-3 tracking-wider">
                    TRY SEARCHING THESE POPULAR CATEGORIES:
                  </span>
                  <div className="flex flex-wrap justify-center gap-1.5 uppercase">
                    {['Phones', 'Laptops', 'Clothes', 'Tablets', 'Gaming', 'Monitors'].map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => {
                          setInputValue(sug);
                          setSearchParams({ q: sug });
                        }}
                        className="bg-neutral-50 hover:bg-[#E53935] hover:text-white border border-neutral-150 rounded-full py-1.5 px-3.5 text-[9px] font-extrabold text-neutral-800 transition"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* 2_COLUMN PRODUCT GRID DISPLAY */
              <div className="grid grid-cols-2 gap-3" id="search-products-grid">
                {finalResultList.map((prod) => {
                  const inCartItem = cartItems.find((i) => i.productId === prod.id);
                  const isDiscounted = (prod.discountPercent || 0) > 0 || (prod.originalPrice && prod.originalPrice > prod.price);
                  return (
                    <div
                      key={prod.id}
                      onClick={() => navigate(`/product/${prod.id}`)}
                      className="bg-white rounded-2xl border border-neutral-100 shadow-4xs overflow-hidden flex flex-col group cursor-pointer justify-between border-b-2 hover:border-[#E53935] transition-all"
                    >
                      <div>
                        {/* Image wrap representation */}
                        <div className="relative h-24 bg-neutral-50/70 py-4 flex items-center justify-center text-4xl select-none shrink-0">
                          {prod.images?.[0] || prod.imageUrl || '📦'}

                          {/* Choice layout badge */}
                          {prod.isChoice && (
                            <span className="absolute top-1.5 left-1.5 text-[6.5px] font-black tracking-widest bg-blue-600 text-white py-0.5 px-1.5 rounded uppercase font-sans whitespace-nowrap shadow-xs">
                              Choice
                            </span>
                          )}

                          {/* Discount tag */}
                          {prod.discountPercent && prod.discountPercent > 0 && (
                            <span className="absolute top-1.5 right-1.5 text-[7px] font-black bg-[#E53935] text-white py-0.5 px-1.5 rounded">
                              -{prod.discountPercent}%
                            </span>
                          )}

                          {/* Bulk ribbon */}
                          {prod.isBulk && (
                            <span className="absolute bottom-1.5 left-1.5 text-[6px] font-black tracking-wider bg-emerald-600 text-white py-0.5 px-1.5 rounded uppercase font-mono">
                              Bulk
                            </span>
                          )}
                        </div>

                        {/* Title descriptions */}
                        <div className="p-2.5">
                          <span className="text-[7px] font-extrabold uppercase text-[#E53935] leading-none mb-1 block">
                            {prod.categoryName || prod.category}
                          </span>
                          <h4 className="text-[10px] font-black text-neutral-950 line-clamp-2 leading-snug group-hover:text-[#E53935] transition-colors">
                            {prod.title || prod.name}
                          </h4>

                          <div className="flex items-center gap-1 mt-1 font-mono text-[8px] text-neutral-400">
                            <span className="text-amber-400 text-[10px] pb-0.5">★</span>
                            <span className="font-extrabold text-[#212121]">{prod.rating || '4.5'}</span>
                            <span>({prod.sold || 45} sold)</span>
                          </div>
                        </div>
                      </div>

                      {/* Buy Action bars */}
                      <div className="p-2.5 pt-0 border-t border-neutral-50/60 mt-1 flex items-center justify-between">
                        <div className="flex flex-col">
                          {prod.originalPrice && prod.originalPrice > prod.price && (
                            <span className="text-[7.5px] text-neutral-400 font-bold line-through leading-none">
                              MWK {Math.round(prod.originalPrice).toLocaleString()}
                            </span>
                          )}
                          <span className="font-mono text-[10px] font-black text-[#212121] leading-none">
                            MWK {Math.round(prod.price).toLocaleString()}
                          </span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addItem({
                              id: prod.id,
                              storeId: prod.sellerId || 'store_unknown',
                              storeName: prod.sellerName || 'Local Seller',
                              name: prod.title || prod.name || '',
                              description: prod.description || '',
                              price: prod.price,
                              imageUrl: prod.imageUrl || prod.images?.[0] || '📦',
                              city: prod.sellerCity || prod.city || 'Malawi',
                              stock: prod.stock,
                              active: prod.isActive ?? true,
                              featured: false,
                              category: prod.categoryName || prod.category || '',
                              createdAt: prod.createdAt || new Date().toISOString()
                            }, 1);
                            triggerToast("Added to basket!");
                          }}
                          className={`h-6.5 w-6.5 rounded-full flex items-center justify-center transition-all ${
                            inCartItem
                              ? 'bg-emerald-500 text-white'
                              : 'bg-neutral-105 hover:bg-[#E53935] hover:text-white text-neutral-850'
                          }`}
                          title="Add to Shopping Cart"
                        >
                          {inCartItem ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 rotate-45" />}
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
}
