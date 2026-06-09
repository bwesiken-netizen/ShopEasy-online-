import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, collection, getDocs, getDoc, deleteDoc, writeBatch, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { useAuthStore, useCartStore } from '../stores';
import { ArrowLeft, Heart, ShoppingCart, Trash2, CheckSquare, Square, Check } from 'lucide-react';
import { OperationType } from '../types';

export default function Wishlist() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const cartStore = useCartStore();

  const [loading, setLoading] = useState(true);
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const [productsData, setProductsData] = useState<Record<string, any>>({});
  
  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Long press tracking
  const pressTimer = useRef<any>(null);

  // Fetch wishlist collection
  const fetchWishlist = async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const colPath = `users/${user.uid}/wishlist`;
      const qSnap = await getDocs(collection(db, colPath));
      const items: any[] = [];
      qSnap.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Sort by addedAt desc (using local fallback if serverTimestamp yields null initially)
      items.sort((a, b) => {
        const timeA = a.addedAt?.toDate ? a.addedAt.toDate().getTime() : (a.addedAt ? new Date(a.addedAt).getTime() : 0);
        const timeB = b.addedAt?.toDate ? b.addedAt.toDate().getTime() : (b.addedAt ? new Date(b.addedAt).getTime() : 0);
        return timeB - timeA;
      });

      setWishlistItems(items);

      // Fetch corresponding product document for each wishlist item to make sure we have up-to-date data
      const fetchedProducts: Record<string, any> = {};
      for (const item of items) {
        try {
          const prodDoc = await getDoc(doc(db, 'products', item.productId));
          if (prodDoc.exists()) {
            fetchedProducts[item.productId] = { id: prodDoc.id, ...prodDoc.data() };
          } else {
            // Fallback to the cached data stored in the wishlist document
            fetchedProducts[item.productId] = {
              id: item.productId,
              name: item.title || 'Product Not Found',
              title: item.title,
              price: item.price || 0,
              imageUrl: item.image || '',
              stock: 10,
              priceFormatted: item.price
            };
          }
        } catch (e) {
          console.warn("Could not fetch product details, using wishlist document summary: ", e);
          fetchedProducts[item.productId] = {
            id: item.productId,
            name: item.title || 'Product Details',
            title: item.title,
            price: item.price || 0,
            imageUrl: item.image || '',
            stock: 10
          };
        }
      }
      setProductsData(fetchedProducts);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      handleFirestoreError(err, OperationType.LIST, `users/${user?.uid}/wishlist`);
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, [user?.uid]);

  // Remove single item from wishlist
  const handleRemoveItem = async (productId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user?.uid) return;
    
    try {
      const docPath = `users/${user.uid}/wishlist/${productId}`;
      await deleteDoc(doc(db, docPath));
      setWishlistItems(prev => prev.filter(item => item.productId !== productId));
      setSelectedIds(prev => prev.filter(id => id !== productId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/wishlist/${productId}`);
    }
  };

  // Add individual product to cart
  const handleAddToCart = async (product: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const title = product.title || product.name || 'ShopEasy Item';
    await cartStore.addItem({
      id: product.id,
      title: title,
      name: title,
      imageUrl: product.imageUrl || product.images?.[0] || '📦',
      price: product.price,
      stock: product.stock || 50,
      storeId: product.storeId || '',
      storeName: product.storeName || 'Local Merchant',
      city: product.city || 'Malawi'
    });
    
    // Simple visual toast indication
    alert(`Added "${title}" to your shopping cart! 🛒`);
  };

  // Selection mode utilities
  const handleCardPressStart = (productId: string) => {
    pressTimer.current = setTimeout(() => {
      setSelectionMode(true);
      toggleSelect(productId);
    }, 800); // 800ms threshold for long press
  };

  const handleCardPressEnd = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
  };

  const toggleSelect = (productId: string) => {
    setSelectedIds(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = wishlistItems.map(item => item.productId);
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  };

  // Batch actions on selection
  const handleAddBatchToCart = async () => {
    if (selectedIds.length === 0) return;
    
    for (const id of selectedIds) {
      const product = productsData[id];
      if (product) {
        const title = product.title || product.name || 'ShopEasy Item';
        await cartStore.addItem({
          id: product.id,
          title: title,
          name: title,
          imageUrl: product.imageUrl || product.images?.[0] || '📦',
          price: product.price,
          stock: product.stock || 50,
          storeId: product.storeId || '',
          storeName: product.storeName || 'Local Merchant',
          city: product.city || 'Malawi'
        });
      }
    }
    
    alert(`Successfully added ${selectedIds.length} items to your cart! 🛒`);
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const handleRemoveBatchFromWishlist = async () => {
    if (selectedIds.length === 0 || !user?.uid) return;
    if (!window.confirm(`Are you sure you want to remove ${selectedIds.length} items from your wishlist?`)) {
      return;
    }

    try {
      const batch = writeBatch(db);
      for (const id of selectedIds) {
        const docRef = doc(db, 'users', user.uid, 'wishlist', id);
        batch.delete(docRef);
      }
      await batch.commit();

      setWishlistItems(prev => prev.filter(item => !selectedIds.includes(item.productId)));
      setSelectedIds([]);
      setSelectionMode(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/wishlist (batch)`);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* HEADER BAR */}
      <div className="sticky top-0 z-40 bg-white border-b border-neutral-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/account')}
            className="p-1 text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="font-display font-black text-sm text-neutral-900">
            My Wishlist
          </span>
        </div>
        
        {wishlistItems.length > 0 && (
          <button 
            onClick={() => {
              setSelectionMode(!selectionMode);
              setSelectedIds([]);
            }}
            className="text-xs font-black text-[#E42525] hover:text-[#c41e1e] transition-colors bg-red-50 px-3 py-1.5 rounded-full"
          >
            {selectionMode ? 'Cancel' : 'Manage'}
          </button>
        )}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[#E42525] border-t-transparent animate-spin"></div>
            <p className="text-xs text-neutral-500 font-bold mt-3">Kutsitsa zomwe mwasunga...</p>
          </div>
        ) : wishlistItems.length === 0 ? (
          /* EMPTY STATE */
          <div className="text-center py-16 px-4 flex flex-col items-center justify-center bg-white rounded-3xl border border-neutral-100 shadow-sm">
            <div className="h-20 w-20 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4 animate-pulse">
              <Heart className="h-10 w-10 text-[#E42525]" strokeWidth={1.5} />
            </div>
            <h3 className="font-display font-black text-neutral-900 text-lg">No saved items yet</h3>
            <p className="text-xs text-neutral-500 font-semibold max-w-xs mt-2 leading-relaxed">
              Start exploring and save items you love to find them easily later.
            </p>
            <button
              onClick={() => navigate('/shop')}
              className="mt-6 font-display font-black text-xs text-white bg-[#E42525] hover:bg-[#c41e1e] px-6 py-3 rounded-full transition-all tracking-wide shadow-sm"
            >
              Browse Products
            </button>
          </div>
        ) : (
          /* ITEMS LISTED */
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center px-1">
              <h2 className="font-display font-black text-sm text-neutral-900">
                {wishlistItems.length} {wishlistItems.length === 1 ? 'saved item' : 'saved items'}
              </h2>
              {selectionMode && (
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-neutral-600">
                  <input 
                    type="checkbox"
                    className="rounded border-neutral-300 text-[#E42525] focus:ring-[#E42525] accent-[#E42525]"
                    checked={selectedIds.length === wishlistItems.length && wishlistItems.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                  <span>✓ Select All</span>
                </label>
              )}
            </div>

            {/* TWO-COLUMN GRID */}
            <div className="grid grid-cols-2 gap-3.5">
              {wishlistItems.map((item) => {
                const product = productsData[item.productId] || {};
                const name = product.title || product.name || item.title || 'Product Item';
                const image = product.imageUrl || product.images?.[0] || item.image || '📦';
                const price = product.price || item.price || 0;
                const isSelected = selectedIds.includes(item.productId);

                return (
                  <div
                    key={item.productId}
                    onMouseDown={() => handleCardPressStart(item.productId)}
                    onMouseUp={handleCardPressEnd}
                    onMouseLeave={handleCardPressEnd}
                    onTouchStart={() => handleCardPressStart(item.productId)}
                    onTouchEnd={handleCardPressEnd}
                    onClick={() => {
                      if (selectionMode) {
                        toggleSelect(item.productId);
                      } else {
                        navigate(`/product/${item.productId}`);
                      }
                    }}
                    className={`relative bg-white rounded-2xl border transition-all overflow-hidden flex flex-col justify-between hover:shadow-md cursor-pointer select-none ${
                      isSelected 
                        ? 'border-[#E42525] bg-red-50/10 shadow-sm' 
                        : 'border-neutral-100'
                    }`}
                  >
                    {/* Checkbox overlay in selection mode */}
                    {selectionMode && (
                      <div className="absolute top-2.5 left-2.5 z-20 bg-white/90 backdrop-blur rounded-md p-1 border border-neutral-100 shadow-sm pointer-events-none">
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-[#E42525]" />
                        ) : (
                          <Square className="h-4 w-4 text-neutral-400" />
                        )}
                      </div>
                    )}

                    {/* Image section */}
                    <div className="relative aspect-square w-full bg-neutral-100 flex items-center justify-center overflow-hidden">
                      {image.startsWith('http') ? (
                        <img 
                          src={image} 
                          alt={name} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-4xl">{image}</span>
                      )}

                      {/* Remove toggle heart button */}
                      {!selectionMode && (
                        <button
                          type="button"
                          onClick={(e) => handleRemoveItem(item.productId, e)}
                          className="absolute top-2.5 right-2.5 z-10 h-7.5 w-7.5 rounded-full bg-white/90 backdrop-blur shadow-sm border border-neutral-50 flex items-center justify-center text-red-500 hover:scale-105 active:scale-95 transition-all"
                        >
                          <Heart className="h-4.5 w-4.5 fill-red-500 text-red-500" />
                        </button>
                      )}

                      {/* Discount or badge */}
                      {product.discountPercent > 0 && (
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-[#E42525] text-white text-[9px] font-black uppercase tracking-wider">
                          -{product.discountPercent}%
                        </span>
                      )}
                    </div>

                    {/* Detail section */}
                    <div className="p-3 flex-1 flex flex-col justify-between gap-1">
                      <div>
                        <h4 className="font-sans font-bold text-xs text-neutral-800 line-clamp-2 leading-tight">
                          {name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="font-mono text-[13px] font-black text-[#E42525]">
                            MWK {price.toLocaleString()}
                          </span>
                          {product.originalPrice && product.originalPrice > price && (
                            <span className="font-mono text-[9px] text-neutral-400 line-through">
                              MWK {product.originalPrice.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Add to cart action */}
                      {!selectionMode && (
                        <button
                          type="button"
                          onClick={(e) => handleAddToCart(product, e)}
                          className="w-full mt-2.5 flex items-center justify-center gap-1 py-2 text-[10px] font-black uppercase tracking-wider text-white bg-[#E42525] hover:bg-[#c41e1e] rounded-xl transition-all shadow-sm"
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                          <span>Add to Cart</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM SLIDE-UP ACTIONS FOR SELECTION MODE */}
      {selectionMode && selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-neutral-100 p-4 shadow-lg flex items-center justify-between animate-[slideUp_0.2s_ease-out]">
          <span className="text-xs font-black text-neutral-700">
            {selectedIds.length} {selectedIds.length === 1 ? 'item selected' : 'items selected'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRemoveBatchFromWishlist}
              className="flex items-center gap-1 px-3.5 py-2.5 font-display font-black text-xs text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-full transition-all"
            >
              <Trash2 className="h-4 w-4" />
              <span>Remove</span>
            </button>
            <button
              onClick={handleAddBatchToCart}
              className="flex items-center gap-1 px-4.5 py-2.5 font-display font-black text-xs text-white bg-[#E42525] hover:bg-[#c41e1e] rounded-full transition-all shadow-md"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>Add to Cart</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
