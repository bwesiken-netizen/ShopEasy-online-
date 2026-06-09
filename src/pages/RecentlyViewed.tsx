import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { useI18nStore } from '../i18n';
import { db } from '../firebase';
import { collection, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { SEED_PRODUCTS } from '../data/seedData';
import { ArrowLeft, Clock, Trash2, ArrowRight, Loader2, Star, ShoppingBag } from 'lucide-react';

interface Product {
  id: string;
  name?: string;
  title?: string;
  images?: string[];
  imageUrl?: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  categoryName?: string;
  rating?: number;
  sold?: number;
  isChoice?: boolean;
}

export default function RecentlyViewed() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useI18nStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    async function fetchRecentlyViewed() {
      setLoading(true);
      try {
        // 1. Fetch from localStorage
        let localIds: string[] = [];
        try {
          const raw = localStorage.getItem('shopeasy_viewed');
          if (raw) {
            localIds = JSON.parse(raw);
          }
        } catch (e) {
          console.warn("localStorage view parse error: ", e);
        }

        // 2. Fetch from Firestore subcollection if logged in
        let firestoreIds: string[] = [];
        if (user?.uid) {
          try {
            const viewedColRef = collection(db, 'users', user.uid, 'viewed');
            const snap = await getDocs(viewedColRef);
            snap.forEach((doc) => {
              firestoreIds.push(doc.id);
            });
          } catch (e) {
            console.warn("Firestore viewed fetch error: ", e);
          }
        }

        // 3. Merge unique IDs
        const uniqueIds = Array.from(new Set([...localIds, ...firestoreIds]));

        if (uniqueIds.length === 0) {
          setProducts([]);
          setLoading(false);
          return;
        }

        // 4. Load full product documents from seedData or Firestore
        const loaded: Product[] = [];
        for (const pid of uniqueIds) {
          // Check local seed data first (very fast)
          const matchedSeed = SEED_PRODUCTS.find((p) => p.id === pid);
          if (matchedSeed) {
            loaded.push(matchedSeed as unknown as Product);
          } else {
            // Check Firestore
            try {
              const snap = await getDocs(collection(db, 'products')); // Or query individual
              const docMatch = snap.docs.find(d => d.id === pid);
              if (docMatch) {
                loaded.push({ id: docMatch.id, ...docMatch.data() } as Product);
              }
            } catch (err) {
              console.warn("Firestore single product load error: ", err);
            }
          }
        }

        setProducts(loaded);
      } catch (err) {
        console.error("Critical error inside RecentlyViewed load stream: ", err);
      } finally {
        setLoading(false);
      }
    }

    fetchRecentlyViewed();
  }, [user?.uid]);

  const handleClearAll = async () => {
    const isConfirmed = window.confirm(t('confirmClearCache'));
    if (!isConfirmed) return;

    setClearing(true);
    try {
      // Clear localStorage
      localStorage.removeItem('shopeasy_viewed');

      // Clear Firestore subcollection
      if (user?.uid) {
        const viewedColRef = collection(db, 'users', user.uid, 'viewed');
        const snap = await getDocs(viewedColRef);
        const batch = writeBatch(db);
        snap.forEach((d) => {
          batch.delete(doc(db, 'users', user.uid!, 'viewed', d.id));
        });
        await batch.commit();
      }

      setProducts([]);
    } catch (err) {
      console.error("Failed to clear viewed items: ", err);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 animate-[fadeIn_0.3s_ease]" id="viewed-page">
      {/* HEADER */}
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3.5 flex items-center justify-between" id="viewed-header">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => navigate('/settings')}
            className="p-1 rounded-full text-neutral-500 hover:bg-neutral-100 active:bg-neutral-200 transition-all"
            id="back-to-settings-btn"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex flex-col">
            <h1 className="font-display font-black text-base text-neutral-900 uppercase tracking-tight" id="viewed-title">
              {t('recentlyViewed')}
            </h1>
            <span className="text-[9px] text-neutral-450 font-bold uppercase tracking-wider">
              {products.length} Items cached
            </span>
          </div>
        </div>

        {products.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={clearing}
            className="text-[10px] uppercase font-black tracking-tight text-[#E53935] hover:text-[#c62828] flex items-center gap-1 bg-red-50 hover:bg-red-100/50 px-3 py-1.5 rounded-full transition-colors"
            id="clear-all-viewed-btn"
          >
            {clearing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
            <span>{t('clearAll')}</span>
          </button>
        )}
      </div>

      {/* BODY */}
      <div className="flex-1 p-4" id="viewed-content">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20" id="viewed-loading">
            <Loader2 className="h-8 w-8 animate-spin text-[#E53935]" />
          </div>
        ) : products.length === 0 ? (
          /* EMPTY STATE */
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm" id="viewed-empty-state">
            <span className="text-5xl mb-4 text-neutral-300">🕐</span>
            <h2 className="font-display font-black text-sm text-neutral-800 leading-tight">
              {t('nothingViewed')}
            </h2>
            <p className="text-xs text-neutral-450 mt-1 max-w-[220px] leading-relaxed font-semibold">
              Browse products and stores on Malawi's easiest shopping platform.
            </p>
            <button
              onClick={() => navigate('/shop')}
              className="mt-6 bg-[#E53935] hover:bg-[#c62828] text-white text-xs font-black uppercase px-6 py-3 rounded-full shadow-md flex items-center gap-1"
              id="start-shopping-btn"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>{t('startShopping')}</span>
            </button>
          </div>
        ) : (
          /* PRODUCT GRID (2 COLUMN) */
          <div className="grid grid-cols-2 gap-2.5" id="viewed-products-grid">
            {products.map((prod) => (
              <div
                key={prod.id}
                onClick={() => navigate(`/product/${prod.id}`)}
                className="bg-white rounded-2xl border border-neutral-100 shadow-3xs overflow-hidden flex flex-col justify-between group cursor-pointer border-b-2 hover:border-[#E53935] transition-all"
                id={`recently-viewed-card-${prod.id}`}
              >
                <div>
                  <div className="relative h-24 bg-neutral-50/70 py-4 flex items-center justify-center text-4xl select-none shrink-0" id="product-card-image">
                    {prod.images?.[0] || prod.imageUrl || '📦'}

                    {prod.isChoice && (
                      <span className="absolute top-1.5 left-1.5 text-[7px] font-black tracking-widest bg-blue-600 text-white py-0.5 px-1.5 rounded uppercase font-sans whitespace-nowrap shadow-xs">
                        Choice
                      </span>
                    )}

                    {prod.discountPercent && prod.discountPercent > 0 && (
                      <span className="absolute top-1.5 right-1.5 text-[7.5px] font-black bg-[#E53935] text-white py-0.5 px-1.5 rounded">
                        -{prod.discountPercent}%
                      </span>
                    )}
                  </div>

                  <div className="p-2.5">
                    <span className="text-[7.5px] font-extrabold uppercase text-[#E53935] leading-none mb-1 block">
                      {prod.categoryName || 'Product'}
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

                <div className="p-2.5 pt-0 border-t border-neutral-50/60 mt-1 flex items-center justify-between" id="product-card-footer">
                  <div className="flex flex-col">
                    {prod.originalPrice && prod.originalPrice > prod.price && (
                      <span className="text-[7.5px] text-neutral-400 font-bold line-through leading-none">
                        MWK {prod.originalPrice.toLocaleString()}
                      </span>
                    )}
                    <span className="font-mono text-[10px] font-black text-[#E53935]">
                      MWK {prod.price.toLocaleString()}
                    </span>
                  </div>

                  <span className="text-xs text-neutral-300 group-hover:text-[#E53935] hover:scale-110 transition-all font-bold">
                    →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
