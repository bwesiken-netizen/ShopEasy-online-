import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  writeBatch,
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { useAuthStore } from '../../stores';
import { 
  Settings, 
  Hammer, 
  Clock, 
  Megaphone, 
  Sliders, 
  ArrowUp, 
  ArrowDown, 
  CheckSquare, 
  Layout, 
  ShieldAlert, 
  RefreshCw 
} from 'lucide-react';

export default function AdminSettings() {
  const { user: currentUser } = useAuthStore();
  const [loading, setLoading] = useState(true);

  // App settings state
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [announcementActive, setAnnouncementActive] = useState(false);
  const [announcementBanner, setAnnouncementBanner] = useState('');
  
  // Homepage section toggles
  const [showBulkSaver, setShowBulkSaver] = useState(true);
  const [showNewArrivals, setShowNewArrivals] = useState(true);
  const [showTopDeals, setShowTopDeals] = useState(true);
  const [showChoice, setShowChoice] = useState(true);

  // Categories list State
  const [categories, setCategories] = useState<any[]>([]);

  // Page operation status
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingCategories, setSavingCategories] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchGlobalSettings();
    fetchCategoriesList();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchGlobalSettings = async () => {
    try {
      const docRef = doc(db, 'config', 'appSettings');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const d = snap.data();
        setMaintenanceMode(d.maintenanceMode ?? false);
        setAnnouncementActive(d.announcementActive ?? false);
        setAnnouncementBanner(d.announcementBanner || '');
        
        setShowBulkSaver(d.showBulkSaver ?? true);
        setShowNewArrivals(d.showNewArrivals ?? true);
        setShowTopDeals(d.showTopDeals ?? true);
        setShowChoice(d.showChoice ?? true);
      }
    } catch (err) {
      console.error("Error loaded app settings document:", err);
    }
  };

  const fetchCategoriesList = async () => {
    try {
      const snap = await getDocs(collection(db, 'categories'));
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      // Sort by sortOrder ASC
      list.sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
      setCategories(list);
    } catch (err) {
      console.error("Error loading categories collection:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGlobalConfigs = async () => {
    setSavingSettings(true);
    try {
      const docRef = doc(db, 'config', 'appSettings');
      const payload = {
        maintenanceMode,
        announcementActive,
        announcementBanner: announcementBanner.trim(),
        showBulkSaver,
        showNewArrivals,
        showTopDeals,
        showChoice
      };

      await setDoc(docRef, payload, { merge: true });

      // Audit Log
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentUser?.uid || 'unknown',
        adminName: currentUser?.name || 'Administrator',
        action: 'UPDATE_GLOBAL_APP_SETTINGS',
        targetId: 'config/appSettings',
        targetName: 'Global App Settings Manager',
        reason: `MaintenanceMode=${maintenanceMode}, AnnouncementActive=${announcementActive}, showBulkSaver=${showBulkSaver}`,
        createdAt: serverTimestamp()
      });

      showToast("App settings successfully written to database config!", "success");
    } catch (err) {
      console.error(err);
      showToast("Settings update rejected.", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // Drag simulation logic (Move Up / Down within order list)
  const handleMoveCategory = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === categories.length - 1) return;

    const newList = [...categories];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    
    // Swap items in-memory
    const temp = newList[index];
    newList[index] = newList[targetIdx];
    newList[targetIdx] = temp;

    // Re-sequence sortOrder indices
    const finalized = newList.map((cat, i) => ({
      ...cat,
      sortOrder: i + 1
    }));

    setCategories(finalized);
  };

  const handleSaveCategoriesSortOrder = async () => {
    setSavingCategories(true);
    try {
      const batch = writeBatch(db);
      
      categories.forEach((cat) => {
        const catRef = doc(db, 'categories', cat.id);
        batch.update(catRef, {
          sortOrder: cat.sortOrder
        });
      });

      await batch.commit();

      // Audit Log
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentUser?.uid || 'unknown',
        adminName: currentUser?.name || 'Administrator',
        action: 'UPDATE_CATEGORIES_SORT_ORDER',
        targetId: 'categories',
        targetName: 'Category Ordering Manager',
        reason: `Categories sequence indices updated matching brand rules`,
        createdAt: serverTimestamp()
      });

      showToast("Category sort indices updated in cloud storage!", "success");
    } catch (err) {
      console.error(err);
      showToast("Sort index update was rejected.", "error");
    } finally {
      setSavingCategories(false);
    }
  };

  return (
    <div className="space-y-6" id="admin-settings-root">
      
      {/* HUD Header Bar */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-3xs flex justify-between items-center flex-wrap gap-4">
        <div className="space-y-0.5">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">System Settings Overrides</h2>
          <p className="text-[10px] text-slate-450 font-bold uppercase">Toggle platform-wide maintenance checkpoints, banner broadcasts, and component priorities</p>
        </div>
      </div>

      {toast && (
        <div className={`p-3 bg-emerald-50 text-emerald-800 border border-emerald-150 rounded-xl text-xs font-bold`}>
           {toast.message}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-slate-550 font-bold text-xs">
           Connecting variables matching cloud endpoints...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5.5">
           
           {/* GLOBAL CONSTANTS SETTINGS SHELF (COL 7) */}
           <div className="lg:col-span-7 space-y-5">
             
              {/* MAINTENANCE & DISPATCH SETS */}
              <div className="bg-white p-5 rounded-2.5xl border border-slate-100 shadow-3xs space-y-4">
                <div className="flex items-center gap-1.5 border-b border-slate-50 pb-2.5">
                  <Hammer className="w-5 h-5 text-rose-600" />
                  <h3 className="font-extrabold text-slate-850 text-xs uppercase tracking-wide">Maintenance Guard Checkpoints</h3>
                </div>

                <div className="flex justify-between items-center bg-rose-50/10 p-3.5 rounded-2.5xl border border-rose-100/50">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-rose-900 block uppercase">Maintenance Lockdown Mode</span>
                    <span className="text-[10px] text-slate-500 font-medium block leading-relaxed">
                       If ON, non-admin accounts receive support card overlays on entry
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMaintenanceMode(!maintenanceMode)}
                    className={`p-2 px-4 text-[10.5px] font-black uppercase rounded-xl transition ${
                      maintenanceMode 
                        ? 'bg-rose-600 text-white shadow-3xs' 
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border'
                    }`}
                  >
                     {maintenanceMode ? 'Lockdown ON' : 'Inactive'}
                  </button>
                </div>
              </div>

              {/* ANNOUNCEMENT BROADCAST WRAPPER */}
              <div className="bg-white p-5 rounded-2.5xl border border-slate-100 shadow-3xs space-y-3.5">
                <div className="flex items-center gap-1.5 border-b border-slate-50 pb-2.5 justify-between">
                  <span className="font-extrabold text-slate-850 text-xs uppercase tracking-wide flex items-center gap-1.5">
                    <Megaphone className="w-5 h-5 text-indigo-500 animate-bounce" /> Broadcast Broadcast Banner
                  </span>
                  <button
                    type="button"
                    onClick={() => setAnnouncementActive(!announcementActive)}
                    className={`p-1 px-3.5 text-[9px] font-black uppercase rounded-lg border transition ${
                      announcementActive 
                        ? 'bg-indigo-50 text-indigo-850 border-indigo-200' 
                        : 'bg-slate-50 text-slate-450'
                    }`}
                  >
                     {announcementActive ? 'Broadcasting active' : 'Muted'}
                  </button>
                </div>

                <div className="space-y-1.5 font-sans text-xs font-semibold">
                  <label className="text-[10px] uppercase font-black text-slate-400">Broadcast Banner Text (English / Chichewa)</label>
                  <textarea
                    rows={2}
                    value={announcementBanner}
                    onChange={(e) => setAnnouncementBanner(e.target.value)}
                    placeholder="e.g. 🎉 ShopEasy welcomes our agricultural merchants of Lilongwe with 0% gateway commission this week! ..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-202 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* DYNAMIC COMPONENT HOMEPAGE CONFIGS */}
              <div className="bg-white p-5 rounded-2.5xl border border-slate-100 shadow-3xs space-y-3.5">
                <span className="font-extrabold text-slate-850 text-xs uppercase tracking-wide flex items-center gap-1.5 border-b pb-2.5">
                  <Layout className="w-4.5 h-4.5 text-[#FFB300]" /> Homepage Section Displays
                </span>

                <div className="grid grid-cols-2 gap-3 font-sans text-xs font-semibold">
                  
                  {/* Item 1 */}
                  <div 
                    onClick={() => setShowBulkSaver(!showBulkSaver)}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                      showBulkSaver ? 'border-amber-200 bg-amber-50/10' : 'border-slate-100 bg-slate-50/50'
                    }`}
                  >
                    <span className="font-bold text-slate-750">Bulk Saver</span>
                    <input type="checkbox" checked={showBulkSaver} readOnly className="w-4 h-4" />
                  </div>

                  {/* Item 2 */}
                  <div 
                    onClick={() => setShowNewArrivals(!showNewArrivals)}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                      showNewArrivals ? 'border-amber-200 bg-amber-50/10' : 'border-slate-100 bg-slate-50/50'
                    }`}
                  >
                    <span className="font-bold text-slate-750">New Arrivals</span>
                    <input type="checkbox" checked={showNewArrivals} readOnly className="w-4 h-4" />
                  </div>

                  {/* Item 3 */}
                  <div 
                    onClick={() => setShowTopDeals(!showTopDeals)}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                      showTopDeals ? 'border-amber-200 bg-amber-50/10' : 'border-slate-100 bg-slate-50/50'
                    }`}
                  >
                    <span className="font-bold text-slate-750">Hot Top Deals</span>
                    <input type="checkbox" checked={showTopDeals} readOnly className="w-4 h-4" />
                  </div>

                  {/* Item 4 */}
                  <div 
                    onClick={() => setShowChoice(!showChoice)}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                      showChoice ? 'border-amber-200 bg-amber-50/10' : 'border-slate-100 bg-slate-50/50'
                    }`}
                  >
                    <span className="font-bold text-slate-755">Choice Badged</span>
                    <input type="checkbox" checked={showChoice} readOnly className="w-4 h-4" />
                  </div>

                </div>
              </div>

              {/* SUBMIT BUTTON SECTION */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSaveGlobalConfigs}
                  disabled={savingSettings}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-black uppercase transition-all shadow-md cursor-pointer"
                >
                  {savingSettings ? 'Writing overrides to appSettings...' : 'Commit System Settings'}
                </button>
              </div>

           </div>

           {/* CATEGORY REORDER SELECTION RAIL (COL 5) */}
           <div className="lg:col-span-5 bg-white p-5 rounded-2.5xl border border-slate-100 shadow-3xs space-y-4">
              <div className="border-b border-slate-50 pb-2.5">
                <h3 className="font-extrabold text-slate-850 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <Sliders className="w-4.5 h-4.5 text-indigo-505 text-indigo-600" /> Category Ordering Manager
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 leading-relaxed">
                   Emulate Drag sequencing. Save indices to update local category lists
                </p>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {categories.map((cat, idx) => (
                  <div 
                    key={cat.id} 
                    className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 group"
                  >
                     <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-black text-slate-400 w-5">#{cat.sortOrder ?? idx + 1}</span>
                        <span className="text-sm">{cat.emoji || '📦'}</span>
                        <span className="font-black text-slate-750 text-xs">{cat.name}</span>
                     </div>

                     <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveCategory(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 px-2.5 bg-white border rounded-lg text-slate-600 hover:text-slate-950 disabled:opacity-30 transition"
                          title="Move Rank Up"
                        >
                           <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveCategory(idx, 'down')}
                          disabled={idx === categories.length - 1}
                          className="p-1 px-2.5 bg-white border rounded-lg text-slate-605 hover:text-slate-950 disabled:opacity-30 transition"
                          title="Move Rank Down"
                        >
                           <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                     </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-50">
                <button
                  type="button"
                  onClick={handleSaveCategoriesSortOrder}
                  disabled={savingCategories || categories.length === 0}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-750 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase transition shadow-3xs cursor-pointer"
                >
                  {savingCategories ? 'Syncing sort indices...' : 'Save Sequence Order'}
                </button>
              </div>
           </div>

        </div>
      )}

    </div>
  );
}
