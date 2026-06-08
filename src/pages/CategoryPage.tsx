import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCartStore } from '../stores';
import { 
  ChevronLeft, Filter, SlidersHorizontal, Check, X, Star, 
  ArrowUpDown, Grid, ShoppingBag, Plus, RefreshCw, AlertCircle
} from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, getDocs, query, where, orderBy, limit, startAfter, doc, getDoc 
} from 'firebase/firestore';
import { SEED_CATEGORIES, SEED_PRODUCTS, FirestoreProduct } from '../data/seedData';

type SortOption = 'Best Match' | 'Most Orders' | 'Price ↑' | 'Price ↓' | 'Newest' | 'Top Rated';

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addItem, items: cartItems } = useCartStore();

  const currentCategory = SEED_CATEGORIES.find(c => c.slug === slug) || {
    slug: slug || 'all',
    name: (slug || '').replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()),
    emoji: '🛍️',
    productCount: 0
  };

  // Filter States
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [maxPrice, setMaxPrice] = useState<number>(500000);
  const [minRating, setMinRating] = useState<number | null>(null); // null means Any, 3, 4
  const [minDiscount, setMinDiscount] = useState<number | null>(null); // null, 10, 30, 50
  const [selectedCity, setSelectedCity] = useState<string>('All'); // All | Lilongwe | Blantyre | Mzuzu | Zomba | Other
  const [selectedSort, setSelectedSort] = useState<SortOption>('Best Match');

  // Firestore & local products
  const [rawProducts, setRawProducts] = useState<FirestoreProduct[]>(SEED_PRODUCTS);
  const [loading, setLoading] = useState<boolean>(true);
  const [visibleCount, setVisibleCount] = useState<number>(4); // pagination limit loader size
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Fetch from Firestore
  const fetchCategoryProducts = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'products'),
        where('category', '==', slug || 'all')
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // Fallback to local subset
        const localMatches = SEED_PRODUCTS.filter(p => p.category === slug);
        setRawProducts(localMatches.length > 0 ? localMatches : SEED_PRODUCTS);
      } else {
        const list: FirestoreProduct[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as FirestoreProduct);
        });
        setRawProducts(list);
      }
    } catch (err) {
      console.warn("Firestore error, falling back locally:", err);
      const localMatches = SEED_PRODUCTS.filter(p => p.category === slug);
      setRawProducts(localMatches.length > 0 ? localMatches : SEED_PRODUCTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategoryProducts();
    // Reset page limits when slug changes
    setVisibleCount(4);
  }, [slug]);

  // Apply filters on client side
  const filteredProducts = rawProducts.filter((prod) => {
    // 1. Price constraint
    if (prod.price > maxPrice) return false;

    // 2. Rating constraint
    if (minRating !== null && (prod.rating || 0) < minRating) return false;

    // 3. Discount constraint
    if (minDiscount !== null && (prod.discountPercent || 0) < minDiscount) return false;

    // 4. City constraint
    if (selectedCity !== 'All') {
      const cityLower = (prod.sellerCity || prod.city || '').toLowerCase();
      const matchLabel = selectedCity.toLowerCase();
      if (matchLabel === 'other') {
        const standardCities = ['lilongwe', 'blantyre', 'mzuzu', 'zomba'];
        if (standardCities.includes(cityLower)) return false;
      } else {
        if (cityLower !== matchLabel) return false;
      }
    }

    return true;
  });

  // Apply Sort chips
  const sortedAndFilteredProducts = [...filteredProducts].sort((a, b) => {
    switch (selectedSort) {
      case 'Price ↑':
        return a.price - b.price;
      case 'Price ↓':
        return b.price - a.price;
      case 'Most Orders':
        return (b.sold || 0) - (a.sold || 0);
      case 'Newest':
        return b.id.localeCompare(a.id);
      case 'Top Rated':
        return (b.rating || 0) - (a.rating || 0);
      case 'Best Match':
      default:
        // Featured first, then rating
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return (b.rating || 0) - (a.rating || 0);
    }
  });

  // Paginated display
  const paginatedList = sortedAndFilteredProducts.slice(0, visibleCount);
  const hasMore = sortedAndFilteredProducts.length > visibleCount;

  const handleLoadMore = () => {
    // Increment visible count (cursor-based pagination simulator or increment limits)
    setLoading(true);
    setTimeout(() => {
      setVisibleCount(prev => prev + 4);
      setLoading(false);
      triggerToast("Loaded more products correctly!");
    }, 450);
  };

  const handleResetFilters = () => {
    setMaxPrice(500000);
    setMinRating(null);
    setMinDiscount(null);
    setSelectedCity('All');
    triggerToast("Filters cleaned");
  };

  const formatMWK = (val: number) => {
    return 'MWK ' + Math.round(val).toLocaleString();
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F7F9] font-sans pb-24">
      
      {/* Toast Alert floating */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white font-extrabold text-[10px] uppercase tracking-wider py-2.5 px-5 rounded-full shadow-2xl">
          {toastMessage}
        </div>
      )}

      {/* CATEGORY TOP HEADER BAR */}
      <div 
        className="sticky top-0 z-25 bg-white border-b border-neutral-100 flex items-center justify-between px-3 py-3 shadow-3xs shrink-0"
        id="category-topbar"
      >
        <button
          onClick={() => navigate('/shop')}
          className="p-1 px-2.5 bg-neutral-50 rounded-xl hover:bg-neutral-100 transition-all border border-neutral-200 text-neutral-700 flex items-center text-[10px] font-black uppercase tracking-wider gap-0.5"
          id="cat-back-to-shop-btn"
        >
          <ChevronLeft className="h-4 w-4 stroke-[3px]" />
          <span>Shop</span>
        </button>

        <div className="text-center">
          <span className="text-[7px] uppercase font-black text-[#E53935] tracking-widest leading-none block">
            Category System
          </span>
          <h1 className="font-display font-black text-xs text-neutral-900 uppercase tracking-tight flex items-center justify-center gap-1.5 mt-0.5">
            <span>{currentCategory.emoji}</span>
            <span>{currentCategory.name}</span>
          </h1>
        </div>

        <button
          onClick={() => setIsFilterOpen(true)}
          className="relative p-1.5 bg-[#E53935]/5 text-[#E53935] border border-[#E53935]/20 hover:bg-[#E53935]/10 rounded-xl transition-all flex items-center gap-1 text-[10px] font-black uppercase tracking-wider"
          id="cat-open-filter-btn"
        >
          <Filter className="h-3.5 w-3.5" />
          <span>Filter</span>
          {(minRating !== null || minDiscount !== null || maxPrice < 500000 || selectedCity !== 'All') && (
            <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-[#E53935] text-white flex items-center justify-center text-[8px] font-black shadow-sm">
              !
            </span>
          )}
        </button>
      </div>

      {/* PRODUCT COUNT BAR */}
      <div className="bg-neutral-100 border-b border-neutral-200 py-2 px-3 text-center text-[9px] uppercase tracking-wider font-extrabold text-neutral-500">
        Showing {paginatedList.length} of {sortedAndFilteredProducts.length} items in Malawi
      </div>

      {/* SORT CHIPS (Horizontal Scrollable Bar) */}
      <div className="bg-white py-2 px-3 flex gap-1.5 overflow-x-auto scrollbar-none border-b border-neutral-100 shadow-3xs" id="sort-chips-scroller">
        {[
          'Best Match', 
          'Most Orders', 
          'Price ↑', 
          'Price ↓', 
          'Newest', 
          'Top Rated'
        ].map((opt) => {
          const isSelected = selectedSort === opt;
          return (
            <button
              key={opt}
              onClick={() => {
                setSelectedSort(opt as SortOption);
                triggerToast(`Sorting by: ${opt}`);
              }}
              className={`py-1.5 px-3.5 rounded-full text-[9px] font-black uppercase tracking-wider whitespace-nowrap border transition-all ${
                isSelected
                  ? 'bg-neutral-900 border-neutral-900 text-white'
                  : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-neutral-300'
              }`}
              id={`sort-chip-${opt.replace(/\s+/g, '-').replace('↑', 'up').replace('↓', 'down').toLowerCase()}`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {/* MAIN 2-COLUMN PRODUCT GRID CONTAINER */}
      <div className="flex-1 p-3.5">
        {sortedAndFilteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl border border-neutral-150 p-8 text-center flex flex-col items-center justify-center gap-1.5 mt-4">
            <span className="text-4xl">🤷‍♂️</span>
            <h3 className="font-display font-black text-xs text-neutral-900 uppercase">Pepani! No Matches</h3>
            <p className="text-[10px] text-neutral-500 max-w-xs leading-relaxed font-bold">
              We couldn't locate any products in this category that match your specific filter criteria. Try expanding your price limit or clearing active filters.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-4 px-4.5 py-2.5 bg-neutral-900 text-white font-black text-[10px] uppercase rounded-full tracking-wider"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3" id="category-products-grid">
              {paginatedList.map((prod) => {
                const inCart = cartItems.find(i => i.productId === prod.id);
                return (
                  <div
                    key={prod.id}
                    onClick={() => navigate(`/product/${prod.id}`)}
                    className="bg-white rounded-2xl border border-neutral-100 shadow-3xs overflow-hidden flex flex-col justify-between cursor-pointer border-b-2 hover:border-[#E53935] transition-all group"
                  >
                    <div>
                      {/* Product image section */}
                      <div className="relative h-28 bg-neutral-50 flex items-center justify-center text-4xl select-none py-4">
                        {prod.images?.[0] || prod.imageUrl || '📦'}

                        {prod.isChoice && (
                          <span className="absolute top-2 left-2 text-[6.5px] font-black tracking-widest bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase">
                            Choice
                          </span>
                        )}

                        {prod.discountPercent > 0 && (
                          <span className="absolute top-2 right-2 text-[7px] font-black bg-[#E53935] text-white px-1.5 py-0.5 rounded">
                            -{prod.discountPercent}%
                          </span>
                        )}

                        <span className="absolute bottom-2 left-2 text-[7px] font-black uppercase text-neutral-400 bg-neutral-900/5 px-2 py-0.5 rounded-full">
                          📍 {prod.sellerCity || prod.city}
                        </span>
                      </div>

                      {/* Content block */}
                      <div className="p-2.5">
                        <span className="text-[7.5px] font-black text-[#E53935] uppercase block leading-none mb-1">
                          {prod.sellerName}
                        </span>
                        <h3 className="text-[10px] font-black text-neutral-900 line-clamp-2 leading-snug group-hover:text-[#E53935] transition-colors">
                          {prod.title || prod.name}
                        </h3>

                        <div className="flex items-center gap-1 mt-1 font-bold">
                          <Star className="h-2.5 w-2.5 fill-amber-450 text-amber-450 shrink-0" />
                          <span className="text-[8.5px] text-neutral-800">{prod.rating || '4.5'}</span>
                          <span className="text-[8px] text-neutral-400">({prod.reviewCount || 10})</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer buy actions */}
                    <div className="p-2.5 pt-0 mt-1 border-t border-neutral-50/60 flex items-center justify-between">
                      <div className="flex flex-col">
                        {prod.originalPrice && prod.originalPrice > prod.price && (
                          <span className="text-[7.5px] text-neutral-400 line-through leading-none font-extrabold mb-0.5">
                            {formatMWK(prod.originalPrice)}
                          </span>
                        )}
                        <span className="font-mono text-[10px] font-black text-neutral-950 leading-none">
                          {formatMWK(prod.price)}
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                           addItem({
                            id: prod.id,
                            storeId: prod.sellerId || prod.storeId,
                            storeName: prod.sellerName || prod.storeName,
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
                          triggerToast("Added to shopping cart");
                        }}
                        className={`h-6 w-6 rounded-full flex items-center justify-center transition-all ${
                          inCart
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'bg-neutral-100 hover:bg-[#E53935] hover:text-white text-neutral-700'
                        }`}
                      >
                        {inCart ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {hasMore && (
              <div className="text-center py-4 flex justify-center mt-2">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="px-6 py-3 rounded-full border border-neutral-200 bg-white shadow-3xs text-neutral-800 text-[10px] font-black uppercase hover:bg-neutral-50 transition-all flex items-center gap-2"
                  id="category-load-more-btn"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#E53935]" />
                      <span>Loading Items...</span>
                    </>
                  ) : (
                    <span>Load More Products</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FILTER BOTTOM SHEET COMPONENT */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center select-none" id="bottomsheet-wrapper">
          
          {/* Black high contrast visual backdrop overlay */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-2xs transition-opacity duration-300"
            onClick={() => setIsFilterOpen(false)}
          />

          {/* Bottom Sheet White panel tray */}
          <div 
            className="relative w-full max-w-md bg-white rounded-t-[32px] shadow-2xl p-5 flex flex-col pb-8 z-50 animate-[slideUp_0.25s_ease-out] border-t border-neutral-100"
            id="filter-bottom-sheet"
          >
            {/* Header top row handles */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 mb-4 shrink-0">
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="h-4 w-4 text-[#E53935]" />
                <h3 className="font-display font-black text-xs text-neutral-900 uppercase">Sort & Filter catalog</h3>
              </div>
              <button 
                onClick={() => setIsFilterOpen(false)}
                className="p-1 hover:bg-neutral-100 rounded-full text-neutral-600 transition-colors"
                id="close-bottom-sheet-x"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Filters Content */}
            <div className="flex-1 overflow-y-auto max-h-[60vh] flex flex-col gap-5 pr-1 py-1">
              
              {/* 1. Price Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[10px] font-black uppercase">
                  <span className="text-neutral-500">Price Range</span>
                  <span className="text-[#E53935] font-mono font-black">{formatMWK(maxPrice)} max</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="500000"
                  step="10000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-[#E53935] h-1.5 bg-neutral-150 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[8px] text-neutral-400 font-extrabold uppercase">
                  <span>MWK 0</span>
                  <span>MWK 250,000</span>
                  <span>MWK 500,000</span>
                </div>
              </div>

              {/* 2. Rating chips */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-neutral-500 font-black uppercase">Minimum Seller Rating</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: null, label: 'Any' },
                    { val: 3, label: '⭐ 3+' },
                    { val: 4, label: '⭐ 4+' }
                  ].map((rate) => {
                    const isChoice = minRating === rate.val;
                    return (
                      <button
                        key={rate.label}
                        onClick={() => setMinRating(rate.val)}
                        className={`py-2 px-1 rounded-xl text-[9px] font-black uppercase text-center border transition-all ${
                          isChoice
                            ? 'bg-neutral-900 border-neutral-900 text-white'
                            : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-neutral-300'
                        }`}
                      >
                        {rate.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Discount options */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-neutral-500 font-black uppercase">Minimum Discount Percentage</span>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: null, label: 'Any' },
                    { val: 10, label: '10%+' },
                    { val: 30, label: '30%+' },
                    { val: 50, label: '50%+' }
                  ].map((disc) => {
                    const isSelected = minDiscount === disc.val;
                    return (
                      <button
                        key={disc.label}
                        onClick={() => setMinDiscount(disc.val)}
                        className={`py-2 px-1 rounded-xl text-[9px] font-black uppercase text-center border transition-all ${
                          isSelected
                            ? 'bg-[#E53935] border-[#E53935] text-white'
                            : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-neutral-300'
                        }`}
                      >
                        {disc.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Seller City */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-neutral-500 font-black uppercase font-display">Seller Location (Malawi City)</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {['All', 'Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Other'].map((city) => {
                    const isSelected = selectedCity === city;
                    return (
                      <button
                        key={city}
                        onClick={() => setSelectedCity(city)}
                        className={`py-2 px-1 rounded-xl text-[9px] text-center font-black uppercase border transition-all ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-neutral-300'
                        }`}
                      >
                        {city}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Apply actions */}
            <div className="border-t border-neutral-100 pt-4 mt-4 grid grid-cols-2 gap-3 shrink-0">
              <button
                onClick={handleResetFilters}
                className="py-3 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                id="reset-filters-btn"
              >
                Reset
              </button>
              <button
                onClick={() => setIsFilterOpen(false)}
                className="py-3 px-4 bg-[#E53935] hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-xs"
                id="apply-filters-btn"
              >
                Apply ({(selectedSort === 'Best Match' ? 'Best Match' : selectedSort)})
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
