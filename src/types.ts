export interface UserProfile {
  uid: string;
  phone: string; // E.g. +265999123456
  name: string;
  email?: string;
  location: 'Lilongwe' | 'Blantyre' | 'Mzuzu' | 'Zomba' | 'Kasungu' | 'Mangochi' | string;
  city?: string;
  role: 'buyer' | 'seller' | 'admin';
  coins: number; // For coinTransactions/rewards
  storeId?: string; // If seller
  createdAt: any;
  avatar?: string;
  isVerified?: boolean;
  deliveryAddresses?: string[];
  welcomeDealUsed?: boolean;
  isProfileComplete?: boolean;
  lastSeen?: string;
}

export interface Store {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  city: 'Lilongwe' | 'Blantyre' | 'Mzuzu' | 'Zomba' | 'Kasungu' | 'Mangochi' | string;
  contactPhone: string;
  bannerUrl?: string;
  verified: boolean;
  followerCount: number;
  rating: number;
  createdAt: any;
}

export interface Product {
  id: string;
  storeId: string;
  storeName: string;
  name: string;
  description: string;
  price: number; // in MWK
  category: string; // general category string name
  imageUrl: string;
  stock: number;
  city: string; // Malawi city local pickup constraint
  active: boolean;
  featured: boolean;
  createdAt: any;

  // Rich Firestore Product Document fields
  title?: string; // interchangeable with name
  images?: string[]; // array of storage/emoji URLs
  originalPrice?: number;
  discountPercent?: number;
  categorySlug?: string; // category string slug
  categoryName?: string; 
  sellerId?: string; // interchangeable with storeId
  sellerName?: string; // interchangeable with storeName
  sellerCity?: string; // interchangeable with city
  sold?: number;
  rating?: number;
  reviewCount?: number;
  freeDelivery?: boolean;
  isBulk?: boolean;
  bulkPricing?: { minQty: number; pricePerUnit: number }[];
  tags?: string[];
  isChoice?: boolean;
  isActive?: boolean;
  isFeatured?: boolean;
}

export interface OrderItem {
  productId: string;
  productName: string;
  price: number; // MWK
  quantity: number;
  imageUrl: string;
}

export interface Order {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  storeId: string;
  storeName: string;
  items: OrderItem[];
  subtotal: number;
  couponCode?: string;
  discount: number;
  total: number; // MWK
  deliveryMethod: 'pickup' | 'delivery';
  deliveryAddress?: string; // Within town
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  paymentStatus: 'unpaid' | 'paid';
  paychanguReference?: string;
  createdAt: any;
}

export interface CartItem {
  productId: string;
  productName: string;
  price: number; // MWK
  quantity: number;
  imageUrl: string;
  storeId: string;
  storeName: string;
  city: string;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  updatedAt: any;
}

export interface Coupon {
  code: string;
  discountPercent: number;
  active: boolean;
  expiryDate: any;
  storeId?: string; // If item belongs to a specific store
}

export interface Message {
  id: string;
  chatId: string; // "senderId_receiverId"
  senderId: string;
  receiverId: string;
  text: string;
  imageUrl?: string;
  createdAt: any;
  read: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'order' | 'message' | 'promo' | 'coin';
  read: boolean;
  createdAt: any;
}

export interface CoinTransaction {
  id: string;
  userId: string;
  amount: number; // positive or negative
  type: 'bonus' | 'purchase' | 'spend';
  description: string;
  createdAt: any;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number; // 1-5
  comment: string;
  createdAt: any;
}

export interface Wishlist {
  userId: string;
  productIds: string[];
}

export interface FollowedStore {
  userId: string;
  storeId: string;
  followedAt: any;
}

// Structured error info for Firestore Permission Errors
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}
