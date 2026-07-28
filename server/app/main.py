import sys
import os

# Ensure server directory is in sys.path for Uvicorn imports on Render
SERVER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks, Response
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, defer, load_only
from sqlalchemy import func 
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
import json
import base64 
import httpx
import random
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv 
from pydantic import BaseModel 
import razorpay

# 1. LOAD ENVIRONMENT FIRST
load_dotenv() 

# 1. Initialize Gemini AI Client safely
client = None
chat_session = None
gemini_key = os.getenv("GEMINI_API_KEY")
if gemini_key:
    try:
        import google.genai as genai
        from google.genai import types
        client = genai.Client(api_key=gemini_key)
        chat_session = client.chats.create(
            model="gemini-2.0-flash",
            config=types.GenerateContentConfig(
                system_instruction="You are the official CRAVE food delivery AI assistant. You answer questions strictly about CRAVE food delivery, menu items, restaurants, and food recommendations. Recommend food items and products available on CRAVE whenever relevant. If asked about unrelated subjects, politely guide the user back to CRAVE food ordering."
            )
        )
    except Exception as err:
        print(f"Warning: Gemini AI client initialization skipped: {err}")

# 2. INTERNAL DB & MODEL IMPORTS
from app.db.session import engine, Base, get_db, SessionLocal
from app.models.user import User, Restaurant, Favorite
from app.models.menu import MenuItem 
from app.models.cart import Cart 
from app.models.order import Order, OrderItem
from app.models.restaurant_request import RestaurantRequest
from app.models.rider_request import RiderRequest
from app.models.rider import Rider # <--- MOVED TO TOP TO FIX CRASH
from app.models.cart import Cart  # <--- ADDED IMPORT
from app.models.contact import ContactInquiry
from app.utils.cloudinary_utils import upload_image_to_cloudinary

#  For location
# --- WEBSOCKET IMPORT ---
from app.websocket_manager import manager
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from pydantic import BaseModel

# 3. SCHEMAS
from app.schemas.rider_request import RiderRequestCreate
from app.schemas.user import UserCreate, UserUpdate, TokenResponse
from app.schemas.restaurant_request import RestaurantRequestCreate, RestaurantResponse
from app.schemas.rider_request import RiderProfileUpdate , RiderMessage , RiderRating
from app.schemas.user import PaymentVerification
from app.schemas.contact import ContactSchema
from app.schemas.menu import MenuItemResponse

# 3. Import Routes
from app.routes import restaurant
from app.routes import admin
from app.routes import menu

# 4. ROUTES & EMAIL
from app.routes.admin import send_update_email
from app.routes import restaurant, admin, menu
from app.utils.email import send_admin_reply_email, send_auto_acknowledgment

import bcrypt
if not hasattr(bcrypt, "__about__"):
    class _BcryptAbout:
        __version__ = getattr(bcrypt, "__version__", "4.0.1")
    bcrypt.__about__ = _BcryptAbout()

SECRET_KEY = os.getenv("SECRET_KEY", "your_secret_key_here")
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

app = FastAPI(title="Crave API")

# --- CORS CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Database Tables
Base.metadata.create_all(bind=engine)

def seed_initial_data(force=False):
    db = SessionLocal()
    try:
        # 1. Admin account seed
        admin_user = db.query(User).filter(User.role == "admin").first()
        if not admin_user or force:
            hashed_pw = pwd_context.hash("admin123")
            if not admin_user:
                new_admin = User(
                    username="admin",
                    full_name="System Admin",
                    email="admin@crave.com",
                    phone="0000000000",
                    hashed_password=hashed_pw,
                    role="admin"
                )
                db.add(new_admin)
                db.commit()
            print("[DB Seed] Default admin created: username=admin, password=admin123")

        # 2. Sample Restaurants and Menu Items seed
        if db.query(Restaurant).count() == 0 or force:
            sample_restaurants = [
                {
                    "name": "McDonald's London",
                    "email": "mcdonalds@crave.com",
                    "address": "Oxford Street, London",
                    "is_active": True,
                    "profile_image": "https://upload.wikimedia.org/wikipedia/commons/4/4b/McDonald%27s_logo.svg",
                    "average_rating": 4.8,
                    "rating_count": 124,
                    "items": [
                        {"name": "Big Mac Burger", "price": 199.0, "discount_price": 169.0, "category": "Burgers", "description": "Classic double beef patty with special sauce.", "image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80"},
                        {"name": "McFlurry Oreo", "price": 129.0, "discount_price": 99.0, "category": "Desserts", "description": "Creamy soft serve blended with crunchy Oreo cookies.", "image": "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=800&q=80"},
                        {"name": "Crispy French Fries", "price": 99.0, "discount_price": 79.0, "category": "Sides", "description": "Golden salted crispy potato fries.", "image": "https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&w=800&q=80"}
                    ]
                },
                {
                    "name": "Papa John's Pizza",
                    "email": "papajohns@crave.com",
                    "address": "Baker Street, London",
                    "is_active": True,
                    "profile_image": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Papa_Johns_logo.svg/500px-Papa_Johns_logo.svg.png",
                    "average_rating": 4.7,
                    "rating_count": 98,
                    "items": [
                        {"name": "Pepperoni Feast Pizza", "price": 399.0, "discount_price": 349.0, "category": "Pizza", "description": "Loaded with mozzarella cheese and spicy pepperoni slices.", "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80"},
                        {"name": "Garlic Cheese Sticks", "price": 179.0, "discount_price": 149.0, "category": "Sides", "description": "Freshly baked dough topped with garlic butter and melted cheese.", "image": "https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?auto=format&fit=crop&w=800&q=80"}
                    ]
                },
                {
                    "name": "KFC Crispy Chicken",
                    "email": "kfc@crave.com",
                    "address": "Piccadilly Circus, London",
                    "is_active": True,
                    "profile_image": "https://upload.wikimedia.org/wikipedia/sco/b/bf/KFC_logo.svg",
                    "average_rating": 4.6,
                    "rating_count": 85,
                    "items": [
                        {"name": "6 Pc Zinger Chicken Bucket", "price": 499.0, "discount_price": 429.0, "category": "Buckets", "description": "Extra crunchy spicy fried chicken pieces.", "image": "https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?auto=format&fit=crop&w=800&q=80"},
                        {"name": "Zinger Chicken Burger", "price": 189.0, "discount_price": 159.0, "category": "Burgers", "description": "Crispy chicken fillet in sesame seed bun.", "image": "https://images.unsplash.com/photo-1615557960916-5f4791effe9d?auto=format&fit=crop&w=800&q=80"}
                    ]
                },
                {
                    "name": "South Indian Dosa Corner",
                    "email": "southindian@crave.com",
                    "address": "High Street, London",
                    "is_active": True,
                    "profile_image": "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80",
                    "average_rating": 4.9,
                    "rating_count": 140,
                    "items": [
                        {"name": "Sada Paper Dosa", "price": 120.0, "discount_price": 100.0, "category": "South Indian", "description": "This is delicious Paper Dosa served with coconut chutney & sambar.", "image": "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80"},
                        {"name": "Masala Dosa", "price": 150.0, "discount_price": 130.0, "category": "South Indian", "description": "Crispy dosa stuffed with spiced potato masala.", "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80"}
                    ]
                }
            ]

            for r_data in sample_restaurants:
                items_data = r_data.pop("items")
                res = Restaurant(**r_data)
                db.add(res)
                db.commit()
                db.refresh(res)

                # Create matching user account for restaurant login
                res_user = db.query(User).filter(User.email == res.email).first()
                if not res_user:
                    user_obj = User(
                        username=res.name.lower().replace(" ", "").replace("'", ""),
                        full_name=res.name,
                        email=res.email,
                        phone="0000000000",
                        hashed_password=pwd_context.hash("restaurant123"),
                        role="restaurant"
                    )
                    db.add(user_obj)
                    db.commit()

                # Add menu items
                for item in items_data:
                    m_item = MenuItem(restaurant_id=res.id, **item)
                    db.add(m_item)
                db.commit()

            print("[DB Seed] Sample restaurants and menu items successfully seeded!")
    except Exception as e:
        print(f"[DB Seed Error]: {e}")
        db.rollback()
    finally:
        db.close()

# Automatic startup seeding disabled to keep your custom database 100% untouched
# seed_initial_data()

app.include_router(restaurant.router)
app.include_router(admin.router)
app.include_router(menu.router)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "CRAVE Backend API is live!"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/api/seed")
@app.get("/api/admin/seed-database")
def trigger_seed_database():
    seed_initial_data(force=True)
    return {
        "status": "success",
        "message": "Database seeded successfully with Admin account (username: admin, password: admin123), 4 Restaurants, and full Menus!"
    }

class CreateAdminRequest(BaseModel):
    username: str
    email: str
    password: str
    full_name: Optional[str] = "Admin User"
    phone: Optional[str] = "0000000000"

@app.post("/api/admin/create-admin")
def create_admin_manually(req: CreateAdminRequest, db: Session = Depends(get_db)):
    try:
        existing = db.query(User).filter((User.username == req.username) | (User.email == req.email)).first()
        if existing:
            raise HTTPException(400, "Username or email already exists")
        hashed_pw = pwd_context.hash(req.password)
        new_admin = User(
            username=req.username,
            full_name=req.full_name or req.username,
            email=req.email,
            phone=req.phone or "0000000000",
            hashed_password=hashed_pw,
            role="admin"
        )
        db.add(new_admin)
        db.commit()
        return {"status": "success", "message": f"Admin '{req.username}' created successfully!"}
    except HTTPException:
        raise
    except Exception as err:
        db.rollback()
        raise HTTPException(500, f"Failed to create admin: {str(err)}")


# ---------------- HELPERS ----------------
def verify_password(plain, hashed): return pwd_context.verify(plain, hashed)
def hash_password(password): return pwd_context.hash(password)

# ---------------- PYDANTIC MODELS ----------------
class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str

class UserProfileUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    profile_image: Optional[str] = None
    password: Optional[str] = None 

class CartAdd(BaseModel): 
    menu_item_id: int
    quantity: int
    customization: Optional[str] = "[]"
    total_price: Optional[float] = 0.0

class OrderCreate(BaseModel):
    address: str
    payment_method: str 

class OrderStatusUpdate(BaseModel):
    status: str 

# ==============================================================================
#  AUTH DEPENDENCIES
# ==============================================================================

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Invalid session")

def get_current_restaurant(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if user["role"] != "restaurant": 
        raise HTTPException(403, "Not a restaurant")
    res = db.query(Restaurant).filter(Restaurant.id == user.get("restaurant_id")).first()
    if not res: raise HTTPException(404, "Restaurant not found")
    return res

# ==============================================================================
#  ORDER MANAGEMENT SYSTEM (USER -> RESTAURANT -> RIDER)
# ==============================================================================

razorpay_client = razorpay.Client(auth=(
    os.getenv("RAZORPAY_KEY_ID"), 
    os.getenv("RAZORPAY_KEY_SECRET")
))

# --- Pydantic Schema for Verification ---
class PaymentVerification(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str

# --- UPDATE ORDER PLACEMENT ---
@app.post("/api/orders/place")
def place_order(order_data: OrderCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user["id"]
    cart_items = db.query(Cart).filter(Cart.user_id == user_id).all()
    if not cart_items: raise HTTPException(400, "Cart is empty")

    # 1. Calculate Totals (Same as before)
    total = 0
    restaurant_id = cart_items[0].menu_item.restaurant_id 
    order_items_data = []

    for item in cart_items:
        # FIX: Use the cart's custom price that includes addons, fallback to menu item price
        if item.price and item.price > 0:
            price = item.price
        else:
            price = item.menu_item.discount_price if (item.menu_item.discount_price and item.menu_item.discount_price > 0) else item.menu_item.price
            
        total += price * item.quantity
        order_items_data.append({
            "menu_item_id": item.menu_item_id,
            "name": item.menu_item.name,
            "price": price,
            "quantity": item.quantity,
            "addons": item.addons # This now saves the mapped names directly to the order
        })

    tax = round(total * 0.05, 2)
    grand_total = total + tax

    initial_status = "payment_pending" if order_data.payment_method == "RAZORPAY" else "pending"

    new_order = Order(
        user_id=user_id,
        restaurant_id=restaurant_id,
        status=initial_status, # <--- CHANGED
        total_amount=grand_total,
        payment_method=order_data.payment_method,
        delivery_address=order_data.address, # Address is SAVED here
        payment_status="pending"
    )
    db.add(new_order)
    db.flush()

    for item in order_items_data:
        db.add(OrderItem(order_id=new_order.id, **item))
    
    # 3. RAZORPAY LOGIC
    razorpay_order_data = None
    if order_data.payment_method == "RAZORPAY":
        amount_in_paise = int(grand_total * 100)
        try:
            razorpay_order = razorpay_client.order.create({
                "amount": amount_in_paise,
                "currency": "INR",
                "receipt": f"order_{new_order.id}",
                "payment_capture": 1
            })
            razorpay_order_data = {
                "id": razorpay_order['id'],
                "amount": razorpay_order['amount'],
                "key": os.getenv("RAZORPAY_KEY_ID")
            }

        except Exception as e:
            print(f"Razorpay Error: {e}")
            raise HTTPException(status_code=500, detail="Payment Gateway Error")
    else:
        db.query(Cart).filter(Cart.user_id == user_id).delete()

    db.commit()

    return {
        "message": "Order placed", 
        "order_id": new_order.id, 
        "total": grand_total,
        "razorpay_order_id": razorpay_order_data['id'] if razorpay_order_data else None,
        "razorpay_key_id": razorpay_order_data['key'] if razorpay_order_data else None,
        "razorpay_amount": razorpay_order_data['amount'] if razorpay_order_data else None,
        "currency": "INR"
    }


@app.get("/api/orders/history")
def get_order_history(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    orders = db.query(Order).filter(
        Order.user_id == current_user["id"],
        Order.status.in_(["delivered", "cancelled"])
    ).order_by(Order.created_at.desc()).all()
    
    response_data = []
    for o in orders:
        items_list = []
        for item in o.items:
            items_list.append({
                "menu_item_id": item.menu_item_id, # <--- WE NEED THIS FOR REORDER
                "name": item.name,
                "qty": getattr(item, "quantity", 1)
            })
            
        response_data.append({
            "id": o.id,
            "status": o.status,
            "total_amount": o.total_amount,
            "restaurant_id": o.restaurant_id, # <--- WE NEED THIS TO REDIRECT
            "restaurant_name": o.restaurant.name if o.restaurant else "Unknown Restaurant",
            "items": items_list,
            "created_at": o.created_at.isoformat() if o.created_at else None
        })
        
    return response_data


# --- UPDATE VERIFICATION (Activate Order & Clear Cart) ---
@app.post("/api/payments/verify")
def verify_payment(data: PaymentVerification, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        # 1. Verify Signature
        razorpay_client.utility.verify_payment_signature({
            'razorpay_order_id': data.razorpay_order_id,
            'razorpay_payment_id': data.razorpay_payment_id,
            'razorpay_signature': data.razorpay_signature
        })

        order = db.query(Order).filter(
            Order.user_id == current_user["id"],
            Order.status == "payment_pending"
        ).order_by(Order.created_at.desc()).first()

        if not order:
            raise HTTPException(404, "Order not found or already processed")

        # 3. ACTIVATE ORDER
        order.status = "pending" # Now it becomes visible to Restaurant/Rider
        order.payment_status = "paid"
        
        # 4. CLEAR CART (Only now!)
        db.query(Cart).filter(Cart.user_id == current_user["id"]).delete()
        
        db.commit()
        return {"status": "success", "message": "Payment verified and Order Placed"}

    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Payment Verification Failed")

@app.get("/api/orders/track")
def track_active_order(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(
        Order.user_id == current_user["id"],
        Order.status.notin_(["delivered", "cancelled"])
    ).order_by(Order.created_at.desc()).first()

    if not order:
        return {"active": False}

    rider_info = None

    if order.rider_id:
        rider = db.query(Rider).filter(Rider.user_id == order.rider_id).first()
        rider_user = db.query(User).filter(User.id == order.rider_id).first()

        if rider and rider_user:
            rider_info = {
                "name": rider_user.full_name,
                "phone": rider_user.phone,
                "vehicle_type": rider.vehicle_type,
                "rating": 4.5,  # Temporary static rating (can improve later)
                "latitude": rider.current_latitude,
                "longitude": rider.current_longitude
            }

    return {
        "active": True,
        "id": order.id,
        "status": order.status,
        "total": order.total_amount,
        "restaurant_name": order.restaurant.name if order.restaurant else "Restaurant",
        # 👇 ADD THESE TWO LINES 👇
        "restaurant_address": order.restaurant.address if order.restaurant else "Rajkot, Gujarat",
        "delivery_address": order.delivery_address,
        
        "rider_location": {
            "lat": rider.current_latitude if order.rider_id and rider else None,
            "lng": rider.current_longitude if order.rider_id and rider else None
        },
        "items": [{"name": i.name, "qty": i.quantity} for i in order.items],
        "rider_info": rider_info
    }


# --- CUSTOMER ORDER HISTORY ---
@app.get("/api/orders/customer/{user_id}")
def get_customer_orders(user_id: int, db: Session = Depends(get_db)):
    orders = db.query(Order).filter(
        Order.user_id == user_id,
        Order.status.notin_(["delivered", "cancelled"])
    ).order_by(Order.created_at.desc()).all()
    
    response_data = []
    for o in orders:
        response_data.append({
            "_id": o.id,
            "id": o.id,
            "status": o.status,
            "total": o.total_amount,
            "restaurant_name": o.restaurant.name if o.restaurant else "Unknown Restaurant",
            "location": { "lat": 22.3039, "lng": 70.8022 }
        })
    return response_data

# --- RESTAURANT ORDERS (With Full Details & Add-ons) ---
@app.get("/api/restaurant/orders")
def get_restaurant_orders(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user["role"] != "restaurant": 
        raise HTTPException(status_code=403, detail="Access denied")
    
    orders = db.query(Order).filter(
        Order.restaurant_id == current_user["restaurant_id"]
    ).order_by(Order.created_at.desc()).all()

    response_data = []
    for o in orders:
        items_list = []
        for item in o.items:
            # 1. Safely parse whatever is saved (could be IDs like [1, 2] or Text)
            raw_addons = []
            final_addon_names = [] # <--- We will put the actual TEXT here
            
            if item.addons and item.addons.strip() not in ["", "[]", "null"]:
                try:
                    raw_addons = json.loads(item.addons)
                    if not isinstance(raw_addons, list):
                        raw_addons = [raw_addons]
                except Exception:
                    # Fallback just in case it was saved as raw text instead of JSON
                    raw_addons = [item.addons] 

            # 2. TRANSLATE IDs to REAL NAMES
            if raw_addons:
                # Fetch the original menu item to see what the IDs mean
                menu_item = db.query(MenuItem).filter(MenuItem.id == item.menu_item_id).first()
                available_addons = []
                
                if menu_item and menu_item.addons:
                    try:
                        available_addons = json.loads(menu_item.addons)
                    except Exception:
                        pass
                
                for addon_val in raw_addons:
                    # If it is a number (ID), translate it!
                    if str(addon_val).isdigit():
                        found_name = str(addon_val) # Fallback to number if we can't find it
                        for avail in available_addons:
                            if str(avail.get("id")) == str(addon_val):
                                found_name = avail.get("name")
                                break
                        final_addon_names.append(found_name)
                    else:
                        # If it is ALREADY text (e.g. "Extra Cheese"), just keep it
                        final_addon_names.append(str(addon_val))

            items_list.append({
                "name": item.name, 
                "quantity": item.quantity, 
                "addons": final_addon_names # <--- Now sending NAMES to the frontend!
            })

        response_data.append({
            "id": o.id,
            "status": o.status,
            "total_amount": o.total_amount,
            "created_at": o.created_at,
            "rider_name": o.rider_name,
            "customer_name": o.user.full_name if o.user else "Guest Customer",
            "delivery_address": o.delivery_address, 
            "items": items_list
        })
    return response_data

@app.put("/api/orders/{order_id}/status")
def update_order_status(order_id: int, status: str, db: Session = Depends(get_db)):
    # 1. Fetch the order
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # 2. Trigger earnings update ONLY when transitioning to "delivered"
    if status == "delivered" and order.status != "delivered":
        
        # --- Update Restaurant Earnings ---
        if order.restaurant_id:
            restaurant = db.query(Restaurant).filter(Restaurant.id == order.restaurant_id).first()
            if restaurant:
                # Add food cost to restaurant
                restaurant.total_earnings = (restaurant.total_earnings or 0.0) + order.total_amount
        
        # --- Update Rider Earnings ---
        if order.rider_id:
            # Assuming order.rider_id links to User.id. If it links to Rider.id, change to: filter(Rider.id == order.rider_id)
            rider = db.query(Rider).filter(Rider.user_id == order.rider_id).first()
            if rider:
                # Add delivery fee to rider and increment trips
                rider.total_earnings = (rider.total_earnings or 0.0) + order.delivery_fee
                rider.total_trips = (rider.total_trips or 0) + 1

    # 3. Save everything to the database
    order.status = status
    db.commit()
    
    return {"message": "Order delivered!", "status": status}

@app.post("/api/orders/{order_id}/cancel")
def cancel_order(order_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == current_user["id"]).first()
    if not order: raise HTTPException(404, "Order not found")
    if order.status != "pending": raise HTTPException(400, "Cannot cancel order")
    order.status = "cancelled"
    db.commit()
    return {"message": "Order cancelled successfully"}


@app.get("/api/rider/stats")
def get_rider_stats(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # 1. Fetch User Data
    user = db.query(User).filter(User.id == current_user["id"]).first()
    
    rider = db.query(Rider).filter(Rider.user_id == current_user["id"]).first()
    
    # 2. Auto-create Rider Profile if missing
    if not rider:
        rider = Rider(
            user_id=user.id,
            is_active=True,
            is_available=False, 
            total_earnings=0.0,
            total_trips=0
        )
        db.add(rider)
        db.commit()
        db.refresh(rider)

    # 3. Check for active orders
    active_order = db.query(Order).filter(
        Order.rider_id == current_user["id"], 
        Order.status.in_(["accepted", "ready", "out_for_delivery"])
    ).order_by(Order.created_at.desc()).first()

    # 4. Format Active Order
    active_order_data = None
    if active_order:
        active_order_data = {
            "id": active_order.id,
            "status": active_order.status,
            "total": active_order.total_amount,
            "restaurant_name": active_order.restaurant.name if active_order.restaurant else "Unknown",
            "restaurant_address": active_order.restaurant.address if active_order.restaurant else "",
            "delivery_address": active_order.delivery_address,
            # 👇 ADD THIS ONE LINE TO SEND ITEMS TO THE RIDER 👇
            "items": [{"name": i.name, "qty": i.quantity} for i in active_order.items] 
        }

    # --- NEW: Calculate Average Rating ---
    avg_rating = 0.0
    if rider.rating_count and rider.rating_count > 0:
        avg_rating = rider.total_rating / rider.rating_count

    # 5. Return Data (Added rating)
    return {
        "username": user.username,       
        "name": user.full_name,          
        "email": user.email,             
        "phone": user.phone,             
        "is_online": rider.is_available,
        "total_earnings": round(rider.total_earnings or 0.0, 2),
        "total_trips": rider.total_trips or 0,
        "rating": round(avg_rating, 1),  # <--- NEW: Sends the rating!
        "active_order": active_order_data,
        "message": rider.message 
    }

@app.put("/api/rider/profile")
def update_rider_profile(data: RiderProfileUpdate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # 1. FETCH USER
    user = db.query(User).filter(User.id == current_user["id"]).first()
    if not user: 
        raise HTTPException(status_code=404, detail="User not found")
    
    # 2. VALIDATE USERNAME (New Logic)
    # If the username is changing, check if the new one is already taken by someone else
    if data.username != user.username:
        existing_username = db.query(User).filter(User.username == data.username, User.id != user.id).first()
        if existing_username:
            raise HTTPException(status_code=400, detail="Username already taken")

    # 3. VALIDATE EMAIL
    if data.email != user.email:
        existing_email = db.query(User).filter(User.email == data.email, User.id != user.id).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already in use")

    # 4. UPDATE USER TABLE
    user.username = data.username  # <--- Update Username here
    user.full_name = data.full_name
    user.email = data.email
    if data.phone:
        user.phone = data.phone

    # 5. UPDATE RIDER TABLE (Syncing data if columns exist)
    rider = db.query(Rider).filter(Rider.user_id == user.id).first()
    if rider:
        # These checks prevent crashes if your Rider table doesn't have these specific columns
        if hasattr(rider, 'full_name'): 
            rider.full_name = data.full_name
        if hasattr(rider, 'phone'): 
            rider.phone = data.phone
        if hasattr(rider, 'email'): 
            rider.email = data.email

    db.commit()
    
    return {
        "message": "Profile updated successfully", 
        "username": user.username,   # <--- Return new username to Frontend
        "name": user.full_name, 
        "email": user.email,
        "phone": user.phone
    }

@app.post("/api/rider/status")
def toggle_rider_status(status_data: dict, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    rider = db.query(Rider).filter(Rider.user_id == current_user["id"]).first()
    if not rider: raise HTTPException(404, "Rider profile not found")
    rider.is_available = status_data.get("is_online", False)
    db.commit()
    return {"is_online": rider.is_available}

# In your main.py, find the get_available_orders function and update the filter:

@app.get("/api/rider/orders/available")
def get_available_orders(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    rider = db.query(Rider).filter(Rider.user_id == current_user["id"]).first()
    
    if not rider or not rider.is_available: 
        return []
    
    # Check if rider is currently busy
    busy = db.query(Order).filter(
        Order.rider_id == current_user["id"], 
        Order.status.in_(["accepted", "ready", "out_for_delivery"])
    ).first()
    
    if busy: 
        return []

    # --- UPDATED FILTER ---
    # We now include "accepted" so riders see orders as soon as the restaurant hits Accept
    orders = db.query(Order).filter(
        Order.status.in_(["accepted", "preparing", "ready"]), 
        Order.rider_id == None
    ).all()

    return [{
        "id": o.id,
        "total": o.total_amount,
        "status": o.status,
        "restaurant_name": o.restaurant.name if o.restaurant else "Unknown",
        "restaurant_address": o.restaurant.address if o.restaurant else "Location",
        "delivery_address": o.delivery_address,
        "created_at": o.created_at
    } for o in orders]


@app.post("/api/rider/orders/{order_id}/accept")
def accept_order(order_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()

    if not order: raise HTTPException(404, "Order not found")
    if order.rider_id: raise HTTPException(400, "Order already taken")

    # --- THE FIX ---
    # Fetch the actual user from the DB to get their real full_name
    rider_user = db.query(User).filter(User.id == current_user["id"]).first()
    
    # Fallback to "Rider" just in case the name is empty
    actual_rider_name = rider_user.full_name if rider_user and rider_user.full_name else "Rider"

    order.rider_id = current_user["id"] 
    order.rider_name = actual_rider_name # Save the actual fetched name
    order.status = "accepted"
    
    db.commit()
    return {"message": "Order Accepted"}
    
@app.post("/api/rider/orders/{order_id}/pickup")
def pickup_order(order_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id, Order.rider_id == current_user["id"]).first()
    if not order: raise HTTPException(404, "Order not found")
    order.status = "out_for_delivery"
    db.commit()
    return {"message": "Order Picked Up"}

@app.post("/api/rider/orders/{order_id}/complete")
def complete_order(order_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    rider = db.query(Rider).filter(Rider.user_id == current_user["id"]).first()
    order = db.query(Order).filter(Order.id == order_id, Order.rider_id == current_user["id"]).first()
    
    if not order: raise HTTPException(404, "Order not found")
    if order.status == "delivered": return {"message": "Already delivered"}

    order.status = "delivered"
    order.payment_status = "paid"

    # --- 1. RIDER EARNINGS (10%) ---
    commission = order.total_amount * 0.10
    rider.total_earnings = (rider.total_earnings or 0) + commission
    rider.total_trips = (rider.total_trips or 0) + 1

    # --- 2. RESTAURANT EARNINGS (NEW FIX) ---
    if order.restaurant_id:
        restaurant = db.query(Restaurant).filter(Restaurant.id == order.restaurant_id).first()
        if restaurant:
            # Add the food total to the restaurant's running total
            restaurant.total_earnings = (restaurant.total_earnings or 0.0) + order.total_amount

    db.commit()
    return { "message": "Order Completed", "earned": commission, "total_earnings": rider.total_earnings }


# ==============================================================================
#  EXISTING ROUTES (Favorites, Cart, Profile, etc.)
# ==============================================================================

@app.get("/api/favorites/list") 
def get_favorites_list(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    fav_items = db.query(MenuItem).join(Favorite, Favorite.menu_item_id == MenuItem.id).filter(Favorite.user_id == current_user["id"]).all()
    return format_items(fav_items)

@app.get("/api/favorites")
def get_user_favorites(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    favs = db.query(Favorite.menu_item_id).filter(Favorite.user_id == current_user["id"]).all()
    return [f[0] for f in favs]

@app.post("/api/favorites/{item_id}")
def toggle_favorite(item_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user["id"]
    existing_fav = db.query(Favorite).filter(Favorite.user_id == user_id, Favorite.menu_item_id == item_id).first()
    if existing_fav:
        db.delete(existing_fav)
        db.commit()
        return {"status": "removed", "item_id": item_id}
    else:
        new_fav = Favorite(user_id=user_id, menu_item_id=item_id)
        db.add(new_fav)
        db.commit()
        return {"status": "added", "item_id": item_id}

@app.get("/api/cart")
def get_user_cart(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    cart_items = db.query(Cart).filter(Cart.user_id == current_user["id"]).all()
    
    result = []
    for item in cart_items:
        if not item.menu_item: continue
        
        # Safely parse addons back into a list for the frontend
        parsed_addons = []
        if item.addons and item.addons not in ["", "[]", "null"]:
            try:
                parsed_addons = json.loads(item.addons)
            except Exception:
                parsed_addons = [item.addons]

        result.append({
            "id": item.menu_item.id, 
            "name": item.menu_item.name,
            "price": item.price if item.price > 0 else item.menu_item.price,
            "discount_price": item.menu_item.discount_price, 
            "image": item.menu_item.image,
            "description": item.menu_item.description, 
            "quantity": item.quantity,
            "cart_id": item.id, 
            "addons": parsed_addons 
        })
    return result

@app.post("/api/cart")
def update_cart_item(data: CartAdd, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user["id"]
    
    # Calculate exact unit price (Base Price + Addons Price)
    unit_price = 0
    if data.total_price and data.quantity > 0: 
        unit_price = data.total_price / data.quantity

    # 1. Fetch the menu item to map Addon IDs to Addon Names
    menu_item = db.query(MenuItem).filter(MenuItem.id == data.menu_item_id).first()
    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    addon_names = []
    if data.customization and data.customization != "[]":
        try:
            selected_ids = json.loads(data.customization) # What React sends: [1, 2]
            
            # Match IDs with the actual Menu Item's addon list
            if menu_item.addons:
                available_addons = json.loads(menu_item.addons)
                for s_id in selected_ids:
                    for avail in available_addons:
                        # Compare as strings to prevent int/str type mismatches
                        if str(avail.get("id")) == str(s_id):
                            addon_names.append(avail.get("name"))
        except Exception as e:
            print(f"Addon parsing error: {e}")
            # Fallback if it's not a JSON array
            addon_names = json.loads(data.customization) if "[" in data.customization else [data.customization]
    
    # Save as string array: '["Extra Cheese", "Spicy"]'
    final_customization_str = json.dumps(addon_names) if addon_names else "[]"

    # 2. Check if item with EXACT SAME ADDONS is already in cart
    cart_item = db.query(Cart).filter(
        Cart.user_id == user_id, 
        Cart.menu_item_id == data.menu_item_id,
        Cart.addons == final_customization_str 
    ).first()

    if cart_item:
        new_qty = cart_item.quantity + data.quantity
        if new_qty > 0:
            cart_item.quantity = new_qty
            if unit_price > 0: cart_item.price = unit_price
        else: 
            db.delete(cart_item)
    elif data.quantity > 0:
        new_item = Cart(
            user_id=user_id, 
            menu_item_id=data.menu_item_id, 
            quantity=data.quantity, 
            price=unit_price, 
            addons=final_customization_str 
        )
        db.add(new_item)
        
    db.commit()
    return {"message": "Cart updated"}
def format_items(items):
    return [{
        "id": item.id, 
        "name": item.name, 
        "category": item.category,
        "description": item.description, 
        "price": item.price,
        "discountPrice": item.discount_price, 
        "type": "veg" if item.is_veg else "non-veg",
        "is_veg": item.is_veg, 
        "isAvailable": item.is_available, 
        "image": item.image,
        "addons": item.addons
    } for item in items]

@app.post("/api/restaurant-request")
def submit_restaurant_request(request: RestaurantRequestCreate, db: Session = Depends(get_db)):
    if db.query(RestaurantRequest).filter(RestaurantRequest.email == request.email).first(): raise HTTPException(status_code=400, detail="Application with this email already exists.")
    if db.query(Restaurant).filter(Restaurant.email == request.email).first(): raise HTTPException(status_code=400, detail="Restaurant is already active.")
    new_request = RestaurantRequest(restaurant_name=request.restaurantName, owner_name=request.ownerName, email=request.email, phone=request.phone, address=request.address, status="pending")
    db.add(new_request)
    db.commit()
    return {"message": "Application submitted successfully!", "id": new_request.id}

@app.get("/restaurants")
def get_all_restaurants(db: Session = Depends(get_db)):
    restaurants = db.query(Restaurant).filter(Restaurant.is_active == True).all()
    response_data = []
    for r in restaurants:
        cats = db.query(MenuItem.category).filter(MenuItem.restaurant_id == r.id).distinct().limit(2).all()
        cuisine_str = " • ".join([c[0] for c in cats if c[0]]) if cats else "Multi-Cuisine" 
        response_data.append({
            "id": r.id, 
            "name": r.name, 
            "address": r.address, 
            "rating": "4.5",
            "is_active": r.is_active, 
            "profile_image": r.profile_image, 
            "cuisine": cuisine_str,
            "total_earnings": getattr(r, "total_earnings", 0.0),
            "average_rating": getattr(r, "average_rating", 0.0),
            "rating_count": getattr(r, "rating_count", 0)
        })
    return response_data

@app.get("/api/restaurant/image/{restaurant_id}")
def get_restaurant_image(restaurant_id: int, db: Session = Depends(get_db)):
    res = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not res or not res.profile_image:
        return Response(status_code=404)
    
    img_str = str(res.profile_image).strip()
    if img_str.startswith("http://") or img_str.startswith("https://"):
        return RedirectResponse(url=img_str, status_code=307)

    try:
        media_type = "image/jpeg"
        if img_str.startswith("data:"):
            header, img_str = img_str.split(",", 1)
            if "image/png" in header:
                media_type = "image/png"
            elif "image/webp" in header:
                media_type = "image/webp"
        elif "base64," in img_str:
            _, img_str = img_str.split("base64,", 1)

        return Response(
            content=base64.b64decode(img_str),
            media_type=media_type,
            headers={"Cache-Control": "public, max-age=31536000"}
        )
    except Exception as e:
        print(f"[Restaurant Image Error for id {restaurant_id}]: {e}")
        return Response(status_code=404)

@app.get("/restaurants/{restaurant_id}")
def get_restaurant_detail(restaurant_id: int, db: Session = Depends(get_db)):
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant: raise HTTPException(status_code=404, detail="Restaurant not found")
    return restaurant

@app.get("/users/{user_id}")
def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    profile_image = user.profile_image
    if user.role == "restaurant":
        res_data = db.query(Restaurant).filter(Restaurant.email == user.email).first()
        if res_data: profile_image = res_data.profile_image
    return {"id": user.id, "username": user.username, "full_name": user.full_name, "email": user.email, "phone": user.phone, "role": user.role, "profile_image": profile_image}

@app.put("/users/{user_id}")
def update_user_profile(user_id: int, data: UserProfileUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    if data.username: user.username = data.username
    if data.full_name: user.full_name = data.full_name
    if data.email: user.email = data.email
    if data.phone: user.phone = data.phone
    if data.profile_image: user.profile_image = data.profile_image
    if data.password: user.hashed_password = hash_password(data.password)
    db.commit()
    return {"message": "Profile updated successfully"}

# --- THIS IS THE NEW DELETE ENDPOINT FOR THE ADMIN PANEL ---
@app.delete("/admin/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    # 1. Fetch User
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 2. If User is a RIDER, delete their rider profile first (Foreign Key Constraint)
    rider = db.query(Rider).filter(Rider.user_id == user_id).first()
    if rider:
        db.delete(rider)

    # 3. If User is a RESTAURANT, delete their restaurant profile
    if user.role == "restaurant":
        restaurant = db.query(Restaurant).filter(Restaurant.email == user.email).first()
        if restaurant:
            db.delete(restaurant)

    # 4. Finally, Delete the User
    db.delete(user)
    db.commit()
    
    return {"message": "User and related profiles deleted successfully"}

@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == user.username).first(): raise HTTPException(400, "Username taken")
    if db.query(User).filter(User.email == user.email).first(): raise HTTPException(400, "Email registered")
    new_user = User(username=user.username, full_name=user.full_name, email=user.email, phone=user.phone, hashed_password=hash_password(user.password), role=user.role if user.role else "customer")
    db.add(new_user)
    db.commit()
    return {"message": "Registration successful"}

@app.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).options(defer(User.profile_image)).first()
    if not user or not verify_password(form_data.password, user.hashed_password): raise HTTPException(401, "Invalid credentials")
    restaurant_id = None
    if user.role == "restaurant":
        res = db.query(Restaurant).filter(Restaurant.email == user.email).first()
        if res: restaurant_id = res.id
    token = jwt.encode({"sub": user.username, "id": user.id, "role": user.role, "restaurant_id": restaurant_id, "exp": datetime.now(timezone.utc) + timedelta(hours=2)}, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer", "role": user.role, "username": user.username, "user_id": user.id, "restaurant_id": restaurant_id}

@app.get("/api/restaurant/me")
def get_my_profile(res: Restaurant = Depends(get_current_restaurant), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == res.email).first()
    return {
        "id": res.id, 
        "name": res.name, 
        "email": res.email, 
        "address": res.address, 
        "is_active": res.is_active, 
        "profile_image": res.profile_image, 
        "username": user.username if user else None,
        
        # 👇 ADD THESE TWO LINES 👇
        "average_rating": res.average_rating,
        "rating_count": res.rating_count
    }

class GoogleAuthRequest(BaseModel):
    token: str

@app.post("/auth/google")
async def google_login(auth_data: GoogleAuthRequest, db: Session = Depends(get_db)):
    # 1. Verify the token by calling Google's API
    google_user_info_url = "https://www.googleapis.com/oauth2/v3/userinfo"
    headers = {"Authorization": f"Bearer {auth_data.token}"}

    async with httpx.AsyncClient() as client:
        response = await client.get(google_user_info_url, headers=headers)
        
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="Invalid Google Token")

    # 2. Get User Data from Google
    google_data = response.json()
    email = google_data.get("email")
    
    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")

    # 3. Check if User Exists in your Database
    user = db.query(User).filter(User.email == email).first()

    if not user:
        # --- SCENARIO A: NEW USER (REGISTER THEM) ---
        # Basic username generation (you might want to make this more robust later)
        base_username = email.split("@")[0]
        
        # Check if username exists, if so, append random numbers or handle it
        # For now, we assume it's unique or let the DB throw an error
        
        new_user = User(
            username=base_username, 
            email=email,
            full_name=google_data.get("name", "Unknown"),
            role="customer", 
            hashed_password=hash_password("GOOGLE_LOGIN_NO_PASSWORD"), # Use your hash_password helper
            phone="" # Optional: Empty phone for now
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        user = new_user
    
    # --- SCENARIO B: EXISTING USER (LOG THEM IN) ---
    
    # 4. Create your App's JWT Token
    # FIX: We use jwt.encode directly here, just like in your /login endpoint
    access_token_expires = datetime.now(timezone.utc) + timedelta(hours=2)
    
    access_token = jwt.encode({
        "sub": user.username, 
        "id": user.id, 
        "role": user.role,
        "restaurant_id": None, # Google users are usually customers
        "exp": access_token_expires
    }, SECRET_KEY, algorithm=ALGORITHM)

    # 5. Return the Token Response
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.username,
        "role": user.role,
        "restaurant_id": None
    }


# --- FORGOT PASSWORD UTILS ---
fake_otp_db = {}  # Temporary storage for OTPs

def send_otp_email_smtp(to_email: str, otp: str):
    sender_email = os.getenv("MAIL_USERNAME")
    sender_password = os.getenv("MAIL_PASSWORD")

    if not sender_email or not sender_password:
        print("⚠️ Skipped Email: Missing Credentials in .env")
        return

    subject = "Crave Password Reset 🔐"
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #ea580c;">Password Reset Request</h2>
        <p>You requested to reset your password.</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; width: fit-content;">
            <p style="font-size: 18px; font-weight: bold; margin: 0;">Your OTP Code: <span style="color: #ea580c;">{otp}</span></p>
        </div>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
    </body>
    </html>
    """

    msg = MIMEMultipart()
    msg["From"] = f"Crave Support <{sender_email}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "html"))

    try:
        # Connect to Gmail SMTP
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, to_email, msg.as_string())
        server.quit()
        print(f"✅ OTP Email sent to {to_email}")
    except Exception as e:
        print(f"❌ Email Failed: {e}")
    
# ==============================================================================
#  FORGOT PASSWORD ROUTES
# ==============================================================================

@app.post("/auth/forgot-password")
def forgot_password(
    request: ForgotPasswordRequest, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    # 1. Check if user exists
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Email not found")

    # 2. Generate 6-digit OTP
    otp = "".join(random.choices(string.digits, k=6))
    
    # 3. Save OTP to Mock DB (Expires in 10 mins)
    fake_otp_db[request.email] = {
        "otp": otp,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=10)
    }

    # 4. Send Email using Background Task (Non-blocking)
    background_tasks.add_task(send_otp_email_smtp, request.email, otp)

    return {"message": "OTP sent to your email"}


@app.post("/auth/reset-password")
def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    email = request.email
    input_otp = request.otp
    new_password = request.new_password

    # 1. Retrieve OTP Record
    record = fake_otp_db.get(email)

    # 2. Validate OTP
    if not record:
        raise HTTPException(status_code=400, detail="No reset request found.")
    
    if record["otp"] != input_otp:
        raise HTTPException(status_code=400, detail="Invalid OTP code.")
    
    if datetime.now(timezone.utc) > record["expires"]:
        del fake_otp_db[email]
        raise HTTPException(status_code=400, detail="OTP code has expired.")

    # 3. Hash the new password
    hashed_pwd = hash_password(new_password)

    # 4. Update User Table
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.hashed_password = hashed_pwd

    # 5. Update Restaurant Table (if exists) to keep passwords in sync
    restaurant = db.query(Restaurant).filter(Restaurant.email == email).first()
    if restaurant:
        restaurant.password = hashed_pwd

    db.commit()

    # 6. Clean up OTP
    del fake_otp_db[email]

    return {"message": "Password reset successfully"}



class AdminReplyRequest(BaseModel):
    reply_message: str

# --- 1. USER SUBMITS FORM (Updated) ---
@app.post("/api/contact")
def submit_contact(
    data: ContactSchema, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    # Save to DB
    new_entry = ContactInquiry(
        name=data.name, 
        email=data.email, 
        message=data.message,
        status="pending" # Default status
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)

    # Send "We received your message" email immediately
    background_tasks.add_task(send_auto_acknowledgment, data.email, data.name)

    return {"message": "Message received. Check your email!"}


# --- 2. ADMIN GETS ALL MESSAGES ---
@app.get("/api/admin/messages")
def get_all_inquiries(db: Session = Depends(get_db)):
    try:
        # Fetch messages sorted by newest first
        messages = db.query(ContactInquiry).order_by(ContactInquiry.created_at.desc()).all()
        return messages
    except Exception as e:
        print(f"❌ Error fetching messages: {e}")
        # This will show the actual error in your browser console instead of just "500"
        raise HTTPException(status_code=500, detail=str(e))

# --- 3. ADMIN REPLIES TO MESSAGE ---
@app.post("/api/admin/reply/{inquiry_id}")
def reply_to_inquiry(
    inquiry_id: int, 
    reply_data: AdminReplyRequest, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    # Find the message
    inquiry = db.query(ContactInquiry).filter(ContactInquiry.id == inquiry_id).first()
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")

    # Update DB
    inquiry.admin_reply = reply_data.reply_message
    inquiry.status = "replied"
    inquiry.replied_at = datetime.utcnow()
    db.commit()

    # Send the actual reply email
    background_tasks.add_task(
        send_admin_reply_email, 
        inquiry.email, 
        inquiry.name, 
        inquiry.message, 
        reply_data.reply_message
    )

    return {"message": "Reply sent successfully"}

@app.put("/api/restaurant/update")
async def update_restaurant_profile(bg_tasks: BackgroundTasks, name: str = Form(...), email: str = Form(...), address: str = Form(...), username: str = Form(...), password: Optional[str] = Form(None), profile_image: Optional[UploadFile] = File(None), db: Session = Depends(get_db), res: Restaurant = Depends(get_current_restaurant)):
    user = db.query(User).filter(User.email == res.email).first()
    res.name, res.email, res.address = name, email, address
    if user: user.email, user.full_name, user.username = email, name, username 
    if password and password.strip():
        hashed = hash_password(password)
        if user: user.hashed_password = hashed
        res.password = hashed
    if profile_image:
        image_url = upload_image_to_cloudinary(profile_image, folder="crave_profiles")
        if image_url:
            res.profile_image = image_url
            if user: user.profile_image = image_url
    db.commit()
    bg_tasks.add_task(send_update_email, email, name, username, address, password, res.profile_image)
    return {"message": "Profile updated", "profile_image": res.profile_image}

@app.post("/api/rider-request")
def submit_rider_request(request: RiderRequestCreate, db: Session = Depends(get_db)):
    new_request = RiderRequest(full_name=request.fullName, email=request.email, phone=request.phone, city=request.city, vehicle_type=request.vehicleType, status="pending")
    db.add(new_request)
    db.commit()
    return {"message": "Rider Application Received!"}

# ==============================================================================
#  ADMIN FETCH REQUESTS ROUTES
# ==============================================================================

@app.get("/api/admin/requests")
def get_pending_restaurant_requests(db: Session = Depends(get_db)):
    # Fetch all restaurant requests with a 'pending' status
    requests = db.query(RestaurantRequest).filter(RestaurantRequest.status == "pending").all()
    return requests

@app.get("/api/admin/rider-requests")
def get_pending_rider_requests(db: Session = Depends(get_db)):
    # Fetch all rider requests with a 'pending' status
    requests = db.query(RiderRequest).filter(RiderRequest.status == "pending").all()
    return requests



@app.delete("/api/admin/restaurants/{restaurant_id}")
def delete_restaurant(restaurant_id: int, db: Session = Depends(get_db)):
    try:
        # 1. Find the restaurant
        restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
        
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        # 2. CLEAR CART ITEMS referencing this restaurant's menu items
        menu_items = db.query(MenuItem).filter(MenuItem.restaurant_id == restaurant_id).all()
        menu_item_ids = [m.id for m in menu_items]
        if menu_item_ids:
            db.query(Cart).filter(Cart.menu_item_id.in_(menu_item_ids)).delete(synchronize_session=False)

        # 3. CLEAR FAVORITES
        db.query(Favorite).filter(Favorite.restaurant_id == restaurant_id).delete(synchronize_session=False)

        # 4. CLEAR MENU ITEMS
        db.query(MenuItem).filter(MenuItem.restaurant_id == restaurant_id).delete(synchronize_session=False)

        # 5. CLEAR RESTAURANT ORDERS & ORDER ITEMS
        orders = db.query(Order).filter(Order.restaurant_id == restaurant_id).all()
        order_ids = [o.id for o in orders]
        if order_ids:
            db.query(OrderItem).filter(OrderItem.order_id.in_(order_ids)).delete(synchronize_session=False)
            db.query(Order).filter(Order.id.in_(order_ids)).delete(synchronize_session=False)

        # 6. CLEAR RESTAURANT REQUESTS
        if restaurant.email:
            db.query(RestaurantRequest).filter(RestaurantRequest.email == restaurant.email).delete(synchronize_session=False)

        # 7. HANDLE THE USER
        user = db.query(User).filter(User.email == restaurant.email).first()
        if user:
            user.role = "customer"

        # 8. Delete the restaurant itself
        db.delete(restaurant)
        db.commit()
        
        return {"message": "Restaurant and associated data deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Deletion Error: {e}") 
        raise HTTPException(status_code=500, detail=str(e))

        
class AddressUpdate(BaseModel):
    address: str

@app.post("/api/update-address")
def update_user_address(
    data: AddressUpdate, 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user) # Changed type hint to dict
):
    try:
        # FIX: Use brackets [] to access the ID from the dictionary
        # Most JWT setups use 'id' or 'sub' as the key
        user_id = current_user.get("id") or current_user.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")

        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found in database")
        
        user.address = data.address
        db.commit()
        db.refresh(user) # Refresh the object with new data from DB
        
        return {"status": "success", "message": "Address updated", "address": user.address}
        
    except Exception as e:
        db.rollback()
        # Log the error for yourself in the terminal
        print(f"Error updating address: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
# Add this route to fetch the currently logged-in user's profile and address
@app.get("/api/users/me")
def get_current_user_profile(
    current_user: dict = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    # Safely get the ID from the token payload
    user_id = current_user.get("id") or current_user.get("sub")
    
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "address": user.address # This is the crucial field we need!
    }

@app.post("/api/orders/{order_id}/message-rider")
def message_rider(
    order_id: int,
    data: RiderMessage,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Verify the order exists
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user["id"]
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if not order.rider_id:
        raise HTTPException(status_code=400, detail="No rider assigned yet")

    # 2. Find the actual Rider in the riders table
    # Note: order.rider_id matches the Rider.user_id based on your schema
    rider = db.query(Rider).filter(Rider.user_id == order.rider_id).first()

    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    # 3. Save the message directly into the riders table!
    rider.message = data.message
    db.commit()

    return {"message": "Message successfully saved to the rider's profile!"}

@app.post("/api/orders/{order_id}/rate-rider")
def rate_rider(
    order_id: int,
    data: RiderRating,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Verify the order
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user["id"]
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != "delivered":
        raise HTTPException(status_code=400, detail="Order not delivered yet")

    if not order.rider_id:
        raise HTTPException(status_code=400, detail="No rider assigned")

    # 2. Prevent duplicate rating (Now that the column exists in SQL)
    # Use getattr just in case the model hasn't been updated perfectly yet
    if hasattr(order, 'rider_rating') and order.rider_rating:
        raise HTTPException(status_code=400, detail="You already rated this rider")

    # 3. Find the Rider
    rider = db.query(Rider).filter(Rider.user_id == order.rider_id).first()

    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")

    # 4. Update the Rider's Aggregates
    rider.total_rating = (rider.total_rating or 0) + data.rating
    rider.rating_count = (rider.rating_count or 0) + 1

    # 5. Mark the order as rated
    if hasattr(order, 'rider_rating'):
        order.rider_rating = data.rating

    db.commit()

    avg_rating = rider.total_rating / rider.rating_count

    return {
        "message": "Rating saved successfully!",
        "rating": data.rating,
        "average_rating": round(avg_rating, 2)
    }


class RatingRequest(BaseModel):
    rating: int

@app.post("/api/restaurants/{restaurant_id}/rate")
def rate_restaurant(
    restaurant_id: int, 
    rating_data: RatingRequest, 
    db: Session = Depends(get_db), 
    current_user = Depends(get_current_user) # Ensures they are logged in
):
    # 1. Find the restaurant
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
        
    # 2. Validate the rating (must be 1, 2, 3, 4, or 5)
    if rating_data.rating < 1 or rating_data.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
        
    # 3. Calculate the new average mathematically
    # (Current Average * Current Count) + New Rating / (Current Count + 1)
    current_total_score = restaurant.average_rating * restaurant.rating_count
    new_total_score = current_total_score + rating_data.rating
    
    restaurant.rating_count += 1
    restaurant.average_rating = round(new_total_score / restaurant.rating_count, 1)
    
    # 4. Save to database
    db.commit()
    db.refresh(restaurant)

    return {
        "success": True, 
        "message": "Rating submitted successfully!", 
        "new_average": restaurant.average_rating,
        "total_reviews": restaurant.rating_count
    }

@app.websocket("/api/ws/track/{order_id}")
async def track_order_ws(websocket: WebSocket, order_id: int):
    # Connect the customer to this specific order's "channel"
    await manager.connect(websocket, order_id)
    try:
        while True:
            # Keep the connection open. We just wait here. 
            # If the customer's internet drops, it triggers the exception below.
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, order_id)


# --- 2. THE RIDER LOCATION UPDATE ROUTE ---
class LocationUpdate(BaseModel):
    lat: float
    lng: float

@app.post("/api/orders/{order_id}/location")
async def update_rider_location(order_id: int, location: LocationUpdate):
    # 1. (Optional) Save this to your database if you want a historical route
    # db_order.current_lat = location.lat
    # db.commit()

    # 2. Instantly beam the new coordinates to the customer!
    await manager.broadcast_to_order(order_id, {"lat": location.lat, "lng": location.lng})
    
    return {"status": "success", "message": "Location broadcasted"}
    





# --- 1. THE SAFE DATA EXTRACTOR (With IDs for Links) ---
def get_safe_database_context(db: Session):
    """
    Pulls live data and includes IDs so the AI can generate clickable links.
    STRICTLY excludes sensitive user/owner data.
    """
    restaurants = db.query(Restaurant).filter(Restaurant.is_active == True).all()
    
    safe_data = []
    for res in restaurants:
        menu_items = db.query(MenuItem).filter(
            MenuItem.restaurant_id == res.id,
            MenuItem.is_available == True
        ).all()
        
        # We include the ID here so the AI knows where to link the user
        items_list = [
            f"{m.name} (ID:{m.id}, Price:₹{m.price}, {'Veg' if m.is_veg else 'Non-Veg'})" 
            for m in menu_items
        ]
        
        items_str = ", ".join(items_list)
        
        safe_data.append(
            f"RESTAURANT: '{res.name}' (Address: {res.address}). "
            f"MENU: [{items_str if items_str else 'No items available right now'}]"
        )
        
    total_riders = db.query(Rider).filter(Rider.is_active == True).count()
    
    full_safe_text = "\n".join(safe_data)
    full_safe_text += f"\nPlatform Stats: {total_riders} riders are currently active."
    
    return full_safe_text


# --- 2. REQUEST MODEL ---
class ChatRequest(BaseModel):
    message: str
    user_id: Optional[int] = None


# --- 3. THE FINAL CHAT ENDPOINT ---
@app.post("/api/chat")
def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    try:
        msg = request.message.lower()
        # Define keywords for tracking logic
        msg_words = set(re.findall(r'\b\w+\b', msg))

        # --- STEP A: SMART ORDER TRACKING (Database Query) ---
        if (
            "track" in msg_words or 
            "active" in msg_words or 
            "status" in msg_words or
            ("my" in msg_words and "order" in msg_words) or 
            ("where" in msg_words and "order" in msg_words)
        ):
            if request.user_id:
                active_order = db.query(Order).filter(
                    Order.user_id == request.user_id,
                    Order.status.notin_(["delivered", "cancelled"])
                ).order_by(Order.created_at.desc()).first()

                if active_order:
                    res_name = active_order.restaurant.name if active_order.restaurant else "the restaurant"
                    status_map = {
                        "pending": "is awaiting restaurant acceptance.",
                        "accepted": "is currently being prepared!",
                        "ready": "is ready and waiting for a rider.",
                        "out_for_delivery": "is on the way with your rider! 🛵"
                    }
                    friendly_status = status_map.get(active_order.status, f"is currently: {active_order.status}")
                    return {"reply": f"I found your active order from {res_name}! It {friendly_status}"}
                else:
                    return {"reply": "You don't have any active orders right now. Want to explore the menu?"}
            else:
                return {"reply": "Please log in so I can check your active orders!"}

        # --- STEP B: SAFE AI CHAT (With Link Generation) ---
        safe_context = get_safe_database_context(db)

        # Instructions telling the AI to use Markdown links for your React routes
        live_prompt = f"""
            You are the CRAVE assistant. 

            DATABASE STATE:
            {safe_context}

            INSTRUCTIONS:
            1. Be friendly and concise.
            2. If a user asks for food, list the items and their prices.
            3. For EVERY food item you mention, you MUST append this exact button trigger: [Add ItemName ID:ItemID]
            4. DO NOT use standard markdown links or parentheses. 
            5. Example: "Devi offers Dosa for ₹97. [Add Dosa ID:1] and Pizza for ₹243. [Add Pizza ID:3]"
            """
        
        # Send context + instructions to Gemini
        response = chat_session.send_message(live_prompt)
        
        return {"reply": response.text}
        
    except Exception as e:
        print(f"Chat Error: {e}")
        return {"reply": "I'm having a little trouble connecting to the database. Please try again in a second!"}



# --- ADD THIS TO main.py ---

class CartRequest(BaseModel):
    user_id: int
    menu_item_id: int
    quantity: int

@app.post("/api/cart/add") # 👈 This must match the React fetch URL exactly!
def add_to_cart(request: CartRequest, db: Session = Depends(get_db)):
    # 1. Check if item already exists in user's cart
    existing_item = db.query(Cart).filter(
        Cart.user_id == request.user_id, 
        Cart.menu_item_id == request.menu_item_id
    ).first()

    if existing_item:
        existing_item.quantity += request.quantity
    else:
        # 2. Add new item
        new_cart_item = Cart(
            user_id=request.user_id,
            menu_item_id=request.menu_item_id,
            quantity=request.quantity
        )
        db.add(new_cart_item)
    
    db.commit()
    return {"status": "success", "message": "Item added to cart"}

@app.get("/users/{user_id}/recommendations", response_model=list[MenuItemResponse])
def get_user_recommendations(user_id: int, db: Session = Depends(get_db)):
    # 1. Recommendations ONLY show after at least one order is completed
    user_orders = db.query(Order).filter(Order.user_id == user_id).all()
    if not user_orders:
        return []

    # 2. Get past ordered items for this user
    past_order_items = (
        db.query(MenuItem)
        .join(OrderItem, OrderItem.menu_item_id == MenuItem.id)
        .join(Order, Order.id == OrderItem.order_id)
        .filter(Order.user_id == user_id, MenuItem.is_available == True)
        .order_by(OrderItem.id.desc())
        .all()
    )

    if not past_order_items:
        return []

    recommended_items = []
    recommended_ids = set()

    # Slot 1: Item from user's first/past completed order
    first_order_item = past_order_items[0]
    recommended_items.append(first_order_item)
    recommended_ids.add(first_order_item.id)

    # Slot 2: Similar product from the SAME category
    similar_category_item = (
        db.query(MenuItem)
        .filter(
            MenuItem.category == first_order_item.category,
            MenuItem.is_available == True,
            MenuItem.id.notin_(recommended_ids)
        )
        .first()
    )
    if similar_category_item:
        recommended_items.append(similar_category_item)
        recommended_ids.add(similar_category_item.id)

    # Slot 3: Product from ANOTHER category
    other_category_item = (
        db.query(MenuItem)
        .filter(
            MenuItem.category != first_order_item.category,
            MenuItem.is_available == True,
            MenuItem.id.notin_(recommended_ids)
        )
        .first()
    )
    if other_category_item:
        recommended_items.append(other_category_item)
        recommended_ids.add(other_category_item.id)

    # Fallback to reach 3 items if needed
    if len(recommended_items) < 3:
        needed = 3 - len(recommended_items)
        extra_items = (
            db.query(MenuItem)
            .filter(
                MenuItem.is_available == True,
                MenuItem.id.notin_(recommended_ids)
            )
            .limit(needed)
            .all()
        )
        recommended_items.extend(extra_items)

    return recommended_items
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)