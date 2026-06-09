import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth, functions, httpsCallable, handleFirestoreError } from '../firebase';
import { OperationType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  HelpCircle, 
  RotateCcw, 
  Coins, 
  Sparkles, 
  CheckCircle2, 
  Package, 
  AlertCircle,
  TrendingUp,
  Database
} from 'lucide-react';

interface MergeItem {
  id: string; // unique slot id
  level: number; // 0 for empty, 1 to 5 for merge levels
}

interface CustomerOrder {
  id: string;
  name: string;
  targetLevel: number;
  rewardCoins: number;
  emoji: string;
}

const ITEMS_META = [
  { level: 0, name: 'Empty Land', emoji: '🟫', desc: 'Ready for seeds' },
  { level: 1, name: 'Sprouting Seed', emoji: '🌱', desc: 'Needs nutrients' },
  { level: 2, name: 'Budding Shoot', emoji: '🌿', desc: 'Growing taller' },
  { level: 3, name: 'Malawi Maize Head', emoji: '🌽', desc: 'Thriving locally' },
  { level: 4, name: 'Golden Flour Sack', emoji: '🌾', desc: 'Milled to perfection' },
  { level: 5, name: 'Organic Cornbread', emoji: '🍞', desc: 'Premium farm baked' }
];

export default function MergeBoss() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState<number>(0);
  const [board, setBoard] = useState<MergeItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Stats
  const [energy, setEnergy] = useState<number>(40);
  const [dailyMergeCoins, setDailyMergeCoins] = useState<number>(0);
  const [savingState, setSavingState] = useState<boolean>(false);

  // Active orders generated based on board capabilities
  const [orders, setOrders] = useState<CustomerOrder[]>([
    { id: 'ord_1', name: 'Zomba Cafe Special', targetLevel: 3, rewardCoins: 15, emoji: '🌽' },
    { id: 'ord_2', name: 'Lilongwe Flour Mill', targetLevel: 4, rewardCoins: 20, emoji: '🌾' },
    { id: 'ord_3', name: 'Blantyre Farm Stall', targetLevel: 5, rewardCoins: 30, emoji: '🍞' }
  ]);

  // Alert State
  const [notice, setNotice] = useState<string>('');
  const [errorText, setErrorText] = useState<string>('');
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const boardSize = 25; // 5x5 Grid

  const uid = auth.currentUser?.uid;

  // Track user profile, balance, mergeBossState and daily limits
  useEffect(() => {
    if (!uid) return;

    const userDocRef = doc(db, 'users', uid);
    const unsubUser = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const uData = snap.data();
        setCoins(uData.coins ?? 0);
        
        // Restore board from Firestore
        if (uData.mergeBossState) {
          try {
            const parsed = JSON.parse(uData.mergeBossState);
            if (Array.isArray(parsed) && parsed.length === boardSize) {
              setBoard(parsed);
            } else {
              initializeFreshBoard();
            }
          } catch (e) {
            initializeFreshBoard();
          }
        } else {
          initializeFreshBoard();
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    });

    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const mwTime = new Date(utc + (3600000 * 2)); // Malawi is UTC+2
    const dateStr = mwTime.toISOString().split('T')[0];

    // Listen to daily stats
    const statsDocRef = doc(db, 'users', uid, 'gameStats', dateStr);
    const unsubStats = onSnapshot(statsDocRef, (snap) => {
      if (snap.exists()) {
        setDailyMergeCoins(snap.data().mergeCoins ?? 0);
      } else {
        setDailyMergeCoins(0);
      }
    });

    return () => {
      unsubUser();
      unsubStats();
    };
  }, [uid]);

  const initializeFreshBoard = () => {
    const list: MergeItem[] = [];
    for (let i = 0; i < boardSize; i++) {
      // Spawn standard seed or weeds on 4 slots to begin
      let level = 0;
      if (i === 6 || i === 8) level = 1;
      if (i === 12) level = 2;
      list.push({ id: `slot_${i}`, level });
    }
    setBoard(list);
  };

  // Auto-save board state to database
  const saveStateToCloud = async (currentBoard: MergeItem[]) => {
    if (!uid) return;
    setSavingState(true);
    try {
      const submitFn = httpsCallable(functions, 'submitGameResult');
      await submitFn({
        gameType: 'merge-boss',
        rawState: JSON.stringify(currentBoard)
      });
    } catch (e) {
      console.error("AutoSaving state failed:", e);
    } finally {
      setSavingState(false);
    }
  };

  const handleSpawnItem = () => {
    if (energy <= 0) {
      setNotice('Out of generator baskets! Wait for energy to regenerate.');
      return;
    }

    // Find first empty slot
    const emptyIndices = board
      .map((item, idx) => (item.level === 0 ? idx : -1))
      .filter((idx) => idx !== -1);

    if (emptyIndices.length === 0) {
      setNotice('No empty slots on your farm! Clear or deliver some items first.');
      return;
    }

    const randomSlot = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    const nextBoard = [...board];
    nextBoard[randomSlot] = { id: `slot_${randomSlot}`, level: 1 }; // Spawn seed sprout level 1

    setBoard(nextBoard);
    setEnergy(energy - 1);
    setNotice('Seed basket delivered! 🌱 Seed planted successfully.');

    // Save
    saveStateToCloud(nextBoard);
  };

  const handleSlotClick = (id: string, level: number) => {
    setNotice('');
    setErrorText('');

    if (selectedId === null) {
      if (level === 0) return; // Cannot select empty
      setSelectedId(id);
    } else {
      if (selectedId === id) {
        // Toggle selection off
        setSelectedId(null);
        return;
      }

      const prevIdx = board.findIndex((x) => x.id === selectedId);
      const curIdx = board.findIndex((x) => x.id === id);

      if (prevIdx === -1 || curIdx === -1) {
        setSelectedId(null);
        return;
      }

      const prevItem = board[prevIdx];
      const curItem = board[curIdx];

      // Merge check
      if (prevItem.level === curItem.level && prevItem.level > 0 && prevItem.level < 5) {
        // Successful merge! Upgrade target level, clear source
        const nextBoard = [...board];
        nextBoard[curIdx] = { id: id, level: prevItem.level + 1 };
        nextBoard[prevIdx] = { id: selectedId, level: 0 };

        setBoard(nextBoard);
        setNotice(`✓ Upgraded item level successfully to ${ITEMS_META[prevItem.level + 1].name}!`);
        setSelectedId(null);

        // Auto Save Board
        saveStateToCloud(nextBoard);
      } else {
        // Not matching levels, just swap selection anchor
        if (level > 0) {
          setSelectedId(id);
        } else {
          // Move item to empty slot
          const nextBoard = [...board];
          nextBoard[curIdx] = { id: id, level: prevItem.level };
          nextBoard[prevIdx] = { id: selectedId, level: 0 };
          
          setBoard(nextBoard);
          setSelectedId(null);
          saveStateToCloud(nextBoard);
        }
      }
    }
  };

  const handleFillOrder = async (orderId: string, levelNeeded: number) => {
    if (isBusy) return;
    setIsBusy(true);
    setNotice('');
    setErrorText('');

    // Check if levelNeeded exists on board
    const foundIdx = board.findIndex((item) => item.level === levelNeeded);
    if (foundIdx === -1) {
      setErrorText(`Failed! You do not have ${ITEMS_META[levelNeeded].name} on the board to fulfill.`);
      setIsBusy(false);
      return;
    }

    try {
      // 1. Send transaction to cloud function
      const submitFn = httpsCallable(functions, 'submitGameResult');
      
      // Update board layout to remove merged crop before sending progress
      const nextBoard = [...board];
      nextBoard[foundIdx] = { id: board[foundIdx].id, level: 0 }; // Consume crop

      const response: any = await submitFn({
        gameType: 'merge-boss',
        rewardType: 'order_filled',
        level: levelNeeded,
        rawState: JSON.stringify(nextBoard)
      });

      if (response && response.data && response.data.success) {
        setBoard(nextBoard);
        setNotice(response.data.message);
        
        // Regenerate order to randomize things
        const randLevel = Math.floor(2 + Math.random() * 4); // level 2 to 5
        setOrders(orders.map((ord) => {
          if (ord.id === orderId) {
            return {
              id: ord.id,
              name: ord.name,
              targetLevel: randLevel,
              rewardCoins: randLevel * 5,
              emoji: ITEMS_META[randLevel].emoji
            };
          }
          return ord;
        }));
      } else {
        throw new Error('Verification failed.');
      }
    } catch (e: any) {
      console.error("Order completion failed:", e);
      setErrorText(e.message || "Failed validating complete level rewards.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div id="merge-boss-page" className="min-h-screen bg-slate-50 pb-20 select-none">
      
      {/* Header */}
      <div className="bg-white border-b border-slate-150 py-4 px-4 flex items-center justify-between sticky top-0 z-50">
        <button 
          onClick={() => navigate('/coins')} 
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition"
          id="btn-back-from-merge"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-slate-950 font-sans tracking-tight">Merge Boss</span>
        <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-100 text-xs font-bold font-mono">
          <span>🪙 {coins}</span>
        </div>
      </div>

      <div className="max-w-md mx-auto py-5 px-4 space-y-4">
        
        {/* State Banner */}
        <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between border border-slate-800">
          <div>
            <span className="text-purple-400 text-[10px] font-mono tracking-widest uppercase font-semibold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> MERGE & FULFILL
            </span>
            <h2 className="text-lg font-bold tracking-tight">Farm Supply Shop</h2>
            <p className="text-xs text-slate-400">Join same items to bake luxury cornbread.</p>
          </div>
          <div className="bg-purple-500/10 border border-purple-400/20 rounded-lg p-2.5 text-center text-xs text-purple-400 font-mono font-bold">
            <div>Limit Earned</div>
            <div className="text-sm text-white font-extrabold">{dailyMergeCoins}/100 🪙</div>
          </div>
        </div>

        {/* Customer Orders */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-150">
          <h3 className="font-bold text-slate-850 text-xs flex items-center gap-1.5 mb-3 uppercase tracking-wider">
            <Package className="w-4 h-4 text-purple-500" /> Farm Customer Requests
          </h3>

          <div className="space-y-2.5">
            {orders.map((ord) => {
              const matchesExist = board.some((item) => item.level === ord.targetLevel);
              return (
                <div key={ord.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-150 rounded-xl text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl bg-white p-1 rounded-lg shadow-inner">{ord.emoji}</span>
                    <div>
                      <h4 className="font-bold text-slate-800">{ord.name}</h4>
                      <p className="text-slate-400 mt-0.5 text-[10px]">Needs level {ord.targetLevel} {ITEMS_META[ord.targetLevel].name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                      +{ord.rewardCoins} 🪙
                    </span>
                    <button
                      onClick={() => handleFillOrder(ord.id, ord.targetLevel)}
                      disabled={isBusy}
                      className={`px-3 py-1.5 font-bold rounded-lg transition ${
                        matchesExist 
                          ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm' 
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      Deliver
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Energy & Generator controls */}
        <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-slate-150">
          <div className="flex items-center gap-1">
            <span className="text-xl">🧺</span>
            <span className="text-xs font-bold text-slate-800" id="energy-counter">Energy: {energy}/40</span>
          </div>

          <div className="flex items-center gap-2">
            {savingState && (
              <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                <Database className="w-3 h-3 animate-spin" /> Saving...
              </span>
            )}
            <button
              id="btn-spawn-product"
              onClick={handleSpawnItem}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 font-bold text-white rounded-lg transition text-xs shadow-md"
            >
              Plant Crops Seed (-1 Energy)
            </button>
          </div>
        </div>

        {/* Notices */}
        {notice && (
          <div className="p-3 bg-purple-50 text-purple-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notice}</span>
          </div>
        )}

        {errorText && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs border border-red-100 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{errorText}</span>
          </div>
        )}

        {/* Layout Board Grid 5x5 */}
        <div className="bg-slate-900 rounded-2xl p-4 shadow-inner border border-slate-800">
          <div className="grid grid-cols-5 gap-2 w-full aspect-square max-w-[340px] mx-auto">
            {board.map((item) => {
              const isSelected = selectedId === item.id;
              const meta = ITEMS_META[item.level];
              return (
                <div
                  key={item.id}
                  onClick={() => handleSlotClick(item.id, item.level)}
                  className={`aspect-square rounded-xl bg-slate-800 flex flex-col items-center justify-center cursor-pointer border relative transition-all ${
                    isSelected 
                      ? 'border-yellow-400 bg-yellow-400/10 scale-95 ring-2 ring-yellow-400/20' 
                      : 'border-slate-800/20 hover:border-slate-700/50'
                  }`}
                >
                  <span className="text-2.5xl">{meta?.emoji}</span>
                  {item.level > 0 && (
                    <span className="absolute bottom-1 right-1 bg-slate-950 text-slate-100 font-bold font-mono text-[9px] px-1.5 py-0.2 rounded-full border border-slate-800 scale-90">
                      L{item.level}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="p-2 text-center text-[10px] text-slate-400 font-mono mt-2 flex items-center justify-center gap-1.5">
            <span>Tap crop to select. Tap empty land to move, or identical crop level to <strong>MERGE</strong>!</span>
          </div>
        </div>

        {/* Levels Guide Sheet */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-155">
          <h4 className="font-bold text-slate-850 text-xs mb-2.5 uppercase tracking-wider">🌾 Agricultural Merge Recipe Guide</h4>
          <div className="grid grid-cols-5 gap-1 font-mono text-center">
            {ITEMS_META.slice(1).map((m) => (
              <div key={m.level} className="p-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                <span className="text-lg block">{m.emoji}</span>
                <span className="text-[9px] font-bold block text-slate-800 mt-1">L{m.level}</span>
                <span className="text-[8px] text-slate-400 block truncate scale-90 mt-0.5">{m.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
