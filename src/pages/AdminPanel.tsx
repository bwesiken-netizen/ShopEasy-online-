import React, { useState } from 'react';
import { SAMPLE_STORES, SAMPLE_PRODUCTS } from '../data/malawiProducts';
import { ShieldAlert, Users, TrendingUp, Landmark, RefreshCw, Layers } from 'lucide-react';

export default function AdminPanel() {
  const [stores, setStores] = useState(SAMPLE_STORES);
  
  const handleToggleVerify = (storeId: string) => {
    setStores(
      stores.map((s) =>
        s.id === storeId ? { ...s, verified: !s.verified } : s
      )
    );
  };

  return (
    <div className="flex flex-col gap-4 p-4 animate-[fadeIn_0.3s_ease]">
      
      {/* HEADER SECTION */}
      <h2 className="font-display font-black text-base text-neutral-900 uppercase tracking-tight flex items-center gap-1.5">
        <ShieldAlert className="h-5 w-5 text-rose-600" />
        <span>ShopEasy Support Console</span>
      </h2>

      {/* 1. MALAWI METRICS HUD GRID */}
      <div className="grid grid-cols-2 gap-3.5">
        <div className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-sm">
          <TrendingUp className="h-5 w-5 text-[#E53935] mb-2" />
          <span className="block text-[9px] font-black uppercase text-neutral-450 tracking-wider">Estimated Volume</span>
          <span className="block font-mono text-base font-black text-neutral-900 mt-1">MWK 4.2M</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-sm">
          <Landmark className="h-5 w-5 text-[#FFB300] mb-2" />
          <span className="block text-[9px] font-black uppercase text-neutral-450 tracking-wider">Escrow Holds</span>
          <span className="block font-mono text-base font-black text-neutral-900 mt-1">MWK 820K</span>
        </div>
      </div>

      {/* 2. COLLECTION DATA SIZES MONITOR */}
      <div className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-sm flex flex-col gap-2.5">
        <span className="text-xs font-black text-neutral-500 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-neutral-400" />
          <span>Active Firestore Collections (13 total)</span>
        </span>

        <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-neutral-600">
          <div className="bg-neutral-50 rounded-xl p-2.5 flex justify-between">
            <span>users</span>
            <span className="font-mono font-black text-neutral-900">452</span>
          </div>
          <div className="bg-neutral-50 rounded-xl p-2.5 flex justify-between">
            <span>products</span>
            <span className="font-mono font-black text-neutral-900">{SAMPLE_PRODUCTS.length}</span>
          </div>
          <div className="bg-neutral-50 rounded-xl p-2.5 flex justify-between">
            <span>stores</span>
            <span className="font-mono font-black text-neutral-900">{stores.length}</span>
          </div>
          <div className="bg-neutral-50 rounded-xl p-2.5 flex justify-between">
            <span>orders</span>
            <span className="font-mono font-black text-neutral-900">128</span>
          </div>
        </div>
      </div>

      {/* 3. VERIFY PENDING SELLER REVIEWS */}
      <div className="flex flex-col gap-3">
        <h4 className="font-display font-extrabold text-xs text-neutral-550 uppercase tracking-wider">
          Verify Local Sellers
        </h4>

        <div className="flex flex-col gap-2.5">
          {stores.map((st) => (
            <div 
              key={st.id}
              className="bg-white rounded-3xl p-4 border border-neutral-100 shadow-sm flex flex-col gap-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h5 className="font-extrabold text-xs text-neutral-905">{st.name}</h5>
                  <span className="text-[10px] text-neutral-450 font-bold block mt-0.5">
                    Owner: {st.ownerId} • {st.city}
                  </span>
                </div>

                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                  st.verified ? 'bg-blue-50 text-blue-600' : 'bg-neutral-100 text-neutral-400'
                }`}>
                  {st.verified ? 'Verified' : 'Unverified'}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2.5 border-t border-neutral-100">
                <span className="text-[10px] text-neutral-400 font-bold">Phone: {st.contactPhone}</span>
                <button
                  onClick={() => handleToggleVerify(st.id)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black transition ${
                    st.verified
                      ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  {st.verified ? 'Revoke Badge' : 'Verify Seller'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
