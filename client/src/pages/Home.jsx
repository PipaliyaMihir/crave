// import React, { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
// import b1 from '/b1.png';
// import b2 from '/b2.png';
// import b3 from '/b3.png';
// import Recommended from '../components/Recommended';
// import PopularCategories from '../components/PopularCategories';
// import PopularBrand from '../components/PopularBrand';
// import Ad from '../components/ad';
// import Partner from '../components/partner';

// const Home = () => {
//     const navigate = useNavigate();
//     const [activeOrder, setActiveOrder] = useState(null);

//     useEffect(() => {
//         let intervalId;

//         const checkActiveOrder = async () => {

//             const token = sessionStorage.getItem('token');

//             if (!token) {
//                 setActiveOrder(null);
//                 return;
//             }

//             try {
//                 const response = await fetch('http://localhost:8000/api/orders/track', {
//                     headers: {
//                         'Authorization': `Bearer ${token}`,
//                         'Cache-Control': 'no-cache'
//                     }
//                 });

//                 if (response.ok) {
//                     const data = await response.json();
//                     if (data && data.active === true) {
//                         setActiveOrder(data);
//                     } else {
//                         setActiveOrder(null);
//                     }
//                 } else {
//                     setActiveOrder(null);
//                 }
//             } catch (error) {
//                 console.error("Tracker fetch error:", error);
//                 setActiveOrder(null);
//             }
//         };

//         // Check immediately on mount
//         checkActiveOrder();

//         // Only start polling if a token exists
//         const initialToken = sessionStorage.getItem('token');
//         if (initialToken) {
//             intervalId = setInterval(checkActiveOrder, 10000);
//         }

//         return () => clearInterval(intervalId);
//     }, []);

//     const getStatusText = (status) => {
//         const statuses = {
//             'pending': 'Awaiting Restaurant',
//             'payment_pending': 'Awaiting Payment',
//             'accepted': 'Order Accepted!',
//             'preparing': 'Preparing your food...',
//             'ready': 'Food is ready!',
//             'out_for_delivery': 'Rider is on the way!'
//         };
//         return statuses[status] || 'Processing order...';
//     };

//     return (
//         <div className="font-sans text-slate-900 overflow-x-hidden bg-white flex flex-col items-center justify-center relative">

//             {/* --- MAIN HERO CONTAINER --- */}
//             <main className="relative w-[95%] bg-[#F9F9F9] rounded-[10px] overflow-hidden flex flex-col lg:flex-row min-h-[600px] mt-4">
//                 <div className="p-8 lg:p-16 z-30 flex flex-col justify-center">
//                     <p className="text-slate-600 text-sm font-semibold mb-4 tracking-wide">
//                         Order Restaurant food, takeaway and groceries.
//                     </p>
//                     <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] mb-6 sm:mb-8 text-slate-900 text-center lg:text-left">
//                         Feast Your Senses, <br />
//                         <span className="text-[#FF8A00]">Fast and Fresh</span>
//                     </h1>

//                 </div>

//                 <div className="flex-1 relative h-[500px] lg:h-auto w-full">
//                     <div className="absolute top-0 right-0 h-full w-full z-0 flex justify-end">
//                         <img src={b3} alt="Background" className="h-full object-contain object-right-top opacity-90" />
//                     </div>
//                     <div className="absolute top-16 right-[25%] lg:right-[35%] z-10 hidden md:block">
//                         <img src={b2} alt="Pasta" className="w-[260px] h-[340px] object-cover rounded-[2rem] border-[8px] border-white shadow-2xl transform rotate-[-2deg]" />
//                     </div>
//                     <div className="absolute bottom-0 left-0 lg:left-[-280px] z-20 h-[85%] w-[130%] flex items-end pointer-events-none">
//                         <img src={b1} alt="Pizza" className="h-full object-contain mix-blend-multiply drop-shadow-xl" />
//                     </div>

//                     <div className="absolute top-1/2 right-4 lg:right-12 -translate-y-1/2 z-30 flex flex-col gap-5 hidden lg:flex">
//                         <NotificationCard step="1" title="We've Received your order!" subtitle="Awaiting Restaurant acceptance" />
//                         <NotificationCard step="2" title="Order Accepted! ✅" subtitle="Your order will be delivered shortly" />
//                         <NotificationCard step="3" title="Your rider's nearby 🚴" subtitle="They're almost there - get ready!" />
//                     </div>
//                 </div>
//             </main>

//             <Recommended />
//             <PopularCategories />
//             <PopularBrand />
//             <Ad />
//             <Partner />

//             {/* --- LIVE ORDER TRACKER POPUP --- */}
//             {activeOrder !== null && (
//                 <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[9999] w-[90%] max-w-lg transition-all duration-500 ease-in-out">
//                     <div
//                         className="bg-white/95 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.2)] border-2 border-[#FF8A00] rounded-3xl p-3 pl-5 flex items-center justify-between gap-4 cursor-pointer"
//                         onClick={() => navigate('/track-order')}
//                     >
//                         <div className="flex items-center gap-4">
//                             <div className="relative flex h-3.5 w-3.5 flex-shrink-0">
//                                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
//                                 <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500"></span>
//                             </div>

//                             <div className="flex flex-col">
//                                 <span className="text-sm font-extrabold text-slate-900 leading-tight">
//                                     {getStatusText(activeOrder.status)}
//                                 </span>
//                                 <span className="text-xs font-bold text-slate-500 mt-0.5">
//                                     {activeOrder.restaurant_name} • Total: ₹{activeOrder.total}
//                                 </span>
//                             </div>
//                         </div>

//                         <button
//                             onClick={(e) => { e.stopPropagation(); navigate('/track-order'); }}
//                             className="bg-[#FF8A00] hover:bg-[#ff9f2e] text-white px-6 py-2.5 rounded-2xl font-bold text-sm shadow-md"
//                         >
//                             Track
//                         </button>
//                     </div>
//                 </div>
//             )}

//             <style>{`
//                 html, body { scrollbar-width: none; -ms-overflow-style: none; }
//                 html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }
//             `}</style>
//         </div>
//     );
// };

// const NotificationCard = ({ step, title, subtitle }) => (
//     <div className="relative pl-6 group cursor-default">
//         <span className="absolute -left-4 -top-5 text-[80px] font-black text-white/40 z-0 select-none group-hover:text-white/60 transition-colors">
//             {step}
//         </span>
//         <div className="relative z-10 bg-white/90 backdrop-blur-sm border border-white/60 shadow-lg rounded-2xl p-4 w-[280px] transition-transform hover:-translate-y-1 duration-300">
//             <div className="flex justify-between items-center mb-1">
//                 <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
//                     Order <span className="text-[#FF8A00]">●</span>
//                 </span>
//                 <span className="text-[10px] text-slate-400 italic">now</span>
//             </div>
//             <h3 className="text-xs font-bold text-slate-900 leading-tight">{title}</h3>
//             <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{subtitle}</p>
//         </div>
//     </div>
// );

// export default Home;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import b1 from '/b1.png';
import b2 from '/b2.png';
import b3 from '/b3.png';
import Recommended from '../components/Recommended';
import PopularBrand from '../components/PopularBrand';
import Ad from '../components/ad';
import Partner from '../components/partner';
import { API_BASE_URL } from '../services/api';

const Home = () => {
    const navigate = useNavigate();
    const [activeOrder, setActiveOrder] = useState(null);

    // --- ADDED: State to hold the logged-in user's ID ---
    const [loggedInUserId, setLoggedInUserId] = useState(null);

    useEffect(() => {
        // --- ADDED: Grab the user ID from sessionStorage on load ---
        const storedUserId = sessionStorage.getItem('user_id');
        if (storedUserId) {
            setLoggedInUserId(storedUserId);
        }

        let intervalId;

        const checkActiveOrder = async () => {

            const token = sessionStorage.getItem('token');

            if (!token) {
                setActiveOrder(null);
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/orders/track`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Cache-Control': 'no-cache'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data && data.active === true) {
                        setActiveOrder(data);
                    } else {
                        setActiveOrder(null);
                    }
                } else {
                    setActiveOrder(null);
                }
            } catch (error) {
                console.error("Tracker fetch error:", error);
                setActiveOrder(null);
            }
        };

        // Check immediately on mount
        checkActiveOrder();

        // Only start polling if a token exists
        const initialToken = sessionStorage.getItem('token');
        if (initialToken) {
            intervalId = setInterval(checkActiveOrder, 10000);
        }

        return () => clearInterval(intervalId);
    }, []);

    const getStatusText = (status) => {
        const statuses = {
            'pending': 'Awaiting Restaurant',
            'payment_pending': 'Awaiting Payment',
            'accepted': 'Order Accepted!',
            'preparing': 'Preparing your food...',
            'ready': 'Food is ready!',
            'out_for_delivery': 'Rider is on the way!'
        };
        return statuses[status] || 'Processing order...';
    };

    return (
        <div className="font-sans text-slate-900 overflow-x-hidden bg-white flex flex-col items-center justify-center relative">

            {/* --- MAIN HERO CONTAINER --- */}
            <main className="relative w-[95%] bg-[#F9F9F9] rounded-[10px] overflow-hidden flex flex-col lg:flex-row min-h-[600px] mt-4">
                <div className="p-8 lg:p-16 z-30 flex flex-col justify-center">
                    <p className="text-slate-600 text-sm font-semibold mb-4 tracking-wide">
                        Order Restaurant food, takeaway and groceries.
                    </p>
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] mb-6 sm:mb-8 text-slate-900 text-center lg:text-left">
                        Feast Your Senses, <br />
                        <span className="text-[#FF8A00]">Fast and Fresh</span>
                    </h1>

                </div>

                <div className="flex-1 relative h-[500px] lg:h-auto w-full">
                    <div className="absolute top-0 right-0 h-full w-full z-0 flex justify-end">
                        <img src={b3} alt="Background" className="h-full object-contain object-right-top opacity-90" />
                    </div>
                    <div className="absolute top-16 right-[25%] lg:right-[35%] z-10 hidden md:block">
                        <img src={b2} alt="Pasta" className="w-[260px] h-[340px] object-cover rounded-[2rem] border-[8px] border-white shadow-2xl transform rotate-[-2deg]" />
                    </div>
                    <div className="absolute bottom-0 left-0 lg:left-[-280px] z-20 h-[85%] w-[130%] flex items-end pointer-events-none">
                        <img src={b1} alt="Pizza" className="h-full object-contain mix-blend-multiply drop-shadow-xl" />
                    </div>

                    <div className="absolute top-1/2 right-4 lg:right-12 -translate-y-1/2 z-30 flex flex-col gap-5 hidden lg:flex">
                        <NotificationCard step="1" title="We've Received your order!" subtitle="Awaiting Restaurant acceptance" />
                        <NotificationCard step="2" title="Order Accepted! ✅" subtitle="Your order will be delivered shortly" />
                        <NotificationCard step="3" title="Your rider's nearby 🚴" subtitle="They're almost there - get ready!" />
                    </div>
                </div>
            </main>

            <Recommended userId={loggedInUserId} />

            <PopularBrand />
            <Ad />
            <Partner />

            {/* --- LIVE ORDER TRACKER POPUP --- */}
            {activeOrder !== null && (
                <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[9999] w-[90%] max-w-lg transition-all duration-500 ease-in-out">
                    <div
                        className="bg-white/95 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.2)] border-2 border-[#FF8A00] rounded-3xl p-3 pl-5 flex items-center justify-between gap-4 cursor-pointer"
                        onClick={() => navigate('/track-order')}
                    >
                        <div className="flex items-center gap-4">
                            <div className="relative flex h-3.5 w-3.5 flex-shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500"></span>
                            </div>

                            <div className="flex flex-col">
                                <span className="text-sm font-extrabold text-slate-900 leading-tight">
                                    {getStatusText(activeOrder.status)}
                                </span>
                                <span className="text-xs font-bold text-slate-500 mt-0.5">
                                    {activeOrder.restaurant_name} • Total: ₹{activeOrder.total}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={(e) => { e.stopPropagation(); navigate('/track-order'); }}
                            className="bg-[#FF8A00] hover:bg-[#ff9f2e] text-white px-6 py-2.5 rounded-2xl font-bold text-sm shadow-md"
                        >
                            Track
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                html, body { scrollbar-width: none; -ms-overflow-style: none; }
                html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
};

const NotificationCard = ({ step, title, subtitle }) => (
    <div className="relative pl-6 group cursor-default">
        <span className="absolute -left-4 -top-5 text-[80px] font-black text-white/40 z-0 select-none group-hover:text-white/60 transition-colors">
            {step}
        </span>
        <div className="relative z-10 bg-white/90 backdrop-blur-sm border border-white/60 shadow-lg rounded-2xl p-4 w-[280px] transition-transform hover:-translate-y-1 duration-300">
            <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                    Order <span className="text-[#FF8A00]">●</span>
                </span>
                <span className="text-[10px] text-slate-400 italic">now</span>
            </div>
            <h3 className="text-xs font-bold text-slate-900 leading-tight">{title}</h3>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{subtitle}</p>
        </div>
    </div>
);

export default Home;