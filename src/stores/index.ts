import { create } from 'zustand';
import { UserProfile, CartItem, Notification, Store, Product } from '../types';
import { auth, db, googleProvider } from '../firebase';
import { 
  onAuthStateChanged, 
  signOut, 
  signInWithPhoneNumber,
  signInWithPopup,
  signInAnonymously
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// ==========================================
// 1. AUTH STORE
// ==========================================
interface AuthState {
  user: UserProfile | null;
  fbUser: any | null;
  loading: boolean;
  confirmationResult: any | null;
  isSandboxMode: boolean;
  mockPhone: string;
  initAuthListener: () => () => void;
  sendOtp: (phoneWithPrefix: string, appVerifier: any) => Promise<{ success: boolean; error?: string; operationNotAllowed?: boolean }>;
  confirmOtp: (otp: string) => Promise<{ success: boolean; isNewUser?: boolean; error?: string }>;
  saveUserProfile: (profileData: { name: string; role: 'buyer' | 'seller'; city: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateLocation: (city: string) => void;
  awardCoins: (amount: number) => void;
  checkAuthSession: () => Promise<void>;
  signInWithGoogle: () => Promise<{ success: boolean; isNewUser?: boolean; error?: string }>;
  enableSandboxBypass: (phoneWithPrefix: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  fbUser: null,
  loading: false,
  confirmationResult: null,
  isSandboxMode: false,
  mockPhone: '',

  initAuthListener: () => {
    set({ loading: true });
    
    // Attempt restoring saved mock session first
    const savedSandboxUser = localStorage.getItem('shopeasy_sandbox_user');
    if (savedSandboxUser) {
      try {
        const parsed = JSON.parse(savedSandboxUser);
        set({ 
          user: parsed.user, 
          fbUser: parsed.fbUser, 
          isSandboxMode: true, 
          mockPhone: parsed.user.phone, 
          loading: false 
        });
      } catch (e) {}
    }

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            const userProfile = {
              uid: fbUser.uid,
              phone: fbUser.phoneNumber || data.phone || '',
              name: data.name || '',
              role: data.role || 'buyer',
              city: data.city || data.location || '',
              location: data.city || data.location || '',
              avatar: data.avatar || '',
              isProfileComplete: data.isProfileComplete ?? true,
              coins: data.coins ?? 0,
              welcomeDealUsed: data.welcomeDealUsed ?? false,
              createdAt: data.createdAt,
              lastSeen: new Date().toISOString()
            };
            set({ 
              user: userProfile,
              fbUser,
              loading: false
            });
            
            // Sync last seen to db
            try {
              await updateDoc(userDocRef, { lastSeen: new Date().toISOString() });
            } catch (err) {}
          } else {
            // New verified user (profile incomplete)
            set({
              user: {
                uid: fbUser.uid,
                phone: fbUser.phoneNumber || '',
                name: '',
                role: 'buyer',
                city: '',
                location: '',
                coins: 0,
                isProfileComplete: false,
                welcomeDealUsed: false,
                createdAt: new Date().toISOString(),
                avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'
              },
              fbUser,
              loading: false
            });
          }
        } catch (error) {
          console.error("Firestore loading error:", error);
          set({ loading: false });
        }
      } else {
        // If there's no real fbUser but we have a stored mock sandbox session, keep it!
        if (!localStorage.getItem('shopeasy_sandbox_user')) {
          set({ user: null, fbUser: null, loading: false });
        }
      }
    });
    return unsub;
  },

  sendOtp: async (phoneWithPrefix, appVerifier) => {
    set({ loading: true });
    try {
      // In sandbox mode already, bypass
      if (get().isSandboxMode) {
        set({ loading: false });
        return { success: true };
      }

      const confirmationResult = await signInWithPhoneNumber(auth, phoneWithPrefix, appVerifier);
      set({ confirmationResult, loading: false });
      return { success: true };
    } catch (err: any) {
      set({ loading: false });
      const isOpNotAllowed = err.code === 'auth/operation-not-allowed' || 
                             err.message?.includes('operation-not-allowed') ||
                             err.message?.includes('auth/operation-not-allowed');
      return { 
        success: false, 
        error: err.message, 
        operationNotAllowed: isOpNotAllowed
      };
    }
  },

  confirmOtp: async (otp) => {
    set({ loading: true });
    try {
      if (get().isSandboxMode) {
        // Mock success scenario
        // Try background anonymous login to satisfy Firebase Security rules if possible
        let fbUser: any = null;
        try {
          const credentials = await signInAnonymously(auth);
          fbUser = credentials.user;
        } catch (anonErr) {
          console.warn("Could not login anonymously in sandbox, using local simulation UID: ", anonErr);
          fbUser = {
            uid: 'sandbox_' + get().mockPhone.replace('+', ''),
            phoneNumber: get().mockPhone,
            isAnonymous: true
          };
        }

        const userDocRef = doc(db, 'users', fbUser.uid);
        let userSnap;
        try {
          userSnap = await getDoc(userDocRef);
        } catch (e) {
          userSnap = { exists: () => false };
        }

        const isNewUser = !userSnap.exists();
        set({ fbUser, loading: false });

        if (!isNewUser) {
          // If profile exists, load sandbox profile into state
          const data = userSnap.data();
          const userProfile = {
            uid: fbUser.uid,
            phone: fbUser.phoneNumber || get().mockPhone,
            name: data?.name || 'Sandbox Tester',
            role: data?.role || 'buyer',
            city: data?.city || data?.location || 'Lilongwe',
            location: data?.city || data?.location || 'Lilongwe',
            avatar: data?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
            isProfileComplete: data?.isProfileComplete ?? true,
            coins: data?.coins ?? 100,
            welcomeDealUsed: data?.welcomeDealUsed ?? false,
            createdAt: data?.createdAt || new Date().toISOString(),
            lastSeen: new Date().toISOString()
          };
          set({ user: userProfile });
          localStorage.setItem('shopeasy_sandbox_user', JSON.stringify({ user: userProfile, fbUser }));
        }

        return { success: true, isNewUser };
      }

      const confirmationResult = get().confirmationResult;
      if (!confirmationResult) {
        throw new Error("Munamva kale OTP? Please click Send OTP again.");
      }
      const userCredential = await confirmationResult.confirm(otp);
      const fbUser = userCredential.user;
      
      // Look up profile state
      const userDocRef = doc(db, 'users', fbUser.uid);
      const userSnap = await getDoc(userDocRef);
      const isNewUser = !userSnap.exists();
      
      set({ loading: false });
      return { success: true, isNewUser };
    } catch (err: any) {
      set({ loading: false });
      return { success: false, error: err.message };
    }
  },

  saveUserProfile: async (profileData) => {
    set({ loading: true });
    const fbUser = get().fbUser || auth.currentUser;
    const isSandbox = get().isSandboxMode;

    if (!fbUser && !isSandbox) {
      set({ loading: false });
      return { success: false, error: "Tsatirani njira yolowera / Authentication required." };
    }

    try {
      const uid = fbUser?.uid || 'sandbox_' + get().mockPhone.replace('+', '');
      const phone = fbUser?.phoneNumber || get().user?.phone || get().mockPhone || '';
      
      const newProfile = {
        uid,
        name: profileData.name,
        phone,
        role: profileData.role,
        city: profileData.city,
        location: profileData.city,
        avatar: get().user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
        isProfileComplete: true,
        coins: 100, // Give sandbox bonus coins
        welcomeDealUsed: false,
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'users', uid), newProfile);
      } catch (dbErr) {
        console.warn("Could not save profile to firestore due to permissions/offline. Persisting locally as fallback.", dbErr);
      }
      
      set({ 
        user: newProfile,
        loading: false 
      });

      if (isSandbox) {
        localStorage.setItem('shopeasy_sandbox_user', JSON.stringify({
          user: newProfile,
          fbUser: fbUser || { uid, phoneNumber: phone, isAnonymous: true }
        }));
      }

      return { success: true };
    } catch (err: any) {
      set({ loading: false });
      return { success: false, error: err.message };
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      localStorage.removeItem('shopeasy_sandbox_user');
      await signOut(auth);
      set({ user: null, fbUser: null, confirmationResult: null, isSandboxMode: false, mockPhone: '', loading: false });
    } catch (err) {
      localStorage.removeItem('shopeasy_sandbox_user');
      set({ user: null, fbUser: null, confirmationResult: null, isSandboxMode: false, mockPhone: '', loading: false });
    }
  },

  updateLocation: async (city) => {
    const user = get().user;
    if (!user) return;
    const updatedUser = { ...user, city, location: city };
    set({ user: updatedUser });

    if (get().isSandboxMode) {
      const stored = localStorage.getItem('shopeasy_sandbox_user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          parsed.user = updatedUser;
          localStorage.setItem('shopeasy_sandbox_user', JSON.stringify(parsed));
        } catch (e) {}
      }
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { city, location: city });
    } catch (err) {
      console.warn("Could not update location in db:", err);
    }
  },

  awardCoins: async (amount) => {
    const user = get().user;
    if (!user) return;
    const newCoins = user.coins + amount;
    const updatedUser = { ...user, coins: newCoins };
    set({ user: updatedUser });

    if (get().isSandboxMode) {
      const stored = localStorage.getItem('shopeasy_sandbox_user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          parsed.user = updatedUser;
          localStorage.setItem('shopeasy_sandbox_user', JSON.stringify(parsed));
        } catch (e) {}
      }
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { coins: newCoins });
    } catch (err) {
      console.warn("Could not award coins in db:", err);
    }
  },

  checkAuthSession: async () => {
    get().initAuthListener();
  },

  signInWithGoogle: async () => {
    set({ loading: true });
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const fbUser = userCredential.user;
      
      set({ fbUser });
      
      const userDocRef = doc(db, 'users', fbUser.uid);
      const userSnap = await getDoc(userDocRef);
      const isNewUser = !userSnap.exists();
      
      set({ loading: false });
      return { success: true, isNewUser };
    } catch (err: any) {
      set({ loading: false });
      return { success: false, error: err.message };
    }
  },

  enableSandboxBypass: (phoneWithPrefix) => {
    set({
      isSandboxMode: true,
      mockPhone: phoneWithPrefix,
      confirmationResult: {
        confirm: async (otp: string) => {
          return {
            user: {
              uid: 'sandbox_' + phoneWithPrefix.replace('+', ''),
              phoneNumber: phoneWithPrefix,
              isAnonymous: true
            }
          };
        }
      }
    });
  }
}));

// ==========================================
// 2. CART STORE
// ==========================================
interface CartState {
  items: CartItem[];
  couponCode: string;
  discountPercent: number;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  applyCoupon: (code: string) => boolean;
  clearCart: () => void;
  getTotals: () => {
    subtotal: number;
    discount: number;
    total: number;
  };
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  couponCode: '',
  discountPercent: 0,

  addItem: (product, quantity = 1) => set((state) => {
    const existing = state.items.find((item) => item.productId === product.id);
    if (existing) {
      return {
        items: state.items.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      };
    }
    const newItem: CartItem = {
      productId: product.id,
      productName: product.name,
      price: product.price,
      quantity,
      imageUrl: product.imageUrl,
      storeId: product.storeId,
      storeName: product.storeName,
      city: product.city
    };
    return { items: [...state.items, newItem] };
  }),

  removeItem: (productId) => set((state) => ({
    items: state.items.filter((item) => item.productId !== productId)
  })),

  updateQuantity: (productId, quantity) => set((state) => {
    if (quantity <= 0) {
      return { items: state.items.filter((item) => item.productId !== productId) };
    }
    return {
      items: state.items.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      )
    };
  }),

  applyCoupon: (code) => {
    const normalized = code.trim().toUpperCase();
    // Pre-defined local coupons
    if (normalized === 'LILONGWE15' || normalized === 'BLANTYRE15' || normalized === 'EASTER20') {
      const discount = normalized === 'EASTER20' ? 20 : 15;
      set({ couponCode: normalized, discountPercent: discount });
      return true;
    }
    return false;
  },

  clearCart: () => set({ items: [], couponCode: '', discountPercent: 0 }),

  getTotals: () => {
    const { items, discountPercent } = get();
    const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const discount = Math.round(subtotal * (discountPercent / 100));
    const total = subtotal - discount;
    return { subtotal, discount, total };
  }
}));

// ==========================================
// 3. NOTIFICATION STORE
// ==========================================
interface NotificationState {
  notifications: Notification[];
  addNotification: (title: string, body: string, type: 'order' | 'message' | 'promo' | 'coin') => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [
    {
      id: 'notif_1',
      userId: 'mb101',
      title: 'Order Delivered Successfully 📦',
      body: 'Your pickup order for item Sourdough bread is completed in Blantyre.',
      type: 'order',
      read: false,
      createdAt: new Date(Date.now() - 3600000)
    },
    {
      id: 'notif_2',
      userId: 'mb101',
      title: 'You Earned 50 Loyalty Coins! 🎉',
      body: 'Thanks for purchasing locally on ShopEasy Malawi.',
      type: 'coin',
      read: true,
      createdAt: new Date(Date.now() - 7200000)
    }
  ],

  addNotification: (title, body, type) => set((state) => {
    const newNotif: Notification = {
      id: 'notif_' + Math.random().toString(36).substring(2, 9),
      userId: state.notifications[0]?.userId || 'mb101',
      title,
      body,
      type,
      read: false,
      createdAt: new Date()
    };
    return { notifications: [newNotif, ...state.notifications] };
  }),

  markAsRead: (id) => set((state) => ({
    notifications: state.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    )
  })),

  markAllRead: () => set((state) => ({
    notifications: state.notifications.map((n) => ({ ...n, read: true }))
  }))
}));
