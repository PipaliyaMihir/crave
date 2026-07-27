import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Star, MapPin } from 'lucide-react';
import { API_BASE_URL } from '../services/api';

const PopularBrand = () => {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/restaurants`);
        if (Array.isArray(response.data)) {
          setRestaurants(response.data);
        }
      } catch (error) {
        console.error("Error fetching popular restaurants:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  return (
    <div className="w-[95%] mx-auto py-10 px-4 font-sans">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-[#03081F] tracking-tight">
            Popular Restaurants
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">Explore top-rated dining spots nearby</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={`sk-${i}`} className="h-52 rounded-3xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : restaurants.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-3xl border border-slate-100 text-sm font-medium">
          No registered restaurants available right now.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {restaurants.map((restaurant) => (
            <div
              key={restaurant.id}
              onClick={() => navigate(`/rest/${restaurant.id}`)}
              className="group cursor-pointer rounded-3xl overflow-hidden bg-white border border-slate-100 hover:border-orange-200 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative flex flex-col justify-between"
            >
              {/* Rating Tag */}
              <div className="absolute top-2.5 right-2.5 z-10 bg-slate-900/80 backdrop-blur-md text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                <Star size={11} className="fill-amber-400 text-amber-400" />
                {restaurant.average_rating > 0 ? Number(restaurant.average_rating).toFixed(1) : "4.8"}
              </div>

              {/* Image Container */}
              <div className="h-36 w-full relative overflow-hidden bg-slate-100">
                <img
                  src={restaurant.profile_image || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80"}
                  alt={restaurant.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>

              {/* Orange CRAVE Bottom Banner */}
              <div className="bg-[#FC8A06] p-3.5 h-16 flex flex-col items-center justify-center">
                <h3 className="text-white font-extrabold text-center text-xs uppercase tracking-wider leading-tight line-clamp-1">
                  {restaurant.name}
                </h3>
                {restaurant.cuisine && (
                  <span className="text-[10px] text-orange-100 font-medium truncate mt-0.5">
                    {restaurant.cuisine}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PopularBrand;
