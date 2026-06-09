import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth, functions, httpsCallable, handleFirestoreError } from '../firebase';
import { OperationType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  HelpCircle, 
  Sparkles, 
  Coins, 
  Calendar, 
  CheckCircle,
  Clock,
  RotateCw,
  Gift,
  AlertCircle
} from 'lucide-react';

export default function PlayEarn() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState<number>(0);
  const [lastSpin, setLastSpin] = useState<string>('');
  const [streak, setStreak] = useState<number>(0);
  const [lastCheckIn, setLastCheckIn] = useState<string>('');
  
  // Spin Wheel State
  const [spinning, setSpinning] = useState<boolean>(false);
  const [spinResult, setSpinResult] = useState<any | null>(null);
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [errorText, setErrorText] = useState<string>('');

  const uid = auth.currentUser?.uid;

  // Segments matching server-side weighted items
  const segments = [
    { index: 0, label: '5 Coins', emoji: '🪙', color: '#FFF3E0' },
    { index: 1, label: '10 Coins', emoji: '🪙', color: '#FFE0B2' },
    { index: 2, label: '20 Coins', emoji: '🪙', color: '#FFCC80' },
    { index: 3, label: '50 Coins', emoji: '💰', color: '#FFB74D' },
    { index: 4, label: '100 Coins', emoji: '👑', color: '#FF9800' },
    { index: 5, label: 'Try Again', emoji: '🍀', color: '#ECEFF1' },
    { index: 6, label: 'Free Coupon', emoji: '🎟️', color: '#E1BEE7' }
  ];

  const getMalawiDateStr = () => {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const mwTime = new Date(utc + (3600000 * 2)); // UTC+2
    return mwTime.toISOString().split('T')[0];
  };

  const todayStr = getMalawiDateStr();
  const holdsFreeSpin = lastSpin !== todayStr;
  const isCheckedInToday = lastCheckIn === todayStr;

  useEffect(() => {
    if (!uid) return;

    const userDocRef = doc(db, 'users', uid);
    const unsub = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCoins(data.coins ?? 0);
        setLastSpin(data.lastSpinDate ?? '');
        setStreak(data.checkInStreak ?? 0);
        setLastCheckIn(data.lastCheckInDate ?? '');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    });

    return () => unsub();
  }, [uid]);

  const handleSpin = async () => {
    if (spinning) return;
    setErrorText('');
    setSpinResult(null);

    if (!holdsFreeSpin && coins < 20) {
      setErrorText('Insufficient balance. Daily free spin is used. Paid spin costs 20 Coins!');
      return;
    }

    setSpinning(true);

    try {
      // 1. Fetch server-side secure spin output before animating!
      const spinFn = httpsCallable(functions, 'spinWheel');
      const response: any = await spinFn();
      
      if (response && response.data && response.data.success) {
        const { segmentIndex, prize } = response.data;

        // 2. Animate rotation to matched segment index
        // Each segment takes 360 / segments.length degrees (approx 51.4 degrees for 7 segments)
        const segmentsCount = segments.length;
        const segmentDegrees = 360 / segmentsCount;
        
        // Calculate dynamic degrees to align arrow at the top (0 deg/360 deg is first element)
        // Offset is index * segments degrees. Subtract from 360 to rotate clockwise
        const offsetDegrees = 360 - (segmentIndex * segmentDegrees);
        
        // Multiple full spins (e.g., 5 rotations = 1800 deg) to look incredible!
        const extraSpins = 5;
        const targetRotation = (extraSpins * 360) + offsetDegrees;

        setWheelRotation(targetRotation);

        // 3. Highlight result after smooth transition completes (3.5 seconds)
        setTimeout(() => {
          setSpinning(false);
          setSpinResult(response.data);
        }, 3600);
      } else {
        throw new Error('Server returned an invalid result format.');
      }
    } catch (err: any) {
      console.error('Spin Failure:', err);
      setErrorText(err.message || 'Error occurred while spinning the wheel.');
      setSpinning(false);
    }
  };

  return (
    <div id="play-earn-page" className="min-h-screen bg-slate-50 pb-20">
      
      {/* Sticky Header */}
      <div className="bg-white border-b border-slate-150 py-4 px-4 flex items-center justify-between sticky top-0 z-50">
        <button 
          onClick={() => navigate('/coins')} 
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition"
          id="btn-back-coins"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-slate-950 font-sans tracking-tight">Lucky Spin Wheel</span>
        <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-100 text-xs font-bold font-mono">
          <span>🪙 {coins.toLocaleString()}</span>
        </div>
      </div>

      <div className="max-w-md mx-auto py-5 px-4 space-y-6">
        
        {/* Banner */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl p-5 shadow-md relative overflow-hidden">
          <div className="absolute right-0 bottom-0 top-0 opacity-10 flex items-center justify-center pointer-events-none">
            <RotateCw className="w-24 h-24 animate-spin-slow" />
          </div>
          <div className="relative z-10 space-y-1">
            <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-sans font-black tracking-wider uppercase">
              Free Daily Fortune
            </span>
            <h2 className="text-xl font-bold tracking-tight mt-1.5">Lucky Wheel Daily Spin</h2>
            <p className="text-xs text-indigo-100 leading-relaxed">
              Every day you get <strong>one free spin</strong> with guaranteed prizes from direct e-coins up to premium shopping coupons!
            </p>
          </div>
        </div>

        {/* Spin Wheel Main Area */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-150 text-center space-y-6 flex flex-col items-center relative">
          
          {/* Top Indicator Arrow */}
          <div className="absolute top-4 z-20 flex flex-col items-center">
            <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] border-t-amber-500 filter drop-shadow" />
            <div className="w-3 h-3 bg-amber-600 rounded-full border-2 border-white -mt-1 shadow" />
          </div>

          {/* Secure Spin Wheel Component */}
          <div id="wheel-outer-wrapper" className="relative w-64 h-64 mt-4 drop-shadow-xl select-none">
            {/* Round border element */}
            <div className="absolute inset-0 rounded-full border-[8px] border-slate-900 bg-slate-900 z-10 pointer-events-none" />
            
            {/* Spinning panel */}
            <div 
              id="wheel-rotor"
              className="w-full h-full rounded-full overflow-hidden relative"
              style={{
                transform: `rotate(${wheelRotation}deg)`,
                transition: spinning ? 'transform 3.5s cubic-bezier(0.1, 0.8, 0.25, 1)' : 'none',
              }}
            >
              {/* Segments drawing */}
              {segments.map((seg, i) => {
                const total = segments.length;
                const angle = 360 / total;
                const rotateDeg = i * angle;
                const skewY = 90 - angle; // skew to form perfect triangles
                
                return (
                  <div 
                    key={seg.index}
                    className="absolute top-0 right-0 w-1/2 h-1/2 origin-bottom-left"
                    style={{
                      transform: `rotate(${rotateDeg}deg) skewY(-${skewY}deg)`,
                      backgroundColor: seg.color,
                      borderLeft: '1px solid rgba(0,0,0,0.06)'
                    }}
                  >
                    {/* Segment content unskewed */}
                    <div 
                      className="absolute bottom-4 left-4"
                      style={{
                        transform: `skewY(${skewY}deg) rotate(${(angle / 2) + 90}deg)`,
                        transformOrigin: '50% 100%'
                      }}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-lg">{seg.emoji}</span>
                        <span className="text-[10px] font-mono font-bold tracking-tight text-slate-800 rotate-180 whitespace-nowrap mt-1">
                          {seg.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Glowing wheel center pin */}
            <div className="absolute inset-0 m-auto w-12 h-12 bg-slate-900 rounded-full border-4 border-amber-400 z-20 flex items-center justify-center font-bold text-amber-400 shadow-lg cursor-pointer">
              🎡
            </div>
          </div>

          {/* Spin CTA Controls */}
          <div className="w-full space-y-2.5">
            <button
              id="btn-spin-wheel"
              onClick={handleSpin}
              disabled={spinning}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-sm tracking-wide ${
                spinning 
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg shadow-amber-500/25 active:scale-[98%]'
              }`}
            >
              {spinning ? (
                <>
                  <RotateCw className="w-5 h-5 animate-spin" />
                  Spinning Wheel of Fortune...
                </>
              ) : holdsFreeSpin ? (
                <>
                  <Sparkles className="w-5 h-5 text-amber-200 animate-pulse" />
                  SPIN FREE TODAY!
                </>
              ) : (
                <>
                  <Coins className="w-5 h-5" />
                  SPIN AGAIN (Costs 🪙 20 Coins)
                </>
              )}
            </button>

            {errorText && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-xs border border-red-150 text-left justify-center">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorText}</span>
              </div>
            )}

            {!spinning && (
              <p className="text-xs text-slate-400 font-mono">
                {holdsFreeSpin 
                  ? "✓ Your free daily spin is ready. Good luck!" 
                  : "Additional spins deduct 20 Coins. Prizes verify on server."}
              </p>
            )}
          </div>
        </div>

        {/* Spin Result Claims Alert / Card */}
        <AnimatePresence>
          {spinResult && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              id="spin-result-card"
              className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-xl p-6 shadow-xl border-2 border-amber-400 text-center relative overflow-hidden"
            >
              <div className="absolute -top-12 -right-12 w-28 h-28 bg-amber-400/10 rounded-full blur-xl" />
              <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-purple-500/15 rounded-full blur-xl" />

              <div className="text-4xl bg-amber-400/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 border border-amber-400/20">
                {spinResult.prize.emoji}
              </div>
              
              <h3 className="text-lg font-black tracking-tight text-amber-400">
                {spinResult.message}
              </h3>
              
              <p className="text-xs text-slate-300 mt-2 leading-relaxed max-w-xs mx-auto">
                {spinResult.coinsEarned > 0 
                  ? `Authenticated credit applied successfully! Your updated loyalty balance is 🪙 ${spinResult.totalCoins.toLocaleString()} Coins.`
                  : spinResult.couponCode 
                    ? `Your special promotional checkout claim code is ${spinResult.couponCode}. This has been saved immediately to your coupons vault!`
                    : "Thanks for participating! Try again with options above."}
              </p>

              <button 
                onClick={() => setSpinResult(null)}
                className="mt-5 px-6 py-2 bg-amber-500 hover:bg-amber-600 font-bold text-slate-950 text-xs rounded-full transition shadow-sm active:scale-95"
              >
                ✓ COOL, THANKS!
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Earning Games Hub Redirect Tiles */}
        <div className="space-y-3">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Gift className="w-4 h-4 text-purple-600" /> Play More Games
          </h3>
          
          <div className="grid grid-cols-2 gap-3">
            <div 
              onClick={() => navigate('/coins/gogo-match')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-amber-400 transition text-center cursor-pointer hover:shadow-sm"
              id="card-game-gogo"
            >
              <div className="text-3xl mb-1.5">🥭</div>
              <h4 className="font-bold text-slate-950 text-xs text-ellipsis overflow-hidden">GoGo Match</h4>
              <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">Agricultural match-3</p>
              <span className="inline-block mt-2.5 bg-amber-50 border border-amber-100 text-amber-800 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                +15 Coins / win
              </span>
            </div>

            <div 
              onClick={() => navigate('/coins/merge-boss')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-purple-400 transition text-center cursor-pointer hover:shadow-sm"
              id="card-game-merge"
            >
              <div className="text-3xl mb-1.5">📦</div>
              <h4 className="font-bold text-slate-950 text-xs text-ellipsis overflow-hidden">Merge Boss</h4>
              <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">Malawi shop supply</p>
              <span className="inline-block mt-2.5 bg-purple-50 border border-purple-100 text-purple-800 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                +5-30 Coins / order
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
