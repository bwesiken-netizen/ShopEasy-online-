import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  HelpCircle, 
  Eye, 
  EyeOff,
  ShoppingBag,
  PackageOpen,
  ArrowRightLeft
} from 'lucide-react';

export default function SellerProducts() {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering and Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Active' | 'Draft' | 'Out of Stock'>('All');

  // Deletion Modal / Overlay State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [targetProduct, setTargetProduct] = useState<any>(null);
  const [productHasOrders, setProductHasOrders] = useState<boolean | null>(null);
  const [checkingOrders, setCheckingOrders] = useState(false);

  useEffect(() => {
    if (!uid) return;
    fetchProducts();
  }, [uid]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Query Products where storeId == current seller uid
      const q = query(
        collection(db, 'products'),
        where('storeId', '==', uid)
      );
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort in memory by createdAt desc
      list.sort((a, b) => {
        const dateA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
        const dateB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      setProducts(list);
    } catch (err) {
      console.error("Error loaded store products database inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  // Check if product is referenced in any buyers orders
  const verifyProductOrdersRef = async (productId: string) => {
    setCheckingOrders(true);
    try {
      const q = query(collection(db, 'orders'), where('storeId', '==', uid));
      const snap = await getDocs(q);
      let found = false;
      snap.forEach((doc) => {
        const orderData = doc.data();
        const items = orderData.items || [];
        if (items.some((it: any) => it.productId === productId)) {
          found = true;
        }
      });
      setProductHasOrders(found);
    } catch (e) {
      console.error("Error checking orders reference:", e);
      setProductHasOrders(false); // Safety fallback
    } finally {
      setCheckingOrders(false);
    }
  };

  const handleDeleteTrigger = async (prod: any) => {
    setTargetProduct(prod);
    setProductHasOrders(null);
    setShowDeleteModal(true);
    await verifyProductOrdersRef(prod.id);
  };

  const handleDeactivateProduct = async () => {
    if (!targetProduct) return;
    try {
      await updateDoc(doc(db, 'products', targetProduct.id), {
        isActive: false,
        active: false
      });
      alert(`✓ "${targetProduct.title || targetProduct.name}" has been deactivated successfully.`);
      setShowDeleteModal(false);
      fetchProducts();
    } catch (err) {
      alert("Failed to deactivate product: " + String(err));
    }
  };

  const handleConfirmDeleteAnyway = async () => {
    if (!targetProduct) return;
    try {
      await deleteDoc(doc(db, 'products', targetProduct.id));
      alert(`✓ "${targetProduct.title || targetProduct.name}" has been deleted permanently.`);
      setShowDeleteModal(false);
      fetchProducts();
    } catch (err) {
      alert("Failed to permanently delete product: " + String(err));
    }
  };

  // Filter list
  const filteredProducts = products.filter((p) => {
    const title = (p.title || p.name || '').toLowerCase();
    const matchesSearch = title.includes(searchTerm.toLowerCase());

    const isStockOut = p.stock !== undefined && p.stock <= 0;
    const isDraft = p.isActive === false || p.active === false;
    const isActive = !isDraft && !isStockOut;

    if (activeTab === 'Active') {
      return matchesSearch && isActive;
    }
    if (activeTab === 'Draft') {
      return matchesSearch && isDraft;
    }
    if (activeTab === 'Out of Stock') {
      return matchesSearch && isStockOut;
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-4" id="seller-products-page">
      
      {/* Top action bar */}
      <div className="flex gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input 
            type="text"
            placeholder="Search my inventory..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs font-semibold pl-10 pr-4 py-3 border rounded-xl focus:border-red-500 focus:outline-none bg-white text-slate-900" 
          />
        </div>
        <button
          onClick={() => navigate('/seller/products/new')}
          className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3.5 py-3 rounded-xl flex items-center gap-1 shrink-0 whitespace-nowrap transition"
        >
          <Plus className="w-4.5 h-4.5" /> Add Product
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-100 bg-white rounded-xl p-1 shadow-3xs">
        {(['All', 'Active', 'Draft', 'Out of Stock'] as const).map((tab) => {
          const isSelected = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-center py-2 text-[11px] font-black rounded-lg uppercase tracking-wider transition ${
                isSelected 
                  ? 'bg-red-600 text-white' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Listings Container */}
      {loading ? (
        <div className="py-12 flex justify-center text-slate-400 text-xs text-center font-bold">
          <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mr-2" />
          Loading store listings...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border text-center text-slate-400 space-y-2 text-xs">
          <PackageOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <p>No products match your criteria.</p>
          <p className="text-[10px] text-slate-400">Add some products or check in another filter tab.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProducts.map((p) => {
            const isStockOut = p.stock !== undefined && p.stock <= 0;
            const isDraft = p.isActive === false || p.active === false;
            
            const title = p.title || p.name || 'Unnamed product';
            const price = p.price || 0;
            const stock = p.stock ?? 0;
            const soldCount = p.sold ?? 0;

            const coverImage = p.images?.[0] || p.imageUrl || '📦';
            const isEmoji = coverImage.length <= 4; // Basic check for emoji character

            return (
              <div 
                key={p.id}
                className="bg-white rounded-2xl p-3 border border-slate-100 shadow-3xs flex justify-between items-center gap-3 relative overflow-hidden active:bg-slate-50/50 transition duration-150"
              >
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  
                  {/* Photo Thumbnail */}
                  <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 shrink-0 overflow-hidden flex items-center justify-center text-2xl font-sans">
                    {isEmoji ? (
                      coverImage
                    ) : (
                      <img referrerPolicy="no-referrer" src={coverImage} alt={title} className="w-full h-full object-cover" />
                    )}
                  </div>

                  {/* Fields info */}
                  <div className="min-w-0 space-y-1.5 flex-1 pr-2">
                    <h4 className="font-bold text-slate-800 text-xs lines-2 line-clamp-2 leading-tight">
                      {title}
                    </h4>
                    
                    <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-[10px] text-slate-450 font-bold uppercase font-sans">
                      <span className="text-red-600 font-mono font-bold font-sans">
                        MWK {price.toLocaleString()}
                      </span>
                      <span>•</span>
                      <span className={stock < 5 ? 'text-red-600 font-mono' : 'text-slate-500 font-mono'}>
                        {stock} stock
                      </span>
                      <span>•</span>
                      <span className="font-mono text-slate-500">
                        {soldCount} sold
                      </span>
                    </div>
                  </div>

                </div>

                {/* Status elements & Quick Actions */}
                <div className="flex flex-col items-end gap-2.5 shrink-0">
                  
                  {/* Status Badging */}
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isStockOut 
                      ? 'bg-rose-50 text-rose-800 border border-rose-100' 
                      : isDraft 
                        ? 'bg-slate-100 text-slate-500' 
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                  }`}>
                    {isStockOut ? 'Out of Stock' : isDraft ? 'Draft' : 'Active'}
                  </span>

                  {/* Actions Row */}
                  <div className="flex gap-2.5 text-slate-450 z-10">
                    <button
                      onClick={() => navigate(`/seller/products/edit/${p.id}`)}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition"
                      title="Edit Product"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTrigger(p)}
                      className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition"
                      title="Delete Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* HARDENED PERMANENT DELETION DIALOG */}
      {showDeleteModal && targetProduct && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 border border-slate-150 max-w-sm w-full space-y-4 shadow-xl animate-[scaleUp_0.2s_ease-out]">
            
            <div className="flex items-center gap-2.5 text-red-600">
              <Trash2 className="w-6 h-6 p-1 bg-red-100 rounded-full shrink-0" />
              <h3 className="text-sm font-bold text-slate-900">Confirm Deletion</h3>
            </div>

            <p className="text-xs text-slate-650 leading-relaxed font-semibold">
              Are you sure you want to permanently delete <strong className="text-slate-900">"{targetProduct.title || targetProduct.name}"</strong>? This operation is irreversible.
            </p>

            {/* Checking Orders Loading Frame */}
            {checkingOrders ? (
              <div className="py-2.5 text-slate-450 text-[11px] text-center font-bold">
                Analyzing connected buyers sales records...
              </div>
            ) : productHasOrders === true ? (
              /* Product has connected orders and cannot be standard deleted. Guide deactivation */
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-900 space-y-2 text-xs font-semibold leading-normal">
                <span className="font-extrabold uppercase tracking-widest text-[10px] text-amber-800 block">⚠️ Warning: Orders Exist!</span>
                <p className="text-[11px] text-amber-700">
                  This product has existing order histories in database records! Deleting active product documents might break order summaries for previous buyers.
                </p>
                <div className="font-bold text-amber-800 text-[10.5px]">
                  We highly recommend **Deactivating** it instead to hide it from the buyer catalog while keeping order histories safe!
                </div>
              </div>
            ) : null}

            {/* Dialog Buttons Row */}
            <div className="flex flex-col gap-2 pt-1 text-xs">
              
              {/* Deactivate Option (Safe) */}
              <button
                onClick={handleDeactivateProduct}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl transition-colors uppercase tracking-wider"
              >
                Hide / Deactivate Listing (Recommended)
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDeleteAnyway}
                  className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-2.5 rounded-xl transition"
                >
                  Delete anyway
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
