import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  getDocs, 
  addDoc, 
  doc, 
  getDoc, 
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { handleFirestoreError } from '../firebase';
import { OperationType } from '../types';
import { 
  Settings, 
  Trash2, 
  ShoppingBag, 
  Tag, 
  Store, 
  ChevronRight, 
  Sparkles,
  Award,
  Gamepad,
  Search,
  Loader,
  MessageSquare,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'motion/react';

interface ConversationItem {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar: string;
  sellerId: string;
  storeName: string;
  storeAvatar: string;
  lastMessage: string;
  lastMessageAt: any;
  unreadCountBuyer: number;
  unreadCountSeller: number;
}

interface NotificationItem {
  id: string;
  type: string;
  body: string;
  read: boolean;
  createdAt: any;
}

export default function Messages() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();

  const chatWithParam = searchParams.get('chatWith');
  const storeNameParam = searchParams.get('storeName');
  const productNameParam = searchParams.get('productName');

  const [loading, setLoading] = useState(true);
  const [creatingChat, setCreatingChat] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  
  // Real-time unread count and previews for system notifications
  const [ordersNotifs, setOrdersNotifs] = useState<NotificationItem[]>([]);
  const [promoNotifs, setPromoNotifs] = useState<NotificationItem[]>([]);

  // 1. INCOMING REDIRECT/CONVERSATION CREATION ACTION
  useEffect(() => {
    if (!user || !chatWithParam) return;

    async function handleIncomingChatRequest() {
      setCreatingChat(true);
      try {
        // Query if conversation already exists between this buyer and seller
        // (both combinations are safe, but since primary structure is current buyerId == user.uid, query that)
        const convsRef = collection(db, 'conversations');
        const q = query(
          convsRef,
          where('buyerId', '==', user.uid),
          where('sellerId', '==', chatWithParam)
        );

        const snap = await getDocs(q);
        if (!snap.empty) {
          // Conversation exists - redirect directly
          navigate(`/messages/${snap.docs[0].id}`, { replace: true });
        } else {
          // Create new conversation
          const newDocRef = await addDoc(collection(db, 'conversations'), {
            buyerId: user.uid,
            buyerName: user.name || 'Mwayi',
            buyerAvatar: user.avatar || '',
            sellerId: chatWithParam,
            storeId: chatWithParam,
            storeName: storeNameParam || 'Malawi Farm Merchant',
            storeAvatar: '',
            lastMessage: productNameParam ? `Wofunsa za: "${productNameParam}"` : 'Uthenga watsopano / New Conversation',
            lastMessageAt: new Date().toISOString(),
            unreadCountBuyer: 0,
            unreadCountSeller: 1, // Seller gets unread count badge
            createdAt: new Date().toISOString()
          });

          // Insert first message to the subcollection
          await addDoc(collection(db, 'conversations', newDocRef.id, 'messages'), {
            senderId: user.uid,
            senderRole: 'buyer',
            type: 'text',
            content: productNameParam 
              ? `Inquiry regarding listed item: "${productNameParam}". Is this still available for pickup?`
              : 'Muli bwanji! I would like to inquire about your product listing on ShopEasy.',
            createdAt: new Date().toISOString(),
            read: false
          });

          navigate(`/messages/${newDocRef.id}`, { replace: true });
        }
      } catch (err) {
        console.error("Error setting up direct chat session:", err);
      } finally {
        setCreatingChat(false);
      }
    }

    handleIncomingChatRequest();
  }, [user, chatWithParam, storeNameParam, productNameParam, navigate]);

  // 2. LISTEN IN REAL TIME TO SELLER CONVERSATIONS
  useEffect(() => {
    if (!user || chatWithParam) return; // Prioritize redirection if landing from product detail page

    const convRef = collection(db, 'conversations');
    
    // Listen to conversations where current user is either the Buyer or Seller
    // We fetch and filter client-side to overcome Firestore single-index query limitations safely
    const unsubscribe = onSnapshot(convRef, (snap) => {
      const list: ConversationItem[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.buyerId === user.uid || data.sellerId === user.uid) {
          list.push({
            id: docSnap.id,
            buyerId: data.buyerId,
            buyerName: data.buyerName || 'Buyer',
            buyerAvatar: data.buyerAvatar || '',
            sellerId: data.sellerId,
            storeName: data.storeName || 'Merchant',
            storeAvatar: data.storeAvatar || '',
            lastMessage: data.lastMessage || 'Sent a message',
            lastMessageAt: data.lastMessageAt?.toDate() || new Date(data.lastMessageAt || Date.now()),
            unreadCountBuyer: data.unreadCountBuyer ?? 0,
            unreadCountSeller: data.unreadCountSeller ?? 0
          });
        }
      });

      // Sort by lastMessageAt desc
      list.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
      
      setConversations(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'conversations');
    });

    return () => unsubscribe();
  }, [user, chatWithParam]);

  // 3. LISTEN IN REAL TIME TO USER NOTIFICATIONS FOR PINNED FEEDS
  useEffect(() => {
    if (!user) return;

    const notifsRef = collection(db, 'notifications');
    const q = query(notifsRef, where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snap) => {
      const orders: NotificationItem[] = [];
      const promos: NotificationItem[] = [];

      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const item: NotificationItem = {
          id: docSnap.id,
          type: data.type || '',
          body: data.body || '',
          read: !!data.read,
          createdAt: data.createdAt?.toDate() || new Date(data.createdAt || Date.now())
        };

        if (data.type === 'order' || data.type === 'order_update') {
          orders.push(item);
        } else if (data.type === 'promo' || data.type === 'promotions') {
          promos.push(item);
        }
      });

      // Sort descending by timestamp
      orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      promos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      setOrdersNotifs(orders);
      setPromoNotifs(promos);
    }, (error) => {
      console.warn("Could not load pinned thread badge counts in real-time:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Clear Inbox Action: deletes conversations
  const handleClearInbox = async () => {
    if (conversations.length === 0) return;
    const accept = window.confirm("Kodi mukufuna kufuta macheza onse m'bokosili? (Delete all active chats in inbox?)");
    if (!accept) return;

    try {
      const batch = writeBatch(db);
      conversations.forEach((conv) => {
        const docRef = doc(db, 'conversations', conv.id);
        batch.delete(docRef);
      });
      await batch.commit();
      alert("Macheza onse afutidwa bwino! (All chats cleared!)");
    } catch (err) {
      console.error("Error clearing inbox batch:", err);
    }
  };

  if (creatingChat) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[500px] bg-white">
        <Loader className="h-8 w-8 animate-spin text-[#E53935]" />
        <h3 className="mt-4 font-extrabold text-sm text-neutral-900 leading-tight">Yambitsani Kulumikizana Tetezeka</h3>
        <p className="text-[10.5px] text-neutral-500 font-semibold max-w-sm mt-1 leading-relaxed">
          Establishing a secure chat proxy between you and the listing merchant. Please wait a split second...
        </p>
      </div>
    );
  }

  // Calculate unread badge numbers for system feeds
  const unreadOrdersCount = ordersNotifs.filter(n => !n.read).length;
  const unreadPromosCount = promoNotifs.filter(n => !n.read).length;

  // Latest status message strings
  const lastOrderPreview = ordersNotifs[0]?.body || 'Tsatirani maoda anu amphesa, tracking, ndi delivery/No order updates';
  const lastPromoPreview = promoNotifs[0]?.body || 'Zotsatsa zenizeni ndi ma coupon amphamvu/No promotional campaigns';

  // Game engagement flags: User interacted if they have certain coin counts or clicked/saved state
  const hasInteractedWithGames = user && user.coins > 0;

  return (
    <div className="bg-[#F5F5F5] min-h-screen">
      {/* 1. HEADER */}
      <div className="bg-white px-4 py-4 border-b border-neutral-100 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div>
          <h2 className="text-sm font-extrabold text-[#212121]">Messages</h2>
          <span className="text-[9px] font-mono font-black text-[#E53935] uppercase tracking-widest block mt-0.5">
            Inbox Hub • Live
          </span>
        </div>
        
        {/* Header Controls */}
        <div className="flex items-center gap-1.5">
          <button 
            onClick={handleClearInbox}
            title="Clear All Direct Seller Conversations"
            className="p-2 rounded-full hover:bg-neutral-50 text-neutral-500 hover:text-rose-600 transition"
          >
            <Trash2 className="h-4.5 w-4.5" />
          </button>
          <button 
            onClick={() => navigate('/settings/notifications')}
            title="Configure Push Alerts Alert Settings"
            className="p-2 rounded-full hover:bg-neutral-50 text-neutral-500 hover:text-neutral-900 transition"
          >
            <Settings className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">

        {/* 2. PINNED SYSTEM THREADS SECTION (Always present, top position) */}
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-wider text-neutral-400 mb-2">Pinned Feeds</h3>
          <div className="bg-white rounded-3xl p-3 shadow-3xs border border-neutral-100 flex flex-col gap-1">
            
            {/* Orders Pinned Row */}
            <div 
              onClick={() => navigate('/messages/orders')}
              className="flex items-center justify-between p-2.5 hover:bg-neutral-50 rounded-2xl cursor-pointer transition"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div className="max-w-[180px] sm:max-w-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <h4 className="font-extrabold text-xs text-neutral-900">Orders & Fulfillment</h4>
                  </div>
                  <p className="text-[10px] text-neutral-400 truncate font-semibold mt-0.5 leading-normal">
                    {lastOrderPreview}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {unreadOrdersCount > 0 && (
                  <span className="bg-[#E53935] text-white font-mono text-[9px] font-black h-5 w-5 rounded-full flex items-center justify-center animate-bounce">
                    {unreadOrdersCount}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-neutral-300" />
              </div>
            </div>

            {/* line splitter */}
            <div className="border-t border-dashed border-neutral-100 my-1" />

            {/* Promotions Pinned Row */}
            <div 
              onClick={() => navigate('/messages/promotions')}
              className="flex items-center justify-between p-2.5 hover:bg-neutral-50 rounded-2xl cursor-pointer transition"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-amber-50 text-[#FF8F00] flex items-center justify-center font-bold">
                  <Tag className="h-5 w-5" />
                </div>
                <div className="max-w-[180px] sm:max-w-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    <h4 className="font-extrabold text-xs text-neutral-900">Promotions & Coupons</h4>
                  </div>
                  <p className="text-[10px] text-neutral-400 truncate font-semibold mt-0.5 leading-normal">
                    {lastPromoPreview}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {unreadPromosCount > 0 && (
                  <span className="bg-[#FFB300] text-neutral-950 font-mono text-[9px] font-black h-5 w-5 rounded-full flex items-center justify-center">
                    {unreadPromosCount}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-neutral-300" />
              </div>
            </div>

          </div>
        </div>

        {/* 3. GAME/ACTIVITY THREADS */}
        {hasInteractedWithGames && (
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-wider text-neutral-400 mb-2">My Game Activities</h3>
            <div className="bg-white rounded-3xl p-3 shadow-3xs border border-neutral-100 flex flex-col gap-1">
              
              {/* Play & Earn Game Thread Row */}
              <div 
                onClick={() => navigate('/seller-dashboard')} // Re-direct or launch game elements
                className="flex items-center justify-between p-2.5 hover:bg-neutral-50 rounded-2xl cursor-pointer transition"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg">
                    💎
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-neutral-900">Play & Earn Center</h4>
                    <p className="text-[10px] text-emerald-600 font-bold mt-0.5">
                      Completed daily drop checks! (+50 Coins redeemable)
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-300" />
              </div>

            </div>
          </div>
        )}

        {/* 4. SELLER CONVERSATIONS SECTION */}
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-wider text-neutral-400 mb-2">Merchant Conversations</h3>

          {loading ? (
            <div className="flex flex-col items-center justify-center p-8 bg-white rounded-3xl border border-neutral-100 py-12">
              <Loader className="h-6 w-6 animate-spin text-[#E53935]" />
              <p className="mt-3 text-[11px] font-bold text-neutral-400">Loading inbox chats...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-neutral-150 shadow-3xs flex flex-col items-center py-16">
              <div className="p-3 bg-neutral-50 rounded-full mb-3 shrink-0">
                <Store className="h-7 w-7 text-neutral-300" />
              </div>
              <h4 className="font-extrabold text-xs text-neutral-900">Talk directly to local sellers</h4>
              <p className="text-[10px] text-neutral-550 font-semibold max-w-[240px] mt-1.5 leading-relaxed">
                Connect with local farmers in Limbe, Lilongwe, or Zomba to arrange quick pickups or custom price handoffs.
              </p>
              <button
                onClick={() => navigate('/shop')}
                className="mt-5 bg-neutral-900 hover:bg-black text-white font-black text-[10px] uppercase tracking-wider px-5 py-2.5 rounded-full shadow-sm"
              >
                Find Farmers Inside Malawi
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {conversations.map((conv, idx) => {
                const isUserBuyer = conv.buyerId === user?.uid;
                const otherPartyUnreadBadge = isUserBuyer ? conv.unreadCountBuyer : conv.unreadCountSeller;
                const isUnread = otherPartyUnreadBadge > 0;

                return (
                  <motion.div
                    key={conv.id}
                    onClick={() => navigate(`/messages/${conv.id}`)}
                    className={`bg-white rounded-3xl p-4 shadow-3xs border transition cursor-pointer flex justify-between items-center gap-4 ${
                      isUnread 
                        ? 'border-l-4 border-l-[#E53935] border-neutral-200/90 font-extrabold bg-red-50/10' 
                        : 'border-neutral-150 hover:bg-neutral-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#E53935] to-[#FF8F00] text-white font-black flex items-center justify-center shrink-0 overflow-hidden text-xs">
                        {isUserBuyer && conv.storeAvatar ? (
                          <img src={conv.storeAvatar} alt={conv.storeName} referrerPolicy="no-referrer" className="h-[100%] w-[100%] object-cover" />
                        ) : !isUserBuyer && conv.buyerAvatar ? (
                          <img src={conv.buyerAvatar} alt={conv.buyerName} referrerPolicy="no-referrer" className="h-[100%] w-[100%] object-cover" />
                        ) : (
                          <span>{(isUserBuyer ? conv.storeName : conv.buyerName).slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h4 className="font-extrabold text-xs text-[#212121] leading-snug truncate">
                          {isUserBuyer ? conv.storeName : conv.buyerName}
                        </h4>
                        <p className={`text-[10px] mt-0.5 truncate leading-normal ${
                          isUnread ? 'text-[#212121] font-black' : 'text-neutral-500 font-medium'
                        }`}>
                          {conv.lastMessage}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0 gap-1.5 min-w-[50px]">
                      <span className="text-[8px] font-mono text-neutral-400 font-bold">
                        {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isUnread && (
                        <span className="bg-[#E53935] text-white text-[8px] font-black font-mono px-2 py-0.5 rounded-full animate-pulse">
                          NEW
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
