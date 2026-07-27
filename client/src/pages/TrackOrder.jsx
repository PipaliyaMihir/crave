import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  PhoneCall, MessageSquare, Star, MapPin, CheckCircle2, Bike,
  ChevronLeft, Send, X, ChefHat, Receipt, Clock, ShoppingBag,
  History, Store, RotateCcw, Check, Navigation, LocateFixed
} from "lucide-react";
import { useToast } from "../context/useToast";
import { API_BASE_URL, WS_BASE_URL } from "../services/api";

// --- GORGEOUS HTML MAP ICONS ---
const createHTMLIcon = (emoji, bgColor) => new L.divIcon({
  className: 'bg-transparent',
  html: `<div style="background-color: ${bgColor}; width: 40px; height: 40px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; font-size: 20px;">${emoji}</div>`,
  iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -20]
});

const storeIcon = createHTMLIcon('🏬', '#f97316');
const homeIcon = createHTMLIcon('🏠', '#e23744');
const bikeIcon = createHTMLIcon('🛵', '#10b981');

// --- SMART GEOCODER ---
const geocodeAddress = async (address) => {
  if (!address) return [22.3039, 70.8022];
  try {
    let res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
    let data = await res.json();
    if (data && data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];

    const cleaned = address.replace(/[0-9]/g, '').trim();
    res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleaned)}&limit=1`);
    data = await res.json();
    if (data && data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];

  } catch (e) { console.error("Geocoding API skipped", e); }

  let hash = 0;
  for (let i = 0; i < address.length; i++) hash = address.charCodeAt(i) + ((hash << 5) - hash);
  const latOffset = (hash % 100) / 2500;
  const lngOffset = ((hash >> 2) % 100) / 2500;
  return [22.3039 + latOffset, 70.8022 + lngOffset];
};

const MapUpdater = ({ riderLocation, autoCenter, setAutoCenter }) => {
  const map = useMap();

  useEffect(() => {
    if (riderLocation && riderLocation[0] && autoCenter) {
      map.flyTo(riderLocation, map.getZoom(), { animate: true, duration: 0.5 });
    }
  }, [riderLocation, map, autoCenter]);

  useEffect(() => {
    const handleDragStart = () => {
      setAutoCenter(false);
    };
    map.on('dragstart', handleDragStart);
    return () => map.off('dragstart', handleDragStart);
  }, [map, setAutoCenter]);

  return null;
}

const TrackOrder = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState("live");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const [restaurantLoc, setRestaurantLoc] = useState(null);
  const [customerLoc, setCustomerLoc] = useState(null);
  const [routeLine, setRouteLine] = useState([]);
  const [riderLocation, setRiderLocation] = useState(null);

  const [autoCenter, setAutoCenter] = useState(true);
  const [orderHistory, setOrderHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showRatingPopup, setShowRatingPopup] = useState(false);
  const [rating, setRating] = useState(0);
  const [showMessageBox, setShowMessageBox] = useState(false);
  const [message, setMessage] = useState("");

  const lastActiveOrder = useRef(null);
  const intervalRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const fetchOrder = async () => {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token");
      if (!token) { navigate("/login"); return; }

      try {
        const res = await fetch(`${API_BASE_URL}/api/orders/track`, {
          headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-cache" },
        });

        if (res.status === 401) { sessionStorage.removeItem("token"); navigate("/login"); return; }

        const data = await res.json();

        if (data && data.active) {
          setOrder(data);
          lastActiveOrder.current = data;

          const rLoc = await geocodeAddress(data.restaurant_address || "Rajkot");
          const cLoc = await geocodeAddress(data.delivery_address || "Rajkot");

          setRestaurantLoc(rLoc);
          setCustomerLoc(cLoc);

          if (!riderLocation) {
            if (data.rider_location && data.rider_location.lat) {
              setRiderLocation([data.rider_location.lat, data.rider_location.lng]);
            } else {
              setRiderLocation(rLoc);
            }
          }
        } else {
          if (lastActiveOrder.current) {
            setShowRatingPopup(true); clearInterval(intervalRef.current);
          } else {
            setOrder(null);
          }
        }
      } catch (err) { }
      finally { setLoading(false); }
    };

    fetchOrder();
    intervalRef.current = setInterval(fetchOrder, 15000); 
    return () => clearInterval(intervalRef.current);
  }, [navigate, riderLocation]);

  useEffect(() => {
    if (restaurantLoc && customerLoc) {
      fetch(`https://router.project-osrm.org/route/v1/driving/${restaurantLoc[1]},${restaurantLoc[0]};${customerLoc[1]},${customerLoc[0]}?overview=full&geometries=geojson`)
        .then(res => res.json())
        .then(data => {
          if (data.routes && data.routes.length > 0) {
            const flippedCoords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            setRouteLine(flippedCoords);
          }
        }).catch(err => console.error("Failed to load map route", err));
    }
  }, [restaurantLoc, customerLoc]);

  useEffect(() => {
    if (!order || !order.id || activeTab !== "live") return;
    if (wsRef.current) { wsRef.current.close(); }

    const ws = new WebSocket(`${WS_BASE_URL}/api/ws/track/${order.id}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.lat && data.lng) {
          setRiderLocation([data.lat, data.lng]);
      }
    };

    return () => { if (wsRef.current) { wsRef.current.close(); wsRef.current = null; } };
  }, [order?.id, activeTab]);

  useEffect(() => {
    if (activeTab === "history") {
      const fetchHistory = async () => {
        setLoadingHistory(true);
        const token = sessionStorage.getItem("token") || localStorage.getItem("token");
        try {
          const res = await fetch(`${API_BASE_URL}/api/orders/history`, { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) { setOrderHistory(await res.json()); }
        } catch (err) { } finally { setLoadingHistory(false); }
      };
      fetchHistory();
    }
  }, [activeTab]);

  const sendMessage = async () => {
    if (!message.trim()) return;
    const token = sessionStorage.getItem("token") || localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/${order.id}/message-rider`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (res.ok) { addToast("Message sent!", "success"); setMessage(""); setShowMessageBox(false); }
    } catch (err) { }
  };

  const handleRatingSubmit = async () => {
    const token = sessionStorage.getItem("token") || localStorage.getItem("token");
    try {
      await fetch(`${API_BASE_URL}/api/orders/${lastActiveOrder.current.id}/rate-rider`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
    } catch (err) { }
    navigate("/");
  };

  /* ================= NEW REORDER FUNCTION WITH EVENT DISPATCH ================= */
  const handleReorder = async (pastOrder) => {
    const token = sessionStorage.getItem("token") || localStorage.getItem("token");
    if (!token) {
      addToast("Please login to reorder", "error");
      return;
    }

    try {
      // Loop through all items in the past order and add them to the cart
      for (const item of pastOrder.items) {
        if (!item.menu_item_id) {
            console.warn(`Missing menu_item_id for ${item.name}. Ensure backend is sending it!`);
            continue;
        }

        await fetch(`${API_BASE_URL}/api/cart`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            menu_item_id: item.menu_item_id,
            quantity: item.qty || 1,
            customization: "[]"
          })
        });
      }

      addToast("Items added to your cart!", "success");
      
      // Update cart count globally
      window.dispatchEvent(new Event('cart-updated'));
      
      // Redirect user to that restaurant's page
      if (pastOrder.restaurant_id) {
         navigate(`/rest/${pastOrder.restaurant_id}`);
      } else {
         navigate("/");
      }

      // Tell the Navbar to open the cart automatically after a tiny delay
      setTimeout(() => {
          window.dispatchEvent(new Event('open-cart'));
      }, 300);

    } catch (error) {
      console.error("Reorder failed", error);
      addToast("Failed to reorder items", "error");
    }
  };

  const getStep = (status) => {
    const steps = ["pending", "accepted", "preparing", "ready", "out_for_delivery", "delivered"];
    return steps.indexOf(status);
  };
  const currentStep = order ? getStep(order.status) : 5;

  const statusData = {
    0: { title: "Awaiting Confirmation", desc: "Waiting for restaurant to accept", color: "text-zinc-500", bg: "bg-zinc-100", icon: <Clock /> },
    1: { title: "Order Accepted", desc: "The restaurant is reviewing your order", color: "text-blue-500", bg: "bg-blue-100", icon: <Receipt /> },
    2: { title: "Preparing Food", desc: "Your meal is being cooked", color: "text-orange-500", bg: "bg-orange-100", icon: <ChefHat /> },
    3: { title: "Ready for Pickup", desc: "Waiting for the rider to arrive", color: "text-amber-500", bg: "bg-amber-100", icon: <ShoppingBag /> },
    4: { title: "Out for Delivery", desc: "Your food is on the way!", color: "text-emerald-500", bg: "bg-emerald-100", icon: <Bike /> },
    5: { title: "Delivered", desc: "Enjoy your meal!", color: "text-emerald-600", bg: "bg-emerald-100", icon: <CheckCircle2 /> }
  };
  const currentStatus = statusData[currentStep] || statusData[0];

  const formatDate = (dateString) => {
    if (!dateString) return "Recently";
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white min-h-screen font-sans text-zinc-900 pb-20">
      <div className="pb-6 px-4 md:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-zinc-900">Your Orders</h1>
            <p className="text-zinc-500 font-medium mt-2">Track deliveries or view past history.</p>
          </div>
          <div className="bg-zinc-100 p-1.5 rounded-2xl flex w-full md:w-96 shadow-inner">
            <button onClick={() => setActiveTab("live")} className={`flex-1 py-2.5 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all duration-300 ${activeTab === 'live' ? 'bg-white text-orange-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}><Navigation size={16} /> Live Track</button>
            <button onClick={() => setActiveTab("history")} className={`flex-1 py-2.5 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all duration-300 ${activeTab === 'history' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}><History size={16} /> History</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {activeTab === "live" && (
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-32"><div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mb-6"></div></motion.div>
            ) : (!order && !showRatingPopup) ? (
              <motion.div key="empty" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-zinc-50 rounded-[2.5rem] p-12 text-center border border-zinc-100 flex flex-col items-center mt-4">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm"><ShoppingBag size={40} className="text-zinc-300" /></div>
                <h2 className="text-2xl font-black text-zinc-900 mb-3">No Ongoing Orders</h2>
                <button onClick={() => navigate("/")} className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-2xl font-bold mt-4 shadow-lg active:scale-95 transition-all">Browse Restaurants</button>
              </motion.div>
            ) : (
              <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 flex flex-col gap-6">
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-200 flex items-center gap-5">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center shrink-0 ${currentStatus.bg} ${currentStatus.color}`}>{currentStatus.icon}</div>
                    <div><h2 className="text-2xl font-black text-zinc-900 tracking-tight">{currentStatus.title}</h2><p className="text-zinc-500 font-medium">{currentStatus.desc}</p></div>
                  </div>

                  <div className="bg-zinc-200 rounded-3xl overflow-hidden shadow-sm border border-zinc-200 relative h-[400px] z-0">
                    {order?.rider_info && restaurantLoc && customerLoc && riderLocation ? (
                      <MapContainer
                        center={riderLocation}
                        zoom={14}
                        scrollWheelZoom={true}
                        style={{ height: '100%', width: '100%', zIndex: 0 }}
                      >
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                        
                        <MapUpdater riderLocation={riderLocation} autoCenter={autoCenter} setAutoCenter={setAutoCenter} />

                        <Marker position={restaurantLoc} icon={storeIcon}><Popup className="font-bold">Restaurant</Popup></Marker>
                        <Marker position={customerLoc} icon={homeIcon}><Popup className="font-bold">Delivery Address</Popup></Marker>

                        {routeLine.length > 0 && (
                          <Polyline positions={routeLine} color="#3b82f6" weight={5} dashArray="8, 12" opacity={0.7} />
                        )}

                        <Marker position={riderLocation} icon={bikeIcon}>
                          <Popup><span className="font-bold text-emerald-600">{order.rider_info.name}</span> is on the way!</Popup>
                        </Marker>
                      </MapContainer>
                    ) : (
                      <div className="h-full w-full bg-zinc-900 relative flex items-center justify-center"><div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div><div className="relative flex items-center justify-center"><div className="absolute w-24 h-24 bg-orange-500/20 rounded-full animate-ping"></div><div className="absolute w-16 h-16 bg-orange-500/40 rounded-full animate-pulse"></div><div className="relative z-10 bg-orange-500 p-3 rounded-full text-white shadow-[0_0_20px_rgba(249,115,22,0.6)] border-2 border-white/20"><Store size={24} /></div></div></div>
                    )}

                    <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl text-zinc-900 font-bold text-xs tracking-wider flex items-center gap-2 shadow-lg border border-white">
                      <span className={`w-2 h-2 rounded-full animate-pulse ${order?.rider_info ? 'bg-emerald-500' : 'bg-amber-500'}`}></span> {order?.rider_info ? 'LIVE GPS' : 'AWAITING RIDER'}
                    </div>

                    {!autoCenter && order?.rider_info && (
                      <button
                        onClick={() => setAutoCenter(true)}
                        className="absolute top-4 right-4 z-[400] bg-white p-3 rounded-full shadow-lg border border-slate-200 hover:bg-slate-50 transition-all group"
                        title="Recenter on Rider"
                      >
                        <LocateFixed size={20} className="text-orange-500 group-hover:scale-110 transition-transform" />
                      </button>
                    )}

                    {order?.rider_info && (
                      <div className="absolute bottom-0 w-full bg-white/95 backdrop-blur-xl p-4 border-t border-zinc-200 flex items-center justify-between z-[400]">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center font-black text-xl">{order.rider_info.name.charAt(0)}</div>
                          <div><h3 className="font-bold text-zinc-900 text-lg leading-tight">{order.rider_info.name}</h3><p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">{order.rider_info.vehicle_type}</p></div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setShowMessageBox(true)} className="w-10 h-10 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl flex items-center justify-center transition-colors"><MessageSquare size={18} /></button>
                          <a href={`tel:${order.rider_info.phone}`} className="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-md transition-colors"><PhoneCall size={18} /></a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-5 flex flex-col gap-6">
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-200 relative">
                    <div className="flex items-center gap-3 border-b border-zinc-100 pb-4 mb-4"><Store className="text-orange-500" size={24} /><div><h3 className="font-black text-zinc-900 text-lg leading-none">{order?.restaurant_name || lastActiveOrder.current?.restaurant_name}</h3><p className="text-xs text-zinc-400 font-bold uppercase tracking-wider mt-1">Order #{order?.id || lastActiveOrder.current?.id}</p></div></div>
                    <div className="space-y-4 mb-6">{(order?.items || lastActiveOrder.current?.items || []).map((item, idx) => (<div key={idx} className="flex gap-3 text-zinc-700"><span className="font-black text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded min-w-[32px] text-center text-sm">{item.qty}x</span><span className="font-semibold text-[15px]">{item.name}</span></div>))}</div>
                    <div className="relative h-4 -mx-6 mb-4 overflow-hidden"><div className="absolute inset-0 bg-[radial-gradient(circle,transparent_4px,#ffffff_5px)] [background-size:12px_12px] -top-2"></div></div>
                    <div className="bg-zinc-50 p-4 rounded-2xl flex justify-between items-center border border-zinc-100"><span className="font-bold text-zinc-500 text-sm">Amount Paid</span><span className="text-2xl font-black text-zinc-900">₹{order?.total || lastActiveOrder.current?.total}</span></div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-200">
                    <h3 className="font-black text-zinc-900 mb-6">Track Status</h3>
                    <div className="pl-2">
                      {[{ label: "Order Placed", stepIdx: 1 }, { label: "Kitchen Preparing", stepIdx: 2 }, { label: "Ready for Rider", stepIdx: 3 }, { label: "Out for Delivery", stepIdx: 4 }].map((step, i, arr) => {
                        const isCompleted = currentStep >= step.stepIdx;
                        return (
                          <div key={i} className="flex relative pb-8 last:pb-0">
                            {i !== arr.length - 1 && <div className={`absolute left-[9px] top-6 bottom-[-8px] w-[3px] rounded-full transition-colors duration-500 ${isCompleted ? 'bg-orange-500' : 'bg-zinc-100'}`}></div>}
                            <div className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ${isCompleted ? "bg-orange-500 ring-4 ring-orange-500/20" : "bg-zinc-200"}`}>
                              {isCompleted && <Check size={12} strokeWidth={4} className="text-white" />}
                            </div>
                            <div className={`ml-6 font-bold text-[15px] leading-none pt-0.5 transition-colors duration-500 ${isCompleted ? "text-zinc-900" : "text-zinc-400"}`}>{step.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* --- TAB 2: ORDER HISTORY --- */}
        {activeTab === "history" && (
          <div className="space-y-4">
            {loadingHistory ? (
              <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div></div>
            ) : orderHistory.length === 0 ? (
              <div className="text-center py-24 bg-zinc-50 rounded-[2.5rem] border border-zinc-100"><div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm"><History size={32} className="text-zinc-300" /></div><h2 className="text-xl font-black text-zinc-900">No Past Orders</h2><p className="text-zinc-500 font-medium mt-2">Your historical deliveries will appear here.</p></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {orderHistory.map((pastOrder) => (
                  <div key={pastOrder.id} className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div><h3 className="font-black text-zinc-900 text-lg leading-tight mb-1">{pastOrder.restaurant_name}</h3><p className="text-xs font-bold text-zinc-400 tracking-wide uppercase">{formatDate(pastOrder.created_at)}</p></div>
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-wider flex items-center gap-1 ${pastOrder.status === 'delivered' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{pastOrder.status}</span>
                      </div>
                      <div className="text-sm text-zinc-600 font-medium line-clamp-2 mb-6 leading-relaxed">{pastOrder.items?.map(i => `${i.qty}x ${i.name}`).join(', ') || 'View items'}</div>
                    </div>
                    <div className="flex justify-between items-end border-t border-zinc-100 pt-4">
                      <div className="text-xl font-black text-zinc-900">₹{pastOrder.total_amount || pastOrder.total}</div>
                      <button 
                        onClick={() => handleReorder(pastOrder)} 
                        className="flex items-center gap-2 text-xs font-bold text-white bg-zinc-900 hover:bg-black px-4 py-2.5 rounded-xl transition-colors active:scale-95"
                      >
                        <RotateCcw size={14} /> Reorder
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Message Box Modal */}
      <AnimatePresence>
        {showMessageBox && (
          <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4"><motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white p-6 rounded-[2rem] w-full max-w-sm shadow-xl"><div className="flex justify-between items-center mb-5"><h3 className="font-bold text-lg text-zinc-900">Message Rider</h3><button onClick={() => setShowMessageBox(false)} className="p-2 bg-zinc-50 rounded-full text-zinc-500 hover:bg-zinc-100"><X size={18} /></button></div><textarea className="w-full bg-zinc-50 border border-zinc-200 focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-500/20 outline-none p-4 rounded-xl text-sm font-medium transition-all resize-none" rows="4" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="E.g. Please leave at the door..." /><button onClick={sendMessage} className="bg-orange-500 hover:bg-orange-600 text-white w-full mt-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"><Send size={16} /> Send</button></motion.div></div>
        )}
      </AnimatePresence>

      {/* Rating Modal */}
      <AnimatePresence>
        {showRatingPopup && (
          <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4"><motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-center shadow-2xl"><div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 size={40} strokeWidth={3} /></div><h2 className="text-3xl font-black mb-2 text-zinc-900 tracking-tight">Delivered!</h2><p className="text-zinc-500 font-medium mb-8 leading-relaxed">How was your delivery experience with <br /><span className="text-zinc-900 font-bold">{lastActiveOrder.current?.rider_info?.name || 'the rider'}</span>?</p><div className="flex justify-center gap-2 mb-8">{[1, 2, 3, 4, 5].map((s) => (<button key={s} onClick={() => setRating(s)} className="outline-none transform transition-transform hover:scale-110 active:scale-90"><Star size={42} className={`transition-all duration-300 ${s <= rating ? "text-orange-500 fill-orange-500 drop-shadow-md" : "text-zinc-200 fill-zinc-100"}`} /></button>))}</div><div className="flex flex-col gap-3"><button onClick={handleRatingSubmit} disabled={rating === 0} className={`w-full font-bold py-4 rounded-xl transition-all active:scale-95 ${rating > 0 ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-md' : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'}`}>Submit Feedback</button><button onClick={() => { setShowRatingPopup(false); navigate('/'); }} className="w-full text-zinc-500 font-bold py-3 rounded-xl hover:bg-zinc-50 transition-colors">Skip for now</button></div></motion.div></div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default TrackOrder;