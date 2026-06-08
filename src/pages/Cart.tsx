import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore, useAuthStore } from '../stores';
import { SAMPLE_PRODUCTS } from '../data/malawiProducts';
import { ShoppingBag, Trash2, ArrowRight, Tag, ShieldCheck, MapPin, CheckSquare, Square, Ticket } from 'lucide-react';

export default function Cart() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { 
    items, 
    updateQuantity, 
    removeItem, 
    couponCode, 
    discountPercent, 
    applyCoupon, 
    clearCart
  } = useCartStore();

  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState(false);
  const [promoSuccess, setPromoSuccess] = useState(false);

  // Checkbox Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Initialize all items as selected
  useEffect(() => {
    if (items.length > 0) {
      setSelectedIds(items.map(item => item.productId));
    }
  }, [items.length]);

  // CHAKUPITA Sale Countdown Timer (Ticking count 15:00)
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 mins
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 15 * 60));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Group items by seller
  const groupedItems = items.reduce((groups, item) => {
    const seller = item.storeName || 'Independent Seller';
    if (!groups[seller]) {
      groups[seller] = [];
    }
    groups[seller].push(item);
    return groups;
  }, {} as Record<string, typeof items>);

  // Checkbox handles
  const toggleItemSelection = (productId: string) => {
    setSelectedIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId) 
        : [...prev, productId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map(item => item.productId));
    }
  };

  // Calculate totals based on SELECTED items only!
  const getSelectedTotals = () => {
    const selectedItems = items.filter(item => selectedIds.includes(item.productId));
    const subtotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discount = Math.round(subtotal * (discountPercent / 100));
    const total = subtotal - discount;
    return { subtotal, discount, total, count: selectedItems.length };
  };

  const { subtotal, discount, total, count: selectedCount } = getSelectedTotals();

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    setPromoError(false);
    setPromoSuccess(false);

    if (promoInput.trim()) {
      const ok = applyCoupon(promoInput);
      if (ok) {
        setPromoSuccess(true);
      } else {
        setPromoError(true);
      }
    }
  };

  const handleCheckoutClick = () => {
    const selectedItems = items.filter(item => selectedIds.includes(item.productId));
    if (selectedItems.length === 0) {
      alert('Chonde sankhani katundu mmodzi kapena angapo kuti mupitilize. (Please select at least one item to checkout.)');
      return;
    }
    // Navigate passing only selected items as checkout target
    navigate('/checkout', { 
      state: { 
        checkoutItems: selectedItems,
        subtotal,
        discount,
        total,
        couponUsed: couponCode || null
      } 
    });
  };

  // Helper mock variants based on category name
  const getProductVariant = (productName: string) => {
    if (productName.toLowerCase().includes('chitenje') || productName.toLowerCase().includes('jersey')) {
      return 'Variant: Standard / Medium Size';
    }
    if (productName.toLowerCase().includes('potatoes') || productName.toLowerCase().includes('rice')) {
      return 'Package: 1Kg Standard Polybag';
    }
    return 'Choice: Original / Default';
  };

  // EMPTY CART STATE SCREEN
  if (items.length === 0) {
    const suggestedProducts = SAMPLE_PRODUCTS.slice(0, 4);

    return (
      <div id="empty-cart-view" className="flex flex-col gap-6 p-4 animate-[fadeIn_0.3s_ease] bg-[#F9F9FA] min-h-screen">
        {/* Yellow Chicken Illustration Container */}
        <div className="bg-white rounded-3xl border border-neutral-100 p-8 text-center flex flex-col items-center gap-4 shadow-sm mt-4">
          <div className="relative flex items-center justify-center w-28 h-28 rounded-full bg-amber-50 border-4 border-amber-150 shadow-inner">
            <span className="text-6xl select-none animate-pulse">🐥</span>
            <span className="absolute bottom-1 right-2 text-xl bg-white p-1 rounded-full shadow-md">🌾</span>
          </div>
          
          <div className="flex flex-col gap-1">
            <h3 className="font-display font-black text-base text-neutral-800 tracking-tight">
              Your cart is empty
            </h3>
            <p className="text-xs text-neutral-500 leading-relaxed max-w-xs mx-auto">
              Chisazi chili chete! There's nothing in your basket yet. Let's find great deals from various local Malawian sellers.
            </p>
          </div>

          <div className="flex gap-3 w-full max-w-xs mt-2">
            {!user && (
              <button
                id="btn-cart-signin"
                onClick={() => navigate('/login')}
                className="flex-1 py-3 text-xs font-black text-white bg-[#E53935] hover:bg-red-700 rounded-full transition-all shadow-md shadow-red-500/10"
              >
                Sign In
              </button>
            )}
            <button
              id="btn-cart-explore"
              onClick={() => navigate('/shop')}
              className={`py-3 text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-full transition-all ${!user ? 'flex-1' : 'w-full'}`}
            >
              Explore Items
            </button>
          </div>
        </div>

        {/* Security Discloser Footer Section */}
        <div className="bg-neutral-900 text-neutral-200 p-4 rounded-3xl flex items-center gap-3 border border-neutral-800 shadow-md">
          <div className="p-2 bg-neutral-800 rounded-2xl text-amber-500 text-lg">
            🔒
          </div>
          <div className="flex-1 min-w-0">
            <span className="block text-[11px] font-black uppercase text-amber-500 tracking-wider">
              Security & Privacy
            </span>
            <span className="block text-[10px] text-neutral-400">
              Safe payments via Paychangu. Supported internally with Airtel Money, TNM Mpamba & cards.
            </span>
          </div>
        </div>

        {/* SUGGESTION MODULE: More to love */}
        <div className="flex flex-col gap-3 mt-2">
          <h4 className="font-display font-black text-xs text-neutral-800 uppercase tracking-wider">
            More to love
          </h4>
          <div className="grid grid-cols-2 gap-3 pb-8">
            {suggestedProducts.map((p) => (
              <div 
                key={p.id}
                onClick={() => navigate(`/product/${p.id}`)}
                className="bg-white rounded-2xl border border-neutral-100 p-2.5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="relative h-28 rounded-xl bg-neutral-50 flex items-center justify-center text-4xl border border-neutral-100 select-none">
                  {p.imageUrl || '📦'}
                  <span className="absolute bottom-1.5 right-1.5 bg-[#E53935] text-[8px] font-black text-white px-1.5 py-0.5 rounded">
                    SALE
                  </span>
                </div>
                <div className="mt-2 text-left">
                  <span className="block text-[10px] text-neutral-450 font-bold uppercase truncate">{p.storeName}</span>
                  <p className="font-black text-xs text-neutral-800 line-clamp-1 leading-tight">{p.name}</p>
                  <p className="font-mono text-xs font-black text-[#E53935] mt-1">MWK {p.price.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE CART WITH ITEMS VIEW
  return (
    <div className="flex flex-col gap-4 p-4 animate-[fadeIn_0.3s_ease] bg-[#F9F9FA] pb-24">
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center bg-white rounded-2xl border border-neutral-100 p-3 shadow-xs">
        <div className="flex items-center gap-1.5">
          <ShoppingBag className="h-4.5 w-4.5 text-[#E53935]" />
          <span className="font-display font-black text-sm text-neutral-900">
            Cart ({items.length})
          </span>
          <span className="text-[10px] bg-red-100 text-[#E53935] font-black px-1.5 py-0.5 rounded-full">
            Malawi 🇲🇼
          </span>
        </div>
        <button 
          onClick={clearCart}
          className="text-[10px] font-bold text-neutral-450 hover:text-red-600 uppercase tracking-widest flex items-center gap-1"
        >
          <Trash2 className="h-3 w-3" />
          <span>clear all</span>
        </button>
      </div>

      {/* CHAKUPITA FLASH SALE BLUE TIMED BANNER */}
      <div className="bg-sky-600 text-white p-3 rounded-2xl flex justify-between items-center shadow-md shadow-sky-600/10">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚡</span>
          <div className="leading-none">
            <span className="block text-[10px] font-extrabold uppercase tracking-widest text-[#FFD54F]">
              CHAKUPITA SALE
            </span>
            <span className="text-[9px] text-sky-100 block mt-0.5 font-medium">Extra discounts applied automatically</span>
          </div>
        </div>
        <div className="bg-neutral-900/40 text-amber-300 font-mono text-xs font-black px-2.5 py-1.5 rounded-xl border border-sky-400/25">
          Ends {formatTime(timeLeft)}
        </div>
      </div>

      {/* LIST ITEMS GROUPED BY SELLER */}
      <div className="flex flex-col gap-4">
        {Object.entries(groupedItems).map(([sellerName, sellerItems]) => (
          <div key={sellerName} className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden text-left">
            {/* Seller Header Section */}
            <div className="bg-neutral-50 px-3.5 py-2.5 border-b border-neutral-100 flex items-center gap-2">
              <span className="text-sm">🏪</span>
              <span className="text-xs font-black text-neutral-700 uppercase tracking-wider">
                {sellerName}
              </span>
            </div>

            {/* Seller's products items rows */}
            <div className="divide-y divide-neutral-100">
              {sellerItems.map((item) => {
                const isChecked = selectedIds.includes(item.productId);
                return (
                  <div key={item.productId} className="p-3 flex gap-3 items-center">
                    
                    {/* Checkbox selector */}
                    <button 
                      onClick={() => toggleItemSelection(item.productId)}
                      className="text-neutral-400 hover:text-[#E53935] shrink-0"
                    >
                      {isChecked ? (
                        <CheckSquare className="h-5 w-5 text-[#E53935]" />
                      ) : (
                        <Square className="h-5 w-5 text-neutral-300" />
                      )}
                    </button>

                    {/* Product visual 60x60 */}
                    <div className="h-[60px] w-[60px] rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-center text-3xl shrink-0 select-none">
                      {item.imageUrl || '📦'}
                    </div>

                    {/* Mid text: Title (max 2 lines), variant shape, price */}
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5 text-left">
                      <h4 className="font-extrabold text-xs text-neutral-800 line-clamp-2 leading-tight">
                        {item.productName}
                      </h4>
                      <span className="text-[9px] font-semibold text-neutral-400 block tracking-wide italic">
                        {getProductVariant(item.productName)}
                      </span>
                      <div className="font-mono text-xs font-black text-[#E53935] mt-1 shrink-0">
                        MWK {item.price.toLocaleString()}
                      </div>
                    </div>

                    {/* Stepper qty controls & delete */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <button 
                        onClick={() => removeItem(item.productId)}
                        className="p-1 rounded text-neutral-350 hover:text-red-600 hover:bg-neutral-50 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>

                      <div className="flex items-center border border-neutral-200 rounded-full overflow-hidden bg-neutral-50 shadow-inner">
                        <button 
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="px-2.5 py-1 hover:bg-neutral-200 text-xs font-black text-neutral-700 transition-all border-r border-neutral-200"
                        >
                          −
                        </button>
                        <span className="px-2 font-mono text-xs font-black text-neutral-800">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="px-2.5 py-1 hover:bg-neutral-200 text-xs font-black text-neutral-700 transition-all border-l border-neutral-200"
                        >
                          +
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* SELECT ALL CHECKBOX CONSOLE BAR */}
      <div 
        onClick={toggleSelectAll}
        className="bg-neutral-900 text-white rounded-2xl p-3 flex justify-between items-center shadow-md cursor-pointer hover:bg-neutral-800 transition-all"
      >
        <div className="flex items-center gap-2">
          {selectedIds.length === items.length ? (
            <CheckSquare className="h-4.5 w-4.5 text-amber-500" />
          ) : (
            <Square className="h-4.5 w-4.5 text-neutral-400" />
          )}
          <span className="text-xs font-black uppercase tracking-wider text-[10px]">
            ☑ Select All ({items.length})
          </span>
        </div>
        <span className="font-mono text-[10px] text-amber-400 font-extrabold bg-neutral-800 px-2 py-1 rounded">
          {selectedIds.length} Selected
        </span>
      </div>

      {/* COUPON ENTER COMPONENT */}
      <form onSubmit={handleApplyPromo} className="bg-white p-3.5 rounded-3xl border border-neutral-100 shadow-sm flex flex-col gap-2.5">
        <label className="text-xs font-extrabold text-neutral-700 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
          <Ticket className="h-4 w-4 text-emerald-500" />
          <span>Apply Promo Coupon</span>
        </label>
        
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="🎟️ Enter coupon code"
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value)}
            className="flex-1 text-xs font-mono font-black placeholder:font-sans uppercase rounded-full border border-neutral-200 px-4 py-2.5 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#E53935]"
          />
          <button 
            type="submit"
            className="px-4 py-2 text-xs font-black text-white bg-[#E53935] hover:bg-red-700 rounded-full transition-all shrink-0 shadow-md shadow-red-500/15 animate-bounce"
          >
            Apply
          </button>
        </div>

        {promoError && (
          <p className="text-[10px] font-bold text-rose-600 text-left">
            ❌ Invalid code. Try "LILONGWE15" or "EASTER20"
          </p>
        )}
        {promoSuccess && (
          <p className="text-[10px] font-bold text-emerald-600 text-left">
            🎉 Coupon "{couponCode}" applied! Save {discountPercent}% off on selected items!
          </p>
        )}
        {couponCode && !promoSuccess && (
          <p className="text-[10px] font-bold text-emerald-600 text-left">
            ✓ Coupon active: {couponCode} ({discountPercent}% Discount)
          </p>
        )}
      </form>

      {/* ORDER SUMMARY */}
      <div className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-sm flex flex-col gap-2 text-left">
        <h3 className="text-xs font-black uppercase tracking-wider text-[10px] text-neutral-450 pb-1.5 border-b border-neutral-100">
          Order Summary ({selectedCount} Selected)
        </h3>

        <div className="flex justify-between items-center text-xs font-bold text-neutral-600 mt-1">
          <span>Subtotal</span>
          <span className="font-mono text-neutral-900">MWK {subtotal.toLocaleString()}</span>
        </div>

        {discount > 0 && (
          <div className="flex justify-between items-center text-xs font-extrabold text-emerald-600">
            <span>Coupon discount ({discountPercent}%)</span>
            <span className="font-mono">- MWK {discount.toLocaleString()}</span>
          </div>
        )}

        <div className="flex justify-between items-center text-xs font-bold text-neutral-500 pb-1.5 border-b border-dashed border-neutral-100">
          <span>Delivery / Connection</span>
          <span className="text-[9px] uppercase text-[#FFB300] bg-amber-50 px-2 py-0.5 rounded font-black">
            Arrange at checkout
          </span>
        </div>

        <div className="flex justify-between items-center font-display font-extrabold text-[#212121] py-1">
          <span>Total</span>
          <span className="font-mono text-lg font-black text-[#E53935] leading-none">
            MWK {total.toLocaleString()}
          </span>
        </div>

        {/* Security Discloser Footer Section */}
        <div className="flex items-center gap-1.5 text-[9px] font-bold text-neutral-400 mt-1 justify-center bg-neutral-50 border border-neutral-100 p-2 rounded-xl">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span>🔒 Security & Privacy — Safe payments via Paychangu</span>
        </div>

        {/* Proceed to checkout button */}
        <button
          onClick={handleCheckoutClick}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3.5 rounded-full bg-[#E53935] hover:bg-red-700 text-xs font-black text-white hover:scale-[1.01] transition-all shadow-md shadow-red-500/20"
        >
          <span>Checkout ({selectedCount} items) →</span>
        </button>
      </div>

    </div>
  );
}
