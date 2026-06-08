import { Product, Store, Category } from '../types';

export const MALAWI_CITIES = [
  'Lilongwe',
  'Blantyre',
  'Mzuzu',
  'Zomba',
  'Kasungu',
  'Mangochi'
];

export const CATEGORIES: Category[] = [
  { id: 'cat_farms', name: 'Farm Produce', icon: '🌽' },
  { id: 'cat_fish', name: 'Lake Malawi Fish', icon: '🐟' },
  { id: 'cat_clothes', name: 'Zitenje & Fashion', icon: '👗' },
  { id: 'cat_tech', name: 'Phones & Tech', icon: '📱' },
  { id: 'cat_crafts', name: 'Local Crafts', icon: '🎨' },
  { id: 'cat_groceries', name: 'Groceries', icon: '🧼' }
];

export const SAMPLE_STORES: Store[] = [
  {
    id: 'store_limbe',
    ownerId: 'seller_1',
    name: 'Limbe Golden Farm Store',
    description: 'Fresh organic farm produce delivered directly to you in Blantyre.',
    city: 'Blantyre',
    contactPhone: '+265888231201', // TNM format
    verified: true,
    followerCount: 230,
    rating: 4.8,
    createdAt: new Date()
  },
  {
    id: 'store_chambo',
    ownerId: 'seller_2',
    name: 'Lake Side Chambo Kings',
    description: 'Fresh and dried Chambo straight from Lake Malawi (Mangochi & Zomba).',
    city: 'Mangochi',
    contactPhone: '+265999450321', // Airtel format
    verified: true,
    followerCount: 540,
    rating: 4.9,
    createdAt: new Date()
  },
  {
    id: 'store_mzuzu_tech',
    ownerId: 'seller_3',
    name: 'Mzuzu Mobile & Solar Solutions',
    description: 'High quality smartphones, solar lights, and accessories in Mzuzu city.',
    city: 'Mzuzu',
    contactPhone: '+265888204901',
    verified: false,
    followerCount: 95,
    rating: 4.2,
    createdAt: new Date()
  },
  {
    id: 'store_zomba_art',
    ownerId: 'seller_4',
    name: 'Zomba Plateau Crafts',
    description: 'Handmade wooden sculptures, customized zitenje handbags, and carvings.',
    city: 'Zomba',
    contactPhone: '+265777401340',
    verified: true,
    followerCount: 160,
    rating: 4.7,
    createdAt: new Date()
  }
];

export const SAMPLE_PRODUCTS: Product[] = [
  {
    id: 'p_1',
    storeId: 'store_limbe',
    storeName: 'Limbe Golden Farm Store',
    name: 'Irish Potatoes (Kilo)',
    description: 'Sweet local organic Irish potatoes harvested from Lilongwe highlands. Best for chips or stew!',
    price: 3500, // MWK
    category: 'Farm Produce',
    imageUrl: '🥔',
    stock: 250,
    city: 'Blantyre',
    active: true,
    featured: true,
    createdAt: new Date()
  },
  {
    id: 'p_2',
    storeId: 'store_chambo',
    storeName: 'Lake Side Chambo Kings',
    name: 'Fresh Lake Chambo (Medium)',
    description: 'Delicious fresh Chambo fish wild-caught from Mangochi shores. Perfectly cleaned and on ice.',
    price: 8000,
    category: 'Lake Malawi Fish',
    imageUrl: '🐟',
    stock: 45,
    city: 'Mangochi',
    active: true,
    featured: true,
    createdAt: new Date()
  },
  {
    id: 'p_3',
    storeId: 'store_zomba_art',
    storeName: 'Zomba Plateau Crafts',
    name: 'African Wax Chirundu Chitenje',
    description: 'Authentic high-purity Malawian Chitenje cotton wax fabric print. Beautiful bold colors!',
    price: 12000,
    category: 'Zitenje & Fashion',
    imageUrl: '👗',
    stock: 12,
    city: 'Zomba',
    active: true,
    featured: true,
    createdAt: new Date()
  },
  {
    id: 'p_4',
    storeId: 'store_mzuzu_tech',
    storeName: 'Mzuzu Mobile & Solar Solutions',
    name: 'Itel Magic 3 Super Feature Phone',
    description: 'Excellent battery life, dual SIM card slots, Airtel/TNM compatible, perfect for farmers.',
    price: 24500,
    category: 'Phones & Tech',
    imageUrl: '📱',
    stock: 28,
    city: 'Mzuzu',
    active: true,
    featured: false,
    createdAt: new Date()
  },
  {
    id: 'p_5',
    storeId: 'store_limbe',
    storeName: 'Limbe Golden Farm Store',
    name: 'Aroma Kilombero Rice (5kg)',
    description: 'Premium aromatic Kilombero rice from Karonga. The absolute best rice fragrance in Malawi!',
    price: 11500,
    category: 'Farm Produce',
    imageUrl: '🌾',
    stock: 80,
    city: 'Blantyre',
    active: true,
    featured: true,
    createdAt: new Date()
  },
  {
    id: 'p_6',
    storeId: 'store_chambo',
    storeName: 'Lake Side Chambo Kings',
    name: 'Dried Usipa Fish (Large Pack)',
    description: 'Sun-dried crisp Usipa small fish. Highly nutritional, great for frying with local tomatoes.',
    price: 4500,
    category: 'Lake Malawi Fish',
    imageUrl: '🍤',
    stock: 150,
    city: 'Lilongwe',
    active: true,
    featured: false,
    createdAt: new Date()
  },
  {
    id: 'p_7',
    storeId: 'store_zomba_art',
    storeName: 'Zomba Plateau Crafts',
    name: 'Handcarved Wooden Salad Bowls',
    description: 'Elegant serving bowl sculpted by master artisans from Mulanje Cedar wood.',
    price: 18000,
    category: 'Local Crafts',
    imageUrl: '🥣',
    stock: 5,
    city: 'Zomba',
    active: true,
    featured: false,
    createdAt: new Date()
  }
];
