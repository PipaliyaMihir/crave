import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api, { API_BASE_URL } from "../services/api";
import {
  ArrowLeft, Star, Search, Plus, Minus,
  CheckCircle, AlertCircle, Heart, MapPin, UtensilsCrossed, ChevronRight, X, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- IMAGE HELPER (Fixed with cache-busting) ---
const getImageUrl = (item) => {
  if (!item) return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80";
  if (item.image && (item.image.startsWith("data:") || item.image.startsWith("http"))) {
    return item.image;
  }
  // Automatically fetch from backend API if no direct image string is provided
  return `${API_BASE_URL}/api/menu/image/${item.id}?t=${new Date().getTime()}`;
};

// --- TOAST COMPONENT ---
const Toast = ({ message, type = "success" }) => (
  <motion.div
    initial={{ opacity: 0, y: 50, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border ${
      type === "neutral" 
        ? "bg-stone-900/95 text-white border-stone-800" 
        : type === "error"
        ? "bg-red-600 text-white border-red-500"
        : "bg-emerald-600 text-white border-emerald-500"
    }`}
  >
    {type === "success" ? <CheckCircle size={20} className="text-white" /> : <AlertCircle size={20} className="text-white" />}
    <span className="font-bold text-sm tracking-wide">{message}</span>
  </motion.div>
);

// --- VERTICAL SKELETON ---
const MenuSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    {['skel-1', 'skel-2', 'skel-3', 'skel-4', 'skel-5', 'skel-6'].map((i) => (
      <div key={i} className="bg-white rounded-[2rem] p-3 flex flex-col gap-4 animate-pulse border border-stone-100 shadow-sm">
        <div className="w-full h-48 bg-stone-100 rounded-[1.5rem]" />
        <div className="px-2 pb-2 space-y-3">
          <div className="h-5 bg-stone-100 rounded-md w-3/4" />
          <div className="h-3 bg-stone-50 rounded-md w-full" />
          <div className="flex justify-between items-end pt-4">
            <div className="h-6 bg-stone-100 rounded-md w-20" />
            <div className="h-10 bg-stone-100 rounded-xl w-24" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const RestaurantDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activeCategory, setActiveCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState(null);

  const [cartItems, setCartItems] = useState([]);
  const [favorites, setFavorites] = useState({});

  // Rating State
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingVal, setRatingVal] = useState(0);
  const [isRatingSubmitting, setIsRatingSubmitting] = useState(false);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getToken = () => {
    let token = localStorage.getItem("authToken") || localStorage.getItem("token") || localStorage.getItem("access_token");
    if (!token) token = sessionStorage.getItem("authToken") || sessionStorage.getItem("token") || sessionStorage.getItem("access_token");
    if (token) return token.replace(/^"|"$/g, '');
    return null;
  };

  const fetchUserData = async () => {
      const token = getToken();
      if (!token) return; 

      try {
          const cartRes = await api.get("/api/cart", { headers: { Authorization: `Bearer ${token}` } });
          setCartItems(cartRes.data);
      } catch (e) { 
          if (e.response && e.response.status === 401) console.warn("Invalid Token");
      }

      try {
          const favRes = await api.get("/api/favorites", { headers: { Authorization: `Bearer ${token}` } });
          const favObj = {};
          favRes.data.forEach(id => favObj[id] = true);
          setFavorites(favObj);
      } catch (e) { }
  };

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        setLoading(true);
        const [menuRes, restRes] = await Promise.all([
          api.get(`/api/public/menu/${id}`),
          api.get(`/restaurants/${id}`)
        ]);
        setMenuItems(menuRes.data.filter(item => item.isAvailable));
        setRestaurant(restRes.data);
      } catch (err) {
        console.error("Data Load Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMenu();
    fetchUserData(); 

    const intervalId = setInterval(() => {
        if(getToken()) fetchUserData();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [id]);

  const handleUpdateCart = async (itemId, delta, itemName = "Item") => {
    const token = getToken();

    if (!token) {
        showToast("Please sign in first", "neutral");
        return;
    }
    
    const previousCart = [...cartItems];

    setCartItems(prev => {
      const existing = prev.find(item => item.id === itemId);
      if (existing) {
        const newQty = existing.quantity + delta;
        if (delta === -1000 || newQty <= 0) {
          if (delta !== -1000) showToast(`${itemName} removed`, "neutral");
          return prev.filter(item => item.id !== itemId);
        }
        return prev.map(item => item.id === itemId ? { ...item, quantity: newQty } : item);
      } else {
        if (delta > 0) {
          showToast(`${itemName} added`, "success");
          const menuItem = menuItems.find(i => i.id === itemId);
          return [...prev, { ...menuItem, quantity: 1, image: getImageUrl(menuItem) }];
        }
        return prev;
      }
    });

    try {
      await api.post("/api/cart", { menu_item_id: itemId, quantity: delta }, { headers: { Authorization: `Bearer ${token}` } });
      window.dispatchEvent(new Event('cart-updated'));
      const res = await api.get("/api/cart", { headers: { Authorization: `Bearer ${token}` } });
      setCartItems(res.data);
    } catch (err) {
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
         showToast("Session expired. Sign in again.", "neutral");
         setCartItems(previousCart); 
         localStorage.removeItem("token");
         localStorage.removeItem("authToken");
      } else {
         showToast("Failed to update cart", "neutral");
         setCartItems(previousCart);
      }
    }
  };

  const toggleFavorite = async (itemId) => {
    const token = getToken();
    if (!token) { showToast("Please sign in first", "neutral"); return; }

    const isFav = !favorites[itemId];
    setFavorites(prev => ({ ...prev, [itemId]: isFav }));
    
    if (isFav) showToast("Saved to Favorites", "success");
    else showToast("Removed from Favorites", "neutral");

    try { 
        await api.post(`/api/favorites/${itemId}`, {}, { headers: { Authorization: `Bearer ${token}` } }); 
        window.dispatchEvent(new Event('fav-updated')); 
    } catch (err) { 
        setFavorites(prev => ({ ...prev, [itemId]: !isFav }));
    }
  };

  const handleRateRestaurant = async () => {
    const token = getToken();
    if (!token) {
        showToast("Please sign in to rate", "error");
        return;
    }
    if (ratingVal === 0) return;

    setIsRatingSubmitting(true);
    try {
        const response = await api.post(`/api/restaurants/${id}/rate`, { rating: ratingVal }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        showToast("Thank you for your rating!", "success");
        
        if (response.data && response.data.new_average !== undefined) {
            setRestaurant(prev => ({
                ...prev,
                average_rating: response.data.new_average,
                rating_count: response.data.total_reviews
            }));
        }

        setShowRatingModal(false);
    } catch (err) {
        console.error(err);
        showToast("Failed to submit rating", "error");
    } finally {
        setIsRatingSubmitting(false);
    }
  };

  const getItemQty = (itemId) => {
    const item = cartItems.find(i => i.id === itemId);
    return item ? item.quantity : 0;
  };

  const categories = useMemo(() => ["All", ...new Set(menuItems.map(i => i.category))], [menuItems]);

  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = activeCategory === "All" || item.category === activeCategory;
      return matchSearch && matchCat;
    });
  }, [menuItems, searchTerm, activeCategory]);

  return (
    <div className="min-h-screen bg-white font-sans text-stone-900 pb-24 selection:bg-rose-500/20">
      <AnimatePresence>{toast && <Toast message={toast.msg} type={toast.type} />}</AnimatePresence>

      <div className="w-[95%] mx-auto pt-6 md:pt-10">
          
          <button onClick={() => navigate("/rest")} className="mb-6 flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors font-bold text-sm w-fit">
              <ArrowLeft size={18} /> Back to Restaurants
          </button>

          {loading ? (
              <div className="h-64 bg-stone-100 animate-pulse rounded-[2.5rem] mb-10 border border-stone-200"></div>
          ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-10 h-auto md:h-72">
                  
                  <div className="md:col-span-2 relative rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-sm border border-stone-100 group">
                      <img 
                          src={restaurant?.profile_image || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1920&q=80"} 
                          alt="Cover" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-6 left-6 md:bottom-8 md:left-8">
                          <h1 className="text-4xl md:text-5xl text-white font-black tracking-tight mb-2">
                              {restaurant?.name}
                          </h1>
                          <p className="text-stone-200 font-medium flex items-center gap-2">
                              <UtensilsCrossed size={16} className="text-rose-400" /> Premium Culinary Experience
                          </p>
                      </div>
                  </div>

                  <div className="grid grid-rows-2 gap-4 md:gap-6">
                      
                      <div 
                        onClick={() => setShowRatingModal(true)}
                        className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-6 shadow-sm border border-stone-200 flex flex-col justify-center relative overflow-hidden cursor-pointer group hover:border-rose-200 transition-colors"
                      >
                          <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-50 rounded-full blur-2xl transition-all group-hover:bg-rose-100"></div>
                          <div className="flex items-center justify-between mb-2 relative z-10">
                              <span className="text-stone-500 font-bold text-xs uppercase tracking-widest group-hover:text-rose-500 transition-colors">Rating</span>
                              <Star size={20} className="fill-rose-500 text-rose-500 group-hover:scale-110 transition-transform" />
                          </div>
                          
                          <div className="flex items-baseline gap-2 relative z-10">
                              <h2 className="text-4xl font-black text-stone-900 group-hover:text-rose-600 transition-colors">
                                  {restaurant?.average_rating > 0 ? restaurant.average_rating.toFixed(1) : "New"}
                              </h2>
                              {restaurant?.average_rating > 0 && <span className="text-stone-400 font-medium pb-1">/ 5.0</span>}
                          </div>
                          
                          <p className="text-xs text-stone-400 font-medium mt-1 flex items-center justify-between">
                              {restaurant?.rating_count > 0 ? `Based on ${restaurant.rating_count} reviews` : "Be the first to rate!"}
                              <span className="text-rose-500 font-bold opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all flex items-center">
                                  Rate Us <ChevronRight size={14} />
                              </span>
                          </p>
                      </div>

                      <div className="bg-stone-900 rounded-[2rem] md:rounded-[2.5rem] p-6 shadow-lg flex flex-col justify-center relative overflow-hidden">
                          <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-stone-800 rounded-full blur-2xl"></div>
                          <div className="flex items-center gap-3 mb-3 relative z-10">
                              <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
                                  <MapPin size={18} className="text-white" />
                              </div>
                              <span className="text-stone-400 font-bold text-xs uppercase tracking-widest">Location</span>
                          </div>
                          <p className="text-white font-medium text-sm leading-relaxed relative z-10 pr-4 line-clamp-2">
                              {restaurant?.address || "Serving your favorite neighborhood."}
                          </p>
                      </div>

                  </div>
              </div>
          )}

          <div className="mb-6 max-w-md">
              <div className="bg-white border border-stone-200 rounded-2xl flex items-center p-3 shadow-sm focus-within:ring-2 ring-stone-900/5 transition-all">
                  <Search className="text-stone-400 mr-3 ml-1" size={20} />
                  <input 
                      type="text" 
                      placeholder="Search the menu..." 
                      value={searchTerm} 
                      onChange={e => setSearchTerm(e.target.value)} 
                      className="w-full bg-transparent outline-none font-medium text-stone-800" 
                  />
              </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
              
              <aside className="lg:w-64 shrink-0">
                  <div className="lg:sticky lg:top-24">
                      <h3 className="hidden lg:block text-2xl font-black text-stone-900 mb-6">Menu</h3>
                      
                      <div className="flex lg:flex-col gap-3 overflow-x-auto no-scrollbar pb-4 lg:pb-0">
                          {categories.map(cat => (
                              <button 
                                key={cat} 
                                onClick={() => setActiveCategory(cat)} 
                                className={`flex items-center justify-between whitespace-nowrap px-6 py-3.5 lg:px-5 lg:py-4 rounded-2xl text-sm font-bold transition-all duration-300 ${
                                    activeCategory === cat 
                                    ? "bg-stone-900 text-white shadow-md lg:scale-105 origin-left" 
                                    : "bg-white text-stone-500 border border-stone-200 hover:bg-stone-50 hover:text-stone-900"
                                }`}
                              >
                                  <span>{cat}</span>
                                  {activeCategory === cat && <ChevronRight size={16} className="hidden lg:block opacity-60" />}
                              </button>
                          ))}
                      </div>
                  </div>
              </aside>

              <main className="flex-1">
                <div className="mb-8 flex items-end justify-between border-b border-stone-100 pb-4">
                    <h2 className="text-2xl md:text-3xl font-black text-stone-900">{activeCategory}</h2>
                    <span className="text-stone-400 font-bold text-sm bg-stone-50 px-3 py-1 rounded-lg border border-stone-100">{filteredItems.length} items</span>
                </div>

                {loading ? <MenuSkeleton /> : (
                  <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                      {filteredItems.map((item, index) => (
                        <MenuCard
                          key={`${item.id}-${index}`}
                          item={item}
                          qty={getItemQty(item.id)}
                          isFav={favorites[item.id] || false}
                          onUpdate={(d) => handleUpdateCart(item.id, d, item.name)}
                          onFav={() => toggleFavorite(item.id)}
                        />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}
              </main>
          </div>
      </div>

      <AnimatePresence>
        {showRatingModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => setShowRatingModal(false)}
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl relative z-10 text-center"
                >
                    <button onClick={() => setShowRatingModal(false)} className="absolute top-6 right-6 text-stone-400 hover:text-stone-900 bg-stone-100 rounded-full p-1.5 transition-colors">
                        <X size={18} strokeWidth={3} />
                    </button>
                    
                    <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Star size={32} className="text-rose-500 fill-rose-500" />
                    </div>

                    <h2 className="text-2xl font-black text-stone-900 tracking-tight mb-2">Rate your experience</h2>
                    <p className="text-stone-500 text-sm font-medium mb-8">How was your meal at {restaurant?.name || "this restaurant"}?</p>

                    <div className="flex items-center justify-center gap-2 mb-8">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button 
                                key={star}
                                onClick={() => setRatingVal(star)}
                                className="group p-1 transition-transform hover:scale-110 active:scale-90 outline-none"
                            >
                                <Star 
                                    size={40} 
                                    className={`transition-colors duration-200 ${
                                        ratingVal >= star 
                                        ? "fill-rose-500 text-rose-500 drop-shadow-md" 
                                        : "fill-stone-100 text-stone-200"
                                    }`} 
                                />
                            </button>
                        ))}
                    </div>

                    <button 
                        onClick={handleRateRestaurant}
                        disabled={ratingVal === 0 || isRatingSubmitting}
                        className={`w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center ${
                            ratingVal > 0 
                            ? "bg-rose-500 text-white shadow-lg shadow-rose-500/25 hover:bg-rose-600 active:scale-95" 
                            : "bg-stone-100 text-stone-400 cursor-not-allowed"
                        }`}
                    >
                        {isRatingSubmitting ? <Loader2 className="animate-spin" size={24} /> : "Submit Rating"}
                    </button>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
};

// --- VERTICAL EDITORIAL MENU CARD ---
const MenuCard = ({ item, qty, onUpdate, isFav, onFav }) => {
  const navigate = useNavigate();
  const dPrice = item.discountPrice || item.discount_price;
  const hasDiscount = dPrice && dPrice < item.price;
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      onClick={() => navigate(`/menu-item/${item.id}`, { state: { item } })}
      className="group bg-white rounded-[2rem] p-3 flex flex-col shadow-sm border border-stone-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer relative overflow-hidden"
    >
      <button 
        onClick={(e) => { e.stopPropagation(); onFav(); }} 
        className="absolute top-6 right-6 z-20 p-2.5 bg-white/90 backdrop-blur-md rounded-full shadow-sm hover:scale-110 active:scale-95 transition-all border border-stone-100"
      >
        <Heart size={18} className={`transition-colors duration-300 ${isFav ? "fill-rose-500 text-rose-500" : "text-stone-400 hover:text-rose-500"}`} />
      </button>

      <div className="relative w-full h-48 md:h-52 flex-shrink-0 rounded-[1.5rem] overflow-hidden bg-stone-100 mb-4 border border-stone-100/50">
         {/* FIX: USING getImageUrl(item) HERE! */}
         <img
          src={getImageUrl(item)} 
          alt={item.name} 
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          className={`w-full h-full object-cover transition-transform duration-700 ${imgLoaded ? "opacity-100 scale-100" : "opacity-0 scale-105"} group-hover:scale-105`}
        />
        
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent"></div>

        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-lg shadow-sm border border-white">
            <div className={`w-3 h-3 rounded-sm border-[1.5px] flex items-center justify-center ${item.is_veg || item.type === 'veg' ? 'border-emerald-600' : 'border-rose-600'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${item.is_veg || item.type === 'veg' ? 'bg-emerald-600' : 'bg-rose-600'}`}></div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-stone-700">{item.category}</span>
        </div>
      </div>

      <div className="flex flex-col flex-1 px-2 pb-2">
        <h3 className="text-xl font-black text-stone-900 leading-tight group-hover:text-rose-600 transition-colors line-clamp-1 mb-1">
            {item.name}
        </h3>
        <p className="text-stone-500 text-sm line-clamp-2 leading-relaxed font-medium mb-4">
            {item.description || "Expertly crafted with premium ingredients for an unforgettable taste."}
        </p>
        
        <div className="mt-auto flex items-center justify-between pt-3 border-t border-stone-100">
          <div className="flex flex-col">
            {hasDiscount && (<span className="text-stone-400 text-xs line-through font-bold decoration-stone-300">₹{item.price}</span>)}
            <span className={`text-2xl font-black tracking-tighter ${hasDiscount ? 'text-rose-600' : 'text-stone-900'}`}>
                ₹{hasDiscount ? dPrice : item.price}
            </span>
          </div>
          
          <div onClick={(e) => e.stopPropagation()}> 
            {qty === 0 ? (
              <button onClick={() => onUpdate(1)} className="bg-white border border-stone-200 text-stone-900 hover:bg-stone-900 hover:text-white px-6 py-2.5 rounded-2xl text-sm font-black transition-all active:scale-95 shadow-sm">
                  ADD
              </button>
            ) : (
              <div className="flex items-center gap-3 bg-stone-900 text-white p-1.5 px-2 rounded-2xl shadow-lg border border-stone-800">
                <button onClick={() => onUpdate(-1)} className="p-1.5 hover:bg-stone-700 rounded-xl transition-colors active:scale-90"><Minus size={14} strokeWidth={3} /></button>
                <span className="font-bold text-sm w-4 text-center">{qty}</span>
                <button onClick={() => onUpdate(1)} className="p-1.5 hover:bg-stone-700 rounded-xl transition-colors active:scale-90"><Plus size={14} strokeWidth={3} /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default RestaurantDetails;