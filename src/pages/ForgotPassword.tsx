import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, KeyRound } from 'lucide-react';

export default function ForgotPassword() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-5 p-4 animate-[fadeIn_0.3s_ease] max-w-md mx-auto min-h-[80vh] justify-center text-[#212121]">
      {/* HEADER ACTIONS */}
      <div className="flex items-center gap-3">
        <button 
          id="back-to-login"
          onClick={() => navigate('/login')} 
          className="p-1.5 rounded-full hover:bg-neutral-100 border border-neutral-150 transition"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        <div>
          <h2 className="font-display font-black text-sm text-neutral-900 uppercase">Recover Account</h2>
          <p className="text-[10px] text-neutral-450 font-bold uppercase block mt-0.5">ShopEasy Password Support</p>
        </div>
      </div>

      {/* CORE DISPLAY */}
      <div className="bg-white rounded-3xl border border-neutral-100 p-6 shadow-sm flex flex-col gap-5 text-center items-center">
        <div className="h-14 w-14 rounded-full bg-red-50 text-[#E53935] flex items-center justify-center border border-red-100">
          <KeyRound className="h-6 w-6" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="font-display font-black text-sm uppercase text-neutral-900">
            Passwords are obsolete!
          </h1>
          <p className="text-xs text-neutral-600 font-medium leading-relaxed">
            ShopEasy has fully upgraded to a passwordless, secure single-sign-on using <strong>Firebase Phone Authentication</strong>.
          </p>
          <p className="text-[11px] text-neutral-400 font-medium leading-normal mt-1">
            You no longer need to remember or recover any passwords. Just verify your Malawian cell line via SMS OTP and begin trading instantly!
          </p>
        </div>

        <button
          id="proceed-to-login-btn"
          onClick={() => navigate('/login')}
          className="w-full py-3.5 rounded-full bg-[#E53935] hover:bg-red-700 text-white text-xs font-black tracking-wide uppercase transition hover:shadow-md flex items-center justify-center gap-2"
        >
          <span>Login with Phone Number</span>
        </button>
      </div>
    </div>
  );
}
