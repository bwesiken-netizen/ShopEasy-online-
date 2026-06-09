import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp, 
  getDoc 
} from 'firebase/firestore';
import { useAuthStore } from '../../stores';
import { 
  Search, 
  ShieldAlert, 
  UserMinus, 
  ShieldCheck, 
  MoreVertical, 
  X, 
  AlertCircle 
} from 'lucide-react';

export default function AdminUsers() {
  const { user: currentUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'banned' | 'admin'>('all');

  // Modal / Detail States
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [isBanModalOpen, setIsBanModalOpen] = useState(false);
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ uid: d.id, ...d.data() });
      });
      setUsers(list);
    } catch (err) {
      console.error("Error loaded users: ", err);
      showToast("Could not retrieve system users", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Safe checks for self-action protection
  const isSelfAction = (targetUid: string) => {
    return currentUser?.uid === targetUid;
  };

  const handleBanUser = async () => {
    if (!selectedUser) return;
    if (isSelfAction(selectedUser.uid)) {
      showToast("Ufiti sachedwa! You cannot ban your own active administrator account.", "error");
      return;
    }
    if (!actionReason.trim()) {
      showToast("Justification reason is strictly required to proceed.", "error");
      return;
    }

    setSubmittingAction(true);
    try {
      const targetRef = doc(db, 'users', selectedUser.uid);
      const updatedStatus = 'banned';

      // Update status on user profile
      await updateDoc(targetRef, {
        status: updatedStatus,
        bannedAt: new Date().toISOString(),
        banReason: actionReason
      });

      // Write action to admin logs audit trail
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentUser?.uid || 'unknown',
        adminName: currentUser?.name || 'Administrator',
        action: 'BAN_USER',
        targetId: selectedUser.uid,
        targetName: selectedUser.name || selectedUser.phone,
        reason: actionReason,
        createdAt: serverTimestamp()
      });

      showToast(`User ${selectedUser.name || 'Account'} has been successfully banned.`, "success");
      setIsBanModalOpen(false);
      setActionReason('');
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      console.error("Error banning user: ", err);
      showToast("Action rejected by Firestore rules.", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleUnbanUser = async (targetUser: any) => {
    if (isSelfAction(targetUser.uid)) return;
    
    setLoading(true);
    try {
      const targetRef = doc(db, 'users', targetUser.uid);
      await updateDoc(targetRef, {
        status: 'active',
        bannedAt: null,
        banReason: null
      });

      // Write action log
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentUser?.uid || 'unknown',
        adminName: currentUser?.name || 'Administrator',
        action: 'UNBAN_USER',
        targetId: targetUser.uid,
        targetName: targetUser.name || targetUser.phone,
        reason: 'Restored active status from Admin Panel console',
        createdAt: serverTimestamp()
      });

      showToast(`User account ${targetUser.name || ''} has been successfully restored active.`, "success");
      fetchUsers();
    } catch (err) {
      console.error("Error restoring user profile: ", err);
      showToast("Restoration rejected.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdminRole = async () => {
    if (!selectedUser) return;
    
    if (isSelfAction(selectedUser.uid)) {
      showToast("Action blocked! You are not allowed to demote or modify your own administration rights.", "error");
      return;
    }

    setSubmittingAction(true);
    try {
      const targetRef = doc(db, 'users', selectedUser.uid);
      // Toggle role
      const isCurrentlyAdmin = selectedUser.role === 'admin';
      const newRole = isCurrentlyAdmin ? 'buyer' : 'admin';

      await updateDoc(targetRef, {
        role: newRole
      });

      // Log the promotion
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentUser?.uid || 'unknown',
        adminName: currentUser?.name || 'Administrator',
        action: isCurrentlyAdmin ? 'DEMOTE_ADMIN' : 'PROMOTE_ADMIN',
        targetId: selectedUser.uid,
        targetName: selectedUser.name || selectedUser.phone,
        reason: actionReason || `Admin authorization toggled value to: ${newRole}`,
        createdAt: serverTimestamp()
      });

      showToast(`Role updated successfully to ${newRole.toUpperCase()}.`, "success");
      setIsPromoteModalOpen(false);
      setActionReason('');
      setSelectedUser(null);
      fetchUsers();
    } catch (e) {
      console.error("Promotion failed:", e);
      showToast("Role change was rejected.", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  // Search and filter logic
  const filteredUsers = users.filter((u) => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = 
      (u.name || '').toLowerCase().includes(term) ||
      (u.phone || '').includes(term) ||
      (u.city || '').toLowerCase().includes(term) ||
      (u.uid || '').toLowerCase().includes(term);

    if (!matchesSearch) return false;

    if (activeTab === 'active') return u.status !== 'banned';
    if (activeTab === 'banned') return u.status === 'banned';
    if (activeTab === 'admin') return u.role === 'admin';
    return true; // 'all'
  });

  return (
    <div className="space-y-6" id="admin-users-root">
      
      {/* HUD Header Bar */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-3xs flex justify-between items-center flex-wrap gap-4">
        <div className="space-y-0.5">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Accounts & Security Center</h2>
          <p className="text-[10px] text-slate-450 font-bold uppercase">Search accounts, manage authorization levels, and ban bad actors</p>
        </div>

        <div className="relative w-full max-w-xs">
          <input
            type="text"
            placeholder="Search by name, phone or UID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-slate-100 bg-white p-1 rounded-xl border max-w-md">
        {(['all', 'active', 'banned', 'admin'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-[10px] font-black uppercase text-center rounded-lg transition duration-200 ${
              activeTab === tab
                ? 'bg-rose-600 text-white shadow-3xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Toast Alert */}
      {toast && (
        <div className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2.5 ${
          toast.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <AlertCircle className="w-4 h-4" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* User grid view */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 font-bold text-xs">
          Querying safe profiles registry...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white p-10 border rounded-2xl text-center text-slate-400 font-bold text-xs">
          No matches found under filter "{activeTab}".
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="users-card-grid">
          {filteredUsers.map((item) => {
            const isUserBanned = item.status === 'banned';
            const isTargetAdmin = item.role === 'admin';
            const isSelf = isSelfAction(item.uid);

            return (
              <div 
                key={item.uid} 
                className={`bg-white rounded-2.5xl p-4 border transition hover:shadow-xs relative flex flex-col justify-between cursor-pointer ${
                  isUserBanned ? 'border-rose-150 bg-rose-50/10' : 'border-slate-100'
                }`}
                onClick={() => setSelectedUser(item)}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full border overflow-hidden flex items-center justify-center shrink-0">
                        {item.avatar ? (
                          <img referrerPolicy="no-referrer" src={item.avatar} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-black text-slate-500">{item.name?.slice(0, 1) || 'U'}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-slate-900 truncate flex items-center gap-1.5">
                          <span>{item.name || 'Incomplete Account'}</span>
                          {isSelf && (
                            <span className="text-[8px] bg-slate-250 text-slate-800 px-1.5 rounded font-black uppercase">Me</span>
                          )}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono block font-bold">{item.phone || 'No phone'}</span>
                      </div>
                    </div>

                    <span className={`text-[8.5px] font-black uppercase px-2.5 py-0.5 rounded-full border shrink-0 ${
                      isTargetAdmin 
                        ? 'bg-purple-50 text-purple-700 border-purple-200' 
                        : isUserBanned 
                        ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse' 
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      {isTargetAdmin ? 'Admin' : isUserBanned ? 'Banned' : item.role || 'buyer'}
                    </span>
                  </div>

                  {/* Highlights */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500 font-sans">
                    <div className="bg-slate-50 rounded-lg p-2">
                      <span className="block text-[8px] uppercase text-slate-400">Coins Bal</span>
                      <span className="font-mono text-slate-900 mt-0.5 block">{item.coins ?? 0}🪙</span>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2">
                      <span className="block text-[8px] uppercase text-slate-400">City / District</span>
                      <span className="text-slate-900 mt-0.5 block truncate">{item.city || 'Malawi'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3.5 border-t border-slate-50 flex items-center justify-between gap-2">
                  <span className="text-[9px] text-slate-400 font-semibold font-mono">
                    Joined {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'earlier'}
                  </span>
                  
                  <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                    {/* Action buttons */}
                    {isUserBanned ? (
                      <button
                        onClick={() => handleUnbanUser(item)}
                        className="p-1 px-3.5 bg-emerald-50 text-emerald-800 rounded-lg text-[9.5px] font-black uppercase hover:bg-emerald-100 transition"
                      >
                        Unban
                      </button>
                    ) : (
                      <>
                        {!isSelf && (
                          <button
                            onClick={() => { setSelectedUser(item); setIsBanModalOpen(true); }}
                            className="p-1.5 bg-rose-50 text-rose-700 rounded-lg text-[9.5px] font-black uppercase hover:bg-rose-100 transition flex items-center justify-center"
                            title="Ban User"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => { setSelectedUser(item); setIsPromoteModalOpen(true); }}
                          className="p-1 px-2.5 bg-indigo-50 text-indigo-700 rounded-lg text-[9.5px] font-black uppercase hover:bg-indigo-100 transition flex items-center gap-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Role
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail & Action Sheet Modal */}
      {selectedUser && !isBanModalOpen && !isPromoteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease]">
          <div className="bg-white rounded-3xl p-5.5 w-full max-w-md relative border shadow-xl space-y-4">
            <button 
              onClick={() => setSelectedUser(null)}
              className="p-1.5 bg-slate-50 text-slate-400 hover:text-slate-800 rounded-full absolute right-4 top-4"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900 uppercase">Account Profile Details</h3>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Comprehensive records inspection</p>
            </div>

            <div className="flex items-center gap-3.5 bg-slate-50 p-3 rounded-2xl">
              <div className="w-12 h-12 bg-white border rounded-full overflow-hidden flex items-center justify-center">
                {selectedUser.avatar ? (
                  <img referrerPolicy="no-referrer" src={selectedUser.avatar} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-black text-slate-400">_</span>
                )}
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900">{selectedUser.name || 'Anonymous User'}</h4>
                <p className="text-[10.5px] font-mono text-slate-500 font-bold">{selectedUser.phone || 'No direct phone'}</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 font-medium">
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-slate-400">User Identification</span>
                <span className="font-mono font-bold text-slate-900 select-all">{selectedUser.uid}</span>
              </div>
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-slate-400">Current Role Group</span>
                <span className="font-bold text-slate-900 uppercase">{selectedUser.role}</span>
              </div>
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-slate-400">District Base</span>
                <span className="font-bold text-slate-900">{selectedUser.city || 'Lilongwe'}</span>
              </div>
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-slate-400">Registered On</span>
                <span className="font-bold text-slate-900">{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : 'N/A'}</span>
              </div>
              {selectedUser.status === 'banned' && (
                <div className="bg-rose-50 border border-rose-150 p-2.5 rounded-xl space-y-1 mt-2 text-rose-950 font-bold">
                  <span className="text-[9px] uppercase tracking-wide text-rose-700 font-black block">Active Ban Reason:</span>
                  <p className="text-[10px] leading-relaxed">{selectedUser.banReason || 'Security risk violation'}</p>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedUser(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Close Profile Info
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban Justification modal */}
      {isBanModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease]">
          <div className="bg-white rounded-3xl p-5 w-full max-w-md relative border shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-rose-650">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-black uppercase text-slate-900">Ban Account Authorization</h3>
            </div>

            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              You are restricting user profile <strong className="text-slate-900">"{selectedUser.name || selectedUser.phone}"</strong>. They will immediately lose access to ShopEasy app functionality. Justification is log audited.
            </p>

            <div className="space-y-1.5">
              <label className="text-[10.5px] font-black text-slate-450 uppercase">Mandatory Justification Reason</label>
              <textarea
                rows={3}
                placeholder="Specify precise policy violation (e.g., fraudulent marketplace activities)..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => { setIsBanModalOpen(false); setActionReason(''); }}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleBanUser}
                disabled={submittingAction || !actionReason.trim()}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white disabled:bg-slate-200 disabled:text-slate-400 rounded-xl text-xs font-black uppercase transition"
              >
                {submittingAction ? 'Processing...' : 'Enforce Ban'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role promote modal */}
      {isPromoteModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease]">
          <div className="bg-white rounded-3xl p-5 w-full max-w-md relative border shadow-xl space-y-4">
            <div className="flex items-center gap-1.5 text-indigo-650">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-black uppercase text-slate-900">Modify Account Authority</h3>
            </div>

            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Confirm change of authorization level for <strong className="text-slate-900">"{selectedUser.name || selectedUser.phone}"</strong>. 
              {selectedUser.role === 'admin' 
                ? ' Demoting this administrator will revoke their control console authorization immediately.' 
                : ' Promoting this account grants full admin abilities, including database setting overrides.'}
            </p>

            <div className="space-y-1.5">
              <label className="text-[10.5px] font-black text-slate-450 uppercase">Mandatory Justification Reason</label>
              <input
                type="text"
                placeholder="Why is this authorization state being updated?"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => { setIsPromoteModalOpen(false); setActionReason(''); }}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition"
              >
                Cancel Change
              </button>
              <button
                onClick={handleToggleAdminRole}
                disabled={submittingAction || !actionReason.trim()}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-200 disabled:text-slate-400 rounded-xl text-xs font-extrabold uppercase transition"
              >
                {submittingAction ? 'Processing...' : 'Confirm Role change'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
