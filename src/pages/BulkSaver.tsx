import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../stores';
import { ChevronLeft, Info, HelpCircle, Check, Plus, Minus, CreditCard, ArrowRight } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { SEED_PRODUCTS, FirestoreProduct } from '../data/seedData';

export default function BulkSaver() {
  const navigate = useNavigate();
  const { addItem, items: cartItems } = useCartStore();
  const [products, setProducts] = useState<FirestoreProduct[]>(SEED_PRODUCTS.filter(p => p.isBulk));
  const [loading, setLoading] = useState<boolean>(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Track state for dynamic quantity selectors per bulk product id
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const fetchBulkProducts = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'products'),
        where('isBulk', '==', true)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setProducts(SEED_PRODUCTS.filter(p => p.isBulk));
      } else {
        const list: FirestoreProduct[] = [];
        snap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as FirestoreProduct);
        });
        setProducts(list);
      }
    } catch (err) {
      console.warn("Could not query Firestore for bulk, using fallbacks:", err);
      setProducts(SEED_PRODUCTS.filter(p => p.isBulk));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBulkProducts();
  }, []);

  // Initialize quantities
  useEffect(() => {
    if (products.length > 0) {
      const initial: Record<string, number> = {};
      products.forEach(p => {
        initial[p.id] = initial[p.id] || 1;
      });
      setQuantities(prev => ({ ...initial, ...prev }));
    }
  }, [products]);

  const formatMWK = (val: number) => {
    return 'MWK ' + Math.round(val).toLocaleString();
  };

  // Helper to resolve price per unit based on chosen quantity and tiered definitions
  const resolveUnitPrice = (prod: FirestoreProduct, qty: number): number => {
    if (!prod.bulkPricing || prod.bulkPricing.length === 0) {
      return prod.price;
    }
    // Sort descending by minQty to check constraints
    const sortedTiers = [...prod.bulkPricing].sort((a, b) => b.minQty - a.minQty);
    for (const tier of sortedTiers) {
      if (qty >= tier.minQty) {
        return tier.pricePerUnit;
      }
    }
    return prod.price;
  };

  const handleQtyChange = (prodId: string, delta: number) => {
    setQuantities(prev => {
      const current = prev[prodId] || 1;
      const parsed = Math.max(1, current + delta);
      return { ...prev, [prodId]: parsed };
    });
  };

  // Format tiered table list values
  const getDisplayTiers = (prod: FirestoreProduct) => {
    if (prod.bulkPricing && prod.bulkPricing.length >= 3) {
      return prod.bulkPricing;
    }
    // Fallback standard tiers if empty
    return [
      { minQty: 1, pricePerUnit: prod.price },
      { minQty: 3, pricePerUnit: Math.round(prod.price * 0.90) },
      { minQty: 10, pricePerUnit: Math.round(prod.price * 0.82) }
    ];
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F7F9] font-sans pb-24">
      
      {/* Toast popup */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#212121] text-white py-2.5 px-5 rounded-full text-[10px] uppercase font-black shadow-xl">
          {toastMsg}
        </div>
      )}

      {/* HEADER SECTION */}
      <div 
        className="sticky top-0 z-20 bg-white border-b border-neutral-150 py-3.5 px-3 flex items-center gap-3 shadow-3xs shrink-0"
        id="bulk-header-row"
      >
        <button
          onClick={() => navigate('/shop')}
          className="p-1.5 bg-neutral-50 rounded-xl hover:bg-neutral-150 transition-all border border-neutral-200 text-neutral-800 flex items-center text-[9px] font-black uppercase tracking-wider gap-0.5"
          id="bulk-back-btn"
        >
          <ChevronLeft className="h-4 w-4 stroke-[2.5px]" />
          <span>Shop</span>
        </button>

        <div>
          <span className="text-[7px] uppercase font-black text-emerald-600 tracking-widest block leading-none">
            AIS Business Center
          </span>
          <h1 className="font-display font-black text-xs text-neutral-900 uppercase tracking-tight mt-0.5">
            📦 Bulk Saver Wholesale
          </h1>
        </div>
      </div>

      {/* INTRO ANNOUNCEMENT */}
      <div className="bg-emerald-500 text-white p-3.5 flex flex-col gap-1 shadow-2xs select-none">
        <h2 className="text-xs font-black uppercase tracking-wider">📦 Save More, Buy More</h2>
        <p className="text-[10px] text-emerald-50 leading-relaxed font-bold">
          Unlock wholesale prices, customized manufacturing, and lower unit coordinates straight from suppliers in Lilongwe or custom docks. Perfect for corporate supply or joint neighbors purchasing!
        </p>
      </div>

      {/* PRODUCTS DISPLAY CARDS */}
      <div className="flex-1 p-3.5 flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col gap-4 animate-pulse">
            {[1, 2].map(idx => (
              <div key={idx} className="bg-white rounded-3xl h-52 border border-neutral-100" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-3xl border border-neutral-150 p-8 text-center flex flex-col items-center justify-center gap-1.5 mt-4">
            <span className="text-4xl">📦</span>
            <h3 className="font-display font-black text-xs text-neutral-900 uppercase">No active bulk deals</h3>
            <p className="text-[10px] text-neutral-500 max-w-xs leading-relaxed font-bold">
              There are no wholesale listings available at this moment. Tap "Seed Firestore" on the Shop page to auto-inject wholesale deals.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4" id="bulk-products-list">
            {products.map((prod) => {
              const qty = quantities[prod.id] || 1;
              const unitPrice = resolveUnitPrice(prod, qty);
              const totalPrice = qty * unitPrice;
              const defaultItemUnitPrice = prod.price;
              const simulatedTiers = getDisplayTiers(prod);
              const inCart = cartItems.find(i => i.productId === prod.id);

              return (
                <div
                  key={prod.id}
                  className="bg-white rounded-3xl border border-neutral-150 shadow-sm p-4 flex flex-col gap-3.5 border-b-4 hover:border-emerald-600 transition-all"
                  id={`bulk-saver-card-${prod.id}`}
                >
                  
                  {/* Top product general metadata */}
                  <div className="flex gap-3">
                    {/* Centered big vector image/emoji */}
                    <div className="h-16 w-16 bg-neutral-10/40 rounded-2xl flex items-center justify-center text-3xl select-none shrink-0 border border-neutral-100">
                      {prod.images?.[0] || prod.imageUrl || '📦'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[7.5px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded leading-none block">
                          Wholesale
                        </span>
                        <span className="text-[7px] text-neutral-400 font-extrabold uppercase">
                          📍 {prod.sellerCity || prod.city}
                        </span>
                      </div>
                      <h3 className="text-xs font-black text-neutral-950 mt-1 truncate">
                        {prod.title || prod.name}
                      </h3>
                      <p className="text-[9.5px] text-neutral-500 leading-snug line-clamp-2 mt-0.5">
                        {prod.description}
                      </p>
                    </div>
                  </div>

                  {/* PRICING TIERS GRID TABLE */}
                  <div className="bg-neutral-50 border border-neutral-150 rounded-2xl p-2.5">
                    <div className="text-[8px] uppercase font-black text-neutral-400 tracking-wider mb-2 flex items-center gap-1">
                      <Info className="h-3 w-3 text-neutral-400" />
                      <span>Volume Discount Pricing Table (MWK)</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-b border-neutral-200/60 pb-1.5 text-center text-[8px] font-black uppercase text-neutral-500">
                      <span>Order Qty</span>
                      <span>Price Per Unit</span>
                      <span>Status</span>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-1.5">
                      {simulatedTiers.map((tier, tIdx) => {
                        const tierQtyLabel = tier.minQty === 1 ? '1 pc' : `${tier.minQty}+ pcs`;
                        const activeTier = (tIdx < simulatedTiers.length - 1)
                          ? (qty >= tier.minQty && qty < simulatedTiers[tIdx+1].minQty)
                          : (qty >= tier.minQty);

                        return (
                          <div 
                            key={tIdx} 
                            className={`grid grid-cols-3 gap-2 py-1 px-1 rounded-xl text-center text-[9px] font-mono transition-all ${
                              activeTier 
                                ? 'bg-emerald-600 text-white font-black' 
                                : 'text-neutral-700 font-medium'
                            }`}
                          >
                            <span className="font-sans font-bold">{tierQtyLabel}</span>
                            <span>{formatMWK(tier.pricePerUnit)}</span>
                            <span className="text-[7.5px] font-extrabold uppercase font-sans">
                              {activeTier ? '✓ Active Tier' : '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* INTERACTIVE QUANTITY CONTROLLER FOOTER */}
                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-3">
                    
                    {/* Sub-counter panel */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleQtyChange(prod.id, -1)}
                        className="h-8 w-8 rounded-xl bg-neutral-10 border border-neutral-200 hover:bg-neutral-50 text-neutral-800 flex items-center justify-center font-bold"
                      >
                        <Minus className="h-3.5 w-3.5 stroke-[2.5px]" />
                      </button>

                      <div className="text-center min-w-[32px]">
                        <span className="font-mono text-xs font-black block leading-none">
                          {qty}
                        </span>
                        <span className="text-[6.5px] text-neutral-400 font-extrabold uppercase block mt-1">
                          pcs
                        </span>
                      </div>

                      <button
                        onClick={() => handleQtyChange(prod.id, 1)}
                        className="h-8 w-8 rounded-xl bg-neutral-10 border border-neutral-200 hover:bg-neutral-50 text-neutral-800 flex items-center justify-center font-bold"
                      >
                        <Plus className="h-3.5 w-3.5 stroke-[2.5px]" />
                      </button>
                    </div>

                    {/* Dynamic checkout estimation calculation details */}
                    <div className="text-right flex-1 pr-1">
                      <span className="text-[7.5px] text-neutral-400 font-extrabold uppercase block leading-none mb-0.5">
                        Dynamic Total Order Value
                      </span>
                      <span className="font-mono text-[11px] font-black text-neutral-900 block leading-none">
                        {formatMWK(totalPrice)}
                      </span>
                      <span className="text-[6.5px] text-emerald-500 font-extrabold block mt-0.5">
                        Saved: {formatMWK((defaultItemUnitPrice * qty) - totalPrice)}
                      </span>
                    </div>

                    {/* Place order trigger */}
                    <button
                      onClick={() => {
                        // Push exact aggregate quantity with discounted price to the Cart item structures securely!
                        addItem({
                          id: prod.id,
                          storeId: prod.sellerId || prod.storeId,
                          storeName: prod.sellerName || prod.storeName,
                          name: `${prod.title || prod.name} (Wholesale Tier)`,
                          description: prod.description || '',
                          price: unitPrice, // Resolved tiered unit price
                          imageUrl: prod.imageUrl || prod.images?.[0] || '📦',
                          city: prod.sellerCity || prod.city,
                          stock: prod.stock,
                          active: prod.isActive ?? true,
                          featured: prod.isFeatured ?? false,
                          category: prod.categoryName || prod.category,
                          createdAt: prod.createdAt
                        }, qty);
                        triggerToast(`Added ${qty} packages at tiered rates!`);
                      }}
                      className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1 shrink-0"
                    >
                      <span>Get Deals</span>
                      <ArrowRight className="h-3.5 w-3.5" />
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
