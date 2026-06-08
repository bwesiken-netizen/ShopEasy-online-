import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { ArrowRight, Sparkles, LogIn, ShieldAlert, Mail, Lock } from 'lucide-react';
import { auth } from '../firebase';
import { sendOTP } from '../firebase/auth';
import { motion, AnimatePresence } from 'motion/react';

export default function Login() {
  const navigate = useNavigate();
  const { 
    loading, 
    user, 
    enableSandboxBypass, 
    signInWithGoogle, 
    signInWithEmail,
    signUpWithEmail,
    isSandboxMode 
  } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'phone' | 'email'>('phone');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const [localLoading, setLocalLoading] = useState(false);
  const isCurrentlyLoading = loading || localLoading;

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isOpNotAllowed, setIsOpNotAllowed] = useState(false);

  // Auto redirect if user is already logged in with complete profile
  useEffect(() => {
    if (user && user.isProfileComplete) {
      navigate('/', { replace: true });
    } else if (user && !user.isProfileComplete) {
      navigate('/complete-profile', { replace: true });
    }
  }, [user, navigate]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsOpNotAllowed(false);

    if (!email.trim()) {
      setErrorMsg('Chonde lemberani email yanu / Please specify email.');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMsg('Imelo yolakwika / Invalid email format.');
      return;
    }

    try {
      setLocalLoading(true);
      const res = await sendOTP({ email: email.trim() });
      if (res.data && (res.data as any).success) {
        setSuccessMsg('✓ OTP Code sent successfully! Pitani ku chitsimikizo...');
        setTimeout(() => {
          navigate(`/verify-otp?email=${encodeURIComponent(email.trim())}`, { state: { email: email.trim() } });
        }, 1200);
      } else {
        setErrorMsg('Failed to send OTP. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to send OTP. Please check your network or try again.');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Chonde lemberani email ndi password yanu / Please specify email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password iyenera kukhala yosachepera manambala 6 / Password must be at least 6 characters.');
      return;
    }

    if (isRegisterMode) {
      const res = await signUpWithEmail(email.trim(), password);
      if (res.success) {
        setSuccessMsg('✓ Account registered successfully! Pitani ku chitsimikizo...');
        setTimeout(() => {
          navigate('/complete-profile');
        }, 1200);
      } else {
        setErrorMsg(res.error || 'Failed to create email account.');
      }
    } else {
      const res = await signInWithEmail(email.trim(), password);
      if (res.success) {
        setSuccessMsg('✓ Logged in successfully!');
        setTimeout(() => {
          if (res.isNewUser) {
            navigate('/complete-profile');
          } else {
            navigate('/');
          }
        }, 1200);
      } else {
        const errStr = res.error || '';
        if (errStr.includes('auth/user-not-found') || errStr.toLowerCase().includes('no user record')) {
          setErrorMsg('Account imeneyi silipezeka / Account not found. Press "Create Account" below if you want to sign up.');
        } else if (errStr.includes('auth/wrong-password') || errStr.toLowerCase().includes('invalid-credential')) {
          setErrorMsg('Mawu achinsinsi olakwika / Incorrect password. Chonde yesesani kachiwiri.');
        } else {
          setErrorMsg(errStr || 'Google/Email sign-in failed.');
        }
      }
    }
  };

  const handleSandboxBypass = () => {
    setErrorMsg('');
    setSuccessMsg('');
    const useEmail = email.trim() || 'sandbox_test@shopeasy.mw';
    enableSandboxBypass(useEmail);
    setSuccessMsg('✓ Sandbox simulation activated! Pitani ku chitsimikizo...');
    setTimeout(() => {
      navigate(`/verify-otp?email=${encodeURIComponent(useEmail)}`, { state: { email: useEmail } });
    }, 1200);
  };

  const handleGoogleLoginSubmit = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsOpNotAllowed(false);
    
    const res = await signInWithGoogle();
    if (res.success) {
      setSuccessMsg('✓ Google authentication success!');
      setTimeout(() => {
        if (res.isNewUser) {
          navigate('/complete-profile');
        } else {
          navigate('/');
        }
      }, 1200);
    } else {
      setErrorMsg(res.error || 'Google login failed.');
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 animate-[fadeIn_0.3s_ease] max-w-md mx-auto min-h-[85vh] justify-center text-[#212121]">
      
      {/* 1. ShopEasy logo at top & Welcome page header */}
      <div className="flex flex-col items-center justify-center text-center">
        <div className="h-16 w-16 bg-gradient-to-br from-[#E53935] to-[#FFB300] rounded-3xl flex items-center justify-center text-4xl shadow-md border border-[#E53935]/10 font-bold mb-4">
          🏪
        </div>
        <h1 className="font-display font-black text-2xl text-neutral-900 tracking-tight">
          Welcome to ShopEasy 🇲🇼
        </h1>
        <p className="text-[10px] uppercase font-black tracking-widest text-[#E53935] mt-1">
          Direct local pickup marketplace
        </p>
      </div>

      {/* LOGIN/REGISTER WRAPPER CARD */}
      <div className="bg-white rounded-3xl border border-neutral-100 p-6 shadow-sm flex flex-col gap-4">
        
        {/* Toggle tabs for Phone vs Email */}
        <div className="grid grid-cols-2 bg-neutral-100 p-1 rounded-full border border-neutral-200">
          <button
            type="button"
            onClick={() => {
              setActiveTab('phone');
              setErrorMsg('');
            }}
            className={`py-2 rounded-full text-[11px] font-black uppercase tracking-wider transition ${
              activeTab === 'phone' 
                ? 'bg-white text-neutral-900 shadow-xs' 
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            ✉️ Email & OTP
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('email');
              setErrorMsg('');
            }}
            className={`py-2 rounded-full text-[11px] font-black uppercase tracking-wider transition ${
              activeTab === 'email' 
                ? 'bg-white text-neutral-900 shadow-xs' 
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            ✉️ Email & Password
          </button>
        </div>

        <div className="text-center pb-2 border-b border-neutral-100">
          <h2 className="font-display font-black text-xs uppercase text-neutral-500 tracking-wider">
            {activeTab === 'phone' ? 'Email Verification' : isRegisterMode ? 'Create Account 🇲🇼' : 'Sign In 🇲🇼'}
          </h2>
          <p className="text-[10px] font-bold text-neutral-400 mt-1">
            {activeTab === 'phone' 
              ? 'Enter email to receive a 6-digit confirmation code' 
              : isRegisterMode 
                ? 'Lembetsani tsopano ndi email yanu' 
                : 'Lowani mwachangu ndi email yanu'}
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-150 p-3.5 rounded-2xl text-[11px] font-bold text-red-650 text-center uppercase tracking-wide leading-relaxed">
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-150 p-3.5 rounded-2xl text-[11px] font-bold text-emerald-850 text-center uppercase tracking-wide">
            {successMsg}
          </div>
        )}

        {/* Tab CONTENT: EMAIL OTP */}
        {activeTab === 'phone' && (
          <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email-otp-input" className="block text-[10px] font-black text-neutral-450 uppercase mb-2 tracking-wider">
                ENTER YOUR EMAIL ADDRESS
              </label>
              
              <div className="flex items-stretch rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-950 overflow-hidden focus-within:ring-1 focus-within:ring-[#E53935] focus-within:bg-white transition-all">
                <div className="flex items-center px-3.5 bg-neutral-100 border-r border-neutral-250 text-neutral-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email-otp-input"
                  type="email"
                  placeholder="E.g. yourname@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isCurrentlyLoading}
                  className="w-full text-xs font-semibold py-3 px-3 bg-transparent text-neutral-900 focus:outline-none"
                />
              </div>
              
              <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider mt-1.5 px-1">
                A 6-digit code will be sent to your email
              </p>
            </div>

            {/* Send OTP Actions */}
            <button
              id="send-otp-btn"
              type="submit"
              disabled={isCurrentlyLoading || !email.trim()}
              className="w-full mt-2 py-3.5 rounded-full bg-[#E53935] hover:bg-red-700 text-white text-xs font-black tracking-wide uppercase transition hover:shadow-md disabled:bg-neutral-300 flex items-center justify-center gap-2"
            >
              <span>{isCurrentlyLoading ? 'Sending OTP... / Dikirani' : 'Send OTP'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}

        {/* Tab CONTENT: EMAIL */}
        {activeTab === 'email' && (
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email-input" className="block text-[10px] font-black text-neutral-450 uppercase mb-2 tracking-wider">
                Email Address
              </label>
              <div className="flex items-stretch rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-950 overflow-hidden focus-within:ring-1 focus-within:ring-[#E53935] focus-within:bg-white transition-all">
                <div className="flex items-center px-3.5 bg-neutral-100 border-r border-neutral-250 text-neutral-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email-input"
                  type="email"
                  placeholder="name@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isCurrentlyLoading}
                  className="w-full text-xs font-semibold py-3 px-3 bg-transparent text-neutral-900 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password-input" className="block text-[10px] font-black text-neutral-450 uppercase mb-2 tracking-wider">
                Password
              </label>
              <div className="flex items-stretch rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-950 overflow-hidden focus-within:ring-1 focus-within:ring-[#E53935] focus-within:bg-white transition-all">
                <div className="flex items-center px-3.5 bg-neutral-100 border-r border-neutral-250 text-neutral-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password-input"
                  type="password"
                  placeholder="******"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isCurrentlyLoading}
                  className="w-full text-xs font-semibold py-3 px-3 bg-transparent text-neutral-900 focus:outline-none"
                />
              </div>
            </div>

            <button
              id="email-auth-btn"
              type="submit"
              disabled={isCurrentlyLoading || !email.trim() || !password.trim()}
              className="w-full mt-2 py-3.5 rounded-full bg-[#E53935] hover:bg-red-700 text-white text-xs font-black tracking-wide uppercase transition hover:shadow-md disabled:bg-neutral-300 flex items-center justify-center gap-2"
            >
              <span>{isCurrentlyLoading ? 'Dikirani...' : isRegisterMode ? 'Create Account' : 'Sign In'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            {/* Toggle Sign Up vs Login */}
            <div className="text-center mt-2">
              <button
                type="button"
                onClick={() => setIsRegisterMode(!isRegisterMode)}
                className="text-[11px] font-black text-[#E53935] uppercase hover:underline"
              >
                {isRegisterMode 
                  ? 'I already have an account / Lowani m’malo mwake' 
                  : 'New here? Register with Email / Lembetsani akaunti tsono'}
              </button>
            </div>
          </form>
        )}

        {/* Dynamic Sandbox Option & Firebase Fix Guide Fallback UI */}
        {isOpNotAllowed && (
          <div className="bg-amber-50/70 border border-amber-200/80 p-5 rounded-2xl flex flex-col gap-4.5 animate-[fadeIn_0.2s_ease] text-neutral-800">
            <div className="flex items-start gap-2 text-amber-955">
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
              <div className="text-[11px] font-black uppercase tracking-wider">
                HOW TO FIX THIS IN FIREBASE CONSOLE ⚙️
              </div>
            </div>
            
            <div className="flex flex-col gap-2.5 text-[10px] text-neutral-700 bg-white/80 p-3.5 rounded-xl border border-amber-200/50">
              <span className="font-extrabold uppercase text-amber-900 tracking-wide text-[10px] block">Option A: Enable Malawi SMS Deliveries</span>
              <ol className="list-decimal pl-4 space-y-1.5 font-semibold text-[10px] text-neutral-600 leading-relaxed">
                <li>Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-[#E53935] underline font-black">Firebase Console</a> and select your project.</li>
                <li>Navigate to <strong className="text-neutral-900 font-extrabold">Build → Authentication</strong>.</li>
                <li>Click on the <strong className="text-neutral-900 font-extrabold">Settings</strong> tab at the top.</li>
                <li>In the left sidebar, click on <strong className="text-neutral-800 font-extrabold">User sign-in settings</strong>.</li>
                <li>Scroll down to find and expand <strong className="text-neutral-800 font-semibold">SMS Region Policy</strong>.</li>
                <li>Select <strong className="text-neutral-900 font-extrabold">Allow</strong>, select or search for <strong className="text-neutral-900 font-extrabold">Malawi (MW) / +265</strong>, and click <strong className="text-neutral-900 font-extrabold">Save</strong>!</li>
              </ol>
            </div>

            <div className="flex flex-col gap-2 text-[10px] text-neutral-700 bg-white/80 p-3.5 rounded-xl border border-amber-200/50">
              <span className="font-extrabold uppercase text-amber-900 tracking-wide text-[10px] block">Option B: Set up Test Numbers (Recommended)</span>
              <p className="font-semibold text-[10px] text-neutral-600 leading-relaxed">
                Under <strong className="text-neutral-800 font-semibold">Authentication → Sign-in method</strong>, click on <strong className="text-neutral-800 font-semibold">Phone</strong>. Expose the "Phone numbers for testing (optional)" section. Add your phone number (e.g., <strong className="text-neutral-900 font-mono font-bold">+265899195843</strong>) and set any 6-digit confirmation code (e.g. <strong className="text-neutral-900 font-mono">123456</strong>) to verify instantly!
              </p>
            </div>

            <div className="flex flex-col gap-2 border-t border-amber-200/80 pt-3">
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-900">Immediate Local Shortcut:</span>
              <p className="text-[9px] font-bold text-neutral-500">
                You can also bypass this check immediately right now using our local built-in simulator:
              </p>
              <button
                id="sandbox-emulator-btn"
                type="button"
                onClick={handleSandboxBypass}
                className="w-full py-2.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-wider transition shadow-sm"
              >
                Skip & Enter Sandbox Mode
              </button>
            </div>
          </div>
        )}

        {/* ALTERNATIVE LOGIN SECTIONS */}
        <div className="flex flex-col gap-3 pt-3 border-t border-neutral-100">
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-neutral-100"></div>
            <span className="flex-shrink mx-3 text-[9px] font-black text-neutral-400 uppercase tracking-widest">Or authenticate via</span>
            <div className="flex-grow border-t border-neutral-100"></div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Google provider */}
            <button
              id="google-signin-btn"
              type="button"
              onClick={handleGoogleLoginSubmit}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 border border-neutral-200 rounded-full hover:bg-neutral-50 hover:border-neutral-300 transition text-xs font-extrabold text-neutral-700"
            >
              <span>🌐</span>
              <span>Google Account</span>
            </button>

            {/* Direct Sandbox Simulator Option */}
            <button
              id="direct-sandbox-btn"
              type="button"
              onClick={handleSandboxBypass}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 border border-dashed border-amber-300 bg-amber-50/50 text-amber-800 font-extrabold text-xs rounded-full hover:bg-amber-100/50 hover:border-amber-400 transition"
            >
              <span>⚡</span>
              <span>Sandbox Demo</span>
            </button>
          </div>
        </div>

        {/* NEW HERE FOOTER */}
        <div className="text-center pt-3 border-t border-neutral-100 text-[11px] font-extrabold text-[#E53935] uppercase tracking-wide">
          NEW HERE? REGISTER AFTER VERIFYING YOUR EMAIL
        </div>

      </div>

    </div>
  );
}
