// import React, { useState, useEffect } from 'react';
// import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, MapPin, ReceiptText } from 'lucide-react';
// import { motion, AnimatePresence } from 'framer-motion';
// import { useToast } from '../context/useToast';
// import CheckoutModal from './CheckoutModal';

// const Cart = ({ isOpen, onClose, cartItems = [], onUpdate }) => {
//   const { addToast } = useToast();
//   const [showCheckout, setShowCheckout] = useState(false);
//   const [address, setAddress] = useState("");
//   const [isSaving, setIsSaving] = useState(false);
//   const [isUpdating, setIsUpdating] = useState(false);

//   // --- FETCH SAVED ADDRESS ON OPEN ---
//   useEffect(() => {
//     const fetchUserAddress = async () => {
//       if (!isOpen) return;
//       const token = sessionStorage.getItem('token') || localStorage.getItem('token');
//       if (!token) return;

//       try {
//         const response = await fetch('http://localhost:8000/api/users/me', {
//           headers: { 'Authorization': `Bearer ${token}` }
//         });
//         if (response.ok) {
//           const userData = await response.json();
//           if (userData.address) setAddress(userData.address);
//         }
//       } catch (error) {
//         console.error("Failed to fetch address", error);
//       }
//     };
//     fetchUserAddress();
//   }, [isOpen]);

//   // --- CALCULATIONS ---
//   const itemTotal = cartItems.reduce((acc, item) => {
//     const dPrice = item.discount_price || item.discountPrice;
//     const finalPrice = (dPrice > 0 && dPrice < item.price) ? dPrice : item.price;
//     return acc + (finalPrice * item.quantity);
//   }, 0);

//   const tax = Math.round(itemTotal * 0.05);
//   const grandTotal = itemTotal + tax;

//   const handleUpdateAddress = async () => {
//     const token = sessionStorage.getItem('token') || localStorage.getItem('token');
//     if (!token) return addToast("Please login first.", "error");
//     if (!address.trim()) return addToast("Enter an address.", "error");

//     setIsUpdating(true);
//     try {
//       const response = await fetch('http://localhost:8000/api/update-address', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
//         body: JSON.stringify({ address: address })
//       });
//       if (response.ok) addToast("Address saved!", "success");
//     } catch (e) { console.error(e); }
//     finally { setIsUpdating(false); }
//   };

//   const handleProceedToPay = async () => {
//     const token = sessionStorage.getItem('token') || localStorage.getItem('token');
//     if (!token) return addToast("Please login.", "error");
//     if (!address.trim()) return addToast("Delivery address required.", "error");

//     setIsSaving(true);
//     try {
//       const response = await fetch('http://localhost:8000/api/update-address', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
//         body: JSON.stringify({ address: address })
//       });
//       if (response.ok) setShowCheckout(true);
//       else addToast("Failed to verify address.", "error");
//     } catch (e) { console.error(e); }
//     finally { setIsSaving(false); }
//   };

//   return (
//     <AnimatePresence>
//       {isOpen && (
//         <>
//           {/* Overlay */}
//           <motion.div
//             initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
//             onClick={onClose}
//             className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-[150]"
//           />

//           {/* Cart Sidebar */}
//           <motion.div
//             initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
//             transition={{ type: "spring", damping: 28, stiffness: 220 }}
//             className="fixed top-0 right-0 h-full w-full sm:max-w-md bg-[#F9F9F9] z-[150] shadow-2xl flex flex-col overflow-hidden"
//           >
//             {/* --- HEADER --- */}
//             <div className="bg-white/80 backdrop-blur-md px-6 py-5 border-b border-zinc-100 flex items-center justify-between shrink-0">
//               <div>
//                 <h2 className="text-xl font-black text-zinc-900 flex items-center gap-2">
//                   My Cart
//                 </h2>
//                 <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
//                   {cartItems.length} items ready to go
//                 </p>
//               </div>
//               <button onClick={onClose} className="w-10 h-10 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 transition-colors border border-zinc-100">
//                 <X size={20} />
//               </button>
//             </div>

//             {/* --- SCROLLABLE CONTENT --- */}
//             <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 no-scrollbar">
//               {cartItems.length === 0 ? (
//                 <div className="h-full flex flex-col items-center justify-center text-center">
//                   <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mb-4 text-zinc-300">
//                     <ShoppingBag size={40} />
//                   </div>
//                   <h3 className="text-lg font-black text-zinc-800">Your cart is empty</h3>
//                   <p className="text-sm text-zinc-400 mt-1">Add items from the menu to start an order.</p>
//                 </div>
//               ) : (
//                 <>
//                   {/* Address Section */}
//                   <div className="bg-white rounded-3xl p-5 border border-zinc-100 shadow-sm">
//                     <div className="flex items-center justify-between mb-4">
//                       <div className="flex items-center gap-2 text-zinc-900">
//                         <MapPin size={18} className="text-orange-500" />
//                         <span className="font-black text-sm uppercase tracking-tight">Delivery Details</span>
//                       </div>
//                       <button
//                         onClick={handleUpdateAddress}
//                         disabled={isUpdating}
//                         className="text-[11px] font-bold text-orange-600 hover:text-orange-700 transition-colors"
//                       >
//                         {isUpdating ? "..." : "Update"}
//                       </button>
//                     </div>
//                     <textarea
//                       className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20 outline-none min-h-[80px] transition-all resize-none"
//                       placeholder="Add specific delivery instructions..."
//                       value={address}
//                       onChange={(e) => setAddress(e.target.value)}
//                     />
//                   </div>

//                   {/* Cart Items */}
//                   <div className="space-y-4">
//                     <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest px-1">Order Summary</h3>
//                     {cartItems.map((item, index) => {
//                       const dPrice = item.discount_price || item.discountPrice;
//                       const finalDisplayPrice = (dPrice > 0 && dPrice < item.price) ? dPrice : item.price;

//                       return (
//                         <motion.div
//                           layout
//                           key={`${item.id || item.cart_id}-${index}`}
//                           className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex gap-4 group"
//                         >
//                           <div className="w-20 h-20 bg-zinc-100 rounded-2xl overflow-hidden shrink-0">
//                             <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
//                           </div>

//                           <div className="flex-1 flex flex-col justify-between">
//                             <div className="flex justify-between items-start">
//                               <div>
//                                 <h4 className="font-black text-zinc-900 leading-tight text-sm">{item.name}</h4>
//                                 <p className="text-[10px] font-bold text-orange-600 mt-1 uppercase">₹{finalDisplayPrice}</p>
//                               </div>
//                               <button onClick={() => onUpdate(item.id, -1000)} className="text-zinc-300 hover:text-red-500 transition-colors">
//                                 <Trash2 size={16} />
//                               </button>
//                             </div>

//                             <div className="flex justify-between items-center mt-2">
//                               <span className="font-black text-zinc-900 text-sm">₹{finalDisplayPrice * item.quantity}</span>
//                               <div className="flex items-center bg-zinc-900 text-white rounded-xl p-1 gap-1">
//                                 <button onClick={() => onUpdate(item.id, -1)} className="w-7 h-7 flex items-center justify-center hover:bg-zinc-800 rounded-lg transition-colors"><Minus size={12} /></button>
//                                 <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
//                                 <button onClick={() => onUpdate(item.id, 1)} className="w-7 h-7 flex items-center justify-center hover:bg-zinc-800 rounded-lg transition-colors"><Plus size={12} /></button>
//                               </div>
//                             </div>
//                           </div>
//                         </motion.div>
//                       );
//                     })}
//                   </div>

//                   {/* Bill Breakdown */}
//                   <div className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm space-y-4">
//                     <div className="flex items-center gap-2 mb-2">
//                       <ReceiptText size={18} className="text-zinc-400" />
//                       <span className="font-black text-xs uppercase tracking-widest text-zinc-400">Bill Details</span>
//                     </div>
//                     <div className="space-y-3">
//                       <div className="flex justify-between text-sm font-bold text-zinc-500">
//                         <span>Item Total</span>
//                         <span className="text-zinc-900">₹{itemTotal}</span>
//                       </div>
//                       <div className="flex justify-between text-sm font-bold text-zinc-500">
//                         <span>Delivery Fee</span>
//                         <span className="text-emerald-600">FREE</span>
//                       </div>
//                       <div className="flex justify-between text-sm font-bold text-zinc-500">
//                         <span>Taxes (GST 5%)</span>
//                         <span className="text-zinc-900">₹{tax}</span>
//                       </div>
//                       <div className="h-px bg-zinc-100 w-full pt-2" />
//                       <div className="flex justify-between items-center pt-2">
//                         <span className="font-black text-zinc-900">Grand Total</span>
//                         <span className="text-2xl font-black text-zinc-900 tracking-tighter">₹{grandTotal}</span>
//                       </div>
//                     </div>
//                   </div>
//                 </>
//               )}
//             </div>

//             {/* --- FOOTER ACTION --- */}
//             {cartItems.length > 0 && (
//               <div className="p-6 bg-white border-t border-zinc-100 shrink-0">
//                 <button
//                   disabled={isSaving}
//                   onClick={handleProceedToPay}
//                   className="w-full h-16 bg-zinc-900 hover:bg-zinc-800 text-white rounded-[1.5rem] font-black flex items-center justify-between px-8 transition-all shadow-xl active:scale-[0.98] disabled:bg-zinc-200"
//                 >
//                   <div className="flex flex-col items-start leading-none">
//                     <span className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Pay Now</span>
//                     <span className="text-xl">₹{grandTotal}</span>
//                   </div>
//                   <div className="flex items-center gap-2 text-orange-500 uppercase text-xs tracking-widest font-black">
//                     {isSaving ? "Processing..." : "Place Order"}
//                     {!isSaving && <ArrowRight size={18} />}
//                   </div>
//                 </button>
//               </div>
//             )}
//           </motion.div>

//           <CheckoutModal
//             isOpen={showCheckout}
//             onClose={() => setShowCheckout(false)}
//             total={grandTotal}
//             address={address}
//             onSuccess={() => {
//               addToast("Order Placed Successfully!", "success");
//               onClose();
//               window.location.reload();
//             }}
//           />
//         </>
//       )}
//     </AnimatePresence>
//   );
// };

// export default Cart;

import React, { useState, useEffect, useRef } from 'react'; // 👈 Added useEffect
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, MapPin, ReceiptText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../context/useToast';
import CheckoutModal from './CheckoutModal';
import { API_BASE_URL } from '../services/api';

const Cart = ({ isOpen, onClose, cartItems = [], onUpdate }) => {
  const { addToast } = useToast();
  const [showCheckout, setShowCheckout] = useState(false);
  const [address, setAddress] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // --- 🚨 NEW: SIGNAL CHATBOT TO HIDE/SHOW ---
  useEffect(() => {
    // Dispatch a global event that the Chatbot is listening for
    window.dispatchEvent(new CustomEvent('crave:cartToggle', { detail: isOpen }));
    
    // Cleanup: If the component unmounts, make sure the chatbot shows again
    return () => {
      window.dispatchEvent(new CustomEvent('crave:cartToggle', { detail: false }));
    };
  }, [isOpen]);

  // --- FETCH SAVED ADDRESS ON OPEN ---
  useEffect(() => {
    const fetchUserAddress = async () => {
      if (!isOpen) return;
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      if (!token) return;

      try {
        const response = await fetch(`${API_BASE_URL}/api/users/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const userData = await response.json();
          if (userData.address) setAddress(userData.address);
        }
      } catch (error) {
        console.error("Failed to fetch address", error);
      }
    };
    fetchUserAddress();
  }, [isOpen]);

  // --- CALCULATIONS ---
  const itemTotal = cartItems.reduce((acc, item) => {
    const dPrice = item.discount_price || item.discountPrice;
    const finalPrice = (dPrice > 0 && dPrice < item.price) ? dPrice : item.price;
    return acc + (finalPrice * item.quantity);
  }, 0);

  const tax = Math.round(itemTotal * 0.05);
  const grandTotal = itemTotal + tax;

  const handleUpdateAddress = async () => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (!token) return addToast("Please login first.", "error");
    if (!address.trim()) return addToast("Enter an address.", "error");

    setIsUpdating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/update-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ address: address })
      });
      if (response.ok) addToast("Address saved!", "success");
    } catch (e) { console.error(e); }
    finally { setIsUpdating(false); }
  };

  const handleProceedToPay = async () => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (!token) return addToast("Please login.", "error");
    if (!address.trim()) return addToast("Delivery address required.", "error");

    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/update-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ address: address })
      });
      if (response.ok) setShowCheckout(true);
      else addToast("Failed to verify address.", "error");
    } catch (e) { console.error(e); }
    finally { setIsSaving(false); }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-[150]"
          />

          {/* Cart Sidebar */}
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="fixed top-0 right-0 h-full w-full sm:max-w-md bg-[#F9F9F9] z-[150] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* --- HEADER --- */}
            <div className="bg-white/80 backdrop-blur-md px-6 py-5 border-b border-zinc-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-xl font-black text-zinc-900 flex items-center gap-2">
                  My Cart
                </h2>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  {cartItems.length} items ready to go
                </p>
              </div>
              <button onClick={onClose} className="w-10 h-10 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 transition-colors border border-zinc-100">
                <X size={20} />
              </button>
            </div>

            {/* --- SCROLLABLE CONTENT --- */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 no-scrollbar">
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mb-4 text-zinc-300">
                    <ShoppingBag size={40} />
                  </div>
                  <h3 className="text-lg font-black text-zinc-800">Your cart is empty</h3>
                  <p className="text-sm text-zinc-400 mt-1">Add items from the menu to start an order.</p>
                </div>
              ) : (
                <>
                  {/* Address Section */}
                  <div className="bg-white rounded-3xl p-5 border border-zinc-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-zinc-900">
                        <MapPin size={18} className="text-orange-500" />
                        <span className="font-black text-sm uppercase tracking-tight">Delivery Details</span>
                      </div>
                      <button
                        onClick={handleUpdateAddress}
                        disabled={isUpdating}
                        className="text-[11px] font-bold text-orange-600 hover:text-orange-700 transition-colors"
                      >
                        {isUpdating ? "..." : "Update"}
                      </button>
                    </div>
                    <textarea
                      className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20 outline-none min-h-[80px] transition-all resize-none"
                      placeholder="Add specific delivery instructions..."
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>

                  {/* Cart Items */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest px-1">Order Summary</h3>
                    {cartItems.map((item, index) => {
                      const dPrice = item.discount_price || item.discountPrice;
                      const finalDisplayPrice = (dPrice > 0 && dPrice < item.price) ? dPrice : item.price;

                      return (
                        <motion.div
                          layout
                          key={`${item.id || item.cart_id}-${index}`}
                          className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex gap-4 group"
                        >
                          <div className="w-20 h-20 bg-zinc-100 rounded-2xl overflow-hidden shrink-0">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          </div>

                          <div className="flex-1 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-black text-zinc-900 leading-tight text-sm">{item.name}</h4>
                                <p className="text-[10px] font-bold text-orange-600 mt-1 uppercase">₹{finalDisplayPrice}</p>
                              </div>
                              <button onClick={() => onUpdate(item.id, -1000)} className="text-zinc-300 hover:text-red-500 transition-colors">
                                <Trash2 size={16} />
                              </button>
                            </div>

                            <div className="flex justify-between items-center mt-2">
                              <span className="font-black text-zinc-900 text-sm">₹{finalDisplayPrice * item.quantity}</span>
                              <div className="flex items-center bg-zinc-900 text-white rounded-xl p-1 gap-1">
                                <button onClick={() => onUpdate(item.id, -1)} className="w-7 h-7 flex items-center justify-center hover:bg-zinc-800 rounded-lg transition-colors"><Minus size={12} /></button>
                                <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                                <button onClick={() => onUpdate(item.id, 1)} className="w-7 h-7 flex items-center justify-center hover:bg-zinc-800 rounded-lg transition-colors"><Plus size={12} /></button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Bill Breakdown */}
                  <div className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ReceiptText size={18} className="text-zinc-400" />
                      <span className="font-black text-xs uppercase tracking-widest text-zinc-400">Bill Details</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm font-bold text-zinc-500">
                        <span>Item Total</span>
                        <span className="text-zinc-900">₹{itemTotal}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-zinc-500">
                        <span>Delivery Fee</span>
                        <span className="text-emerald-600">FREE</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-zinc-500">
                        <span>Taxes (GST 5%)</span>
                        <span className="text-zinc-900">₹{tax}</span>
                      </div>
                      <div className="h-px bg-zinc-100 w-full pt-2" />
                      <div className="flex justify-between items-center pt-2">
                        <span className="font-black text-zinc-900">Grand Total</span>
                        <span className="text-2xl font-black text-zinc-900 tracking-tighter">₹{grandTotal}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* --- FOOTER ACTION --- */}
            {cartItems.length > 0 && (
              <div className="p-6 bg-white border-t border-zinc-100 shrink-0">
                <button
                  disabled={isSaving}
                  onClick={handleProceedToPay}
                  className="w-full h-16 bg-zinc-900 hover:bg-zinc-800 text-white rounded-[1.5rem] font-black flex items-center justify-between px-8 transition-all shadow-xl active:scale-[0.98] disabled:bg-zinc-200"
                >
                  <div className="flex flex-col items-start leading-none">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Pay Now</span>
                    <span className="text-xl">₹{grandTotal}</span>
                  </div>
                  <div className="flex items-center gap-2 text-orange-500 uppercase text-xs tracking-widest font-black">
                    {isSaving ? "Processing..." : "Place Order"}
                    {!isSaving && <ArrowRight size={18} />}
                  </div>
                </button>
              </div>
            )}
          </motion.div>

          <CheckoutModal
            isOpen={showCheckout}
            onClose={() => setShowCheckout(false)}
            total={grandTotal}
            address={address}
            onSuccess={() => {
              addToast("Order Placed Successfully!", "success");
              onClose();
              window.location.reload();
            }}
          />
        </>
      )}
    </AnimatePresence>
  );
};

export default Cart;