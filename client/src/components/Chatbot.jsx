import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '../services/api';

const Chatbot = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: "Hi! Welcome to CRAVE. Ready to order something delicious? 🍕", sender: "bot" }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { if (isOpen) scrollToBottom(); }, [messages, isOpen]);

  // --- 1. LISTEN FOR THE CART POP-UP ---
  useEffect(() => {
    const handleCartToggle = (e) => {
      setIsCartModalOpen(e.detail);
      if (e.detail) setIsOpen(false);
    };

    window.addEventListener('crave:cartToggle', handleCartToggle);
    return () => window.removeEventListener('crave:cartToggle', handleCartToggle);
  }, []);

  // --- 2. HIDE LOGIC ---
  const hiddenPaths = ['/admin', '/restaurant', '/rider'];
  const isPathHidden = hiddenPaths.some(path => location.pathname.startsWith(path));
  
  const isHidden = isPathHidden || isCartModalOpen; 

  // --- 3. ADD TO CART LOGIC ---
  const handleAddToCart = async (itemId, itemName) => {
    const storedUserId = sessionStorage.getItem('user_id');
    if (!storedUserId) {
      setMessages(prev => [...prev, { text: "⚠️ Please log in to add items!", sender: "bot" }]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/cart/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: parseInt(storedUserId, 10),
          menu_item_id: itemId,
          quantity: 1
        }),
      });

      if (response.ok) {
        setMessages(prev => [...prev, { text: `✅ ${itemName} added to your cart!`, sender: "bot" }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { text: "❌ Connection error.", sender: "bot" }]);
    }
  };

  // --- 4. FORMATTER ---
  const renderMessageText = (text) => {
    const cartRegex = /\[Add ([^ ]+) ID:(\d+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = cartRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex, match.index)}</span>);
      }
      const [_, itemName, itemId] = match;
      parts.push(
        <div key={`btn-${match.index}`} className="mt-3 transform transition-all duration-200 active:scale-95">
          <button
            onClick={() => handleAddToCart(parseInt(itemId, 10), itemName)}
            className="flex items-center gap-2 bg-white text-[#e8601a] border-2 border-[#e8601a] px-4 py-2 rounded-full text-xs font-bold shadow-sm hover:bg-[#e8601a] hover:text-white transition-colors duration-300"
          >
            <span className="text-base">🛒</span> Add {itemName}
          </button>
        </div>
      );
      lastIndex = cartRegex.lastIndex;
    }
    if (lastIndex < text.length) parts.push(<span key={`text-end`}>{text.substring(lastIndex)}</span>);
    return parts.length > 0 ? parts : text;
  };

  // --- 5. SEND MESSAGE ---
  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = input;
    const newMessages = [...messages, { text: userMessage, sender: "user" }];
    setMessages(newMessages);
    setInput('');

    const storedUserId = sessionStorage.getItem('user_id');
    const currentUserId = storedUserId ? parseInt(storedUserId, 10) : null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, user_id: currentUserId }),
      });
      const data = await response.json();
      setMessages([...newMessages, { text: data.reply, sender: "bot" }]);
    } catch (error) {
      setMessages([...newMessages, { text: "Server connection error.", sender: "bot" }]);
    }
  };

  if (isHidden) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[99] font-sans">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-16 h-16 bg-white text-[#e8601a] rounded-full shadow-2xl flex items-center justify-center text-3xl border border-orange-100 hover:scale-110 active:scale-90 transition-all duration-300 animate-bounce-slow"
        >
          💬
        </button>
      )}

      {isOpen && (
        <div className="w-[360px] h-[520px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-[#e8601a] p-4 text-white flex justify-between items-center shadow-md">
            <div className="flex items-center gap-3">
              <div className="bg-white text-[#e8601a] rounded-lg w-8 h-8 flex items-center justify-center font-bold text-xl shadow-inner">C</div>
              <div>
                <h3 className="font-bold text-sm tracking-wide">CRAVE AI</h3>
                <p className="text-[10px] text-orange-100 opacity-80 leading-none">Always active</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:rotate-90 transition-transform duration-300 p-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 bg-orange-50/20 flex flex-col gap-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm transition-all animate-in fade-in slide-in-from-bottom-2 duration-300
                  ${msg.sender === "user" ? "self-end bg-[#e8601a] text-white rounded-br-none" : "self-start bg-white text-slate-700 border border-orange-100 rounded-bl-none"}`}
              >
                {renderMessageText(msg.text)}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-white border-t border-slate-100 flex gap-2 items-center">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Hungry? Ask me anything..."
              className="flex-1 px-4 py-2.5 bg-slate-50 rounded-full border border-slate-200 focus:outline-none focus:border-[#e8601a] focus:ring-1 focus:ring-[#e8601a] text-sm transition-all"
            />
            <button onClick={sendMessage} className="bg-[#e8601a] text-white p-2.5 rounded-full hover:bg-[#d05315] hover:shadow-lg active:scale-95 transition-all shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .animate-bounce-slow { animation: bounce-slow 3s infinite ease-in-out; }
      `}</style>
    </div>
  );
};

export default Chatbot;