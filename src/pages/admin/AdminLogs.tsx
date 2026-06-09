import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { Search, ShieldAlert, Calendar, RefreshCw, FileText } from 'lucide-react';

export default function AdminLogs() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAdminLogs();
  }, []);

  const fetchAdminLogs = async () => {
    setRefreshing(true);
    try {
      const logsQuery = query(
        collection(db, 'adminLogs'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const snap = await getDocs(logsQuery);
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setLogs(list);
    } catch (err) {
      console.error("Error loaded audit logs collection: ", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getActionBadgeStyle = (action: string) => {
    const act = (action || '').toUpperCase();
    if (act.includes('BAN')) return 'bg-rose-50 text-rose-800 border-rose-200';
    if (act.includes('REJECT')) return 'bg-rose-50 text-rose-800 border-rose-200';
    if (act.includes('APPROVE') || act.includes('PROMOTE') || act.includes('CREATE')) return 'bg-emerald-50 text-emerald-800 border-emerald-250';
    return 'bg-slate-50 text-slate-800 border-slate-205';
  };

  const filteredLogs = logs.filter((log) => {
    const term = searchQuery.toLowerCase();
    return (
      (log.adminName || '').toLowerCase().includes(term) ||
      (log.action || '').toLowerCase().includes(term) ||
      (log.targetName || '').toLowerCase().includes(term) ||
      (log.reason || '').toLowerCase().includes(term) ||
      (log.adminId || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6" id="admin-logs-root">
      
      {/* HUD Header Bar */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-3xs flex justify-between items-center flex-wrap gap-4">
        <div className="space-y-0.5">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Audit Ledger Chronicle</h2>
          <p className="text-[10px] text-slate-450 font-bold uppercase">Immutable audit history logged across all system administrators</p>
        </div>

        <div className="flex gap-2.5 flex-wrap w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <input
              type="text"
              placeholder="Search actions, names, reasons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-rose-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <button
            onClick={fetchAdminLogs}
            disabled={refreshing}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5 border"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-500 font-bold text-xs">
          Loading system audit files...
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white p-12 text-center text-slate-400 font-bold text-xs border rounded-2.5xl">
          No audit entries recorded matching the query.
        </div>
      ) : (
        <div className="bg-white rounded-2.5xl border border-slate-100 shadow-3s overflow-hidden shadow-3xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px] border-collapse">
               <thead>
                 <tr className="bg-slate-50/70 border-b text-[8.5px] uppercase font-black text-slate-450">
                   <th className="p-4 py-3 text-left">Timestamp</th>
                   <th className="p-4 py-3">Administrator</th>
                   <th className="p-4 py-3">Action Type</th>
                   <th className="p-4 py-3">Target Details</th>
                   <th className="p-4 py-3 max-w-xs">Justification Description</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 font-semibold text-[11.5px] text-slate-700">
                 {filteredLogs.map((log) => {
                   const logDate = log.createdAt?.seconds 
                     ? new Date(log.createdAt.seconds * 1000) 
                     : new Date(log.createdAt || 0);

                   return (
                     <tr key={log.id} className="hover:bg-slate-50/50 transition">
                       <td className="p-4 font-mono text-slate-450 text-[10.5px]">
                          {logDate.toLocaleString()}
                       </td>
                       <td className="p-4">
                          <span className="font-extrabold text-slate-900 block">{log.adminName || 'Admin Agent'}</span>
                          <span className="text-[10px] text-slate-400 font-mono font-medium block">UID: #{log.adminId}</span>
                       </td>
                       <td className="p-4">
                          <span className={`text-[8.5px] font-black uppercase tracking-wider px-2.5 py-0.5 border rounded-full ${getActionBadgeStyle(log.action)}`}>
                             {log.action}
                          </span>
                       </td>
                       <td className="p-4">
                          <span className="text-slate-900 block">{log.targetName || 'Universal'}</span>
                          {log.targetId && (
                             <span className="text-[10px] text-slate-400 font-mono font-medium block">ID: #{log.targetId}</span>
                          )}
                       </td>
                       <td className="p-4 text-slate-550 max-w-xs select-text">
                          {log.reason || 'Security parameters validation satisfied.'}
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
