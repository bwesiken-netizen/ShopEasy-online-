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
  Flame, 
  Trophy,
  Play,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

type CropType = '🥭' | '🌽' | '🥑' | '🍌' | '🥔';
const CROPS: CropType[] = ['🥭', '🌽', '🥑', '🍌', '🥔'];

export default function GoGoMatch() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState<number>(0);
  const [dailyGogoCount, setDailyGogoCount] = useState<number>(0);

  // Puzzle State
  const [board, setBoard] = useState<CropType[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [score, setScore] = useState<number>(0);
  const [movesLeft, setMovesLeft] = useState<number>(20);
  const [gameWon, setGameWon] = useState<boolean>(false);
  const [gameLost, setGameLost] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  
  // Claim state
  const [claiming, setClaiming] = useState<boolean>(false);
  const [claimStatus, setClaimStatus] = useState<string>('');
  const [errorText, setErrorText] = useState<string>('');

  const targetGoal = 120; // Reach 120 points to win
  const boardSize = 6; // 6x6 Grid

  const uid = auth.currentUser?.uid;

  // Track user coins and game limits
  useEffect(() => {
    if (!uid) return;

    const userDocRef = doc(db, 'users', uid);
    const unsubUser = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        setCoins(snap.data().coins ?? 0);
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
        setDailyGogoCount(snap.data().gogoCount ?? 0);
      } else {
        setDailyGogoCount(0);
      }
    });

    return () => {
      unsubUser();
      unsubStats();
    };
  }, [uid]);

  // Generate Board
  const initBoard = () => {
    const freshBoard: CropType[] = [];
    for (let i = 0; i < boardSize * boardSize; i++) {
      const crop = CROPS[Math.floor(Math.random() * CROPS.length)];
      freshBoard.push(crop);
    }
    setBoard(freshBoard);
    setScore(0);
    setMovesLeft(20);
    setGameWon(false);
    setGameLost(false);
    setSelectedIdx(null);
    setIsPlaying(true);
  };

  const checkMatches = (currentBoard: CropType[]): { matchedIndices: Set<number>, matchScore: number } => {
    const matched = new Set<number>();
    let matchedCount = 0;

    // Row matches
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize - 2; c++) {
        const idx1 = r * boardSize + c;
        const idx2 = r * boardSize + (c + 1);
        const idx3 = r * boardSize + (c + 2);

        if (currentBoard[idx1] && currentBoard[idx1] === currentBoard[idx2] && currentBoard[idx1] === currentBoard[idx3]) {
          matched.add(idx1);
          matched.add(idx2);
          matched.add(idx3);
        }
      }
    }

    // Col matches
    for (let c = 0; c < boardSize; c++) {
      for (let r = 0; r < boardSize - 2; r++) {
        const idx1 = r * boardSize + c;
        const idx2 = (r + 1) * boardSize + c;
        const idx3 = (r + 2) * boardSize + c;

        if (currentBoard[idx1] && currentBoard[idx1] === currentBoard[idx2] && currentBoard[idx1] === currentBoard[idx3]) {
          matched.add(idx1);
          matched.add(idx2);
          matched.add(idx3);
        }
      }
    }

    if (matched.size > 0) {
      matchedCount = matched.size * 10; // 10 points per matched item
    }

    return { matchedIndices: matched, matchScore: matchedCount };
  };

  const handleTileClick = (index: number) => {
    if (!isPlaying || gameWon || gameLost) return;

    if (selectedIdx === null) {
      setSelectedIdx(index);
    } else {
      // 2nd tile clicked. Verify adjacency
      const diff = Math.abs(selectedIdx - index);
      const isNeighbor = diff === 1 || diff === boardSize;

      if (isNeighbor) {
        // Perform Swap
        const nextBoard = [...board];
        const temp = nextBoard[selectedIdx];
        nextBoard[selectedIdx] = nextBoard[index];
        nextBoard[index] = temp;

        const { matchedIndices, matchScore } = checkMatches(nextBoard);

        if (matchedIndices.size > 0) {
          // Clear matches and spawn new ones
          matchedIndices.forEach(idx => {
            nextBoard[idx] = CROPS[Math.floor(Math.random() * CROPS.length)];
          });

          const newScore = score + matchScore;
          const nextMoves = movesLeft - 1;

          setBoard(nextBoard);
          setScore(newScore);
          setMovesLeft(nextMoves);

          if (newScore >= targetGoal) {
            setGameWon(true);
          } else if (nextMoves <= 0) {
            setGameLost(true);
          }
        } else {
          // Non-matching swap, revert state simply without penalty
          // Alert user microfeedback
        }
      }
      setSelectedIdx(null);
    }
  };

  const handleClaimCoins = async () => {
    if (claiming || !gameWon) return;
    setClaiming(true);
    setErrorText('');
    setClaimStatus('');

    try {
      const submitFn = httpsCallable(functions, 'submitGameResult');
      const response: any = await submitFn({
        gameType: 'gogo-match',
        score: score,
        level: 1
      });

      if (response && response.data && response.data.success) {
        setClaimStatus(`✓ Claimed matches! ${response.data.message}`);
      } else {
        throw new Error('Claim response missing verified attributes.');
      }
    } catch (err: any) {
      console.error('Claim Coins Error:', err);
      setErrorText(err.message || 'Verification of match wins failed on server.');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div id="gogo-match-page" className="min-h-screen bg-slate-50 pb-20 select-none">
      
      {/* Header */}
      <div className="bg-white border-b border-slate-150 py-4 px-4 flex items-center justify-between sticky top-0 z-50">
        <button 
          onClick={() => navigate('/coins')} 
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition"
          id="btn-back-dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-slate-950 font-sans tracking-tight">GoGo Match</span>
        <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-100 text-xs font-bold font-mono">
          <span>🪙 {coins}</span>
        </div>
      </div>

      <div className="max-w-md mx-auto py-5 px-4 space-y-5">
        
        {/* Board Panel Rules */}
        <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between border border-slate-800">
          <div>
            <span className="text-amber-400 text-[10px] font-mono tracking-widest uppercase font-semibold">MALAWIAN HARVEST</span>
            <h2 className="text-lg font-bold tracking-tight">Crops Match Puzzle</h2>
            <p className="text-xs text-slate-400">Match 3 adjacent fruits to stack score!</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-400/20 rounded-lg p-2 text-center text-xs text-amber-400 font-mono font-bold">
            <div>Wins Today</div>
            <div className="text-lg text-white font-extrabold">{dailyGogoCount}/3</div>
          </div>
        </div>

        {/* Dashboard state panel */}
        {isPlaying && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-150 text-center">
              <span className="text-[10px] text-slate-400 font-mono uppercase">TARGET</span>
              <div className="text-lg font-bold text-slate-850 font-mono">{targetGoal} pts</div>
            </div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-150 text-center">
              <span className="text-[10px] text-slate-400 font-mono uppercase">MY SCORE</span>
              <div className="text-lg font-black text-amber-600 font-mono">{score} pts</div>
            </div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-150 text-center">
              <span className="text-[10px] text-slate-400 font-mono uppercase">MOVES LEFT</span>
              <div className="text-lg font-bold text-slate-850 font-mono">{movesLeft}</div>
            </div>
          </div>
        )}

        {/* Play Space Board */}
        {!isPlaying ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-slate-150 space-y-4" id="intro-screen">
            <div className="text-6xl animate-bounce">🥭🌽🥑</div>
            <h3 className="text-lg font-bold">Ready to Match Crops?</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              Match 3 of the same local crops on the board! Reaching <strong>{targetGoal} points</strong> rewards you with <strong>🪙 15 Loyalty Coins</strong> up to 3 times per day.
            </p>
            <button
              onClick={initBoard}
              className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-full transition shadow-md flex items-center gap-1.5 mx-auto active:scale-95"
              id="btn-play-now"
            >
              <Play className="w-4 h-4 fill-white" /> PLAY NOW
            </button>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-2xl p-4 shadow-lg border border-slate-800 flex flex-col items-center">
            
            {/* Grid 6x6 */}
            <div className="grid grid-cols-6 gap-2 w-full aspect-square max-w-[320px]">
              {board.map((crop, idx) => {
                const isSelected = selectedIdx === idx;
                return (
                  <motion.div
                    key={idx}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleTileClick(idx)}
                    className={`aspect-square rounded-xl bg-slate-800 flex items-center justify-center text-2xl cursor-pointer border transition-all ${
                      isSelected 
                        ? 'border-amber-400 bg-amber-400/10 scale-95 ring-2 ring-amber-400/20' 
                        : 'border-slate-700/30'
                    }`}
                  >
                    {crop}
                  </motion.div>
                );
              })}
            </div>

            <div className="w-full flex justify-between p-2 mt-4 text-[11px] text-slate-400 font-mono">
              <span>Click two adjacent fruits to swap.</span>
              <span onClick={initBoard} className="text-amber-400 cursor-pointer hover:underline flex items-center gap-1">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </span>
            </div>
          </div>
        )}

        {/* Win/Lose Modals */}
        <AnimatePresence>
          {gameWon && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gradient-to-br from-emerald-800 to-emerald-950 text-white rounded-xl p-6 shadow-xl text-center space-y-4 border border-emerald-500/20"
              id="win-payout-card"
            >
              <div className="text-5xl">🏆</div>
              <h3 className="text-xl font-bold text-emerald-300">Zikomo! You Won the Level!</h3>
              <p className="text-xs text-slate-200 leading-relaxed max-w-sm mx-auto">
                Excellent matching moves! You reached the {targetGoal} score requirement. Earn real ShopEasy loyalty coins verified securely on our server.
              </p>

              {claimStatus ? (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2 justify-center">
                  <CheckCircle className="w-4 h-4" />
                  <span>{claimStatus}</span>
                </div>
              ) : errorText ? (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs border border-red-100 flex items-center gap-2 justify-center">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errorText}</span>
                </div>
              ) : (
                <button
                  onClick={handleClaimCoins}
                  disabled={claiming}
                  id="btn-claim-gogo"
                  className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-sm rounded-full transition w-full shadow-lg flex items-center justify-center gap-1.5 active:scale-95"
                >
                  {claiming ? (
                    <span className="border-2 border-slate-950 border-t-transparent rounded-full w-4 h-4 animate-spin" />
                  ) : (
                    <>Claim Real E-Coins (+15 🪙)</>
                  )}
                </button>
              )}

              <button 
                onClick={initBoard}
                className="text-xs text-slate-300 hover:underline inline-block"
              >
                Play Another Match
              </button>
            </motion.div>
          )}

          {gameLost && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border rounded-xl p-6 shadow-lg text-center space-y-4"
              id="lost-payout-card"
            >
              <div className="text-5xl">🌾</div>
              <h3 className="text-lg font-bold text-slate-850">Out of Matching Moves...</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                You used all 20 matching moves but did not reach the {targetGoal} goal. Try again to harvest those loyalty coins!
              </p>

              <button
                onClick={initBoard}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition"
              >
                ✓ TRY AGAIN
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
