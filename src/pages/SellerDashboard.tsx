import React, { useState } from 'react';
import { useAuthStore } from '../stores';
import { SAMPLE_PRODUCTS, MALAWI_CITIES, CATEGORIES } from '../data/malawiProducts';
import { Store, Plus, ClipboardList, PackageCheck, HeartHandshake, ShieldAlert } from 'lucide-react';

export default function SellerDashboard() {
  const { user } = useAuthStore();

  const [localProducts, setLocalProducts] = useState(SAMPLE_PRODUCTS);
  const [showAddForm, setShowAddForm] = useState(false);

  // New product state inputs
  const [pName, setPName] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pCategory, setPCategory] = useState('Farm Produce');
  const [pCity, setPCity] = useState('Lilongwe');
  const [pDesc, setPDesc] = useState('');
  const [alertMsg, setAlertMsg] = useState('');

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMsg('');

    if (!pName || !pPrice) {
      setAlertMsg('Please fill out the name and pricing fields');
      return;
    }

    const priceNum = parseFloat(pPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setAlertMsg('Price must be a positive number');
      return;
    }

    const newProduct = {
      id: 'p_custom_' + Math.random().toString(36).substring(2, 9),
      storeId: user?.storeId || 'store_custom',
      storeName: 'My Local Marketplace Depot',
      name: pName,
      description: pDesc || 'Freshly harvested product listed locally inside Malawi.',
      price: priceNum,
      category: pCategory,
      imageUrl: '📦',
      stock: 50,
      city: pCity,
      active: true,
      featured: false,
      createdAt: new Date()
    };

    // Prepend to list
    setLocalProducts([newProduct, ...localProducts]);
    
    // Reset state inputs
    setPName('');
    setPPrice('');
    setPDesc('');
    setShowAddForm(false);
    setAlertMsg('✓ Item added to local catalog!');
    setTimeout(() => setAlertMsg(''), 3000);
  };

  return (
    <div className="flex flex-col gap-4 p-4 animate-[fadeIn_0.3s_ease]">
      
      {/* 1. SELLER STORE LOADER INTRO */}
      <div className="bg-gradient-to-br from-[#212121] to-[#3a3a3a] text-white p-5 rounded-3xl border border-neutral-800 shadow-md flex justify-between items-center relative overflow-hidden">
        <div className="absolute right-[-15px] top-[-10px] text-8xl opacity-10 select-none">
          🏪
        </div>
        <div>
          <span className="text-[10px] font-black uppercase text-[#FFB300] tracking-widest block">
            Seller Dashboard
          </span>
          <h2 className="mt-1 font-display text-lg font-black text-white leading-snug">
            {user?.name || 'Seller Agent'} Depot
          </h2>
          <p className="text-[10px] text-neutral-300 mt-1 font-semibold leading-relaxed">
            Manage your local Malawi inventory and fulfill buyer pick ups.
          </p>
        </div>
      </div>

      {/* 2. ALERTS OR SUCCESS FLASHER */}
      {alertMsg && (
        <div className={`p-3.5 rounded-2xl text-xs font-bold text-center ${
          alertMsg.startsWith('✓') ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-orange-50 text-orange-850 border border-orange-100'
        }`}>
          {alertMsg}
        </div>
      )}

      {/* 3. QUICK SELL FORM MODAL TOGGLE */}
      <div className="bg-white rounded-3xl border border-neutral-100 p-4 shadow-sm flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h3 className="font-display font-extrabold text-xs text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
            <ClipboardList className="h-4.5 w-4.5 text-[#E53935]" />
            <span>Post New Malawi Item</span>
          </h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex h-8 px-3 items-center justify-center rounded-2xl bg-[#E53935] hover:bg-red-700 text-white text-xs font-black transition-colors"
          >
            {showAddForm ? 'Close Form' : 'Add Post +'}
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleCreateProduct} className="flex flex-col gap-3 mt-2 pt-3 border-t border-neutral-100">
            <div>
              <label className="block text-[10px] font-black text-neutral-500 mb-1 uppercase">PRODUCT SPECIFICATION NAME:</label>
              <input
                type="text"
                placeholder="E.g. Karonga Groundnuts / Fresh Chambo"
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                className="w-full text-xs font-semibold rounded-xl border border-neutral-200 p-2.5 bg-neutral-50 focus:bg-white text-neutral-900 focus:outline-[#E53935]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-black text-neutral-500 mb-1 uppercase">PRICE (MWK):</label>
                <input
                  type="number"
                  placeholder="E.g. 5000"
                  value={pPrice}
                  onChange={(e) => setPPrice(e.target.value)}
                  className="w-full text-xs font-semibold rounded-xl border border-neutral-200 p-2.5 bg-neutral-50 focus:bg-white text-neutral-900 focus:outline-[#E53935]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-neutral-500 mb-1">LOCAL TOWN/CITY:</label>
                <select
                  value={pCity}
                  onChange={(e) => setPCity(e.target.value)}
                  className="w-full text-xs font-semibold rounded-xl border border-neutral-200 p-2.5 bg-neutral-50 text-neutral-900 focus:outline-[#E53935]"
                >
                  {MALAWI_CITIES.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-[10px] font-black text-neutral-500 mb-1">CATEGORY CLASS:</label>
                <select
                  value={pCategory}
                  onChange={(e) => setPCategory(e.target.value)}
                  className="w-full text-xs font-semibold rounded-xl border border-neutral-200 p-2.5 bg-neutral-50 text-neutral-900 focus:outline-[#E53935]"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-neutral-500 mb-1">OPTIONAL BRIEF DESCRIPTION:</label>
              <textarea
                placeholder="Describe how buyer can pick it up locally..."
                value={pDesc}
                onChange={(e) => setPDesc(e.target.value)}
                className="w-full text-xs font-semibold rounded-xl border border-neutral-200 p-2.5 bg-neutral-50 focus:bg-white text-neutral-900 h-16 resize-none focus:outline-[#E53935]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-full bg-[#E53935] hover:bg-red-700 text-xs font-black text-white hover:shadow-md transition-all mt-1"
            >
              Post Item Live in Malawi catalog
            </button>
          </form>
        )}
      </div>

      {/* 4. SELLER INVENTORY CATALOG COCKPIT */}
      <div className="flex flex-col gap-3">
        <h4 className="font-display font-extrabold text-xs text-neutral-550 uppercase tracking-wide">
          My Active Listings ({localProducts.length} items)
        </h4>

        <div className="flex flex-col gap-2.5">
          {localProducts.map((p) => (
            <div 
              key={p.id}
              className="bg-white rounded-3xl p-3 border border-neutral-100 shadow-sm flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl select-none">{p.imageUrl}</span>
                <div>
                  <h4 className="font-bold text-xs text-neutral-900 line-clamp-1">{p.name}</h4>
                  <span className="text-[10px] text-neutral-450 font-bold uppercase block mt-0.5">
                    {p.city} • Stock {p.stock}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-mono text-xs font-black text-[#E53935]">
                  MWK {p.price.toLocaleString()}
                </div>
                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 block mt-1 uppercase text-center">
                  Live Market
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
