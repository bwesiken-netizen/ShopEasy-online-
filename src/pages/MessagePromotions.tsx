import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, writeBatch } from 'firebase/firestore';
import { handleFirestoreError } from '../firebase';
import { OperationType } from '../types';
import { ArrowLeft, Tag, Sparkles, AlertCircle, ShoppingBag, ArrowUpRight, Gift, Percent } from 'lucide-react';
import { motion } from 'motion/react';

interface PromoNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  productId?: string;
  read: boolean;
  createdAt: any;
}

export default function MessagePromotions() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<PromoNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Listen to promotions / campaigns in real time
    const notifsRef = collection(db, 'notifications');
    const q = query(
      notifsRef,
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const list: PromoNotification[] = [];
        const unreadToMarkRead: string[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.type === 'promo' || data.type === 'promotions') {
            const item: PromoNotification = {
              id: docSnap.id,
              userId: data.userId,
              type: data.type,
              title: data.title || 'Zapadera / Hot Promo',
              body: data.body || '',
              productId: data.productId,
              read: !!data.read,
              createdAt: data.createdAt?.toDate() || new Date(data.createdAt || Date.now())
            };
            list.push(item);

            if (!data.read) {
              unreadToMarkRead.push(docSnap.id);
            }
          }
        });

        setNotifications(list);
        setLoading(false);

        // Batch mark unread ones as read
        if (unreadToMarkRead.length > 0) {
          const batch = writeBatch(db);
          unreadToMarkRead.forEach((id) => {
            const docRef = doc(db, 'notifications', id);
            batch.update(docRef, { read: true });
          });
          try {
            await batch.commit();
          } catch (err) {
            console.error("Failed to mark promo notifications as read", err);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      }
    );

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="bg-[#F5F5F5] min-h-screen">
      {/* HEADER */}
      <div className="bg-white px-4 py-4 border-b border-neutral-100 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/messages')} className="p-1.5 rounded-full hover:bg-neutral-50" id="back-btn-promos">
            <ArrowLeft className="h-5 w-5 text-neutral-700" />
          </button>
          <div>
            <h2 className="text-sm font-extrabold text-[#212121]">Promotions & Campaigns</h2>
            <span className="text-[9px] font-mono font-black text-[#FFB300] uppercase tracking-widest">
              Big Sale Events
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* SALE BANNER QUICK ACTION */}
        <div className="bg-gradient-to-br from-[#E53935] to-[#FF8F00] rounded-3xl p-5 text-white shadow-md relative overflow-hidden">
          <div className="relative z-10">
            <span className="bg-white/20 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full backdrop-blur-xs">
              ShopEasy Club Coupons
            </span>
            <h3 className="font-display font-extrabold text-lg mt-2 leading-tight">Up to 40% Off Direct Farm Products!</h3>
            <p className="text-[11px] text-white/95 col-span-2 font-semibold mt-1 max-w-xs">
              Claim high-value discount vouchers and pay less for maize, sweet potato, and eggs.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => navigate('/sale/coupons')}
                className="bg-white hover:bg-neutral-50 text-[#E53935] font-black text-[9.5px] uppercase tracking-wider py-2.5 px-4 rounded-full flex items-center gap-1 shadow-xs"
              >
                Collect Coupons <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => navigate('/account/coupons')}
                className="bg-neutral-900/40 hover:bg-neutral-900/60 text-white font-black text-[9.5px] uppercase tracking-wider py-2.5 px-4 rounded-full"
              >
                My Wallet
              </button>
            </div>
          </div>
          <div className="absolute right-0 bottom-0 text-white/10 font-black text-9xl leading-none select-none pointer-events-none translate-x-4 translate-y-6">
            🇲🇼
          </div>
        </div>

        {/* NOTIFICATIONS LIST */}
        <div className="flex flex-col gap-3">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-neutral-400">Recent Announcements</h3>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="h-7 w-7 animate-spin rounded-full border-3 border-[#E53935] border-t-transparent" />
              <p className="mt-3 text-xs font-bold text-neutral-500">Kutsegula zotsatsa...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 py-10 text-center border border-neutral-150 shadow-3xs flex flex-col items-center">
              <div className="p-3 bg-neutral-50 rounded-full mb-3">
                <Tag className="h-6 w-6 text-neutral-300" />
              </div>
              <h4 className="font-extrabold text-xs text-neutral-900">No promo announcements yet</h4>
              <p className="text-[10px] text-neutral-500 font-semibold max-w-xs mt-1">
                Be on the lookout! Exclusive campaigns, coupon codes, and rewards and discounts appear right here.
              </p>
            </div>
          ) : (
            notifications.map((notif, idx) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.035 }}
                className={`bg-white rounded-3xl p-4 shadow-3xs border border-neutral-100 flex gap-3 ${
                  !notif.read ? 'border-l-4 border-l-[#FFB300]' : ''
                }`}
              >
                <div className="p-2 bg-amber-50 rounded-full self-start text-amber-500">
                  <Percent className="h-4.5 w-4.5" />
                </div>
                
                <div className="flex-1">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-extrabold text-xs text-neutral-900 leading-snug">
                      {notif.title}
                    </h4>
                    <span className="text-[8px] font-mono text-neutral-400 font-bold shrink-0">
                      {notif.createdAt instanceof Date 
                        ? notif.createdAt.toLocaleDateString()
                        : ''}
                    </span>
                  </div>

                  <p className="text-[10.5px] text-neutral-500 font-medium leading-relaxed mt-1">
                    {notif.body}
                  </p>

                  {notif.productId && (
                    <button
                      onClick={() => navigate(`/product/${notif.productId}`)}
                      className="mt-3 bg-neutral-900 hover:bg-black text-white px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1"
                    >
                      Browse Deal <ArrowUpRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
