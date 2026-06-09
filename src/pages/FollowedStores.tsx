import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  increment,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { useAuthStore } from '../stores';
import { ArrowLeft, Star, MapPin, Plus, Check, Trash2, ShoppingBag } from 'lucide-react';
import { OperationType, Store, Product } from '../types';

export default function FollowedStores() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [followedStoreIds, setFollowedStoreIds] = useState<string[]>([]);
  const [followedStores, setFollowedStores] = useState<any[]>([]);
  const [recommendedStores, setRecommendedStores] = useState<any[]>([]);

  // Discover tab state
  const [discoverTab, setDiscoverTab] = useState<'All' | 'Electronics' | 'Fashion' | 'Food' | 'Farming'>('All');
  const [discoverStores, setDiscoverStores] = useState<any[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);

  // Store lists fallback timestamps for recent products calculation
  // (recentProductCount = products where storeId matches AND createdAt > user's lastVisited this store)
  const [lastVisitedMap, setLastVisitedMap] = useState<Record<string, string>>({});

  // Load visited stores timestamps from localStorage on init
  useEffect(() => {
    const saved = localStorage.getItem('shopeasy_store_visited_timestamps');
    if (saved) {
      try {
        setLastVisitedMap(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // Primary fetch loop
  const fetchAllData = async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      // 1. Fetch user's followed stores subcollection
      const followedSnap = await getDocs(collection(db, 'users', user.uid, 'followedStores'));
      const followedIds: string[] = [];
      followedSnap.forEach((docSnap) => {
        followedIds.push(docSnap.id);
      });
      setFollowedStoreIds(followedIds);

      // 2. Load store documents for each followed store
      const loadedStores: any[] = [];
      for (const sId of followedIds) {
        try {
          const storeDoc = await getDoc(doc(db, 'stores', sId));
          if (storeDoc.exists()) {
            const storeData = { id: storeDoc.id, ...(storeDoc.data() as any) } as any;
            
            // Calculate recentProducts
            // Fetch products where storeId == sId and isActive == true orderBy createdAt desc limit 6
            const prodQuery = query(
              collection(db, 'products'),
              where('storeId', '==', sId),
              where('isActive', '==', true)
            );
            const prodSnap = await getDocs(prodQuery);
            const products: any[] = [];
            prodSnap.forEach((pDoc) => {
              products.push({ id: pDoc.id, ...(pDoc.data() as any) });
            });
            // Sorting locally in case compound indexes aren't created yet or order is requested
            products.sort((a, b) => {
              const ka = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
              const kb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
              return kb - ka;
            });

            const slicedProducts = products.slice(0, 6);

            // Calculate recentProductCount (createdAt > user's lastVisited timestamp for this store)
            const lastVisitedStr = lastVisitedMap[sId];
            const lastVisitedTime = lastVisitedStr ? new Date(lastVisitedStr).getTime() : Date.now() - 7 * 24 * 3600 * 1000; // default 7 days ago if never visited
            
            const recentProductCount = slicedProducts.filter(p => {
              const pTime = p.createdAt?.toDate ? p.createdAt.toDate().getTime() : (p.createdAt ? new Date(p.createdAt).getTime() : 0);
              return pTime > lastVisitedTime;
            }).length;

            loadedStores.push({
              ...storeData,
              products: slicedProducts,
              recentProductCount
            });
          }
        } catch (storeErr) {
          console.warn(`Could not load detailed doc for followed store: ${sId}`, storeErr);
        }
      }
      setFollowedStores(loadedStores);

      // 3. Fetch recommended stores
      // Filter where isApproved == true, limit 15, then exclude already-followed stores locally
      const recQuery = query(
        collection(db, 'stores'),
        where('isApproved', '==', true),
        limit(15)
      );
      const recSnap = await getDocs(recQuery);
      const allApproved: any[] = [];
      recSnap.forEach((docSnap) => {
        allApproved.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });

      // Simple rating/follower count sorting
      allApproved.sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0));

      // Exclude already followed
      const filteredRecs = allApproved
        .filter(store => !followedIds.includes(store.id))
        .slice(0, 5);

      setRecommendedStores(filteredRecs);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
      handleFirestoreError(err, OperationType.LIST, `users/${user?.uid}/followedStores`);
    }
  };

  // Run initial fetch
  useEffect(() => {
    fetchAllData();
  }, [user?.uid, lastVisitedMap]);

  // Handle Discover section tabs independently
  const fetchDiscoverStores = async () => {
    setDiscoverLoading(true);
    try {
      let discoverQuery;
      if (discoverTab === 'All') {
        discoverQuery = query(
          collection(db, 'stores'),
          where('isApproved', '==', true),
          limit(10)
        );
      } else {
        discoverQuery = query(
          collection(db, 'stores'),
          where('isApproved', '==', true),
          where('category', '==', discoverTab),
          limit(10)
        );
      }

      const snap = await getDocs(discoverQuery);
      const stores: any[] = [];
      snap.forEach((docSnap) => {
        stores.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });

      // Order by followerCount desc locally
      stores.sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0));
      setDiscoverStores(stores.slice(0, 6));
      setDiscoverLoading(false);
    } catch (err) {
      console.error("Discover stores loading failed:", err);
      setDiscoverLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscoverStores();
  }, [discoverTab]);

  // FOLLOW Action handler
  const handleFollowStore = async (storeId: string) => {
    if (!user?.uid) {
      alert("Chonde lowani kaye mu account yanu / Please login description.");
      return;
    }

    try {
      // 1. Write relation to users/{uid}/followedStores/{storeId}
      const followRef = doc(db, 'users', user.uid, 'followedStores', storeId);
      await setDoc(followRef, {
        storeId,
        followedAt: serverTimestamp()
      });

      // 2. Increment store's followerCount atomically
      const storeRef = doc(db, 'stores', storeId);
      await updateDoc(storeRef, {
        followerCount: increment(1)
      });

      // 3. Immediately update local state to feel ultra snappy
      setFollowedStoreIds(prev => [...prev, storeId]);
      
      // Update recommended list
      setRecommendedStores(prev => prev.filter(s => s.id !== storeId));

      // Refresh list
      fetchAllData();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/followedStores/${storeId}`);
    }
  };

  // UNFOLLOW Action handler
  const handleUnfollowStore = async (storeId: string) => {
    if (!user?.uid) return;
    if (!window.confirm("Kodi mukufuna kusiya kutsatira sitoloyi? (Are you sure you want to unfollow?)")) {
      return;
    }

    try {
      // 1. Delete from users/{uid}/followedStores/{storeId}
      await deleteDoc(doc(db, 'users', user.uid, 'followedStores', storeId));

      // 2. Decrement follower count
      const storeRef = doc(db, 'stores', storeId);
      await updateDoc(storeRef, {
        followerCount: increment(-1)
      });

      // 3. Update local state
      setFollowedStoreIds(prev => prev.filter(id => id !== storeId));
      setFollowedStores(prev => prev.filter(s => s.id !== storeId));

      // Refresh list
      fetchAllData();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/followedStores/${storeId}`);
    }
  };

  // Check if store is newly created (less than 30 days ago)
  const isNewlyCreated = (createdAt: any) => {
    if (!createdAt) return false;
    const createdDate = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const timeDiff = Date.now() - createdDate.getTime();
    const daysDiff = timeDiff / (1000 * 3600 * 24);
    return daysDiff < 30;
  };

  // When user taps followed store to visit
  const handleVisitStore = (storeId: string) => {
    // Record lastVisited timestamp in local storage
    const updatedMap = {
      ...lastVisitedMap,
      [storeId]: new Date().toISOString()
    };
    setLastVisitedMap(updatedMap);
    localStorage.setItem('shopeasy_store_visited_timestamps', JSON.stringify(updatedMap));

    // Navigate to store details / shop with filter or similar
    navigate(`/shop?store=${storeId}`);
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      {/* HEADER */}
      <div className="sticky top-0 z-40 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
        <button 
          onClick={() => navigate('/account')}
          className="p-1 text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="font-display font-black text-sm text-neutral-900">
          Followed Stores
        </span>
      </div>

      <div className="p-4 flex flex-col gap-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[#E42525] border-t-transparent animate-spin"></div>
            <p className="text-xs text-neutral-500 font-bold mt-3">Kutsegula masitolo...</p>
          </div>
        ) : followedStores.length === 0 ? (
          
          /* EMPTY STATE WITH TABS DISCOVERY */
          <div className="flex flex-col gap-6">
            <div className="text-center py-12 px-4 flex flex-col items-center justify-center bg-white rounded-3xl border border-neutral-100 shadow-sm">
              <span className="text-5xl mb-3 block animate-bounce">📋</span>
              <h3 className="font-display font-black text-neutral-900 text-sm">No stores followed yet</h3>
              <p className="text-xs text-neutral-500 font-semibold max-w-xs mt-1">
                Follow your favorite local Malawian stores to get status alerts and discover fresh inventory.
              </p>
            </div>

            {/* DISCOVER SHOPESY STORES TABS SECTION */}
            <div className="bg-white rounded-3xl p-4 border border-neutral-100 shadow-sm flex flex-col gap-3.5">
              <div className="flex flex-col">
                <h4 className="font-display font-black text-xs text-neutral-500 uppercase tracking-widest">
                  Discover
                </h4>
                <h3 className="font-display font-black text-sm text-neutral-900 mt-0.5">
                  DISCOVER SHOPESY STORES 🇲🇼
                </h3>
              </div>

              {/* TABS HEADER */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {(['All', 'Electronics', 'Fashion', 'Food', 'Farming'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDiscoverTab(tab)}
                    className={`px-4 py-2 rounded-full font-display font-black text-xs whitespace-nowrap transition-all ${
                      discoverTab === tab
                        ? 'bg-[#E42525] text-white'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* STORES LIST SLIDER */}
              {discoverLoading ? (
                <div className="py-8 flex justify-center">
                  <div className="w-6 h-6 rounded-full border-2 border-neutral-300 border-t-[#E42525] animate-spin"></div>
                </div>
              ) : discoverStores.length === 0 ? (
                <p className="text-xs text-neutral-400 font-bold text-center py-6">Palibe masitolo mgululi panopa.</p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-none">
                  {discoverStores.map((store) => {
                    const logoInitial = store.name ? store.name.charAt(0).toUpperCase() : 'S';
                    const hasFollowed = followedStoreIds.includes(store.id);

                    return (
                      <div 
                        key={store.id} 
                        className="bg-neutral-50 rounded-2xl border border-neutral-150 p-3 flex flex-col justify-between min-w-[140px] max-w-[140px]"
                      >
                        <div className="flex flex-col items-center text-center">
                          {store.bannerUrl ? (
                            <img 
                              src={store.bannerUrl} 
                              alt={store.name} 
                              referrerPolicy="no-referrer"
                              className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-red-150 text-[#E42525] font-display font-black text-sm flex items-center justify-center border-2 border-white shadow-sm">
                              {logoInitial}
                            </div>
                          )}
                          <h5 className="font-display font-black text-xs text-neutral-900 mt-2.5 truncate w-full">
                            {store.name}
                          </h5>
                          <span className="text-[10px] text-neutral-400 font-bold block mt-0.5">
                            {store.followerCount || 0} followers
                          </span>
                        </div>

                        <button
                          onClick={() => hasFollowed ? handleUnfollowStore(store.id) : handleFollowStore(store.id)}
                          className={`w-full py-1.5 mt-3 rounded-xl font-display font-black text-[10px] uppercase tracking-wider transition-all border ${
                            hasFollowed
                              ? 'bg-neutral-200 text-neutral-600 border-neutral-200'
                              : 'bg-[#E42525] text-white border-[#E42525] hover:bg-[#c41e1e]'
                          }`}
                        >
                          {hasFollowed ? 'Following' : 'Follow'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          
        ) : (
          
          /* FOLLOWED STORES GRID */
          <div className="flex flex-col gap-5">
            <h3 className="font-display font-black text-sm text-neutral-900">
              Following {followedStores.length} {followedStores.length === 1 ? 'Store' : 'Stores'}
            </h3>

            <div className="flex flex-col gap-4">
              {followedStores.map((store) => {
                const logoInitial = store.name ? store.name.charAt(0).toUpperCase() : 'S';

                return (
                  <div 
                    key={store.id}
                    className="bg-white rounded-3xl border border-neutral-100 p-4 shadow-sm flex flex-col gap-3.5 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => handleVisitStore(store.id)}
                  >
                    {/* Store Header Row */}
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        {store.bannerUrl ? (
                          <img 
                            src={store.bannerUrl} 
                            alt={store.name} 
                            referrerPolicy="no-referrer"
                            className="h-11 w-11 rounded-full object-cover border border-neutral-100"
                          />
                        ) : (
                          <div className="h-11 w-11 rounded-full bg-red-50 text-[#E42525] font-display font-black text-sm flex items-center justify-center border border-red-100">
                            {logoInitial}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-display font-black text-sm text-neutral-900 leading-none">
                              {store.name}
                            </h4>
                            {isNewlyCreated(store.createdAt) && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[8px] font-black uppercase tracking-wider">
                                New
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1 text-[10px] text-neutral-400 font-bold mt-1">
                            <Star className="h-3 w-3 fill-amber-400 stroke-none" />
                            <span className="text-neutral-700">{store.rating || '5.0'}</span>
                            <span>·</span>
                            <span>{store.followerCount || 0} followers</span>
                            <span>·</span>
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-2.5 w-2.5" />
                              {store.city}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Unfollow button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnfollowStore(store.id);
                        }}
                        className="px-3.5 py-1.5 rounded-full border border-red-100 text-[10px] font-black uppercase tracking-wider text-[#E42525] bg-red-50/50 hover:bg-red-50 transition-all whitespace-nowrap"
                      >
                        Unfollow
                      </button>
                    </div>

                    {/* New product count badge if applicable */}
                    {store.recentProductCount > 0 && (
                      <div className="inline-flex self-start px-2.5 py-1 rounded-full bg-orange-100 border border-orange-200 text-[9px] font-black uppercase tracking-wider text-orange-700">
                        New: {store.recentProductCount} products in last visit
                      </div>
                    )}

                    {/* Latest products listing slider */}
                    {store.products && store.products.length > 0 && (
                      <div className="flex flex-col gap-2 pt-2.5 border-t border-neutral-50">
                        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">
                          Latest Inventory
                        </span>
                        
                        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none" onClick={(e) => e.stopPropagation()}>
                          {store.products.map((prod: any) => {
                            const pImage = prod.imageUrl || prod.images?.[0] || '📦';
                            const pName = prod.title || prod.name || 'Catalog Item';
                            
                            return (
                              <div 
                                key={prod.id}
                                onClick={() => navigate(`/product/${prod.id}`)}
                                className="bg-neutral-50 rounded-xl border border-neutral-100 p-1.5 min-w-[90px] max-w-[90px] hover:border-neutral-250 transition-all cursor-pointer"
                              >
                                <div className="aspect-square rounded-lg overflow-hidden bg-neutral-200 flex items-center justify-center">
                                  {pImage.startsWith('http') ? (
                                    <img 
                                      src={pImage} 
                                      alt={pName} 
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-2xl">{pImage}</span>
                                  )}
                                </div>
                                <span className="block text-[8px] font-bold text-neutral-800 truncate mt-1">
                                  {pName}
                                </span>
                                <span className="block text-[8px] font-mono font-black text-neutral-500">
                                  MWK {prod.price ? prod.price.toLocaleString() : '0'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* RECOMMENDED STORES LIST (Displays at the bottom of the page) */}
        {recommendedStores.length > 0 && (
          <div className="bg-white rounded-3xl p-4 border border-neutral-100 shadow-sm flex flex-col gap-4 mt-2">
            <div>
              <h4 className="font-display font-black text-xs text-[#E42525] uppercase tracking-widest">
                Recommendations
              </h4>
              <h3 className="font-display font-black text-sm text-neutral-900 mt-0.5">
                RECOMMENDED STORES
              </h3>
            </div>

            <div className="flex flex-col gap-3">
              {recommendedStores.map((store) => {
                const logoInitial = store.name ? store.name.charAt(0).toUpperCase() : 'S';

                return (
                  <div 
                    key={store.id}
                    onClick={() => handleVisitStore(store.id)}
                    className="flex items-center justify-between gap-2.5 p-2 hover:bg-neutral-50 rounded-2xl transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      {store.bannerUrl ? (
                        <img 
                          src={store.bannerUrl} 
                          alt={store.name} 
                          referrerPolicy="no-referrer"
                          className="h-10 w-10 rounded-full object-cover border border-neutral-100"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-red-50 text-[#E42525] font-display font-black text-sm flex items-center justify-center border border-red-100">
                          {logoInitial}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-display font-black text-xs text-neutral-900 leading-tight truncate max-w-[130px]">
                            {store.name}
                          </h4>
                          {isNewlyCreated(store.createdAt) && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[7px] font-black uppercase tracking-wider">
                              New
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[9px] text-neutral-400 font-bold mt-0.5">
                          <span>⭐ {store.rating || '5.0'}</span>
                          <span>·</span>
                          <span>{store.followerCount || 0} followers</span>
                          <span>·</span>
                          <span>{store.city}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFollowStore(store.id);
                      }}
                      className="px-3.5 py-1.5 rounded-full font-display font-black text-[9px] uppercase tracking-wider text-white bg-[#E42525] hover:bg-[#c41e1e] transition-all whitespace-nowrap shadow-sm"
                    >
                      Follow
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
