import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { handleFirestoreError } from '../firebase';
import { OperationType } from '../types';
import { ArrowLeft, ShoppingBag, Eye, Calendar, Award, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { motion } from 'motion/react';

interface OrderNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  orderId?: string;
  read: boolean;
  createdAt: any;
}

export default function MessageOrders() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Listen in real-time to the notifications collection
    const notifsRef = collection(db, 'notifications');
    const q = query(
      notifsRef,
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const list: OrderNotification[] = [];
        const unreadToMarkRead: string[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Match 'order' or 'order_update' types
          if (data.type === 'order' || data.type === 'order_update') {
            const item: OrderNotification = {
              id: docSnap.id,
              userId: data.userId,
              type: data.type,
              title: data.title || 'Sinthani Kakhalidwe ka Order',
              body: data.body || '',
              orderId: data.orderId,
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

        // Turn read = true in real time so badge counts go down
        if (unreadToMarkRead.length > 0) {
          const batch = writeBatch(db);
          unreadToMarkRead.forEach((id) => {
            const docRef = doc(db, 'notifications', id);
            batch.update(docRef, { read: true });
          });
          try {
            await batch.commit();
          } catch (err) {
            console.error("Failed to mark order notifications as read", err);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      }
    );

    return () => unsubscribe();
  }, [user]);

  const getStatusIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('delivered') || t.includes('completed') || t.includes('pambiri') || t.includes('chabwino')) {
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    }
    if (t.includes('refund') || t.includes('cancel') || t.includes('dispute') || t.includes('vuto')) {
      return <AlertTriangle className="h-5 w-5 text-[#E53935]" />;
    }
    if (t.includes('processing') || t.includes('thupi')) {
      return <Clock className="h-5 w-5 text-amber-500" />;
    }
    return <ShoppingBag className="h-5 w-5 text-[#E53935]" />;
  };

  return (
    <div className="bg-[#F5F5F5] min-h-screen">
      {/* HEADER */}
      <div className="bg-white px-4 py-4 border-b border-neutral-100 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/messages')} className="p-1.5 rounded-full hover:bg-neutral-50" id="back-btn-orders">
            <ArrowLeft className="h-5 w-5 text-neutral-700" />
          </button>
          <div>
            <h2 className="text-sm font-extrabold text-[#212121]">Orders & Updates</h2>
            <span className="text-[9px] font-mono font-black text-[#E53935] uppercase tracking-widest">
              System Assistant
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E53935] border-t-transparent" />
            <p className="mt-4 text-xs font-bold text-neutral-500">Kutsegula maoda/Loading order alerts...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center bg-white rounded-3xl p-10 text-center shadow-3xs border border-neutral-150 py-16">
            <div className="h-16 w-16 bg-neutral-50 rounded-full flex items-center justify-center mb-4">
              <ShoppingBag className="h-8 w-8 text-neutral-300" />
            </div>
            <h3 className="font-extrabold text-sm text-neutral-900">No Order Alerts Yet</h3>
            <p className="text-[11px] text-neutral-500 font-semibold max-w-xs mt-1.5 leading-relaxed">
              When you purchase farm goods or products, shipping updates and dispatch tracking notifications will appear here.
            </p>
            <button
              onClick={() => navigate('/shop')}
              className="mt-6 bg-[#E53935] hover:bg-red-700 text-white font-black text-[10.5px] uppercase tracking-wider px-6 py-2.5 rounded-full shadow-sm"
            >
              Start Exploring Shop
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {notifications.map((notif, idx) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className={`bg-white rounded-3xl p-4 shadow-3xs border border-neutral-100 flex gap-3 transition hover:shadow-2xs ${
                  !notif.read ? 'border-l-4 border-l-[#E53935]' : ''
                }`}
              >
                <div className="p-2.5 bg-neutral-50 rounded-full self-start">
                  {getStatusIcon(notif.title)}
                </div>

                <div className="flex-1">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-extrabold text-[12px] text-neutral-900 leading-tight">
                      {notif.title}
                    </h4>
                    <span className="text-[8px] font-mono text-neutral-400 font-semibold shrink-0">
                      {notif.createdAt instanceof Date 
                        ? notif.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>
                  </div>

                  <p className="text-[10.5px] text-neutral-600 font-medium leading-relaxed mt-1">
                    {notif.body}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-neutral-100">
                    <span className="text-[9px] font-mono font-bold text-neutral-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {notif.createdAt instanceof Date 
                        ? notif.createdAt.toLocaleDateString()
                        : ''}
                    </span>

                    {notif.orderId && (
                      <button
                        onClick={() => navigate(`/account/orders?id=${notif.orderId}`)}
                        className="flex items-center gap-1.5 bg-neutral-900 hover:bg-black text-white py-1.5 px-3 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View Order
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
