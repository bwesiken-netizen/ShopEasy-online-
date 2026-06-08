import { doc, writeBatch, collection, getDocs, limit, query, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { SEED_CATEGORIES, SEED_PRODUCTS } from '../data/seedData';
import { OperationType } from '../types';

export async function isDatabaseSeeded(): Promise<boolean> {
  try {
    const q = query(collection(db, 'products'), limit(1));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (err) {
    console.warn("Could not check if database is seeded, assuming empty or offline fallback:", err);
    return false;
  }
}

function generateKeywords(title: string, tags: string[]): string[] {
  const titleWords = (title || '')
    .toLowerCase()
    .split(/[\s,.\-_/()!]+/)
    .map(w => w.trim())
    .filter(w => w.length >= 2);
  const tagWords = (tags || []).map(t => t.toLowerCase().trim()).filter(t => t.length >= 2);
  return Array.from(new Set([...titleWords, ...tagWords]));
}

export async function seedMarketplaceFirestore(force: boolean = false): Promise<{ success: boolean; seededCount: number; message: string }> {
  try {
    // 1. Check if already seeded unless forced
    if (!force) {
      const seeded = await isDatabaseSeeded();
      if (seeded) {
        return { success: true, seededCount: 0, message: "Database already populated. Use force to re-write." };
      }
    }

    // 2. Batch write categories
    const categoryColPath = 'categories';
    const categoriesBatch = writeBatch(db);
    for (const cat of SEED_CATEGORIES) {
      const ref = doc(db, categoryColPath, cat.slug);
      categoriesBatch.set(ref, {
        slug: cat.slug,
        name: cat.name,
        emoji: cat.emoji,
        productCount: cat.productCount,
        sortOrder: cat.sortOrder
      });
    }
    await categoriesBatch.commit();

    // 3. Sequential write products (Batches have 500 actions limit, there are 15+ products, completely fine)
    const productColPath = 'products';
    const productsBatch = writeBatch(db);
    for (const prod of SEED_PRODUCTS) {
      const ref = doc(db, productColPath, prod.id);
      
      // Ensure all requested formatting is fully populated correctly
      const enrichedPayload = {
        id: prod.id,
        title: prod.title,
        name: prod.title, // interchangeable
        description: prod.description,
        images: prod.images || [prod.imageUrl],
        imageUrl: prod.imageUrl,
        price: prod.price,
        originalPrice: prod.originalPrice || prod.price,
        discountPercent: prod.discountPercent || 0,
        category: prod.category, // string slug
        categoryName: prod.categoryName,
        sellerId: prod.sellerId,
        sellerName: prod.sellerName,
        sellerCity: prod.sellerCity,
        city: prod.sellerCity, // double entry
        stock: prod.stock,
        sold: prod.sold || 0,
        rating: prod.rating || 4.5,
        reviewCount: prod.reviewCount || 0,
        freeDelivery: prod.freeDelivery ?? false,
        isBulk: prod.isBulk ?? false,
        bulkPricing: prod.bulkPricing || [],
        tags: prod.tags || [],
        isChoice: prod.isChoice ?? false,
        isActive: prod.isActive ?? true,
        isFeatured: prod.isFeatured ?? false,
        searchKeywords: generateKeywords(prod.title || '', prod.tags || []),
        createdAt: new Date().toISOString()
      };

      productsBatch.set(ref, enrichedPayload);
    }
    await productsBatch.commit();

    return { 
      success: true, 
      seededCount: SEED_CATEGORIES.length + SEED_PRODUCTS.length, 
      message: `Successfully seeded ${SEED_CATEGORIES.length} categories and ${SEED_PRODUCTS.length} products to Firestore!` 
    };
  } catch (err) {
    console.error("Critical error seeding Firestore database:", err);
    handleFirestoreError(err, OperationType.WRITE, 'seed_transaction');
  }
}
