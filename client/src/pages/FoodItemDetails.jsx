import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Star, Clock, Flame, Check, Minus, Plus, ShoppingBag, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import api, { API_BASE_URL } from "../services/api";
import { useToast } from "../context/useToast";

const FoodItemDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { addToast } = useToast();

    // --- STATE ---
    const [item, setItem] = useState(location.state?.item || null);
    const [loading, setLoading] = useState(!location.state?.item);
    const [selectedAddons, setSelectedAddons] = useState(new Set());
    
    // Cart States
    const [cartItems, setCartItems] = useState([]);
    const [qty, setQty] = useState(1); // Local qty for before it's added
    const [isAdding, setIsAdding] = useState(false);
    const [isAdded, setIsAdded] = useState(false);

    // --- AUTH HELPER ---
    const getToken = () => {
        let token = localStorage.getItem("authToken") || localStorage.getItem("token") || localStorage.getItem("access_token");
        if (!token) token = sessionStorage.getItem("authToken") || sessionStorage.getItem("token") || sessionStorage.getItem("access_token");
        if (token) return token.replace(/^"|"$/g, '');
        return null;
    };

    // --- FETCH DATA & CART ---
    const fetchCart = async () => {
        const token = getToken();
        if (!token) return;
        try {
            const res = await api.get("/api/cart", { headers: { Authorization: `Bearer ${token}` } });
            setCartItems(res.data);
        } catch (e) { console.error("Failed to sync cart", e); }
    };

    useEffect(() => {
        const fetchItemDetails = async () => {
            try {
                if (!item) setLoading(true);
                const response = await api.get(`/api/public/menu/item/${id}`);
                if (response.data) setItem(response.data);
            } catch (error) {
                console.error("Failed to fetch item:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchItemDetails();
        fetchCart();

        window.addEventListener('cart-updated', fetchCart);
        return () => window.removeEventListener('cart-updated', fetchCart);
    }, [id]);

    // --- HELPERS ---
    const getImageUrl = (itm) => {
        if (!itm) return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80";
        if (itm.image && (itm.image.startsWith("data:") || itm.image.startsWith("http"))) return itm.image;
        return `${API_BASE_URL}/api/menu/image/${itm.id}`;
    };

    const availableAddons = useMemo(() => {
        if (!item || !item.addons) return [];
        if (typeof item.addons === 'string') {
            try { return JSON.parse(item.addons); } catch (e) { return []; }
        }
        return Array.isArray(item.addons) ? item.addons : [];
    }, [item]);

    // --- PRICE & QUANTITY CALCULATIONS ---
    const basePrice = item ? (item.discountPrice || item.discount_price || item.price) : 0;
    const hasDiscount = item && (item.discountPrice || item.discount_price) && (item.discountPrice < item.price || item.discount_price < item.price);

    const cartItem = cartItems.find(i => i.menu_item_id === item?.id || i.id === item?.id);
    const cartQty = cartItem ? cartItem.quantity : 0;
    const displayQty = cartQty > 0 ? cartQty : qty; // Uses cart qty if present, else uses local selector

    const unitPrice = useMemo(() => {
        let price = parseFloat(basePrice);
        selectedAddons.forEach(addonId => {
            const addon = availableAddons.find(a => a.id === addonId);
            if (addon) price += parseFloat(addon.price);
        });
        return price;
    }, [basePrice, selectedAddons, availableAddons]);

    const totalPrice = unitPrice * displayQty;

    const toggleAddon = (addonId) => {
        const next = new Set(selectedAddons);
        if (next.has(addonId)) next.delete(addonId);
        else next.add(addonId);
        setSelectedAddons(next);
    };

    // --- FIXED ADD TO CART LOGIC ---
    const handleUpdateCart = async (delta) => {
        const token = getToken();
        if (!token) { addToast("Please sign in first", "error"); return; }
        
        setIsAdding(true);
        const previousCart = [...cartItems];
        
        // 1. Optimistic UI Update (Instant Visual Feedback)
        setCartItems(prev => {
            const existing = prev.find(i => i.menu_item_id === item.id || i.id === item.id);
            if (existing) {
                const newQty = existing.quantity + delta;
                if (newQty <= 0) {
                    addToast("Item removed from cart", "neutral");
                    return prev.filter(i => i.menu_item_id !== item.id && i.id !== item.id);
                }
                return prev.map(i => (i.menu_item_id === item.id || i.id === item.id) ? { ...i, quantity: newQty } : i);
            } else {
                if (delta > 0) {
                    setIsAdded(true);
                    setTimeout(() => setIsAdded(false), 1500);
                    addToast("Item added to cart!", "success");
                    return [...prev, { ...item, menu_item_id: item.id, quantity: delta }]; 
                }
                return prev;
            }
        });

        // 2. Backend Call
        try {
            // FIX: We now ALWAYS send the customization array, even when subtracting (-1).
            // This allows the database to find the EXACT customized item to remove!
            const payload = {
                menu_item_id: item.id,
                quantity: delta,
                customization: JSON.stringify(Array.from(selectedAddons))
            };

            if (delta > 0) {
                payload.total_price = unitPrice * delta; 
            }

            await api.post("/api/cart", payload, { headers: { Authorization: `Bearer ${token}` } });

            window.dispatchEvent(new Event('cart-updated'));
            await fetchCart(); 
        } catch (err) {
            setCartItems(previousCart); // Rollback visually if the database fails
            if (err.response && err.response.status === 401) {
                addToast("Session expired. Please login again.", "error");
            } else {
                addToast("Failed to update cart", "error");
            }
        } finally {
            setIsAdding(false);
        }
    };

    // --- ANIMATION VARIANTS ---
    const staggerContainer = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };
    const fadeUp = {
        hidden: { opacity: 0, y: 30 },
        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
    };

    if (loading || !item) {
        return (
            <div className="flex h-screen items-center justify-center bg-white">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white font-sans flex justify-center selection:bg-orange-500/20">
            <div className="w-[95%] flex flex-col md:flex-row relative">
                
                {/* ================= LEFT: MASSIVE STICKY IMAGE ================= */}
                <div className="relative w-full md:w-1/2 h-[50vh] md:h-screen md:sticky top-0 z-10 md:py-6">
                    <div className="w-full h-full rounded-[2.5rem] overflow-hidden relative shadow-sm border border-gray-100">
                        <img 
                            src={getImageUrl(item)} 
                            alt={item.name} 
                            className="w-full h-full object-cover"
                        />
                        
                        <button 
                            onClick={() => navigate(-1)} 
                            className="absolute top-8 left-8 md:top-10 md:left-10 bg-white/90 backdrop-blur-md text-black px-5 py-3 rounded-full flex items-center gap-2 text-sm font-bold shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:scale-105 active:scale-95 transition-all"
                        >
                            <ArrowLeft size={18} strokeWidth={2.5} /> Back
                        </button>

                        <div className="absolute bottom-8 left-8 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-sm border-[1.5px] flex items-center justify-center ${item.is_veg ? 'border-emerald-600' : 'border-rose-600'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${item.is_veg ? 'bg-emerald-600' : 'bg-rose-600'}`}></div>
                            </div>
                            <span className="text-xs font-black uppercase tracking-widest text-black">
                                {item.is_veg ? 'Vegetarian' : 'Non-Vegetarian'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ================= RIGHT: EDITORIAL CONTENT ================= */}
                <div className="w-full md:w-1/2 bg-white px-6 py-12 md:px-12 lg:px-20 flex flex-col justify-center min-h-screen z-20">
                    <motion.div 
                        variants={staggerContainer} 
                        initial="hidden" 
                        animate="show"
                        className="max-w-lg w-full mx-auto md:mx-0 flex flex-col h-full justify-center py-10"
                    >
                        
                        <motion.div variants={fadeUp} className="mb-6">
                            <span className="text-xs font-bold tracking-[0.2em] text-gray-400 uppercase">
                                {item.category || "Signature Dish"}
                            </span>
                        </motion.div>

                        <motion.h1 variants={fadeUp} className="text-4xl md:text-5xl lg:text-6xl font-black text-black leading-[1.1] tracking-tight mb-6">
                            {item.name}
                        </motion.h1>

                        <motion.div variants={fadeUp} className="flex items-baseline gap-4 mb-8">
                            <span className="text-4xl font-light text-gray-900">
                                ₹{totalPrice}
                            </span>
                            {hasDiscount && (
                                <span className="text-lg text-gray-400 line-through decoration-gray-300">
                                    ₹{item.price * displayQty}
                                </span>
                            )}
                        </motion.div>

                        <motion.p variants={fadeUp} className="text-lg text-gray-500 leading-relaxed mb-10 font-medium">
                            {item.description || "A masterfully crafted dish made from the finest ingredients. Enjoy a perfect balance of flavors in every single bite, prepared fresh to order."}
                        </motion.p>

                        <motion.div variants={fadeUp} className="grid grid-cols-3 gap-6 border-y border-gray-100 py-8 mb-10">
                            <div className="flex flex-col items-start gap-1">
                                <Star size={20} strokeWidth={1.5} className="text-black mb-2" />
                                <span className="text-sm font-bold text-black">4.8 / 5.0</span>
                                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Rating</span>
                            </div>
                            <div className="flex flex-col items-start gap-1 border-l border-gray-100 pl-6">
                                <Clock size={20} strokeWidth={1.5} className="text-black mb-2" />
                                <span className="text-sm font-bold text-black">25 Mins</span>
                                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Prep Time</span>
                            </div>
                            <div className="flex flex-col items-start gap-1 border-l border-gray-100 pl-6">
                                <Flame size={20} strokeWidth={1.5} className="text-black mb-2" />
                                <span className="text-sm font-bold text-black">320 Kcal</span>
                                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Energy</span>
                            </div>
                        </motion.div>

                        {/* Customization */}
                        {availableAddons.length > 0 && (
                            <motion.div variants={fadeUp} className="mb-10">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-black mb-6">
                                    Add Enhancements
                                </h3>
                                
                                <div className="flex flex-col">
                                    {availableAddons.map(addon => {
                                        const isSelected = selectedAddons.has(addon.id);
                                        return (
                                            <div 
                                                key={addon.id} 
                                                onClick={() => toggleAddon(addon.id)}
                                                className="group flex items-center justify-between py-4 border-b border-gray-100 last:border-0 cursor-pointer transition-colors hover:bg-gray-50 -mx-4 px-4 rounded-xl"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-300 ${
                                                        isSelected ? "border-black bg-black" : "border-gray-300 bg-white group-hover:border-gray-400"
                                                    }`}>
                                                        {isSelected && <Check size={12} className="text-white" strokeWidth={4} />}
                                                    </div>
                                                    <span className={`text-base font-medium transition-colors ${isSelected ? "text-black font-bold" : "text-gray-600"}`}>
                                                        {addon.name}
                                                    </span>
                                                </div>
                                                <span className="text-sm text-gray-400 font-medium">
                                                    + ₹{addon.price}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </motion.div>
                        )}

                        {/* --- ADD TO CART ACTION AREA --- */}
                        <motion.div variants={fadeUp} className="mt-auto pt-6 border-t border-gray-100 flex items-center gap-4">
                            {cartQty === 0 ? (
                                // Add New Item State
                                <>
                                    {/* Pre-Cart Qty Selector */}
                                    <div className="flex items-center bg-gray-50 rounded-full px-2 h-14 w-36 justify-between border border-gray-200">
                                        <button 
                                            onClick={() => setQty(Math.max(1, qty - 1))} 
                                            className="w-10 h-10 flex items-center justify-center rounded-full text-gray-500 hover:text-black hover:bg-white active:scale-95 transition-all shadow-sm"
                                        >
                                            <Minus size={18} strokeWidth={2.5}/>
                                        </button>
                                        <span className="font-black text-lg text-black">{qty}</span>
                                        <button 
                                            onClick={() => setQty(qty + 1)} 
                                            className="w-10 h-10 flex items-center justify-center rounded-full text-gray-500 hover:text-black hover:bg-white active:scale-95 transition-all shadow-sm"
                                        >
                                            <Plus size={18} strokeWidth={2.5}/>
                                        </button>
                                    </div>

                                    {/* Add Button */}
                                    <button 
                                        onClick={() => handleUpdateCart(qty)}
                                        disabled={isAdding}
                                        className="flex-1 h-14 rounded-full font-bold text-base md:text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 px-6 bg-black text-white hover:bg-gray-800 shadow-black/25"
                                    >
                                        {isAdding ? <Loader2 className="animate-spin text-white" /> : <><ShoppingBag size={18} /> Add to Cart</>}
                                    </button>
                                </>
                            ) : (
                                // Item Already in Cart State
                                <div className="flex-1 flex items-center justify-between bg-gray-50 rounded-full p-2 border border-gray-200">
                                    <div className="flex items-center bg-white rounded-full px-2 h-12 w-32 justify-between shadow-sm border border-gray-100">
                                        <button 
                                            onClick={() => handleUpdateCart(-1)} 
                                            disabled={isAdding}
                                            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-black hover:bg-gray-100 active:scale-95 transition-all"
                                        >
                                            {isAdding ? <Loader2 size={16} className="animate-spin" /> : <Minus size={18} strokeWidth={2.5}/>}
                                        </button>
                                        <span className="font-black text-lg text-black">{cartQty}</span>
                                        <button 
                                            onClick={() => handleUpdateCart(1)} 
                                            disabled={isAdding}
                                            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-black hover:bg-gray-100 active:scale-95 transition-all"
                                        >
                                            {isAdding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} strokeWidth={2.5}/>}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 pr-6 font-bold text-emerald-600">
                                        <Check strokeWidth={3} size={18} /> In Cart
                                    </div>
                                </div>
                            )}
                        </motion.div>

                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default FoodItemDetails;