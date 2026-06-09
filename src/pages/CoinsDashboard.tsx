import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDoc 
} from 'firebase/firestore';
import { db, auth, functions, httpsCallable, handleFirestoreError } from '../firebase';
import { OperationType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Coins, 
  Calendar, 
  Award, 
  History, 
  ChevronRight, 
  Flame, 
  Sparkles, 
  Info,
  Gift,
  ArrowDownLeft,
  ArrowUpRight,
  HelpCircle,
  Trophy
} from 'lucide-react';

interface CoinTransaction {
  id: string;
  userId: string;
  amount: number;
  type: string;
  description: string;
  createdAt: any;
}

export default function CoinsDashboard() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [lastCheckIn, setLastCheckIn] = useState<string>('');
  const [loadingCheckIn, setLoadingCheckIn] = useState<boolean>(false);
  
  // Settings
  const [redemptionRate, setRedemptionRate] = useState<number>(1); // e.g., 1 coin = 1 MWK value
  const [checkInRewards, setCheckInRewards] = useState<number[]>([10, 15, 20, 25, 30, 35, 40]);
  
  // History & tabs
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [showInfo, setShowInfo] = useState<boolean>(false);

  const user = auth.currentUser;
  const uid = user?.uid;

  // Calculate Malawi date string YYYY-MM-DD
  const getMalawiTodayStr = () => {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const mwTime = new Date(utc + (3600000 * 2)); // UTC+2
    return mwTime.toISOString().split('T')[0];
  };

  const todayStr = getMalawiTodayStr();
  const isCheckedInToday = lastCheckIn === todayStr;

  useEffect(() => {
    if (!uid) return;

    // 1. Real-time listener for User Coins balance, streak, last checkin
    const userDocRef = doc(db, 'users', uid);
    const unsubUser = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setCoins(data.coins ?? 0);
        setStreak(data.checkInStreak ?? 0);
        setLastCheckIn(data.lastCheckInDate ?? '');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    });

    // 2. Fetch config settings
    const configDocRef = doc(db, 'config', 'coinsSettings');
    getDoc(configDocRef).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setRedemptionRate(data.redemptionRate ?? 1);
        if (data.checkInRewards && Array.isArray(data.checkInRewards)) {
          setCheckInRewards(data.checkInRewards);
        }
      }
    }).catch((err) => {
      console.warn("Failed retrieving standard coins settings documents:", err);
    });

    // 3. Keep real-time historical log of user coin updates
    const txColRef = collection(db, 'coinTransactions');
    const txQuery = query(
      txColRef,
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubTx = onSnapshot(txQuery, (snapshot) => {
      const txsList: CoinTransaction[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        txsList.push({
          id: doc.id,
          userId: d.userId,
          amount: d.amount,
          type: d.type,
          description: d.description,
          createdAt: d.createdAt ? d.createdAt.toDate() : new Date()
        });
      });
      setTransactions(txsList);
      setLoadingHistory(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'coinTransactions');
    });

    return () => {
      unsubUser();
      unsubTx();
    };
  }, [uid]);

  const handleCheckIn = async () => {
    if (loadingCheckIn || isCheckedInToday) return;
    setLoadingCheckIn(true);
    try {
      const checkInFn = httpsCallable(functions, 'dailyCheckIn');
      const response: any = await checkInFn();
      if (response.data && response.data.success) {
        // Updated via real-time listeners automatically
        alert(response.data.message || '✓ Verified Check-In complete!');
      }
    } catch (err: any) {
      console.error("Check-In failed:", err);
      alert(err.message || "Unable to process check-in right now.");
    } finally {
      setLoadingCheckIn(false);
    }
  };

  const getTxStyles = (amount: number) => {
    return amount > 0 
      ? { color: 'text-emerald-600 font-medium', bg: 'bg-emerald-50 text-emerald-600', sign: '+' } 
      : { color: 'text-amber-600 font-medium', bg: 'bg-amber-50 text-amber-600', sign: '' };
  };

  const currentRedemptionValue = coins * redemptionRate;

  return (
    <div id="coins-dashboard" className="min-h-screen bg-slate-50 pb-20">
      {/* Golden Header Panel */}
      <div className="bg-gradient-to-b from-amber-500 to-amber-600 text-white pt-8 pb-12 px-5 sticky top-0 z-40 shadow-md">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <Coins className="w-6 h-6 animate-pulse text-amber-100" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-sans tracking-tight">Coins & Rewards</h1>
              <p className="text-xs text-amber-100 font-mono">Malawi Marketplace Rewards</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowInfo(!showInfo)} 
              id="btn-info-toggle"
              className="p-2 bg-white/15 rounded-full hover:bg-white/25 transition-all text-white border border-white/5"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button 
              onClick={() => navigate('/coins/leaderboard')}
              id="btn-nav-leaderboard"
              className="p-2 bg-white/15 rounded-full hover:bg-white/25 transition-all text-white border border-white/5 flex items-center gap-1.5"
              title="Coin Leaderboard"
            >
              <Trophy className="w-5 h-5 text-yellow-200" />
            </button>
          </div>
        </div>

        {/* Dynamic Balance Card */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden border border-amber-400/20"
        >
          {/* Subtle decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-amber-600/15 rounded-full blur-xl" />

          <div className="flex items-center justify-between">
            <div>
              <span className="text-amber-400 text-xs font-mono uppercase tracking-widest font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> SHOPPING BALANCE
              </span>
              <div className="text-4xl font-extrabold mt-1 tracking-tight flex items-baseline gap-2 font-mono text-amber-100">
                <span>🪙 {coins.toLocaleString()}</span>
                <span className="text-sm font-sans font-normal text-slate-400">Coins</span>
              </div>
              <p className="text-sm text-slate-300 mt-2 flex items-center gap-1.5">
                Valued at: <strong className="text-white text-base">MWK {currentRedemptionValue.toLocaleString()}</strong> 
                <span className="text-xs text-slate-400">({redemptionRate} MWK / coin)</span>
              </p>
            </div>
            
            {streak > 0 && (
              <div className="bg-amber-500/10 border border-amber-400/20 px-3.5 py-2.5 rounded-xl flex flex-col items-center">
                <Flame className="w-6 h-6 text-amber-400 animate-bounce" />
                <span className="text-xs font-mono font-bold mt-1 text-amber-200">{streak} Days</span>
                <span className="text-[9px] text-slate-400">Streak</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Main Content Areas */}
      <div className="px-4 -mt-6 relative z-10 space-y-5">
        
        {/* Help Info Box */}
        <AnimatePresence>
          {showInfo && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-amber-50 border border-amber-200 text-slate-800 p-4 rounded-xl shadow-inner text-sm space-y-2 overflow-hidden"
            >
              <h3 className="font-bold text-amber-800 flex items-center gap-1.5 font-sans">
                <Info className="w-4 h-4" /> Understanding Loyalty Coins
              </h3>
              <p className="text-xs leading-relaxed text-slate-600">
                ShopEasy Loyalty E-Coins are earned by completing agricultural games, daily check-ins, or purchasing products on the platform. Every <strong>{100} Coins</strong> can be redeemed at checkout for discounts up to <strong>MWK 5,000</strong> on orders from any trusted Malawian merchant.
              </p>
              <ul className="text-[11px] list-disc list-inside space-y-1 text-slate-500 font-mono">
                <li>100 Coins = MWK {100 * redemptionRate} Checkout Worth</li>
                <li>Daily Check-in awards larger bonuses based on streaks</li>
                <li>Games reward e-coins instantly up to server daily caps</li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Daily Bonus Section */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900 flex items-center gap-2 text-md">
              <Calendar className="w-5 h-5 text-amber-500" /> Collect Daily Rewards
            </h2>
            <span className="text-xs text-slate-400 font-mono">Streak cycle resets after day 7</span>
          </div>

          {/* Stepper calendar */}
          <div className="grid grid-cols-7 gap-1.5 mb-5 overflow-x-auto">
            {checkInRewards.map((amt, idx) => {
              const dayNum = idx + 1;
              const isMatched = streak >= dayNum;
              const isTodayPotential = streak + 1 === dayNum || (streak === 0 && dayNum === 1);
              
              return (
                <div 
                  key={idx}
                  className={`flex flex-col items-center p-2 rounded-lg border text-center transition-all ${
                    isMatched 
                      ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                      : isTodayPotential && !isCheckedInToday
                        ? 'bg-amber-50 border-amber-300 border-dashed text-slate-700 animate-pulse'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  <span className="text-[10px] font-mono tracking-wider">Day {dayNum}</span>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center my-1.5 text-xs font-bold ${
                    isMatched ? 'bg-white text-amber-600' : 'bg-transparent'
                  }`}>
                    🪙
                  </div>
                  <span className="text-[11px] font-bold">+{amt}</span>
                </div>
              );
            })}
          </div>

          <button
            id="btn-daily-checkin"
            onClick={handleCheckIn}
            disabled={isCheckedInToday || loadingCheckIn}
            className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              isCheckedInToday 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg shadow-amber-500/20 active:scale-[98%]'
            }`}
          >
            {loadingCheckIn ? (
              <span className="border-2 border-white border-t-transparent rounded-full w-5 h-5 animate-spin" />
            ) : isCheckedInToday ? (
              <>✓ Checked In Successfully Today (Streak: {streak} days)</>
            ) : (
              <>Collect Today's Coin Bonus (+{checkInRewards[Math.min(streak, 6)]} Coins)</>
            )}
          </button>
        </div>

        {/* Visual Game Launcher (Play & Earn Center) */}
        <div className="bg-slate-900 text-white rounded-xl p-5 shadow-lg relative overflow-hidden border border-slate-800">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Gift className="w-24 h-24 rotate-12" />
          </div>
          
          <div className="relative z-10">
            <span className="bg-amber-500 text-slate-950 font-sans font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider">
              Play & Earn Coins
            </span>
            <h2 className="text-xl font-bold tracking-tight mt-2.5">ShopEasy Game Cabinet</h2>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              Fulfill customer requests, merge products, or test match-3 boards to earn Malawian e-coins.
            </p>

            <div className="grid grid-cols-1 gap-3.5 mt-5">
              
              {/* GoGo Match */}
              <div 
                onClick={() => navigate('/coins/gogo-match')}
                id="tile-gogo-match"
                className="bg-slate-800 hover:bg-slate-755 border border-slate-700/50 hover:border-amber-500/30 p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="text-3xl bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">🥭</div>
                  <div>
                    <h3 className="font-bold text-slate-100 flex items-center gap-1.5">
                      GoGo Match <span className="text-[10px] text-amber-400 bg-amber-404/10 px-1.5 py-0.5 rounded font-mono font-medium">Earn +15/lvl</span>
                    </h3>
                    <p className="text-xs text-slate-400">Agricultural Malawi matching puzzle. Easy fun!</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500" />
              </div>

              {/* Merge Boss */}
              <div 
                onClick={() => navigate('/coins/merge-boss')}
                id="tile-merge-boss"
                className="bg-slate-800 hover:bg-slate-755 border border-slate-700/50 hover:border-amber-500/30 p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="text-3xl bg-purple-500/10 p-2 rounded-xl border border-purple-500/20">📦</div>
                  <div>
                    <h3 className="font-bold text-slate-100 flex items-center gap-1.5">
                      Merge Boss <span className="text-[10px] text-purple-400 bg-purple-404/10 px-1.5 py-0.5 rounded font-mono font-medium">Earn +5-30/ord</span>
                    </h3>
                    <p className="text-xs text-slate-400">Run a Malawi farm shop. Merge and deliver crops!</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500" />
              </div>

              {/* Spin Wheel */}
              <div 
                onClick={() => navigate('/coins/play-earn')}
                id="tile-spin-wheel"
                className="bg-slate-800 hover:bg-slate-755 border border-slate-700/50 hover:border-amber-500/30 p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="text-3xl bg-sky-500/10 p-2 rounded-xl border border-sky-500/20">🎡</div>
                  <div>
                    <h3 className="font-bold text-slate-100 flex items-center gap-1.5">
                      Lucky Spin Wheel <span className="text-[10px] text-sky-400 bg-sky-404/10 px-1.5 py-0.5 rounded font-mono font-medium">Win up to 100</span>
                    </h3>
                    <p className="text-xs text-slate-400">Spin daily for free! Win e-coins or discount coupons.</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500" />
              </div>

            </div>
          </div>
        </div>

        {/* Earning Methods List / Guide */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h2 className="font-bold text-slate-900 flex items-center gap-2 mb-4 text-md">
            <Award className="w-5 h-5 text-amber-500" /> How to Earn Loyalty Coins
          </h2>
          <div className="space-y-3">
            {[
              { title: "Review Purchased Items", payout: "15 Coins", desc: "Write authentic feedback on items purchased with stars to unlock coins." },
              { title: "Daily Check-in Streaks", payout: "Capped at 40 Coins", desc: "Open the Coins hub every day to collect free, exponentially growing rewards." },
              { title: "Checkout Rewards Program", payout: "1% of Spent Value", desc: "Earn 100 Loyalty Coins for every MWK 10,000 spent on any finalized merchant order." },
              { title: "Weekly Leaderboard Podiums", payout: "Up to 500 Coins", desc: "Top 3 weekly e-coin champions split special platform bonus cash vouchers." }
            ].map((method, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                <div className="bg-amber-100 text-amber-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 font-mono">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-850">{method.title}</h4>
                    <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">{method.payout}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{method.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coins History Log */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h2 className="font-bold text-slate-900 flex items-center gap-2 mb-4 text-md">
            <History className="w-5 h-5 text-amber-500" /> Coins History Log
          </h2>

          <div className="space-y-2.5">
            {loadingHistory ? (
              <div className="space-y-2 py-5" id="loader-history">
                <div className="h-6 bg-slate-100 rounded animate-pulse" />
                <div className="h-6 bg-slate-100 rounded animate-pulse" />
                <div className="h-6 bg-slate-100 rounded animate-pulse" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm" id="empty-history">
                <p>No coin transaction records found.</p>
                <p className="text-xs mt-1">Start by checking in or initiating games to earn coins!</p>
              </div>
            ) : (
              transactions.map((tx) => {
                const style = getTxStyles(tx.amount);
                return (
                  <div 
                    key={tx.id} 
                    className="flex justify-between items-center p-3 hover:bg-slate-50 transition-all rounded-xl border border-slate-150 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-full font-bold font-mono text-xs ${style.bg}`}>
                        {tx.amount > 0 ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{tx.description}</h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {tx.createdAt.toLocaleString()} • {tx.type.split('_').join(' ').toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <span className={`font-mono text-sm ${style.color}`}>
                      {style.sign}{tx.amount}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
