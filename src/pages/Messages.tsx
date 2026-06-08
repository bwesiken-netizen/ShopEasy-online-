import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SAMPLE_STORES } from '../data/malawiProducts';
import { useAuthStore } from '../stores';
import { Send, ClipboardCheck, ArrowLeft, SendHorizontal, PhoneCall } from 'lucide-react';

export default function Messages() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chatWithParam = searchParams.get('chatWith');
  const productNameParam = searchParams.get('productName');

  const { user } = useAuthStore();

  const [activeStoreId, setActiveStoreId] = useState<string>(chatWithParam || 'store_limbe');
  const [inputText, setInputText] = useState('');

  // Find store details
  const currentStore = SAMPLE_STORES.find((s) => s.id === activeStoreId) || SAMPLE_STORES[0];

  // Mock message log
  const [messages, setMessages] = useState<any[]>([
    {
      id: 'm1',
      senderId: 'store_limbe',
      text: 'Muli bwanji! Welcome to our Golden farm support. How can we help you inside Blantyre today?',
      createdAt: new Date(Date.now() - 3600000 * 2),
      read: true
    }
  ]);

  useEffect(() => {
    if (productNameParam && chatWithParam) {
      // Auto-populate query intent
      setMessages((prev) => [
        ...prev,
        {
          id: 'm2_intent',
          senderId: 'buyer',
          text: `Inquiry regarding listed item: "${productNameParam}". Is this still available for pickup?`,
          createdAt: new Date(),
          read: true
        }
      ]);
    }
  }, [productNameParam, chatWithParam]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg = {
      id: 'm_' + Math.random().toString(36).substring(2, 9),
      senderId: 'buyer',
      text: inputText,
      createdAt: new Date(),
      read: true
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');

    // Trigger seller reply simulation after 1.5 seconds
    setTimeout(() => {
      const replies = [
        'Chabwino! Let\'s arrange. We can meet in public near Limbe Market or Post Office.',
        'Zabwino kwambiri, the stock is fresh! You can request paychangu verification at checkout.',
        'Ee, we have enough stock stored in our Lilongwe depot. When would you like to collect?',
        'Zikomo! Please phone my TNM/Airtel number if you need instant delivery coordination!'
      ];
      const randomReplyText = replies[Math.floor(Math.random() * replies.length)];

      setMessages((prev) => [
        ...prev,
        {
          id: 'reply_' + Math.random().toString(36).substring(2, 9),
          senderId: activeStoreId,
          text: randomReplyText,
          createdAt: new Date(),
          read: false
        }
      ]);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] sm:h-[680px] bg-[#F5F5F5] animate-[fadeIn_0.3s_ease]">
      
      {/* 1. SELLER STORE HEADER */}
      <div className="bg-white px-4 py-3 border-b border-neutral-100 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-neutral-50 sm:hidden">
            <ArrowLeft className="h-5 w-5 text-neutral-700" />
          </button>
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#E53935] to-[#FFB300] text-white flex items-center justify-center font-bold text-sm">
            🏪
          </div>
          <div>
            <h4 className="font-extrabold text-xs text-neutral-900 leading-tight">{currentStore.name}</h4>
            <span className="text-[9px] text-[#E53935] font-black uppercase tracking-wider block">
              Local Seller • {currentStore.city}
            </span>
          </div>
        </div>

        {currentStore.contactPhone && (
          <a
            href={`tel:${currentStore.contactPhone}`}
            title="Call seller locally in Malawi"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition"
          >
            <PhoneCall className="h-4 w-4" />
          </a>
        )}
      </div>

      {/* 2. CONVERSATION VIEW GRID (SCROLLABLE) */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.map((msg) => {
          const isSenderMe = msg.senderId === 'buyer';
          return (
            <div 
              key={msg.id}
              className={`flex ${isSenderMe ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] rounded-2xl p-3.5 shadow-sm text-xs font-bold ${
                isSenderMe 
                  ? 'bg-[#E53935] text-white rounded-br-none' 
                  : 'bg-white text-neutral-900 rounded-bl-none border border-neutral-100'
              }`}>
                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                <div className={`text-[8px] font-mono mt-1 text-right ${isSenderMe ? 'text-neutral-200' : 'text-neutral-450'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. INPUT SENDER ACTIONS */}
      <form onSubmit={handleSendMessage} className="bg-white border-t border-neutral-150 p-3 flex gap-2 items-center">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Lembani uthenga wanu pano/Type message..."
          className="flex-1 text-xs font-semibold rounded-2xl border border-neutral-200 bg-neutral-50 p-3 focus:outline-none focus:ring-1 focus:ring-[#E53935] focus:bg-white text-[#212121]"
        />
        <button 
          type="submit"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E53935] hover:bg-red-700 text-white shadow transition-transform active:scale-95 shrink-0"
        >
          <SendHorizontal className="h-4.5 w-4.5" />
        </button>
      </form>

    </div>
  );
}
