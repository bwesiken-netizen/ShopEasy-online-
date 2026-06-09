import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { useI18nStore } from '../i18n';
import { db, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  ArrowLeft, User, MapPin, Globe, DollarSign, Bell, Clock, 
  Trash2, Star, Shield, HelpCircle, LogOut, ChevronRight, Check, Loader2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { language, setLanguage, t } = useI18nStore();

  const [showLangSheet, setShowLangSheet] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Toast Control
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  const handleLanguageSelect = async (lang: 'en' | 'ny') => {
    try {
      setLanguage(lang);
      setShowLangSheet(false);

      // Persist to user doc in Firestore if logged in
      if (user?.uid) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { language: lang });
      }

      triggerToast(lang === 'ny' ? "Chilankhulo chasinthidwa!" : "Language updated!");
    } catch (err) {
      console.error("Failed to update language:", err);
    }
  };

  const handleClearCache = () => {
    const isConfirmed = window.confirm(t('confirmClearCache'));
    if (!isConfirmed) return;

    setClearingCache(true);
    setTimeout(() => {
      // Clear localStorage except sandbox session and language
      const savedSandbox = localStorage.getItem('shopeasy_sandbox_user');
      const savedLang = localStorage.getItem('shopeasy_language');

      localStorage.clear();

      if (savedSandbox) localStorage.setItem('shopeasy_sandbox_user', savedSandbox);
      if (savedLang) localStorage.setItem('shopeasy_language', savedLang);

      setClearingCache(false);
      triggerToast(t('cacheCleared'));
    }, 1200);
  };

  const handleLogout = async () => {
    const isConfirmed = window.confirm(t('confirmLogout'));
    if (!isConfirmed) return;

    setLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error("Logout error: ", err);
      // fallback
      navigate('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 animate-[fadeIn_0.3s_ease]" id="settings-view">
      {/* HEADER */}
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3.5 flex items-center gap-3" id="settings-header">
        <button 
          onClick={() => navigate('/account')}
          className="p-1 rounded-full text-neutral-500 hover:bg-neutral-100 active:bg-neutral-200 transition-all font-black"
          id="back-to-account-btn"
        >
          <ArrowLeft className="h-5 w-5 font-black" />
        </button>
        <h1 className="font-display font-black text-base text-neutral-900 uppercase tracking-tight" id="settings-title">
          {t('settings')}
        </h1>
      </div>

      <div className="p-4 space-y-4 flex-1 pb-16" id="settings-scroll-body">
        
        {/* SECTION 1: PROFILE MANAGEMENT */}
        <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden" id="section-profile">
          <div className="px-4.5 py-3 border-b border-neutral-100">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-neutral-450">
              {t('profile')}
            </span>
          </div>
          <div className="divide-y divide-neutral-50">
            <button
              onClick={() => navigate('/settings/profile')}
              className="w-full px-4.5 py-3.5 flex items-center justify-between text-left hover:bg-neutral-50/50 transition-all"
              id="link-profile"
            >
              <div className="flex items-center gap-3">
                <User className="h-4.5 w-4.5 text-neutral-400" />
                <span className="text-xs font-bold text-neutral-800">{t('editProfile')}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-neutral-350" />
            </button>

            <button
              onClick={() => navigate('/settings/addresses')}
              className="w-full px-4.5 py-3.5 flex items-center justify-between text-left hover:bg-neutral-50/50 transition-all"
              id="link-addresses"
            >
              <div className="flex items-center gap-3">
                <MapPin className="h-4.5 w-4.5 text-neutral-400" />
                <span className="text-xs font-bold text-neutral-800">{t('deliveryAddresses')}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-neutral-350" />
            </button>
          </div>
        </div>

        {/* SECTION 2: PREFERENCES */}
        <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden" id="section-preferences">
          <div className="px-4.5 py-3 border-b border-neutral-100">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-neutral-450">
              {t('preferences')}
            </span>
          </div>
          <div className="divide-y divide-neutral-50">
            {/* Display-only Location */}
            <div className="px-4.5 py-3.5 flex items-center justify-between text-left" id="pref-location-row">
              <div className="flex items-center gap-3">
                <MapPin className="h-4.5 w-4.5 text-neutral-400" />
                <span className="text-xs font-bold text-neutral-800">{t('location')}</span>
              </div>
              <span className="text-xs font-black text-neutral-450">Malawi 🇲🇼</span>
            </div>

            {/* Display-only Currency */}
            <div className="px-4.5 py-3.5 flex items-center justify-between text-left" id="pref-currency-row">
              <div className="flex items-center gap-3">
                <DollarSign className="h-4.5 w-4.5 text-neutral-400" />
                <span className="text-xs font-bold text-neutral-800">{t('currency')}</span>
              </div>
              <span className="text-xs font-black text-neutral-450 uppercase font-mono">MWK</span>
            </div>

            {/* Language Selector Bottom Sheet Hook */}
            <button
              onClick={() => setShowLangSheet(true)}
              className="w-full px-4.5 py-3.5 flex items-center justify-between text-left hover:bg-neutral-50/50 transition-all"
              id="pref-language-btn"
            >
              <div className="flex items-center gap-3">
                <Globe className="h-4.5 w-4.5 text-neutral-400" />
                <span className="text-xs font-bold text-neutral-800">{t('language')}</span>
              </div>
              <div className="flex items-center gap-1.5" id="current-lang-holder">
                <span className="text-xs font-black text-[#E53935]" id="active-lang">
                  {language === 'ny' ? 'Chichewa' : 'English (MW)'}
                </span>
                <ChevronRight className="h-4 w-4 text-neutral-350" />
              </div>
            </button>
          </div>
        </div>

        {/* SECTION 3: APP MAINTENANCE */}
        <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden" id="section-app-management">
          <div className="px-4.5 py-3 border-b border-neutral-100">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-neutral-450">
              {t('app')}
            </span>
          </div>
          <div className="divide-y divide-neutral-50">
            <button
              onClick={() => navigate('/settings/notifications')}
              className="w-full px-4.5 py-3.5 flex items-center justify-between text-left hover:bg-neutral-50/50 transition-all"
              id="link-notifications"
            >
              <div className="flex items-center gap-3">
                <Bell className="h-4.5 w-4.5 text-neutral-400" />
                <span className="text-xs font-bold text-neutral-800">{t('notifications')}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-neutral-350" />
            </button>

            <button
              onClick={() => navigate('/settings/viewed')}
              className="w-full px-4.5 py-3.5 flex items-center justify-between text-left hover:bg-neutral-50/50 transition-all"
              id="link-viewed"
            >
              <div className="flex items-center gap-3">
                <Clock className="h-4.5 w-4.5 text-neutral-400" />
                <span className="text-xs font-bold text-neutral-800">{t('recentlyViewed')}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-neutral-350" />
            </button>

            <button
              onClick={handleClearCache}
              disabled={clearingCache}
              className="w-full px-4.5 py-3.5 flex items-center justify-between text-left hover:bg-neutral-50/50 transition-all disabled:opacity-50"
              id="btn-clear-cache"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="h-4.5 w-4.5 text-neutral-400" />
                <span className="text-xs font-bold text-neutral-800">{t('clearCache')}</span>
              </div>
              {clearingCache ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#E53935]" />
              ) : (
                <ChevronRight className="h-4 w-4 text-neutral-350" />
              )}
            </button>
          </div>
        </div>

        {/* SECTION 4: INFO & STORES LAW */}
        <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden" id="section-legal-info">
          <div className="px-4.5 py-3 border-b border-neutral-100">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-neutral-450">
              Information & Feedback
            </span>
          </div>
          <div className="divide-y divide-neutral-50">
            <button
              onClick={() => alert("Muli bwanji! Thank you for rating ShopEasy on Malawian Mobile Stores.")}
              className="w-full px-4.5 py-3.5 flex items-center justify-between text-left hover:bg-neutral-50/50 transition-all"
              id="link-rate"
            >
              <div className="flex items-center gap-3">
                <Star className="h-4.5 w-4.5 text-neutral-400" />
                <span className="text-xs font-bold text-neutral-800">{t('rateApp')}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-neutral-350" />
            </button>

            <button
              onClick={() => alert("ShopEasy is committed to keeping your data and local cellular escrow transactions perfectly private under Malawian digital laws.")}
              className="w-full px-4.5 py-3.5 flex items-center justify-between text-left hover:bg-neutral-50/50 transition-all"
              id="link-privacy"
            >
              <div className="flex items-center gap-3">
                <Shield className="h-4.5 w-4.5 text-neutral-400" />
                <span className="text-xs font-bold text-neutral-800">{t('privacy')}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-neutral-350" />
            </button>

            <button
              onClick={() => alert("By buying locally, you agree to inspect all farm produce and match TNM Mpamba/Airtel Money escrow centers properly.")}
              className="w-full px-4.5 py-3.5 flex items-center justify-between text-left hover:bg-neutral-50/50 transition-all"
              id="link-terms"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="h-4.5 w-4.5 text-neutral-400" />
                <span className="text-xs font-bold text-neutral-800">{t('terms')}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-neutral-350" />
            </button>
          </div>
        </div>

        {/* SECTION 5: ACCOUNT CONTROL */}
        <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden" id="section-log-out">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full px-4.5 py-4 flex items-center justify-between text-left hover:bg-red-50/10 transition-all disabled:opacity-50"
            id="btn-logout"
          >
            <div className="flex items-center gap-3">
              <LogOut className="h-4.5 w-4.5 text-red-500" />
              <span className="text-xs font-black text-red-600 uppercase tracking-tight">{t('logout')}</span>
            </div>
            {loggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#E53935]" />
            ) : (
              <ChevronRight className="h-4 w-4 text-red-400" />
            )}
          </button>
        </div>

        {/* FOOTER */}
        <div className="text-center py-6 flex flex-col items-center gap-1.5" id="settings-footer">
          <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400 font-mono">
            ShopEasy Malawi Applet • {t('version')} 1.2.0
          </span>
          <span className="text-[10px] font-bold text-neutral-450 uppercase flex items-center gap-1">
            <span>Made in Malawi 🇲🇼</span>
          </span>
        </div>

      </div>

      {/* LANGUAGE SELECTOR BOTTOM SHEET (Framer Motion) */}
      <AnimatePresence>
        {showLangSheet && (
          <div className="fixed inset-0 z-50 overflow-hidden" id="language-bottom-sheet">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLangSheet(false)}
              className="absolute inset-0 bg-black"
            />

            {/* Panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="absolute bottom-0 inset-x-0 bg-white rounded-t-[32px] border-t border-neutral-100 p-5 shadow-2xl flex flex-col max-h-[80vh]"
              id="language-sheet-content"
            >
              <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-4" />

              <h2 className="font-display font-black text-base text-neutral-950 uppercase tracking-tight mb-4" id="lang-sheet-title">
                {t('language')}
              </h2>

              <div className="space-y-3 pb-8" id="lang-options">
                <button
                  onClick={() => handleLanguageSelect('en')}
                  className={`w-full py-3 px-4 rounded-2xl border text-xs font-black text-left flex items-center justify-between transition-all ${
                    language === 'en'
                      ? 'border-[#E53935] bg-red-50/40 text-[#E53935]'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-350'
                  }`}
                  id="lang-opt-en"
                >
                  <span>English (MW)</span>
                  {language === 'en' && <Check className="h-4 w-4 text-[#E53935]" />}
                </button>

                <button
                  onClick={() => handleLanguageSelect('ny')}
                  className={`w-full py-3 px-4 rounded-2xl border text-xs font-black text-left flex items-center justify-between transition-all ${
                    language === 'ny'
                      ? 'border-[#E53935] bg-red-50/40 text-[#E53935]'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-350'
                  }`}
                  id="lang-opt-ny"
                >
                  <span>Chichewa</span>
                  {language === 'ny' && <Check className="h-4 w-4 text-[#E53935]" />}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOAST SYSTEM */}
      {showToast && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-neutral-900/90 text-white font-semibold text-xs py-3 px-5 rounded-full shadow-lg flex items-center gap-2 z-50 animate-[slideUp_0.2s_ease-out]" id="toast-notif-settings">
          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

    </div>
  );
}
