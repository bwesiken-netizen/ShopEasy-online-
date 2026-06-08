import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { ShieldCheck, ArrowLeft, RefreshCw, Sparkles } from 'lucide-react';
import { RecaptchaVerifier } from 'firebase/auth';
import { auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';

export default function VerifyOtp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawPhone = searchParams.get('phone') || '';

  const { confirmOtp, sendOtp, loading, user } = useAuthStore();

  const [phone, setPhone] = useState(rawPhone || user?.phone || '');
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));
  const [countdown, setCountdown] = useState(59);
  const [canResend, setCanResend] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Auto redirect if profile is complete
  useEffect(() => {
    if (user && user.isProfileComplete) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // If no phone context is found inSearchParams or authState, fallback back to Login
  useEffect(() => {
    if (!phone) {
      navigate('/login', { replace: true });
    }
  }, [phone, navigate]);

  // Resend Countdown timer
  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      setCanResend(false);
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  // Handle individual input digit key-ins
  const handleDigitChange = (index: number, val: string) => {
    const numericVal = val.replace(/[^0-9]/g, '');
    if (!numericVal) {
      const newDigits = [...otpDigits];
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = numericVal.slice(-1);
    setOtpDigits(newDigits);

    // Auto-advance to the next input box
    if (index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        // Clear previous box and shift focus backwards
        const newDigits = [...otpDigits];
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...otpDigits];
        newDigits[index] = '';
        setOtpDigits(newDigits);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().replace(/[^0-9]/g, '');
    if (pastedData.length !== 6) return;

    const copyArray = pastedData.split('').slice(0, 6);
    setOtpDigits(copyArray);
    inputRefs.current[5]?.focus();
  };

  // Submit OTP Code
  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const code = otpDigits.join('');
    if (code.length !== 6) {
      setErrorMsg('Chonde lemberani manambala onse 6 a OTP / Please enter the entire 6-digit OTP code.');
      return;
    }

    const res = await confirmOtp(code);
    if (res.success) {
      setSuccessMsg('✓ Phone verified successfully! Chonde dikirani...');
      setTimeout(() => {
        if (res.isNewUser) {
          navigate('/complete-profile');
        } else {
          navigate('/');
        }
      }, 1200);
    } else {
      setErrorMsg(res.error || 'The OTP code typed is incorrect. Please double check.');
    }
  };

  // Resend OTP trigger
  const handleResend = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    // Reinitialize/Retrieve the invisible recaptcha
    try {
      if (!(window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container-resend', {
          size: 'invisible'
        });
      }
    } catch (err: any) {
      setErrorMsg('Failed to setup verification protector: ' + err.message);
      return;
    }

    const appVerifier = (window as any).recaptchaVerifier;

    const res = await sendOtp(phone, appVerifier);
    if (res.success) {
      setSuccessMsg('✓ A new 6-digit OTP code has been transmitted.');
      setCountdown(59);
      setCanResend(false);
    } else {
      setErrorMsg(res.error || 'Failed to resend. Please try again later.');
    }
  };

  // Nicely format phoneNumber for presentation, e.g. +265 999 123 456
  const displayPhone = phone.replace(/(\+265)(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4') || phone;

  return (
    <div className="flex flex-col gap-5 p-4 animate-[fadeIn_0.3s_ease] max-w-md mx-auto min-h-[85vh] justify-center text-[#212121]">
      
      {/* Back Arrow to Change Number */}
      <div className="flex justify-start">
        <button
          id="back-to-login-btn"
          onClick={() => navigate('/login')}
          className="flex items-center gap-1 text-[11px] font-black uppercase text-neutral-500 hover:text-[#E53935] transition duration-200"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
          <span>Sinthani Nambala / Change Number</span>
        </button>
      </div>

      {/* VERIFY CONTAINER CARD */}
      <div className="bg-white rounded-3xl border border-neutral-100 p-6 shadow-sm flex flex-col gap-5">
        
        <div className="text-center pb-2 border-b border-neutral-100 flex flex-col items-center gap-2">
          <div className="h-12 w-12 rounded-full bg-red-50 text-[#E53935] flex items-center justify-center border border-red-100">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display font-black text-sm uppercase text-neutral-900 tracking-tight">
              OTP Verification
            </h1>
            <p className="text-[10px] text-neutral-450 font-bold uppercase mt-1 leading-normal">
              Enter the 6-digit code sent to <span className="font-mono text-neutral-800">{displayPhone}</span>
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-150 p-3.5 rounded-2xl text-[11px] font-bold text-red-650 text-center uppercase tracking-wide">
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-150 p-3.5 rounded-2xl text-[11px] font-bold text-emerald-850 text-center uppercase tracking-wide">
            {successMsg}
          </div>
        )}

        {/* 6 Code inputs display */}
        <form onSubmit={handleVerify} className="flex flex-col gap-5">
          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {otpDigits.map((digit, idx) => (
              <input
                id={`otp-digit-${idx}`}
                key={idx}
                ref={(el) => { inputRefs.current[idx] = el; }}
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                disabled={loading}
                className="w-11 h-12 text-center text-lg font-black font-mono rounded-xl border border-neutral-300 bg-neutral-50 text-[#E53935] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E53935] focus:border-transparent transition-all"
              />
            ))}
          </div>

          <button
            id="verify-submit-btn"
            type="submit"
            disabled={loading || otpDigits.some(d => d === '')}
            className="w-full py-3.5 rounded-full bg-[#E53935] hover:bg-red-700 text-white text-xs font-black tracking-wide uppercase transition hover:shadow-md disabled:bg-neutral-300 flex items-center justify-center gap-2"
          >
            <span>{loading ? 'Verifying... / Chonde dikirani' : 'Verify'}</span>
          </button>
        </form>

        {/* Hidden recaptcha division for resend safety */}
        <div id="recaptcha-container-resend" className="mx-auto select-none opacity-0 h-0 pointer-events-none"></div>

        {/* Countdown counter or resend element */}
        <div className="text-center pt-3 border-t border-neutral-100 flex flex-col items-center justify-center gap-1">
          {canResend ? (
            <button
              id="resend-otp-link"
              onClick={handleResend}
              className="flex items-center gap-1.5 text-[11px] font-black text-[#E53935] uppercase hover:underline cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Resend OTP</span>
            </button>
          ) : (
            <span className="text-[10px] text-neutral-450 font-bold uppercase tracking-wider">
              Resend in 00:{countdown < 10 ? `0${countdown}` : countdown}
            </span>
          )}
        </div>

      </div>

    </div>
  );
}
