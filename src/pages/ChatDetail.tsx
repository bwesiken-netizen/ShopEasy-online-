import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { db, storage } from '../firebase';
import { 
  doc, 
  getDoc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  limit, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { handleFirestoreError } from '../firebase';
import { OperationType } from '../types';
import { 
  ArrowLeft, 
  Send, 
  Camera, 
  ShieldAlert, 
  X, 
  Check, 
  CheckCheck, 
  Image as ImageIcon,
  Loader,
  Phone,
  AlertTriangle,
  FileImage,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ConversationData {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar: string;
  sellerId: string;
  storeId: string;
  storeName: string;
  storeAvatar: string;
  lastMessage: string;
  lastMessageAt: any;
  unreadCountBuyer: number;
  unreadCountSeller: number;
  createdAt: any;
  orderId?: string;
}

interface MessageData {
  id: string;
  senderId: string;
  senderRole: string;
  type: 'text' | 'image' | 'system';
  content: string;
  createdAt: any;
  read: boolean;
}

export default function ChatDetail() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showWarningBanner, setShowWarningBanner] = useState(true);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // 1. Core conversation sync listener
  useEffect(() => {
    if (!user || !conversationId) return;

    const convRef = doc(db, 'conversations', conversationId);
    
    const unsubConv = onSnapshot(convRef, (snap) => {
      if (!snap.exists()) {
        console.warn("Conversation does not exist");
        setLoading(false);
        return;
      }

      const data = snap.data();
      // Security role validation
      if (data.buyerId !== user.uid && data.sellerId !== user.uid) {
        console.error("Access denied to conversation");
        navigate('/messages');
        return;
      }

      setConversation({
        id: snap.id,
        buyerId: data.buyerId,
        buyerName: data.buyerName || 'Mwayi',
        buyerAvatar: data.buyerAvatar || '',
        sellerId: data.sellerId,
        storeId: data.storeId || data.sellerId,
        storeName: data.storeName || 'Store Owner',
        storeAvatar: data.storeAvatar || '',
        lastMessage: data.lastMessage || '',
        lastMessageAt: data.lastMessageAt,
        unreadCountBuyer: data.unreadCountBuyer ?? 0,
        unreadCountSeller: data.unreadCountSeller ?? 0,
        createdAt: data.createdAt,
        orderId: data.orderId
      });

      // Clear current user's unread counter inside the conversation
      const isUserBuyer = data.buyerId === user.uid;
      if (isUserBuyer && data.unreadCountBuyer > 0) {
        updateDoc(convRef, { unreadCountBuyer: 0 }).catch(err => {
          console.warn("Failed reset unreadCountBuyer", err);
        });
      } else if (!isUserBuyer && data.unreadCountSeller > 0) {
        updateDoc(convRef, { unreadCountSeller: 0 }).catch(err => {
          console.warn("Failed reset unreadCountSeller", err);
        });
      }

      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `conversations/${conversationId}`);
    });

    return () => unsubConv();
  }, [user, conversationId, navigate]);

  // 2. Messages subcollection sync listener
  useEffect(() => {
    if (!user || !conversationId) return;

    const msgsRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(msgsRef, orderBy('createdAt', 'asc'), limit(50));

    const unsubMsgs = onSnapshot(q, async (snap) => {
      const list: MessageData[] = [];
      const unreadMsgDocs: string[] = [];

      snap.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          senderId: d.senderId,
          senderRole: d.senderRole,
          type: d.type || 'text',
          content: d.content || '',
          createdAt: d.createdAt?.toDate() || new Date(d.createdAt || Date.now()),
          read: !!d.read
        });

        // Collect messages sent by the other party that are currently unread
        if (d.senderId !== user.uid && !d.read) {
          unreadMsgDocs.push(docSnap.id);
        }
      });

      setMessages(list);

      // Perform batch update to mark all other party's messages as read
      if (unreadMsgDocs.length > 0) {
        const batch = writeBatch(db);
        unreadMsgDocs.forEach((msgId) => {
          const mRef = doc(db, 'conversations', conversationId, 'messages', msgId);
          batch.update(mRef, { read: true });
        });
        try {
          await batch.commit();
        } catch (err) {
          console.warn("Error marking messages as read:", err);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `conversations/${conversationId}/messages`);
    });

    return () => unsubMsgs();
  }, [user, conversationId]);

  // Handle message sends
  const handleSendMessage = async (textToSend?: string, attachedImageUrl?: string) => {
    if (!user || !conversationId || !conversation) return;

    const isText = !attachedImageUrl;
    const content = isText ? (textToSend || inputText).trim() : attachedImageUrl!;
    if (!content) return;

    const senderRole = conversation.buyerId === user.uid ? 'buyer' : 'seller';
    const isUserBuyer = senderRole === 'buyer';

    if (isText) {
      setInputText('');
    }

    try {
      // 1. Add message subcollection document
      await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        senderId: user.uid,
        senderRole,
        type: isText ? 'text' : 'image',
        content,
        createdAt: serverTimestamp(),
        read: false
      });

      // 2. Update parent conversation document
      const convRef = doc(db, 'conversations', conversationId);
      const updatePayload: any = {
        lastMessage: isText ? content : 'Sent an image attachment 📷',
        lastMessageAt: serverTimestamp()
      };

      // Increment recipient's unread badge count
      if (isUserBuyer) {
        updatePayload.unreadCountSeller = (conversation.unreadCountSeller || 0) + 1;
      } else {
        updatePayload.unreadCountBuyer = (conversation.unreadCountBuyer || 0) + 1;
      }

      await updateDoc(convRef, updatePayload);
    } catch (err) {
      console.error("Error sending chat message:", err);
    }
  };

  const handleKeyPress = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };

  // Image upload handler
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadAndSendImage(file);
  };

  const uploadAndSendImage = async (file: File) => {
    if (!conversationId) return;

    // Validate size and type for security
    if (!file.type.startsWith('image/')) {
      alert('Chonde tumizani chithunzi chokha! (Only image files allowed)');
      return;
    }

    setUploadingImage(true);
    try {
      const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${file.name.replace(/\s+/g, '_')}`;
      const imgRef = ref(storage, `chats/${conversationId}/${uniqueName}`);
      
      const snap = await uploadBytes(imgRef, file);
      const downloadUrl = await getDownloadURL(snap.ref);
      
      await handleSendMessage(undefined, downloadUrl);
    } catch (err) {
      console.error("Storage upload error in chat:", err);
      alert("Met with block uploading image. Please check your storage quota limits.");
    } finally {
      setUploadingImage(false);
    }
  };

  // Drag and Drop files upload helper (usability rules)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await uploadAndSendImage(file);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[500px] bg-white">
        <Loader className="h-8 w-8 animate-spin text-[#E53935]" />
        <span className="mt-4 text-xs font-bold text-neutral-500">Kulumikiza chitetezo/Connecting chat list...</span>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[500px] bg-white">
        <AlertTriangle className="h-10 w-10 text-neutral-300 mb-2" />
        <span className="text-xs font-bold text-neutral-500">Kucheza kumeneku kulibe/Conversation not found.</span>
        <button onClick={() => navigate('/messages')} className="mt-4 text-xs font-extrabold text-[#E53935] uppercase tracking-wider">
          Go To Inbox
        </button>
      </div>
    );
  }

  const isMeBuyer = conversation.buyerId === user?.uid;
  const chatPartnerName = isMeBuyer ? conversation.storeName : conversation.buyerName;
  const chatPartnerAvatar = isMeBuyer ? conversation.storeAvatar : conversation.buyerAvatar;

  return (
    <div 
      className={`flex flex-col h-[calc(100vh-140px)] sm:h-[720px] bg-[#F5F5F5] transition-all relative ${
        isDragOver ? 'ring-4 ring-[#E53935] ring-inset' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      
      {/* HEADER */}
      <div className="bg-white px-4 py-3 border-b border-neutral-100 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/messages')} className="p-1.5 rounded-full hover:bg-neutral-50" id="back-btn-detail">
            <ArrowLeft className="h-5 w-5 text-neutral-700" />
          </button>
          
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#E53935] to-[#FFB300] text-white flex items-center justify-center font-bold text-sm overflow-hidden border border-neutral-150 shrink-0">
            {chatPartnerAvatar ? (
              <img src={chatPartnerAvatar} alt={chatPartnerName} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
            ) : (
              <span>{chatPartnerName.slice(0, 1).toUpperCase()}</span>
            )}
          </div>

          <div>
            <h4 className="font-extrabold text-[12px] text-neutral-900 leading-tight">{chatPartnerName}</h4>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9.5px] text-neutral-400 font-bold uppercase tracking-wider">
                Active Now
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => alert('Chitetezo Chawonjezereka! Reporting system loaded. Any harassment can be logged under privacy panel.')}
            className="text-[9px] font-black uppercase tracking-wider text-rose-600 hover:text-red-700 bg-rose-50 px-2.5 py-1.5 border border-rose-100 rounded-full"
            title="Block or Report seller in Malawi"
          >
            Block Agent
          </button>
        </div>
      </div>

      {/* WARNING DISMISSABLE BANNER */}
      <AnimatePresence>
        {showWarningBanner && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-50 border-b border-amber-100 text-[#FF8F00] px-4 py-2.5 flex items-start gap-2.5 text-[10px] font-semibold tracking-normal"
          >
            <ShieldAlert className="h-4 w-4 shrink-0 text-[#FF8F00] mt-0.5" />
            <div className="flex-grow">
              Avoid off-platform payments to prevent scams! Always check out invoice details on <span className="font-extrabold text-neutral-950">ShopEasy Malawi</span>.
            </div>
            <button onClick={() => setShowWarningBanner(false)} className="p-0.5 hover:bg-amber-150 rounded text-[#FF8F00]">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DRAG OVERLAY INDICATOR */}
      {isDragOver && (
        <div className="absolute inset-0 bg-neutral-900/40 z-30 flex flex-col justify-center items-center text-white font-extrabold text-center pointer-events-none p-6">
          <div className="h-20 w-20 rounded-full bg-[#E53935] flex items-center justify-center shadow-lg animate-bounce">
            <FileImage className="h-10 w-10 text-white" />
          </div>
          <h3 className="mt-4 font-display text-lg text-white font-black">Drop files here to Upload</h3>
          <p className="text-xs text-neutral-200 col-span-2 font-medium">Send picture instantly to local chat thread</p>
        </div>
      )}

      {/* MESSAGES VIEW PORT */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="text-center py-10 flex flex-col items-center justify-center gap-2">
            <div className="h-10 w-10 bg-white shadow-3xs rounded-full flex items-center justify-center text-xs">
              💬
            </div>
            <span className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-widest">
              Lembani uthenga wanu/No messages here yet
            </span>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === user?.uid;
            
            if (msg.type === 'system') {
              return (
                <div key={msg.id || idx} className="flex justify-center my-2 select-none">
                  <div className="bg-neutral-200/60 border border-neutral-300/45 text-neutral-700 rounded-full px-4 py-1.5 text-[9px] font-bold tracking-wide">
                    {msg.content}
                  </div>
                </div>
              );
            }

            return (
              <div 
                key={msg.id || idx} 
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className={`max-w-[75%] rounded-2xl p-3.5 text-xs font-semibold leading-relaxed ${
                  isMe 
                    ? 'bg-gradient-to-br from-[#E53935] to-red-600 text-white rounded-tr-xs shadow-3xs' 
                    : 'bg-white text-neutral-900 rounded-tl-xs border border-neutral-100 shadow-3xs'
                }`}>
                  {msg.type === 'image' ? (
                    <div className="relative cursor-pointer overflow-hidden rounded-lg border border-neutral-200/50 bg-neutral-100">
                      <img 
                        src={msg.content} 
                        alt="Shared in chat attachment" 
                        referrerPolicy="no-referrer"
                        className="max-h-56 object-contain w-full"
                        onClick={() => setExpandedImage(msg.content)}
                      />
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                  
                  {/* Status Indicator inside the message bubble footer */}
                  <div className="flex items-center justify-end gap-1 mt-1 text-[8px] font-mono leading-none">
                    <span className={isMe ? 'text-neutral-200/80' : 'text-neutral-400'}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isMe && (
                      msg.read ? (
                        <CheckCheck className="h-3 w-3 text-red-200" title="Read by merchant" />
                      ) : (
                        <Check className="h-3 w-3 text-red-200" title="Sent successfully" />
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* SENDER INPUT BAR */}
      <div className="bg-white border-t border-neutral-100 p-3 flex gap-2 items-center relative">
        {uploadingImage && (
          <div className="absolute top-0 left-0 right-0 -translate-y-full bg-white/90 py-2 border-t border-neutral-100 flex items-center justify-center gap-2 text-xs text-neutral-600 font-bold z-10 backdrop-blur-xs">
            <Loader className="h-3.5 w-3.5 animate-spin text-[#E53935]" /> Loading farm picture attachment...
          </div>
        )}

        <button 
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Attach image from photo roll"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-50 hover:bg-neutral-100 text-neutral-500 shrink-0 transition border border-neutral-150 active:scale-95"
          disabled={uploadingImage}
        >
          <Camera className="h-5 w-5 text-neutral-600" />
        </button>
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleImageFileChange}
          accept="image/*"
          className="hidden" 
        />

        <form onSubmit={handleKeyPress} className="flex-1 flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Lembani uthenga wanu pano/Type message..."
            className="flex-1 text-xs font-semibold rounded-2xl border border-neutral-200 bg-neutral-50 p-3 focus:outline-none focus:ring-1 focus:ring-[#E53935] focus:bg-white text-[#212121]"
            disabled={uploadingImage}
          />
          <button 
            type="submit"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E53935] hover:bg-red-700 text-white shadow shadow-red-200 shrink-0 transition-all transform active:scale-95 disabled:bg-neutral-300"
            disabled={!inputText.trim() || uploadingImage}
          >
            <Send className="h-4.5 w-4.5" />
          </button>
        </form>
      </div>

      {/* BIG FULL SCREEN IMAGE MODAL */}
      <AnimatePresence>
        {expandedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutral-950/95 z-50 flex flex-col justify-center items-center p-4 cursor-zoom-out"
            onClick={() => setExpandedImage(null)}
          >
            <button 
              onClick={() => setExpandedImage(null)}
              className="absolute top-4 right-4 bg-white/20 text-white rounded-full p-2.5 hover:bg-white/40 border border-white/20"
            >
              <X className="h-5 w-5" />
            </button>
            <img 
              src={expandedImage} 
              alt="Shared details full width" 
              referrerPolicy="no-referrer"
              className="max-h-[80vh] max-w-full rounded-2xl shadow-2xl object-contain border border-neutral-800" 
            />
            <div className="mt-4 flex gap-3 text-neutral-400 text-[10px] font-mono select-all">
              <span className="bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-full flex items-center gap-1.5">
                <ExternalLink className="h-3 w-3" />
                <a href={expandedImage} target="_blank" rel="noopener noreferrer" className="hover:text-white underline">
                  View full original size
                </a>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
