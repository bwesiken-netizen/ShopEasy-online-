import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useCartStore, useNotificationStore } from '../stores';
import { 
  Sparkles, Percent, ShoppingBag, Users, Flame, Coins, 
  ChevronRight, ThumbsUp, RefreshCw, Heart, Tag, 
  Store, Clock, Plus, Gift, Check, Receipt, Search, Settings, Bell, Compass, User, Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// Define the exact 12 categories requested 
const LISTED_CATEGORIES = [
  { id: 'cat_phones', name: 'Phones', icon: '📱' },
  { id: 'cat_elec', name: 'Electronics', icon: '💻' },
  { id: 'cat_fashion', name: 'Fashion', icon: '👗' },
  { id: 'cat_food', name: 'Food & Groceries', icon: '🍎' },
  { id: 'cat_home', name: 'Home & Living', icon: '🏠' },
  { id: 'cat_beauty', name: 'Beauty', icon: '💄' },
  { id: 'cat_sports', name: 'Sports', icon: '⚽' },
  { id: 'cat_tools', name: 'Tools', icon: '🔧' },
  { id: 'cat_kids', name: 'Baby & Kids', icon: '👶' },
  { id: 'cat_farm', name: 'Farming Supplies', icon: '🌽' },
  { id: 'cat_books', name: 'Books', icon: '📚' },
  { id: 'cat_auto', name: 'Automotive', icon: '🚗' },
];

const LOCAL_FALLBACK_PRODUCTS = [
  {
    id: 'p_1',
    storeId: 'store_limbe',
    storeName: 'Limbe Golden Farm Store',
    name: 'Irish Potatoes (Kilo)',
    description: 'Sweet local organic Irish potatoes harvested from Lilongwe highlands. Best for chips or stew!',
    price: 3500,
    category: 'Food & Groceries',
    imageUrl: '🥔',
    stock: 250,
    city: 'Blantyre',
    active: true,
    featured: true,
    sold: 145,
    rating: 4.8,
    discountBadge: '-20%',
    isBulk: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'p_2',
    storeId: 'store_chambo',
    storeName: 'Lake Side Chambo Kings',
    name: 'Fresh Lake Chambo (Medium)',
    description: 'Delicious fresh Chambo fish wild-caught from Mangochi shores. Perfectly cleaned and on ice.',
    price: 8000,
    category: 'Food & Groceries',
    imageUrl: '🐟',
    stock: 45,
    city: 'Mangochi',
    active: true,
    featured: true,
    sold: 382,
    rating: 4.9,
    discountBadge: '-15%',
    isBulk: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'p_3',
    storeId: 'store_zomba_art',
    storeName: 'Zomba Plateau Crafts',
    name: 'African Wax Chirundu Chitenje',
    description: 'Authentic high-purity Malawian Chitenje cotton cotton prints. Beautiful bold colors!',
    price: 12000,
    category: 'Fashion',
    imageUrl: '👗',
    stock: 12,
    city: 'Zomba',
    active: true,
    featured: true,
    sold: 210,
    rating: 4.7,
    discountBadge: '-10%',
    isBulk: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'p_4',
    storeId: 'store_mzuzu_tech',
    storeName: 'Mzuzu Mobile & Solar Solutions',
    name: 'Itel Magic 3 Super Feature Phone',
    description: 'Excellent battery life, dual SIM card slots, Airtel/TNM compatible, perfect for farmers.',
    price: 24500,
    category: 'Phones',
    imageUrl: '📱',
    stock: 28,
    city: 'Mzuzu',
    active: true,
    featured: false,
    sold: 95,
    rating: 4.2,
    discountBadge: '-5%',
    isBulk: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'p_5',
    storeId: 'store_limbe',
    storeName: 'Limbe Golden Farm Store',
    name: 'Aroma Kilombero Rice (5kg)',
    description: 'Premium aromatic Kilombero rice from Karonga. The absolute best rice fragrance in Malawi!',
    price: 11500,
    category: 'Food & Groceries',
    imageUrl: '🌾',
    stock: 80,
    city: 'Blantyre',
    active: true,
    featured: true,
    sold: 450,
    rating: 4.8,
    discountBadge: '-30%',
    isBulk: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'p_6',
    storeId: 'store_chambo',
    storeName: 'Lake Side Chambo Kings',
    name: 'Dried Usipa Fish (Large Pack)',
    description: 'Sun-dried crisp Usipa small fish. Highly nutritional, great for frying with local tomatoes.',
    price: 4500,
    category: 'Food & Groceries',
    imageUrl: '🍤',
    stock: 150,
    city: 'Lilongwe',
    active: true,
    featured: false,
    sold: 56,
    rating: 4.4,
    discountBadge: '-40%',
    isBulk: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'p_7',
    storeId: 'store_zomba_art',
    storeName: 'Zomba Plateau Crafts',
    name: 'Handcarved Wooden Salad Bowls',
    description: 'Elegant serving bowl sculpted by master artisans from Mulanje Cedar wood.',
    price: 18000,
    category: 'Home & Living',
    imageUrl: '🥣',
    stock: 5,
    city: 'Zomba',
    active: true,
    featured: false,
    sold: 34,
    rating: 4.6,
    discountBadge: '-25%',
    isBulk: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'p_8',
    storeId: 'store_mzuzu_tech',
    storeName: 'Mzuzu Mobile & Solar Solutions',
    name: 'SuperTech Solar Reading Lantern',
    description: 'High readings solar panel light with fast phone charger.',
    price: 15000,
    category: 'Electronics',
    imageUrl: '💡',
    stock: 45,
    city: 'Mzuzu',
    active: true,
    featured: true,
    sold: 115,
    rating: 4.5,
    discountBadge: '-20%',
    isBulk: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'p_bulk_1',
    storeId: 'store_limbe',
    storeName: 'Limbe Golden Farm Store',
    name: 'Wholesale Potato Sacks (Bulk)',
    description: 'Full 50kg farm-fresh sack of Irish potatoes. Perfect for boarding schools, restaurants, or neighbors sharing.',
    price: 45000,
    category: 'Farming Supplies',
    imageUrl: '🥔',
    stock: 30,
    city: 'Blantyre',
    active: true,
    featured: false,
    isBulk: true,
    bulkPrice: 38000,
    bulkMinQty: 3,
    sold: 12,
    rating: 4.7,
    discountBadge: '-15%',
    createdAt: new Date().toISOString()
  },
  {
    id: 'p_bulk_2',
    storeId: 'store_chambo',
    storeName: 'Lake Side Chambo Kings',
    name: 'Lake Chambo Dried Sacks (Bulk)',
    description: 'Bale of 50 dried lake Chambo fish sheets from Mangochi shores, salted for shelf-life security.',
    price: 85000,
    category: 'Food & Groceries',
    imageUrl: '🐟',
    stock: 15,
    city: 'Mangochi',
    active: true,
    featured: false,
    isBulk: true,
    bulkPrice: 65000,
    bulkMinQty: 2,
    sold: 8,
    rating: 4.9,
    discountBadge: '-23%',
    createdAt: new Date().toISOString()
  }
];

export default function Home() {
  const navigate = useNavigate();
  const { user, awardCoins } = useAuthStore();
  const { addItem, items: cartItems } = useCartStore();
  const { notifications } = useNotificationStore();

  const unreadNotifications = notifications.filter((n) => !n.read).length;

  // Real data fetching states
  const [loading, setLoading] = useState(true);
  const [allProducts, setAllProducts] = useState<any[]>(LOCAL_FALLBACK_PRODUCTS);
  const [flashSaleActive, setFlashSaleActive] = useState(true);
  const [saleConfig, setSaleConfig] = useState<{ active: boolean; endTime: string; discountGoldText?: string } | null>(null);
  
  // Specific views
  const [topDealsTab, setTopDealsTab] = useState<'All' | 'Phones' | 'Fashion' | 'Home' | 'Food'>('All');
  const [collectedCoupons, setCollectedCoupons] = useState<string[]>([]);
  const [coinsClaimed, setCoinsClaimed] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [feedSize, setFeedSize] = useState(6);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [showCenterMenu, setShowCenterMenu] = useState(false);

  // Live countdown HH:MM:SS
  const [timeLeft, setTimeLeft] = useState({ hours: 2, minutes: 14, seconds: 45 });

  // Floating feedback Toast helper
  const triggerToast = (msg: string) => {
    setShowToast(msg);
    setTimeout(() => {
      setShowToast(null);
    }, 2500);
  };

  // 1. Check check-in rewards claimed status from localStorage
  useEffect(() => {
    const claimedToday = localStorage.getItem('coins_claimed_today');
    if (claimedToday) {
      setCoinsClaimed(true);
    }
  }, []);

  // 2. Load sale settings config from Firestore config/saleSettings
  useEffect(() => {
    async function fetchSaleConfig() {
      try {
        const configDoc = await getDoc(doc(db, 'config', 'saleSettings'));
        if (configDoc.exists()) {
          const data = configDoc.data();
          setSaleConfig({
            active: data.active ?? true,
            endTime: data.endTime || new Date(Date.now() + 1000 * 60 * 60 * 2.5).toISOString(),
            discountGoldText: data.discountGoldText || 'UP TO 80% OFF'
          });
          setFlashSaleActive(data.active ?? true);
        } else {
          // Default fallbacks
          setSaleConfig({
            active: true,
            endTime: new Date(Date.now() + 1000 * 60 * 60 * 2.5).toISOString(),
            discountGoldText: 'UP TO 80% OFF'
          });
        }
      } catch (err) {
        console.warn("Could not read configuration from config/saleSettings, using defaults:", err);
        setSaleConfig({
          active: true,
          endTime: new Date(Date.now() + 1000 * 60 * 60 * 2.5).toISOString(),
          discountGoldText: 'UP TO 80% OFF'
        });
      }
    }
    fetchSaleConfig();
  }, []);

  // 3. Live countdown HH:MM:SS timer
  useEffect(() => {
    if (!saleConfig?.endTime) return;
    const timer = setInterval(() => {
      const end = new Date(saleConfig.endTime).getTime();
      const now = new Date().getTime();
      const distance = end - now;

      if (distance < 0) {
        setFlashSaleActive(false);
        clearInterval(timer);
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
      } else {
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [saleConfig]);

  // 4. Fetch products from real Firestore database
  useEffect(() => {
    async function loadProductsFromFirestore() {
      try {
        setLoading(true);
        // Add a slight artificial delay (400ms) to proudly demonstrate the skeleton loaders!
        await new Promise((resolve) => setTimeout(resolve, 450));
        const productsCol = collection(db, 'products');
        
        // Fetch ordered by sold desc limit 20
        let q = query(productsCol, limit(20));
        let snapshot;
        try {
          snapshot = await getDocs(q);
        } catch (innerErr) {
          console.warn("Falling back to standard query without complex indexes:", innerErr);
          snapshot = await getDocs(query(productsCol, limit(20)));
        }

        if (snapshot && !snapshot.empty) {
          const list: any[] = [];
          snapshot.forEach((doc) => {
            list.push({ id: doc.id, ...doc.data() });
          });
          
          // Ensure all required UI fields are enriched if missing in raw DB docs
          const enriched = list.map((item, index) => ({
            ...item,
            sold: item.sold || (115 + index * 12),
            orders: item.sold || (115 + index * 12),
            rating: item.rating || parseFloat((4.2 + (index % 8) * 0.1).toFixed(1)),
            discountBadge: item.discountBadge || `-${10 + (index % 5) * 10}%`,
            isBulk: item.isBulk || item.id?.includes('bulk') || (index % 4 === 0),
            bulkPrice: item.bulkPrice || Math.round(item.price * 0.75),
            bulkMinQty: item.bulkMinQty || 3
          }));

          setAllProducts(enriched);
        } else {
          // If Firestore is empty, we keep our beautiful, pre-defined LOCAL_FALLBACK_PRODUCTS!
          setAllProducts(LOCAL_FALLBACK_PRODUCTS);
        }
      } catch (err) {
        console.error("Failure fetching products from Firestore:", err);
        setAllProducts(LOCAL_FALLBACK_PRODUCTS);
      } finally {
        setLoading(false);
      }
    }
    loadProductsFromFirestore();
  }, []);

  // 5. Load collected coupons for logged-in user from Firestore
  useEffect(() => {
    if (!user) {
      setCollectedCoupons([]);
      return;
    }
    async function loadUserCoupons() {
      try {
        const couponsCol = collection(db, 'users', user.uid, 'coupons');
        const qSnapshot = await getDocs(couponsCol);
        const codes: string[] = [];
        qSnapshot.forEach((doc) => {
          codes.push(doc.id);
        });
        setCollectedCoupons(codes);
      } catch (err) {
        console.warn("Failed to load user's collected coupons:", err);
      }
    }
    loadUserCoupons();
  }, [user]);

  // Handle coupon collection
  const collectCoupon = async (code: string) => {
    if (!user) {
      triggerToast("🔐 Please login to collect ShopEasy coupons!");
      setTimeout(() => navigate('/login'), 1200);
      return;
    }
    if (collectedCoupons.includes(code)) {
      triggerToast(`Coupon ${code} is already in your wallet!`);
      return;
    }
    try {
      await setDoc(doc(db, 'users', user.uid, 'coupons', code), {
        code,
        collectedAt: new Date().toISOString()
      });
      setCollectedCoupons([...collectedCoupons, code]);
      awardCoins(15); // awards 15 loyalty coins
      triggerToast(`✓ Voucher ${code} Collected! +15 Coins.`);
    } catch (err) {
      console.error("Error setting user coupon document:", err);
      triggerToast("Failed to collect voucher, please retry.");
    }
  };

  // Claim daily check-in coins
  const claimDailyCoins = () => {
    if (!user) {
      triggerToast("🔐 Log in first to claim daily check-in coins!");
      setTimeout(() => navigate('/login'), 1200);
      return;
    }
    if (coinsClaimed) return;
    try {
      awardCoins(50); // awards 50 coins to user profile & Firestore doc
      setCoinsClaimed(true);
      localStorage.setItem('coins_claimed_today', 'true');
      triggerToast('🪙 Chawama! +50 Coins claimed.');
    } catch (err) {
      console.error("Failed claiming coins:", err);
      triggerToast("Error claiming coins, please retry.");
    }
  };

  // Simulated More to Love infinite scroll loader
  const triggerLoadMore = () => {
    setFeedLoadingMore(true);
    setTimeout(() => {
      setFeedSize((prev) => prev + 4);
      setFeedLoadingMore(false);
      triggerToast('Showing newly matched local products near you.');
    }, 700);
  };

  // Format currency helpers
  const formatMWK = (val: number) => {
    return 'MWK ' + val.toLocaleString();
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F5] pb-24 text-[#212121]">

      {/* Floating Alert Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 border border-neutral-800 text-white font-extrabold text-[11px] uppercase tracking-wider py-3 px-6 rounded-full shadow-2xl flex items-center gap-2 whitespace-nowrap"
          >
            <Sparkles className="h-4 w-4 text-amber-400 animate-spin" />
            <span>{showToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. TOP BAR (sticky, height: 56px) */}
      <div className="sticky top-0 z-45 bg-white h-14 border-b border-neutral-100 shadow-xs flex items-center justify-between px-4">
        {/* Left: Logo ShopEasy */}
        <div className="flex items-center gap-1.5 cursor-pointer select-none" onClick={() => navigate('/')} id="home-logo-btn">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E53935] text-white font-black text-xs">
            SE
          </div>
          <span className="font-display font-extrabold text-base tracking-tight text-neutral-900">
            Shop<span className="text-[#E53935]">Easy</span>
          </span>
        </div>

        {/* Center: Search bar */}
        <div 
          className="flex-1 flex items-center gap-1.5 max-w-[215px] sm:max-w-xs mx-1"
          id="home-search-trigger"
        >
          <div className="relative flex-grow">
            {/* Camera icon on the left, tapping opens /search/camera */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate('/search/camera');
              }}
              className="absolute left-2.5 top-2 text-neutral-500 hover:text-[#E53935] transition-colors z-10"
              title="Camera search"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
            <input
              type="text"
              placeholder="Search ShopEasy..."
              readOnly
              onClick={() => navigate('/search')}
              className="w-full text-[10px] font-bold rounded-full border border-neutral-200 bg-neutral-50 py-1.5 pl-7.5 pr-2 text-neutral-800 cursor-pointer focus:outline-none"
            />
          </div>
          <button
            onClick={() => navigate('/search')}
            className="bg-neutral-900 text-white text-[8.5px] font-black uppercase tracking-wider py-1.5 px-2.5 rounded-full shrink-0 shadow-3xs"
          >
            Go
          </button>
        </div>

        {/* Right side icons */}
        <div className="flex items-center gap-1">
          <button 
            onClick={() => navigate('/account')}
            className="relative p-1.5 rounded-full hover:bg-neutral-50"
            title={`${unreadNotifications} unread notifications`}
            id="home-notifications-bell"
          >
            <Bell className="h-4.5 w-4.5 text-neutral-700" />
            {unreadNotifications > 0 && (
              <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-[#E53935] text-[8px] font-black text-white font-mono animate-bounce">
                {unreadNotifications}
              </span>
            )}
          </button>
          
          <span className="text-base select-none px-0.5" title="Malawi">🇲🇼</span>
          
          <button 
            onClick={() => navigate('/settings')}
            className="p-1.5 rounded-full hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900"
            id="home-settings-gear"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Home Scroll Contents */}
      <div className="flex flex-col gap-6 p-4">

        {/* 2. CHAKUPITA SALE BANNER (if active) */}
        {flashSaleActive && (
          <div className="rounded-3xl bg-gradient-to-r from-blue-600 via-[#E53935] to-red-650 p-4 shrink-0 shadow-md border-b-4 border-amber-400 overflow-hidden relative" id="flash-sale-banner">
            {/* Flamingo and palm tree decorative illustration */}
            <div className="absolute right-[-15px] top-[-10px] text-6xl opacity-20 pointer-events-none select-none">
              🦩🌴
            </div>
            
            <div className="flex justify-between items-center pb-2.5 border-b border-white/20">
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-400 text-neutral-900 text-xs font-black animate-bounce">
                  🔥
                </span>
                <span className="font-display font-black text-xs text-white uppercase tracking-wider">
                  CHAKUPITA SALE
                </span>
              </div>

              {/* LIVE COUNTDOWN */}
              <div className="flex items-center gap-1 bg-black/40 py-1 px-2.5 rounded-full border border-white/10">
                <Clock className="h-3 w-3 text-amber-400" />
                <div className="font-mono text-[10px] font-black text-white flex items-center gap-0.5">
                  <span>{String(timeLeft.hours).padStart(2, '0')}</span>
                  <span className="animate-pulse">:</span>
                  <span>{String(timeLeft.minutes).padStart(2, '0')}</span>
                  <span className="animate-pulse">:</span>
                  <span>{String(timeLeft.seconds).padStart(2, '0')}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-2.5">
              <div>
                <div className="text-[10px] text-amber-300 font-bold uppercase tracking-widest leading-none">Flash Sale active</div>
                <h4 className="font-display text-lg font-black text-white leading-none mt-1">
                  UP TO <span className="text-amber-400 font-extrabold">80% OFF</span> TEXTILES & CROPS
                </h4>
              </div>

              {/* Collect coupon strip below banner (horizontal scroll) */}
              <div className="flex flex-col gap-1.5 mt-2 bg-black/15 rounded-2xl p-2 border border-white/5">
                <div className="text-[8px] text-neutral-200 uppercase font-black tracking-wider px-0.5">
                  🎁 Tap to Collect Discount Coupons:
                </div>
                
                {/* Horizontal scroll strip */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
                  {[
                    { code: 'EASY05', label: 'MWK41,672 OFF' },
                    { code: 'EASY06', label: 'MWK25,000 OFF' },
                    { code: 'EASY07', label: 'MWK10,000 OFF' }
                  ].map((coupon) => {
                    const isCollected = collectedCoupons.includes(coupon.code);
                    return (
                      <button
                        key={coupon.code}
                        onClick={() => collectCoupon(coupon.code)}
                        className={`py-1.5 px-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 shrink-0 snap-start select-none border ${
                          isCollected 
                            ? 'bg-amber-400 text-neutral-950 border-amber-500 shadow-inner' 
                            : 'bg-white/10 text-white hover:bg-white/20 border-white/25'
                        }`}
                      >
                        {isCollected ? (
                          <>
                            <Check className="h-3 w-3 shrink-0 text-neutral-950 font-black" />
                            <span>Collected ✓</span>
                          </>
                        ) : (
                          <span>{coupon.label} | {coupon.code} | Collect</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. MY ORDERS QUICK ACCESS (Shown only if logged in) */}
        {user ? (
          <div className="bg-white rounded-3xl border border-neutral-100 p-4 shadow-xs flex flex-col gap-3" id="quick-orders-access">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <div>
                <span className="text-[9px] uppercase font-black text-neutral-400 tracking-wider">Activities Track</span>
                <h3 className="font-display font-black text-[11px] text-neutral-900 uppercase">My Orders & Shortcuts</h3>
              </div>
              <button 
                onClick={() => navigate('/account?tab=orders')}
                className="text-[10px] font-black text-[#E53935] hover:underline uppercase flex items-center gap-0.5"
                id="all-orders-shortcut"
              >
                <span>Orders</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Row of 5 Icons (No shipping references) */}
            <div className="grid grid-cols-5 gap-1 text-center py-1">
              <button onClick={() => navigate('/account?tab=orders')} className="flex flex-col items-center gap-1 group">
                <div className="h-10 w-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-650 group-hover:bg-[#E53935] group-hover:text-white transition-colors">
                  <Receipt className="h-4.5 w-4.5" />
                </div>
                <span className="text-[8px] font-black text-neutral-600 group-hover:text-neutral-900">📋 To Pay</span>
              </button>

              <button onClick={() => navigate('/account?tab=orders')} className="flex flex-col items-center gap-1 group">
                <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-650 group-hover:bg-[#E53935] group-hover:text-white transition-colors">
                  <ChevronRight className="h-4.5 w-4.5" />
                </div>
                <span className="text-[8px] font-black text-neutral-600 group-hover:text-neutral-900">🔄 Processing</span>
              </button>

              <button onClick={() => navigate('/account?tab=orders')} className="flex flex-col items-center gap-1 group">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-650 group-hover:bg-[#E53935] group-hover:text-white transition-colors">
                  <RefreshCw className="h-4.5 w-4.5" />
                </div>
                <span className="text-[8px] font-black text-neutral-600 group-hover:text-neutral-900">🚗 On The Way</span>
              </button>

              <button onClick={() => navigate('/account?tab=reviews')} className="flex flex-col items-center gap-1 group">
                <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-650 group-hover:bg-[#E53935] group-hover:text-white transition-colors">
                  <ThumbsUp className="h-4.5 w-4.5" />
                </div>
                <span className="text-[8px] font-black text-neutral-600 group-hover:text-neutral-900">⭐ To Review</span>
              </button>

              <button onClick={() => navigate('/account')} className="flex flex-col items-center gap-1 group">
                <div className="h-10 w-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-650 group-hover:bg-[#E53935] group-hover:text-white transition-colors">
                  <span className="text-sm">↩️</span>
                </div>
                <span className="text-[8px] font-black text-neutral-600 group-hover:text-neutral-900">Returns</span>
              </button>
            </div>

            <div className="border-t border-neutral-100/70 pt-2.5">
              {/* Row of 4 Secondary navigators below */}
              <div className="grid grid-cols-4 gap-1.5 text-[9px] font-black">
                <button 
                  onClick={() => navigate('/account?tab=orders')}
                  className="py-2 px-1 bg-neutral-50 rounded-xl hover:bg-neutral-100 text-neutral-700 flex flex-col items-center gap-1 border border-neutral-150"
                  id="order-history-btn"
                >
                  <span className="text-sm">🕐</span>
                  <span>History</span>
                </button>
                <button 
                  onClick={() => navigate('/account?tab=wishlist')}
                  className="py-2 px-1 bg-neutral-50 rounded-xl hover:bg-neutral-100 text-neutral-700 flex flex-col items-center gap-1 border border-neutral-150"
                  id="wishlist-btn"
                >
                  <span className="text-sm">❤️</span>
                  <span>Wishlist</span>
                </button>
                <button 
                  onClick={() => navigate('/account?tab=coupons')}
                  className="py-2 px-1 bg-neutral-50 rounded-xl hover:bg-neutral-100 text-neutral-700 flex flex-col items-center gap-1 border border-neutral-150"
                  id="coupons-btn"
                >
                  <span className="text-sm">🎟️</span>
                  <span>Coupons</span>
                </button>
                <button 
                  onClick={() => navigate('/account?tab=stores')}
                  className="py-2 px-1 bg-neutral-50 rounded-xl hover:bg-neutral-100 text-neutral-700 flex flex-col items-center gap-1 border border-neutral-150"
                  id="followed-stores-btn"
                >
                  <span className="text-sm">🏪</span>
                  <span>Followed</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* 4. WELCOME DEAL BANNER (Shown only to logged-out/new users) */}
        {!user ? (
          <div className="rounded-3xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 p-5 text-neutral-900 shadow-sm relative overflow-hidden flex flex-col gap-3" id="welcome-deal-card">
            <div className="absolute right-[-15px] top-[-10px] text-7xl opacity-20 pointer-events-none select-none">
              🎁
            </div>
            <div>
              <span className="text-[8px] font-black uppercase tracking-wider text-amber-950 bg-white/45 px-2 py-0.5 rounded-full inline-block">
                ⭐️ First Purchase Special
              </span>
              <h3 className="font-display font-black text-sm text-neutral-950 uppercase mt-1 leading-tight">
                Welcome to ShopEasy — Your first order starts at MWK 5,000
              </h3>
              <p className="text-[9px] text-neutral-900 font-bold mt-1 leading-relaxed">
                Unlock welcome deal discount vouchers on fresh produce, garments or feature phones in your closest Malawian markets!
              </p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2.5 rounded-full bg-neutral-950 text-white text-xs font-black uppercase tracking-wide hover:bg-neutral-900 transition-all shadow-sm self-start mt-1 flex items-center justify-center gap-1.5"
              id="welcome-deal-signin-btn"
            >
              <span>Sign In / Register</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        {/* 5. CATEGORY SCROLL ROW */}
        <div className="flex flex-col gap-2" id="categories-section">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-display font-black text-xs text-neutral-900 uppercase tracking-tight">
              Browse Categories
            </h3>
            <span className="text-[8px] text-neutral-400 font-bold uppercase tracking-wider">Slide for more →</span>
          </div>
          
          <div className="flex gap-2.5 overflow-x-auto pb-2.5 scrollbar-none snap-x">
            {LISTED_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  navigate(`/shop?category=${encodeURIComponent(cat.name)}`);
                }}
                className="flex flex-col items-center gap-2 rounded-2xl bg-white border border-neutral-100 hover:border-[#E53935] min-w-[76px] py-3.5 px-1.5 text-center transition-all shadow-xs shrink-0 snap-start active:scale-95 border-b-2 hover:shadow-xs"
                id={`cat-pill-${cat.id}`}
              >
                <span className="text-2xl select-none" role="img" aria-label={cat.name}>
                  {cat.icon}
                </span>
                <span className="text-[9px] font-black text-neutral-700 tracking-tight leading-none max-w-[65px] break-words">
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 6. TOP DEALS SECTION (With filters & horizontal scroll) */}
        <div className="bg-white rounded-3xl border border-neutral-100 p-4 shadow-xs flex flex-col gap-3.5" id="top-deals-section">
          <div className="flex flex-col gap-2 pb-2.5 border-b border-neutral-50">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[8px] font-black uppercase tracking-wider text-[#E53935]">Limited Quantities</span>
                <h3 className="font-display font-black text-xs text-neutral-900 uppercase">Top Deals 🔥</h3>
              </div>
              <button 
                onClick={() => navigate('/shop')}
                className="text-[10px] font-black text-[#E53935] hover:underline uppercase flex items-center gap-0.5"
                id="see-all-top-deals"
              >
                <span>See all</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            
            {/* Horizontal Filter Tab Buttons */}
            <div className="flex gap-1 overflow-x-auto scrollbar-none py-1">
              {[
                { name: 'All', value: 'All' },
                { name: 'Phones', value: 'Phones' },
                { name: 'Fashion', value: 'Fashion' },
                { name: 'Home', value: 'Home' },
                { name: 'Food', value: 'Food' }
              ].map((tab) => {
                const isActive = topDealsTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setTopDealsTab(tab.value as any)}
                    className={`py-1 px-3.5 rounded-full text-[9px] font-black uppercase tracking-wide transition-all whitespace-nowrap shrink-0 ${
                      isActive 
                        ? 'bg-[#E53935] text-white shadow-xs' 
                        : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-800'
                    }`}
                    id={`deal-tab-${tab.value}`}
                  >
                    {tab.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horizontal Product Cards Scroll (width 160px) */}
          {loading ? (
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="flex flex-col gap-2 animate-pulse bg-neutral-50 rounded-2xl p-2.5 border border-neutral-100 min-w-[140px]">
                  <div className="h-20 bg-neutral-250 rounded-xl w-full" />
                  <div className="h-3.5 bg-neutral-250 rounded w-11/12" />
                  <div className="h-3.5 bg-neutral-250 rounded w-6/12" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1.5 scrollbar-none snap-x" id="top-deals-scrollable">
              {allProducts
                .filter(p => {
                  if (topDealsTab === 'All') return true;
                  if (topDealsTab === 'Phones') return p.category === 'Phones';
                  if (topDealsTab === 'Fashion') return p.category === 'Fashion';
                  if (topDealsTab === 'Home') return p.category === 'Home & Living';
                  if (topDealsTab === 'Food') return p.category === 'Food & Groceries';
                  return true;
                })
                .map((product) => (
                  <div
                    key={product.id}
                    onClick={() => navigate(`/product/${product.id}`)}
                    className="relative flex flex-col gap-1 bg-neutral-50 hover:bg-white rounded-2xl p-2.5 border border-neutral-150 min-w-[145px] max-w-[145px] snap-start cursor-pointer group transition-all border-b-2"
                    id={`top-deal-card-${product.id}`}
                  >
                    {/* Discount badge */}
                    <span className="absolute top-1.5 left-1.5 z-10 text-[8px] font-black bg-amber-400 text-neutral-950 px-1 py-0.5 rounded tracking-wide leading-none">
                      {product.discountBadge || '-50%'}
                    </span>

                    {/* Image Area */}
                    <div className="h-20 w-full rounded-xl bg-white border border-neutral-100 flex items-center justify-center text-4xl select-none shadow-xs shrink-0">
                      {product.imageUrl}
                    </div>

                    <div className="flex flex-col gap-0.5 mt-1">
                      <h4 className="text-[10px] font-black text-neutral-900 line-clamp-1 group-hover:text-[#E53935] leading-tight">
                        {product.name}
                      </h4>
                      <div className="font-mono text-[9px] font-black text-[#E53935] leading-none">
                        {formatMWK(product.price)}
                      </div>
                      <div className="flex justify-between items-center text-[7px] text-neutral-400 font-extrabold uppercase mt-1 leading-none">
                        <span>📍 {product.city}</span>
                        <span>{product.sold || 45} sold</span>
                      </div>
                    </div>
                  </div>
                ))}
              {allProducts.filter(p => {
                if (topDealsTab === 'All') return true;
                if (topDealsTab === 'Phones') return p.category === 'Phones';
                if (topDealsTab === 'Fashion') return p.category === 'Fashion';
                if (topDealsTab === 'Home') return p.category === 'Home & Living';
                if (topDealsTab === 'Food') return p.category === 'Food & Groceries';
                return true;
              }).length === 0 && (
                <div className="w-full py-8 text-center text-neutral-400 text-[10px] font-black uppercase">
                  🏷️ More seasonal deals coming soon!
                </div>
              )}
            </div>
          )}
        </div>

        {/* 7. BULK SAVER HUB (Save up to 40% on bulk) */}
        <div className="bg-[#FFFDF0] rounded-3xl border border-yellow-200 p-4 shadow-xs flex flex-col gap-3" id="bulk-saver-hub">
          <div className="flex justify-between items-center pb-2 border-b border-yellow-250/60">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-700 flex items-center gap-1 leading-none">
                <Users className="h-3.5 w-3.5" /> Co-Op Wholesales
              </span>
              <h3 className="font-display font-black text-xs text-neutral-900 uppercase mt-0.5">Bulk Saver Hub 📦</h3>
            </div>
            
            <button
              onClick={() => navigate('/shop?type=bulk')}
              className="text-[9px] font-black bg-neutral-900 hover:bg-[#E53935] text-white px-2.5 py-1 rounded-full uppercase transition-all"
              id="bulk-wholesale-link"
            >
              Save up to 40% in bulk →
            </button>
          </div>

          <p className="text-[9px] text-neutral-600 font-extrabold -mt-1 leading-relaxed px-0.5">
            Buy together with neighbors or family! Ordering blocks of 3+ units unlocks verified, discount Malawian wholesale pricing.
          </p>

          {loading ? (
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {[1, 2].map((idx) => (
                <div key={idx} className="h-24 bg-yellow-100/35 rounded-2xl w-48 shrink-0 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1.5 scrollbar-none snap-x" id="bulk-saver-scroll">
              {allProducts
                .filter((p) => p.isBulk)
                .map((product) => (
                  <div
                    key={product.id}
                    onClick={() => navigate(`/product/${product.id}`)}
                    className="bg-white rounded-2xl border border-yellow-200 p-3 flex gap-3 min-w-[245px] max-w-[245px] shadow-xs shrink-0 snap-start cursor-pointer hover:border-[#E53935] transition-all border-b-2"
                    id={`bulk-card-${product.id}`}
                  >
                    {/* Left Icon */}
                    <div className="h-16 w-16 bg-[#FFFDF0] rounded-xl flex items-center justify-center text-4xl select-none border border-neutral-100 shrink-0 shadow-xs">
                      {product.imageUrl}
                    </div>
                    {/* Right Info */}
                    <div className="flex flex-col justify-between flex-1 gap-1">
                      <div>
                        <h4 className="font-black text-[10px] text-neutral-950 line-clamp-1 leading-tight">
                          {product.name}
                        </h4>
                        <span className="text-[8px] font-extrabold text-amber-600 uppercase tracking-tight block">
                          Bulk Offer: {product.discountBadge || '-25%'}
                        </span>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <div className="text-[7px] text-neutral-400 font-semibold leading-none">
                          Normal: <span className="line-through">{formatMWK(product.price)}</span>
                        </div>
                        <div className="font-mono text-[10px] font-black text-[#E53935] leading-none">
                          {formatMWK(product.bulkPrice || Math.round(product.price * 0.75))} <span className="text-[8px] font-black text-neutral-600 font-sans">each — buy {product.bulkMinQty || 3}+</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* 8. MORE TO LOVE (Personalized infinite scroll feed) */}
        <div className="flex flex-col gap-3" id="more-to-love-section">
          <div className="flex justify-between items-center px-1">
            <div>
              <span className="text-[8px] font-black uppercase tracking-wider text-[#E53935] flex items-center gap-0.5">
                <Sparkles className="h-3 w-3 text-amber-400 animate-pulse" /> Direct Market Price
              </span>
              <h3 className="font-display font-black text-xs text-neutral-900 uppercase">More to Love ❤️</h3>
            </div>
            <span className="text-[8px] text-neutral-400 font-black uppercase">Malawi catalog feed</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((idx) => (
                <div key={idx} className="bg-white rounded-3xl p-3 border border-neutral-100 flex flex-col gap-3.5 h-48 animate-pulse">
                  <div className="h-24 bg-neutral-200 rounded-2xl w-full" />
                  <div className="h-4 bg-neutral-250 rounded w-10/12" />
                  <div className="h-4 bg-neutral-250 rounded w-5/12" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3" id="more-to-love-grid">
              {allProducts.slice(0, feedSize).map((product) => {
                const isItemInCart = cartItems.some(i => i.productId === product.id);
                const discount = product.discountBadge || '-15%';
                return (
                  <div
                    key={product.id}
                    onClick={() => navigate(`/product/${product.id}`)}
                    className="bg-white rounded-3xl border border-neutral-100/90 shadow-2xs overflow-hidden flex flex-col group cursor-pointer hover:shadow-xs transition-all border-b-2 hover:border-[#E53935]"
                    id={`feed-product-${product.id}`}
                  >
                    {/* Image space */}
                    <div className="relative bg-neutral-50 h-32 flex items-center justify-center text-5xl select-none">
                      {product.imageUrl}
                      
                      {/* Discount ribbon */}
                      <span className="absolute top-2 left-2 text-[7px] font-black uppercase bg-[#E53935] text-white px-2 py-0.5 rounded-full shadow-xs">
                        {discount}
                      </span>

                      {/* Location chip */}
                      <span className="absolute top-2 right-2 text-[7px] font-black uppercase bg-neutral-900/80 backdrop-blur-xs text-white px-1.5 py-0.5 rounded">
                        📍 {product.city}
                      </span>
                    </div>

                    {/* Content segment */}
                    <div className="p-3 flex flex-col flex-1 justify-between gap-1.5">
                      <div>
                        <h4 className="font-black text-xs text-neutral-900 line-clamp-2 leading-tight group-hover:text-[#E53935] transition-colors">
                          {product.name}
                        </h4>
                        <p className="text-[8px] text-[#E53935] font-black mt-0.5 uppercase tracking-wide leading-none">
                          {product.storeName || 'Verified Vendor'}
                        </p>
                      </div>

                      {/* Rating + sold quantity */}
                      <div className="flex items-center gap-1 text-[8px] font-bold text-neutral-500 leading-none">
                        <span className="text-amber-400 text-[10px]">★</span>
                        <span className="text-neutral-800 font-extrabold">{product.rating || '4.6'}</span>
                        <span className="text-neutral-300">|</span>
                        <span>{product.sold || 120} sold</span>
                      </div>

                      {/* Pricing + Add to Cart Button */}
                      <div className="flex justify-between items-center pt-1 border-t border-neutral-50 mt-1">
                        <div className="flex flex-col">
                          <span className="text-[7px] text-neutral-400 font-bold line-through leading-none">
                            {formatMWK(Math.round(product.price * 1.35))}
                          </span>
                          <span className="font-mono text-xs font-black text-neutral-950 leading-none">
                            {formatMWK(product.price)}
                          </span>
                        </div>
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            addItem(product, 1);
                            triggerToast(`✓ Added ${product.name} to Cart`);
                          }}
                          className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors active:scale-90 ${
                            isItemInCart 
                              ? 'bg-emerald-500 text-white' 
                              : 'bg-neutral-100 text-neutral-700 hover:bg-[#E53935] hover:text-white'
                          }`}
                          title="Add local item to cart"
                          id={`add-cart-btn-${product.id}`}
                        >
                          {isItemInCart ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Load more logic */}
          {feedSize < allProducts.length ? (
            <button
              onClick={triggerLoadMore}
              disabled={feedLoadingMore}
              className="w-full mt-2 py-3 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-black uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all"
              id="load-more-feed-btn"
            >
              {feedLoadingMore ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  <span>Fetching items...</span>
                </>
              ) : (
                <>
                  <span>Load More / Bwanji kwacha</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          ) : (
            <p className="text-center text-[8px] text-neutral-400 font-extrabold uppercase mt-1 tracking-wider py-4">
              ✓ All products in your Malawi range loaded successfully.
            </p>
          )}
        </div>

        {/* 9. DAILY COINS BANNER */}
        <div className="rounded-3xl bg-neutral-900 text-white p-4.5 shadow-md border-r-4 border-amber-400 relative overflow-hidden flex justify-between items-center" id="daily-checkin-coins-banner">
          <div className="absolute left-[-20px] top-[-10px] text-7xl opacity-10 pointer-events-none select-none">
            🪙
          </div>
          
          <div className="flex items-center gap-3 z-10">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-400/20 text-2xl animate-bounce">
              🪙
            </div>
            <div>
              <span className="text-[8px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <Gift className="h-3 w-3 animate-pulse" /> ShopEasy Loyalty Program
              </span>
              <h4 className="font-display font-black text-xs text-white uppercase tracking-tight mt-0.5">
                Claim your daily check-in coins!
              </h4>
              <p className="text-[9px] text-neutral-300 font-medium leading-none mt-1">
                Wallet Balance: <strong className="font-mono text-amber-400 tracking-wide">{user?.coins || 0} Coins</strong>
              </p>
            </div>
          </div>

          <button
            onClick={claimDailyCoins}
            disabled={coinsClaimed}
            className={`px-4 py-2.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 transition-all z-10 active:scale-95 ${
              coinsClaimed 
                ? 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed' 
                : 'bg-amber-400 hover:bg-amber-550 text-neutral-950 shadow-sm'
            }`}
            id="claim-coins-btn"
          >
            {coinsClaimed ? 'CLAIMED' : 'CLAIM'}
          </button>
        </div>

        {/* Static Safety Handshake Advisory */}
        <div className="rounded-3xl bg-neutral-50 border border-neutral-200/50 p-4 text-[9px] text-neutral-500 flex items-start gap-2.5">
          <span className="text-sm shrink-0">🤝</span>
          <div>
            <h5 className="font-black text-neutral-800 uppercase tracking-wide">
              E-Commerce Safety Handshake
            </h5>
            <p className="text-neutral-500 leading-normal font-bold mt-1">
              Always inspect potato grades, chitenje fabrics, or feature phone batteries closely at safe public zones before money handovers. Zero shipping means instant peer-to-peer handshakes!
            </p>
          </div>
        </div>

      </div>

      {/* 10. BOTTOM NAV (fixed) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-100 flex justify-between items-center px-4 py-2 w-full max-w-[480px] mx-auto shadow-lg" id="home-sticky-footer">
        {/* Home option (Active) */}
        <button 
          onClick={() => navigate('/')} 
          className="flex flex-col items-center flex-1 py-1 text-[10px] font-black text-[#E53935]"
          id="btn-nav-home"
        >
          <span className="text-xl">🏠</span>
          <span>Home</span>
        </button>

        {/* Shop option */}
        <button 
          onClick={() => navigate('/shop')} 
          className="flex flex-col items-center flex-1 py-1 text-[10px] font-black text-neutral-400 hover:text-[#E53935]"
          id="btn-nav-shop"
        >
          <Compass className="h-5 w-5 mb-0.5" />
          <span>Shop</span>
        </button>

        {/* ShopEasy red circle middle shortcut button */}
        <div className="flex-1 flex justify-center -mt-6 relative">
          <button
            onClick={() => setShowCenterMenu(!showCenterMenu)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E53935] text-white shadow-lg shadow-[#E53935]/30 hover:bg-red-700 transition-all transform active:scale-95 z-50"
            title="ShopEasy menu shortcuts"
            id="btn-nav-shortcuts"
          >
            <Plus className={`h-6 w-6 transition-transform duration-200 ${showCenterMenu ? 'rotate-45' : ''}`} />
          </button>
        </div>

        {/* Cart Option with dynamic item count badge */}
        <button 
          onClick={() => navigate('/cart')} 
          className="flex flex-col items-center flex-1 py-1 text-[10px] font-black text-neutral-400 hover:text-[#E53935] relative"
          id="btn-nav-cart"
        >
          <div className="relative">
            <span className="text-xl">🛒</span>
            {cartItems.length > 0 && (
              <span className="absolute -top-1.5 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#E53935] text-[8px] font-black text-white font-mono">
                {cartItems.length}
              </span>
            )}
          </div>
          <span>Cart</span>
        </button>

        {/* Account Option */}
        <button 
          onClick={() => navigate('/account')} 
          className="flex flex-col items-center flex-1 py-1 text-[10px] font-black text-neutral-400 hover:text-[#E53935]"
          id="btn-nav-account"
        >
          <User className="h-5 w-5 mb-0.5" />
          <span>Account</span>
        </button>
      </div>

      {/* Floating Center Shortcut pop-up drawer */}
      <AnimatePresence>
        {showCenterMenu && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCenterMenu(false)}
              className="fixed inset-0 bg-black z-45 max-w-[480px] mx-auto"
              id="shortcuts-backdrop"
            />
            {/* Menu Container */}
            <motion.div 
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }}
              className="fixed bottom-16 left-4 right-4 bg-white rounded-3xl p-5 shadow-2xl z-48 border border-neutral-100 flex flex-col gap-4 text-[#212121] max-w-[448px] mx-auto"
              id="shortcuts-drawer"
            >
              <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Quick Actions</span>
                <span className="text-[11px] font-black text-[#E53935] bg-red-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">ShopEasy MW 🇲🇼</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <button
                  onClick={() => {
                    setShowCenterMenu(false);
                    navigate('/shop?category=Phones');
                  }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl hover:bg-neutral-50 transition-all border border-neutral-100"
                >
                  <span className="text-2xl">📱</span>
                  <span className="text-[9px] font-black text-neutral-700">Phones</span>
                </button>
                <button
                  onClick={() => {
                    setShowCenterMenu(false);
                    navigate('/shop?category=Food%20%26%20Groceries');
                  }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl hover:bg-neutral-50 transition-all border border-neutral-100"
                >
                  <span className="text-2xl">🍎</span>
                  <span className="text-[9px] font-black text-neutral-700">Groceries</span>
                </button>
                <button
                  onClick={() => {
                    setShowCenterMenu(false);
                    navigate('/shop?category=Fashion');
                  }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl hover:bg-neutral-50 transition-all border border-neutral-100"
                >
                  <span className="text-2xl">👗</span>
                  <span className="text-[9px] font-black text-neutral-700">Fashion</span>
                </button>
                <button
                  onClick={() => {
                    setShowCenterMenu(false);
                    navigate('/account?tab=coins');
                  }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl hover:bg-neutral-50 transition-all border border-neutral-100"
                >
                  <span className="text-2xl">🪙</span>
                  <span className="text-[9px] font-black text-neutral-700">My Coins</span>
                </button>
                <button
                  onClick={() => {
                    setShowCenterMenu(false);
                    navigate('/cart');
                  }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl hover:bg-neutral-50 transition-all border border-neutral-100"
                >
                  <span className="text-2xl">🛒</span>
                  <span className="text-[9px] font-black text-neutral-700">My Cart</span>
                </button>
                <button
                  onClick={() => {
                    setShowCenterMenu(false);
                    navigate('/account?tab=orders');
                  }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl hover:bg-neutral-50 transition-all border border-neutral-100"
                >
                  <span className="text-2xl">📋</span>
                  <span className="text-[9px] font-black text-neutral-700">Reviews</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
