import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { useAuthStore } from '../../stores';
import { 
  Search, 
  Star, 
  Award, 
  EyeOff, 
  Check, 
  ShieldAlert, 
  Plus, 
  AlertTriangle, 
  RefreshCw 
} from 'lucide-react';

export default function AdminProducts() {
  const { user: currentUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'reported' | 'banned'>('all');

  // Action / Toast State
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'products'));
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setProducts(list);
    } catch (err) {
      console.error("Error loaded marketplace catalog: ", err);
      showToast("Unable to fetch product listings.", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleToggleFeatured = async (product: any) => {
    setProcessingId(product.id);
    const newFeaturedVal = !product.isFeatured;
    try {
      const prodRef = doc(db, 'products', product.id);
      await updateDoc(prodRef, {
        isFeatured: newFeaturedVal
      });

      // Audit Log
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentUser?.uid || 'unknown',
        adminName: currentUser?.name || 'Administrator',
        action: newFeaturedVal ? 'FEATURE_PRODUCT' : 'UNFEATURE_PRODUCT',
        targetId: product.id,
        targetName: product.title || product.name,
        reason: 'Featured status toggled in catalog manager',
        createdAt: serverTimestamp()
      });

      showToast(`Product featured setting updated successfully!`, 'success');
      fetchProducts();
    } catch (err) {
      console.error(err);
      showToast("Failed to alter featured setting.", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleChoice = async (product: any) => {
    setProcessingId(product.id);
    const newChoiceVal = !product.isChoice;
    try {
      const prodRef = doc(db, 'products', product.id);
      await updateDoc(prodRef, {
        isChoice: newChoiceVal
      });

      // Audit Log
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentUser?.uid || 'unknown',
        adminName: currentUser?.name || 'Administrator',
        action: newChoiceVal ? 'CHOICE_PRODUCT' : 'UNCHOICE_PRODUCT',
        targetId: product.id,
        targetName: product.title || product.name,
        reason: 'Choice stamp toggled in catalog manager',
        createdAt: serverTimestamp()
      });

      showToast(`Choice Badge status modified.`, 'success');
      fetchProducts();
    } catch (err) {
      console.error(err);
      showToast("Field mutation failed.", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleActive = async (product: any, shouldBan: boolean) => {
    setProcessingId(product.id);
    try {
      const prodRef = doc(db, 'products', product.id);
      await updateDoc(prodRef, {
        isActive: !shouldBan
      });

      // Audit Log
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentUser?.uid || 'unknown',
        adminName: currentUser?.name || 'Administrator',
        action: shouldBan ? 'BAN_PRODUCT' : 'RESTORE_PRODUCT',
        targetId: product.id,
        targetName: product.title || product.name,
        reason: shouldBan ? 'In compliance ban enforced' : 'Product catalog restoration approved',
        createdAt: serverTimestamp()
      });

      showToast(
        shouldBan 
          ? `Product is now BANNED. Hidden from customer search index.` 
          : `Listing has been successfully RESTORED active!`, 
        'success'
      );
      fetchProducts();
    } catch (err) {
      console.error(err);
      showToast("Verification action blocked.", "error");
    } finally {
      setProcessingId(null);
    }
  };

  // Searching & Tab filter rules
  const filteredProducts = products.filter((p) => {
    const term = searchQuery.toLowerCase();
    const titleMatch = (p.title || p.name || '').toLowerCase().includes(term);
    const storeMatch = (p.storeName || p.sellerName || '').toLowerCase().includes(term);
    const idMatch = (p.id || '').toLowerCase().includes(term);

    const matchesSearch = titleMatch || storeMatch || idMatch;
    if (!matchesSearch) return false;

    // Tab checks
    const activeState = p.isActive !== false; // defaulted to active
    if (activeTab === 'banned') return !activeState;
    if (activeTab === 'reported') return p.reported === true || Number(p.reportsCount || 0) > 0;
    return true; // all
  });

  return (
    <div className="space-y-6" id="admin-products-root">
      
      {/* HUD Header Bar */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-3xs flex justify-between items-center flex-wrap gap-4">
        <div className="space-y-0.5">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-tight font-display">Product Moderation Terminal</h2>
          <p className="text-[10px] text-slate-450 font-bold uppercase font-sans">Set editorial badges, moderate sensitive item reports, and ban violations</p>
        </div>

        <div className="relative w-full max-w-xs">
          <input
            type="text"
            placeholder="Search by title, merchant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {toast && (
        <div className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-205' : 'bg-rose-50 text-rose-800 border-rose-205'
        }`}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Tabs navigation list */}
      <div className="flex border-b border-slate-100 bg-white p-1 rounded-xl border max-w-md">
        {(['all', 'reported', 'banned'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-[10px] font-black uppercase text-center rounded-lg transition duration-200 ${
              activeTab === tab
                ? 'bg-rose-600 text-white shadow-3xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {tab} {tab === 'reported' && products.filter(p => p.reported === true || Number(p.reportsCount || 0) > 0).length > 0 && (
              <span className="ml-1 bg-amber-100 text-amber-800 text-[8.5px] px-1.5 py-0.5 rounded-full font-black animate-pulse">
                {products.filter(p => p.reported === true || Number(p.reportsCount || 0) > 0).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Grid container */}
      {loading ? (
        <div className="text-center py-20 text-slate-500 font-bold text-xs">
          Interrogating global product schema catalog...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white p-12 border rounded-2.5xl text-center text-slate-405 font-bold text-xs">
          No product records matching requirements in filter "{activeTab}".
        </div>
      ) : (
        <div className="bg-white rounded-2.5xl border border-slate-100 shadow-3xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px] border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[9px] uppercase font-black text-slate-450">
                  <th className="p-4 py-3">Listing Details</th>
                  <th className="p-4 py-3">Store Owner</th>
                  <th className="p-4 py-3">Pricing (MWK)</th>
                  <th className="p-4 py-3">Stats</th>
                  <th className="p-4 py-3">Editorial Badges</th>
                  <th className="p-4 py-3 text-right">Moderations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const image = p.imageUrl || p.image || '📦';
                  const isEmoji = image.length <= 4;
                  const isBanned = p.isActive === false;
                  const isReported = p.reported === true || Number(p.reportsCount || 0) > 0;

                  return (
                    <tr key={p.id} className={`hover:bg-slate-50/50 transition duration-150 ${isBanned ? 'bg-rose-50/10' : ''}`}>
                      <td className="p-4 flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-50 border rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-3xs relative">
                          {isEmoji ? (
                            <span className="text-lg">{image}</span>
                          ) : (
                            <img referrerPolicy="no-referrer" src={image} className="w-full h-full object-cover" />
                          )}
                          {isReported && (
                            <span className="absolute -top-1 -right-1 bg-amber-500 text-white p-0.5 rounded-full shadow-3xs animate-bounce" title="Reported Listing">
                              <AlertTriangle className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className={`font-extrabold text-slate-900 truncate text-[12.5px] ${isBanned ? 'line-through text-slate-400' : ''}`}>
                            {p.title || p.name}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5 select-all">UID: #{p.id}</span>
                        </div>
                      </td>

                      <td className="p-4 font-bold text-slate-700">
                        {p.storeName || p.sellerName || 'Local Merchant'}
                      </td>

                      <td className="p-4 font-mono font-black text-slate-900 text-xs">
                        MWK {(p.price || 0).toLocaleString()}
                        {p.originalPrice && p.originalPrice > p.price && (
                          <span className="block text-[10.5px] text-slate-450 line-through">MWK {p.originalPrice.toLocaleString()}</span>
                        )}
                      </td>

                      <td className="p-4 font-mono font-bold text-slate-500 text-[11px]">
                        <span className="text-rose-650 block">{p.sold || 0} sold</span>
                        <span className="text-slate-400 block mt-0.5">{p.stock || p.quantity || 0} left</span>
                      </td>

                      <td className="p-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggleFeatured(p)}
                            disabled={processingId === p.id}
                            className={`p-1.5 px-2 rounded-lg text-[9.5px] font-black uppercase transition flex items-center gap-1 ${
                              p.isFeatured 
                                ? 'bg-amber-100 text-amber-800' 
                                : 'bg-slate-100 text-slate-450 hover:bg-slate-200'
                            }`}
                          >
                            <Star className={`w-3.5 h-3.5 ${p.isFeatured ? 'fill-amber-500 text-amber-600' : ''}`} />
                            Featured
                          </button>
                          
                          <button
                            onClick={() => handleToggleChoice(p)}
                            disabled={processingId === p.id}
                            className={`p-1.5 px-2 rounded-lg text-[9.5px] font-black uppercase transition flex items-center gap-1 ${
                              p.isChoice 
                                ? 'bg-indigo-100 text-indigo-800' 
                                : 'bg-slate-100 text-slate-455 hover:bg-slate-200'
                            }`}
                          >
                            <Award className="w-3.5 h-3.5" />
                            Choice
                          </button>
                        </div>
                      </td>

                      <td className="p-4 text-right">
                        {isBanned ? (
                          <button
                            onClick={() => handleToggleActive(p, false)}
                            disabled={processingId === p.id}
                            className="p-1.5 px-3 bg-emerald-50 text-emerald-800 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-100 transition inline-flex items-center gap-1 border border-emerald-150"
                          >
                            <Check className="w-3.5 h-3.5" /> Restore
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleActive(p, true)}
                            disabled={processingId === p.id}
                            className="p-1.5 px-3 bg-rose-50 text-rose-800 rounded-lg text-[10px] font-black uppercase hover:bg-rose-100 transition inline-flex items-center gap-1 border border-rose-150"
                          >
                            <EyeOff className="w-3.5 h-3.5" /> Ban Listing
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
