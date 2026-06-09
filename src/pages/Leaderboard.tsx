import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError } from '../firebase';
import { OperationType } from '../types';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Trophy, 
  Award, 
  Medal, 
  Sparkles, 
  Search,
  TrendingUp,
  Coins
} from 'lucide-react';

interface LeaderboardRecord {
  userId: string;
  userName: string;
  avatar?: string;
  totalCoinsEarned: number;
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [standings, setStandings] = useState<LeaderboardRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const uid = auth.currentUser?.uid;

  useEffect(() => {
    // Read from the real Firestore collections
    const colRef = collection(db, 'coinLeaderboard');
    const lbQuery = query(
      colRef,
      orderBy('totalCoinsEarned', 'desc'),
      limit(25)
    );

    const unsub = onSnapshot(lbQuery, (snapshot) => {
      const records: LeaderboardRecord[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        records.push({
          userId: doc.id,
          userName: d.userName ?? 'ShopEasy Member',
          avatar: d.avatar ?? '👤',
          totalCoinsEarned: d.totalCoinsEarned ?? 0
        });
      });
      setStandings(records);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'coinLeaderboard');
    });

    return () => unsub();
  }, []);

  // Separate top 3 for special visual podium representation
  const topThree = standings.slice(0, 3);
  const restUsers = standings.slice(3);

  // Helper helper to generate ranking graphics
  const getPodiumOrder = () => {
    if (topThree.length === 0) return [];
    // Render: 2nd, 1st, 3rd for podium flow
    const order = [];
    if (topThree[1]) order.push({ ...topThree[1], rank: 2 });
    if (topThree[0]) order.push({ ...topThree[0], rank: 1 });
    if (topThree[2]) order.push({ ...topThree[2], rank: 3 });
    return order;
  };

  const getMedalEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return '🏅';
    }
  };

  return (
    <div id="leaderboard-page" className="min-h-screen bg-slate-50 pb-20">
      
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 text-white py-4 px-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <button 
          onClick={() => navigate('/coins')} 
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition"
          id="btn-back-from-leaderboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-white font-sans tracking-tight flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-amber-400" /> Coin Champions Leaderboard
        </span>
        <div className="w-8 h-8" /> {/* Spacer */}
      </div>

      <div className="max-w-md mx-auto p-4 space-y-5">
        
        {/* Banner */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl p-4 shadow-sm relative overflow-hidden flex items-center gap-3">
          <div className="text-3xl bg-white/20 p-2.5 rounded-full">👑</div>
          <div>
            <h3 className="font-bold tracking-tight">Malawi Weekly Standings</h3>
            <p className="text-[11px] text-amber-100">Top contributors and high-scorers split rewards weekly.</p>
          </div>
        </div>

        {/* Podium visualization for top 3 */}
        {!loading && topThree.length > 0 && (
          <div className="bg-white rounded-xl py-6 px-4 shadow-sm border border-slate-150 flex flex-col items-center">
            
            <span className="text-xs font-bold text-slate-400 tracking-wider font-mono mb-6 uppercase">
              🏆 PODIUM FINISHERS
            </span>

            <div className="flex items-end justify-center gap-7 w-full h-32">
              
              {/* Render Podium column */}
              {getPodiumOrder().map((pUser) => {
                const isWinner = pUser.rank === 1;
                const isCurrentUser = pUser.userId === uid;
                
                return (
                  <div key={pUser.userId} className="flex flex-col items-center flex-1 max-w-[90px]">
                    {/* User Avatar */}
                    <div className="relative mb-2">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl bg-slate-100 border-2 ${
                        isWinner ? 'border-amber-400 ring-4 ring-amber-400/20 w-14 h-14 text-2xl' : 'border-slate-300'
                      }`}>
                        {pUser.avatar}
                      </div>
                      <span className="absolute -bottom-1 -right-1 bg-slate-900 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow font-mono font-bold">
                        {pUser.rank}
                      </span>
                    </div>

                    {/* Name */}
                    <span className={`text-[11px] font-bold text-center truncate w-full ${
                      isCurrentUser ? 'text-amber-600 underline' : 'text-slate-800'
                    }`}>
                      {isCurrentUser ? 'You' : pUser.userName.split(' ')[0]}
                    </span>

                    {/* Score */}
                    <span className="text-[10px] font-mono text-slate-500 flex items-center mt-0.5">
                      🪙 {pUser.totalCoinsEarned.toLocaleString()}
                    </span>

                    {/* Podium block */}
                    <div className={`w-full mt-3 rounded-t-lg text-center ${
                      isWinner 
                        ? 'h-10 bg-amber-400 text-amber-950 font-bold' 
                        : pUser.rank === 2 
                          ? 'h-7 bg-slate-350 bg-slate-200 text-slate-600'
                          : 'h-6 bg-amber-200 bg-amber-100 text-amber-800'
                    }`} />
                  </div>
                );
              })}

            </div>
          </div>
        )}

        {/* Standings list list */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-150 space-y-2">
          
          <h4 className="font-bold text-slate-850 text-xs mb-3 flex items-center gap-1.5 uppercase font-mono tracking-wider">
            <TrendingUp className="w-4 h-4 text-amber-500" /> National BoardStandings
          </h4>

          {loading ? (
            <div className="space-y-2.5 py-6" id="leaderboard-loader">
              <div className="h-10 bg-slate-100 rounded animate-pulse" />
              <div className="h-10 bg-slate-100 rounded animate-pulse" />
              <div className="h-10 bg-slate-100 rounded animate-pulse" />
            </div>
          ) : standings.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs" id="leaderboard-empty">
              <p>The champion leaderboard is currently empty.</p>
              <p className="mt-1">Launch GoGo Match or Daily Check-in today to secure rank #1!</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {standings.map((user, idx) => {
                const rankNum = idx + 1;
                const isCurrentUser = user.userId === uid;

                return (
                  <div 
                    key={user.userId}
                    className={`flex items-center justify-between py-3 px-1 text-sm ${
                      isCurrentUser ? 'bg-amber-50/50 -mx-1 px-2.5 rounded-xl border border-amber-100/40 font-semibold' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      
                      {/* Rank Indicator */}
                      <span className="w-6 font-mono font-bold text-slate-400 text-center">
                        {rankNum <= 3 ? getMedalEmoji(rankNum) : rankNum}
                      </span>

                      {/* Avatar */}
                      <div className="text-xl bg-slate-100 p-1.5 rounded-full w-9 h-9 flex items-center justify-center border">
                        {user.avatar}
                      </div>

                      {/* Name tags */}
                      <div>
                        <h4 className={`text-slate-800 ${isCurrentUser ? 'text-amber-800 font-extrabold' : ''}`}>
                          {user.userName} {isCurrentUser && <span className="text-[9px] bg-amber-500 text-slate-950 font-bold rounded px-1 py-0.2 ml-1">YOU</span>}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono">Verified Malawian Member</p>
                      </div>

                    </div>

                    {/* Coins */}
                    <div className="flex items-center gap-1 font-mono font-bold text-slate-705">
                      <span>🪙</span>
                      <span>{user.totalCoinsEarned.toLocaleString()}</span>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
