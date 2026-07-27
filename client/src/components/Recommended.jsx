// // import React from 'react';

// // const Recommended = () => {
// //     // Data for the 3 cards shown in the design
// //     const deals = [
// //         {
// //             id: 1,
// //             discount: "-40%",
// //             restaurant: "Chef Burgers London",
// //             category: "Restaurant",
// //             image: "https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&q=80&w=800", // Burger flatlay
// //         },
// //         {
// //             id: 2,
// //             discount: "-20%",
// //             restaurant: "Grand Ai Cafe London",
// //             category: "Restaurant",
// //             image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=800", // Steak/Salad flatlay
// //         },
// //         {
// //             id: 3,
// //             discount: "-17%",
// //             restaurant: "Butterbrot Caf'e London",
// //             category: "Restaurant",
// //             image: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&q=80&w=800", // Burger/Sandwich flatlay
// //         },
// //     ];

// //     return (
// //         <section className="w-[95%] mx-auto py-12 bg-white">

// //             {/* --- HEADER SECTION --- */}
// //             <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-6">
// //                 {/* Title */}
// //                 <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
// //                     Recommended for you
// //                 </h2>

// //             </div>

// //             {/* --- CARDS GRID --- */}
// //             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
// //                 {deals.map((deal) => (
// //                     <div
// //                         key={deal.id}
// //                         className="group relative h-[320px] w-full rounded-3xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-shadow duration-300"
// //                     >
// //                         {/* Background Image */}
// //                         <img
// //                             src={deal.image}
// //                             alt={deal.restaurant}
// //                             className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
// //                         />

// //                         {/* Dark Gradient Overlay for text readability */}
// //                         <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

// //                         {/* Discount Badge (Top Right) */}
// //                         <div className="absolute top-0 right-0 bg-[#03081F] text-white font-bold px-6 py-3 rounded-bl-2xl text-lg z-10">
// //                             {deal.discount}
// //                         </div>

// //                         {/* Bottom Content */}
// //                         <div className="absolute bottom-0 left-0 p-6 w-full z-10">
// //                             <p className="text-[#FF8A00] font-bold text-sm mb-1">
// //                                 {deal.category}
// //                             </p>
// //                             <h3 className="text-white text-2xl font-bold tracking-wide">
// //                                 {deal.restaurant}
// //                             </h3>
// //                         </div>
// //                     </div>
// //                 ))}
// //             </div>
// //         </section>
// //     );
// // };

// // export default Recommended;

// import React, { useState, useEffect } from 'react';
// import axios from 'axios';

// const Recommended = ({ userId }) => {
//     const [deals, setDeals] = useState([]);
//     const [loading, setLoading] = useState(true);

//     // --- NETWORK OFFLINE FALLBACK ---
//     // This ONLY shows if the FastAPI server completely crashes or goes offline
//     const fallbackDeals = [
//         {
//             id: 'static-1', discount: "-40%", name: "Chef Burgers London", category: "Restaurant",
//             image: "https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&q=80&w=800",
//         },
//         {
//             id: 'static-2', discount: "-20%", name: "Grand Ai Cafe London", category: "Restaurant",
//             image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=800",
//         },
//         {
//             id: 'static-3', discount: "-17%", name: "Butterbrot Caf'e London", category: "Restaurant",
//             image: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&q=80&w=800",
//         },
//     ];

//     useEffect(() => {
//         const fetchRecommendations = async () => {
//             try {
//                 const response = await axios.get(`http://localhost:8000/users/${userId}/recommendations`);
//                 setDeals(response.data);
//             } catch (error) {
//                 console.error("API Error: Server offline. Using static fallback data.");
//             } finally {
//                 setLoading(false);
//             }
//         };

//         if (userId) {
//             fetchRecommendations();
//         } else {
//             setLoading(false);
//         }
//     }, [userId]);

//     const calculateDiscount = (price, discountPrice) => {
//         if (!discountPrice || discountPrice >= price) return null;
//         const percentage = Math.round(((price - discountPrice) / price) * 100);
//         return `-${percentage}%`;
//     };

//     // --- DECISION ENGINE ---
//     // Just use whatever the API gives us! (Backend now guarantees 3 items)
//     const displayDeals = deals.length > 0 ? deals : fallbackDeals;

//     return (
//         <section className="w-[95%] mx-auto py-12 bg-white">
//             <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-6">
//                 <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
//                     Recommended for you
//                 </h2>
//             </div>

//             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//                 {loading ? (
//                     Array.from({ length: 3 }).map((_, index) => (
//                         <div key={`skeleton-${index}`} className="relative h-[320px] w-full rounded-3xl overflow-hidden bg-slate-200 animate-pulse">
//                             <div className="absolute bottom-0 left-0 p-6 w-full">
//                                 <div className="h-4 bg-slate-300 rounded w-1/3 mb-3"></div>
//                                 <div className="h-8 bg-slate-300 rounded w-3/4"></div>
//                             </div>
//                         </div>
//                     ))
//                 ) : (
//                     displayDeals.map((deal) => {
//                         const discountBadge = deal.discount || calculateDiscount(deal.price, deal.discountPrice);

//                         return (
//                             <div key={deal.id} className="group relative h-[320px] w-full rounded-3xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-shadow duration-300">
//                                 <img
//                                     src={deal.image || "https://via.placeholder.com/800x600?text=Food+Image"}
//                                     alt={deal.name}
//                                     className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
//                                 />
//                                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

//                                 {discountBadge && (
//                                     <div className="absolute top-0 right-0 bg-[#03081F] text-white font-bold px-6 py-3 rounded-bl-2xl text-lg z-10">
//                                         {discountBadge}
//                                     </div>
//                                 )}

//                                 <div className="absolute bottom-0 left-0 p-6 w-full z-10">
//                                     <p className="text-[#FF8A00] font-bold text-sm mb-1 uppercase tracking-wider">
//                                         {deal.category}
//                                     </p>
//                                     <h3 className="text-white text-2xl font-bold tracking-wide">
//                                         {deal.name}
//                                     </h3>
//                                 </div>
//                             </div>
//                         );
//                     })
//                 )}
//             </div>
//         </section>
//     );
// };

// export default Recommended;

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { API_BASE_URL } from '../services/api';

const Recommended = ({ userId }) => {
    const [deals, setDeals] = useState([]);
    const [loading, setLoading] = useState(true);

    // Initialize the navigation hook
    const navigate = useNavigate();

    useEffect(() => {
        const fetchRecommendations = async () => {
            if (!userId) {
                setDeals([]);
                setLoading(false);
                return;
            }
            try {
                const response = await axios.get(`${API_BASE_URL}/users/${userId}/recommendations`);
                if (Array.isArray(response.data)) {
                    setDeals(response.data);
                } else {
                    setDeals([]);
                }
            } catch (error) {
                console.error("API Error fetching recommendations:", error);
                setDeals([]);
            } finally {
                setLoading(false);
            }
        };

        fetchRecommendations();
    }, [userId]);

    const calculateDiscount = (price, discountPrice) => {
        if (!discountPrice || discountPrice >= price) return null;
        const percentage = Math.round(((price - discountPrice) / price) * 100);
        return `-${percentage}%`;
    };

    // If loading finished and user has no completed orders/recommendations, hide section
    if (!loading && deals.length === 0) {
        return null;
    }

    return (
        <section className="w-[95%] mx-auto py-12 bg-white">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-6">
                <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
                    Recommended for you
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                        <div key={`skeleton-${index}`} className="relative h-[320px] w-full rounded-3xl overflow-hidden bg-slate-200 animate-pulse">
                            <div className="absolute bottom-0 left-0 p-6 w-full">
                                <div className="h-4 bg-slate-300 rounded w-1/3 mb-3"></div>
                                <div className="h-8 bg-slate-300 rounded w-3/4"></div>
                            </div>
                        </div>
                    ))
                ) : (
                    deals.map((deal) => {
                        const discountBadge = deal.discount || calculateDiscount(deal.price, deal.discountPrice);

                        return (
                            <div
                                key={deal.id}
                                // --- THIS MAKES THE CARD CLICKABLE ---
                                // It redirects the user to the item details page
                                onClick={() => navigate(`/menu-item/${deal.id}`)}
                                className="group relative h-[320px] w-full rounded-3xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-shadow duration-300"
                            >
                                <img
                                    src={deal.image || "https://via.placeholder.com/800x600?text=Food+Image"}
                                    alt={deal.name}
                                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

                                {discountBadge && (
                                    <div className="absolute top-0 right-0 bg-[#03081F] text-white font-bold px-6 py-3 rounded-bl-2xl text-lg z-10">
                                        {discountBadge}
                                    </div>
                                )}

                                <div className="absolute bottom-0 left-0 p-6 w-full z-10">
                                    <p className="text-[#FF8A00] font-bold text-sm mb-1 uppercase tracking-wider">
                                        {deal.category}
                                    </p>
                                    <h3 className="text-white text-2xl font-bold tracking-wide">
                                        {deal.name}
                                    </h3>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </section>
    );
};

export default Recommended;