import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ArrowLeft, Bell, ShoppingBag, Tag, Sparkles, Coins, MessageSquare, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

interface NotificationToggleSettings {
  orders: boolean;
  promotions: boolean;
  activities: boolean;
  coins: boolean;
  messages: boolean;
}

export default function NotificationSettings() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [settings, setSettings] = useState<NotificationToggleSettings>({
    orders: true,
    promotions: true,
    activities: true,
    coins: true,
    messages: true,
  });

  useEffect(() => {
    if (!user) return;

    async function fetchSettings() {
      try {
        const settingsRef = doc(db, 'users', user.uid, 'settings', 'notifications');
        const snap = await getDoc(settingsRef);
        if (snap.exists()) {
          const data = snap.data();
          setSettings({
            orders: data.orders !== false,
            promotions: data.promotions !== false,
            activities: data.activities !== false,
            coins: data.coins !== false,
            messages: data.messages !== false,
          });
        } else {
          // Initialize defaults
          await setDoc(settingsRef, {
            orders: true,
            promotions: true,
            activities: true,
            coins: true,
            messages: true,
            updatedAt: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error("Error loading notification settings:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, [user]);

  const handleToggle = async (key: keyof NotificationToggleSettings) => {
    if (!user) return;
    
    const updatedSettings = {
      ...settings,
      [key]: !settings[key]
    };
    
    setSettings(updatedSettings);
    setSaving(true);
    
    try {
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'notifications');
      await setDoc(settingsRef, {
        ...updatedSettings,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error("Error updating notification settings:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[500px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E53935] border-t-transparent" />
        <span className="mt-4 text-xs font-bold text-neutral-500">Kutsegula zokonda/Loading settings...</span>
      </div>
    );
  }

  const toggleItems = [
    {
      key: 'orders' as const,
      title: 'Order Tracking & Delivery',
      desc: 'Real-time updates on your purchase status, shipper dispatch, and pickup-ready alerts.',
      icon: <ShoppingBag className="h-5 w-5 text-amber-500" />
    },
    {
      key: 'promotions' as const,
      title: 'Discounts & Coupons',
      desc: 'Announcements about exclusive sales, discount codes, and new seasonal coupons.',
      icon: <Tag className="h-5 w-5 text-emerald-500" />
    },
    {
      key: 'messages' as const,
      title: 'Direct Seller Messages',
      desc: 'Alerts when sellers send queries, pictures, or arrange meetups inside Malawi towns.',
      icon: <MessageSquare className="h-5 w-5 text-[#E53935]" />
    },
    {
      key: 'coins' as const,
      title: 'Coins & Reward Alerts',
      desc: 'Daily coin drop reminders, event bonuses, and streak notifications.',
      icon: <Coins className="h-5 w-5 text-yellow-500" />
    },
    {
      key: 'activities' as const,
      title: 'Activities & Game Updates',
      desc: 'Notifications from Play & Earn, Prize Land, GoGo Match, and active campaigns.',
      icon: <Sparkles className="h-5 w-5 text-purple-500" />
    }
  ];

  return (
    <div className="bg-[#F5F5F5] min-h-screen">
      {/* HEADER */}
      <div className="bg-white px-4 py-4 border-b border-neutral-100 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-neutral-50" id="back-btn">
            <ArrowLeft className="h-5 w-5 text-neutral-700" />
          </button>
          <h2 className="text-sm font-extrabold text-neutral-900">Notification Settings</h2>
        </div>
        {saving && (
          <span className="text-[10px] font-bold text-neutral-400 animate-pulse">Saving...</span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* INFO HERO CARD */}
        <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 rounded-3xl p-5 text-white shadow-md relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-yellow-500 font-mono text-[9px] font-black uppercase tracking-wider">
              <ShieldCheck className="h-3 w-3" /> Real-time Firestore Sync
            </div>
            <h3 className="font-extrabold text-sm mt-1.5">Configure Alerts</h3>
            <p className="text-[11px] text-neutral-300 mt-1 font-medium leading-relaxed">
              Tsatirani makonda anu a uthenga. Decide which updates to push immediately to your device.
            </p>
          </div>
          <div className="absolute right-4 bottom-2 text-white/5 font-display text-8xl font-black select-none pointer-events-none">
            <Bell className="h-24 w-24" />
          </div>
        </div>

        {/* SETTINGS CARD GROUP */}
        <div className="bg-white rounded-3xl p-4 shadow-3xs border border-neutral-100 flex flex-col divide-y divide-neutral-100">
          {toggleItems.map((item) => (
            <div key={item.key} className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="p-2 bg-neutral-50 rounded-2xl shrink-0 mt-0.5">
                  {item.icon}
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-neutral-900">{item.title}</h4>
                  <p className="text-[10px] text-neutral-500 leading-relaxed font-medium mt-0.5">{item.desc}</p>
                </div>
              </div>

              {/* IOS STYLE TOGGLE */}
              <button
                id={`toggle-${item.key}`}
                onClick={() => handleToggle(item.key)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings[item.key] ? 'bg-[#E53935]' : 'bg-neutral-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    settings[item.key] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <div className="text-center mt-2 px-6">
          <p className="text-[10px] text-neutral-400 font-medium">
            System generated settings are protected. You can toggle off any specific feed to reduce background alerts on ShopEasy.
          </p>
        </div>
      </div>
    </div>
  );
}
