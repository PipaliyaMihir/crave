# import os
# import smtplib
# import base64
# from typing import Optional, List
# from email.mime.text import MIMEText
# from email.mime.multipart import MIMEMultipart
# from email.mime.image import MIMEImage
# from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
# from sqlalchemy.orm import Session
# from passlib.context import CryptContext
# from pydantic import BaseModel

# # --- INTERNAL IMPORTS ---
# from app.db.session import get_db
# from app.models.restaurant_request import RestaurantRequest
# from app.models.rider_request import RiderRequest 
# from app.models.user import User, Restaurant
# from app.models.rider import Rider
# from app.models.order import Order # <--- Make sure this is imported at the top!
# from sqlalchemy import func

# # --- CONFIGURATION ---
# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# router = APIRouter(prefix="/admin", tags=["Admin"])

# # ===========================
# # 1. PYDANTIC SCHEMAS
# # ===========================

# class AdminUserResponse(BaseModel):
#     id: int
#     username: Optional[str] = None
#     email: Optional[str] = None
#     role: str
#     phone: Optional[str] = None
#     # --- NEW FIELDS FOR ADMIN DASHBOARD ---
#     rating: Optional[float] = 0.0
#     total_earnings: Optional[float] = 0.0
#     total_trips: Optional[int] = 0
#     total_spent: Optional[float] = 0.0
    
#     class Config:
#         from_attributes = True

# class AdminRequestResponse(BaseModel):
#     id: int
#     restaurant_name: str
#     owner_name: str
#     email: str
#     phone: str
#     address: str
#     status: str
#     class Config:
#         from_attributes = True

# class AdminRiderResponse(BaseModel):
#     id: int
#     full_name: str
#     email: str
#     phone: str
#     city: str
#     vehicle_type: str
#     status: str
#     class Config:
#         from_attributes = True

# # ===========================
# # 2. HELPER FUNCTIONS
# # ===========================

# def get_password_hash(password):
#     return pwd_context.hash(password)

# # --- CORE EMAIL SENDER ---
# def _send_email_core(to_email, subject, body, image_base64=None):
#     sender_email = os.getenv("MAIL_USERNAME")
#     sender_password = os.getenv("MAIL_PASSWORD")

#     if not sender_email or not sender_password:
#         print("⚠️ Skipped Email: Missing Credentials in .env")
#         return

#     msg = MIMEMultipart("related")
#     msg["From"] = f"Crave Support <{sender_email}>"
#     msg["To"] = to_email
#     msg["Subject"] = subject
#     msg_html = MIMEText(body, "html")
#     msg.attach(msg_html)

#     # Image Embedding Logic (Optional)
#     if image_base64 and "base64," in image_base64:
#         try:
#             header, encoded = image_base64.split("base64,", 1)
#             img_data = base64.b64decode(encoded)
#             img = MIMEImage(img_data)
#             img.add_header('Content-ID', '<profile_pic>')
#             img.add_header('Content-Disposition', 'inline')
#             msg.attach(img)
#         except Exception:
#             pass

#     try:
#         server = smtplib.SMTP("smtp.gmail.com", 587)
#         server.starttls()
#         server.login(sender_email, sender_password)
#         server.sendmail(sender_email, to_email, msg.as_string())
#         server.quit()
#         print(f"✅ Email sent to {to_email}")
#     except Exception as e:
#         print(f"❌ Email Failed: {e}")

# # --- RESTAURANT EMAIL ---
# def send_login_email(to_email: str, username: str
# , password: str):
#     subject = "Welcome to the Crave Family! 🍽️"
#     body = f"""
#     <html>
#     <body style="font-family: Arial, sans-serif; padding: 20px;">
#         <h2 style="color: #ea580c;">Welcome to Crave! 🎉</h2>
#         <p>Your Restaurant application has been approved.</p>
#         <div style="background: #f3f4f6; padding: 15px; border-radius: 8px;">
#             <p><strong>Username:</strong> {username}</p>
#             <p><strong>Password:</strong> {password}</p>
#         </div>
#         <p><a href="http://localhost:5173/login">Login here</a></p>
#     </body>
#     </html>
#     """
#     _send_email_core(to_email, subject, body)

# # --- NEW: RIDER WELCOME EMAIL ---
# def send_rider_welcome_email(to_email: str, username: str, password: str):
#     subject = "Welcome to the Crave Fleet! 🚴‍♂️"
#     body = f"""
#     <!DOCTYPE html>
#     <html>
#     <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
#         <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
#             <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
#                 <h1 style="color: #ffffff; margin: 0; font-size: 26px;">You're Hired! 🚴‍♂️</h1>
#                 <p style="color: #bfdbfe; margin: 5px 0 0; font-size: 16px;">Welcome to the fleet</p>
#             </div>
#             <div style="padding: 40px 30px;">
#                 <p style="color: #333; font-size: 16px; line-height: 1.6;">Hello,</p>
#                 <p style="color: #555; font-size: 16px; line-height: 1.6;">Your application to become a rider has been approved. You can now log in and start accepting orders.</p>
                
#                 <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; margin: 25px 0; border-radius: 4px;">
#                     <p style="margin: 0 0 10px; color: #2563eb; font-weight: bold; font-size: 12px; text-transform: uppercase;">Your Credentials</p>
#                     <p style="margin: 5px 0; color: #333; font-size: 16px;"><strong>Username:</strong> {username}</p>
#                     <p style="margin: 5px 0; color: #333; font-size: 16px;"><strong>Password:</strong> {password}</p>
#                 </div>

#                 <div style="text-align: center; margin-top: 35px;">
#                     <a href="http://localhost:5173/login" style="background-color: #2563eb; color: white; padding: 14px 30px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px;">Login to App</a>
#                 </div>
#             </div>
#         </div>
#     </body>
#     </html>
#     """
#     _send_email_core(to_email, subject, body)

# def send_update_email(to_email, name, username, address, password=None, profile_image=None):
#     pass # Kept structure for your existing code

# # ===========================
# # 3. ROUTES
# # ===========================

# @router.get("/dashboard")
# def get_admin_stats(db: Session = Depends(get_db)):
#     return {
#         "stats": {
#             "revenue": "₹0",
#             "total_orders": "0",
#             "active_drivers": db.query(User).filter(User.role == "driver").count(),
#             "pending_requests": db.query(RestaurantRequest).filter(RestaurantRequest.status == "pending").count()
#         }
#     }


# from sqlalchemy import func
# from app.models.order import Order # Ensure this is imported!

# from sqlalchemy import func
# from app.models.order import Order

# @router.get("/users", response_model=List[AdminUserResponse])
# def get_all_users(db: Session = Depends(get_db)):
#     users = db.query(User).all()
    
#     response_data = []
#     for u in users:
#         user_data = {
#             "id": u.id,
#             "username": u.username,
#             "email": u.email,
#             "role": u.role,
#             "phone": u.phone,
#             "total_earnings": 0.0,
#             "total_trips": 0,
#             "rating": 0.0,
#             "total_spent": 0.0  # Default to 0
#         }
        
#         # --- CUSTOMER LOGIC (Calculates total spent) ---
#         if u.role == "customer":
#             # Bulletproof sum query for this specific user
#             spent = db.query(func.sum(Order.total_amount)).filter(
#                 Order.user_id == u.id,
#                 Order.status == "delivered"
#             ).scalar()
            
#             user_data["total_spent"] = float(spent) if spent else 0.0
                
#         # --- RIDER LOGIC (Calculates earnings & rating) ---
#         elif u.role in ["rider", "driver"] and getattr(u, "rider", None):
#             user_data["total_earnings"] = getattr(u.rider, "total_earnings", 0.0) or 0.0
#             user_data["total_trips"] = getattr(u.rider, "total_trips", 0) or 0
            
#             t_rating = getattr(u.rider, "total_rating", 0.0) or 0.0
#             r_count = getattr(u.rider, "rating_count", 0) or 0
            
#             if r_count > 0:
#                 user_data["rating"] = round(t_rating / r_count, 1)
                
#         response_data.append(user_data)
        
#     return response_data

# # --- RESTAURANT REQUESTS ---
# @router.get("/requests", response_model=List[AdminRequestResponse])
# def get_pending_requests(db: Session = Depends(get_db)):
#     return db.query(RestaurantRequest).filter(RestaurantRequest.status == "pending").all()

# @router.post("/approve/{request_id}")
# def approve_restaurant(request_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
#     req = db.query(RestaurantRequest).filter(RestaurantRequest.id == request_id).first()
#     if not req: raise HTTPException(status_code=404, detail="Request not found")
    
#     if req.status == "approved":
#         return {"message": "Already approved"}

#     generated_username = req.email.split("@")[0] + "_owner"
#     temp_password = "Pass" + str(req.id) + "word!" 
#     hashed_pw = get_password_hash(temp_password)

#     # 1. Create/Check User Account
#     existing_user = db.query(User).filter(User.email == req.email).first()
#     if not existing_user:
#         new_user = User(
#             username=generated_username, full_name=req.owner_name, email=req.email,
#             phone=req.phone, hashed_password=hashed_pw, role="restaurant",
#             profile_image="https://cdn-icons-png.flaticon.com/512/1996/1996055.png"
#         )
#         db.add(new_user)
#         db.commit()
#         db.refresh(new_user)
#     else:
#         generated_username = existing_user.username
#         temp_password = "[Existing Password]"

#     # 2. Create/Check Restaurant Profile
#     existing_restaurant = db.query(Restaurant).filter(Restaurant.email == req.email).first()
#     if not existing_restaurant:
#         new_restaurant = Restaurant(
#             name=req.restaurant_name, 
#             email=req.email, 
#             password=hashed_pw,
#             is_active=True, 
#             address=req.address
#         )
#         db.add(new_restaurant)
#         db.commit()

#     # 3. Update Request Status
#     req.status = "approved"
#     db.commit()

#     if not existing_user:
#         # Calls the Restaurant Email function
#         background_tasks.add_task(send_login_email, req.email, generated_username, temp_password)

#     return {"message": "Request approved successfully", "username": generated_username}

# @router.post("/reject/{request_id}")
# def reject_restaurant_request(request_id: int, db: Session = Depends(get_db)):
#     req = db.query(RestaurantRequest).filter(RestaurantRequest.id == request_id).first()
#     if not req: raise HTTPException(status_code=404, detail="Request not found")
#     req.status = "rejected"
#     db.commit()
#     return {"message": "Request rejected"}

# @router.delete("/restaurants/{restaurant_id}")
# def delete_restaurant(restaurant_id: int, db: Session = Depends(get_db)):
#     rest = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
#     if not rest: raise HTTPException(status_code=404, detail="Restaurant not found")
#     user = db.query(User).filter(User.email == rest.email).first()
#     db.delete(rest)
#     if user: db.delete(user)
#     db.commit()
#     return {"message": "Restaurant deleted"}

# # --- RIDER REQUESTS ---

# @router.get("/rider-requests", response_model=List[AdminRiderResponse])
# def get_rider_requests(db: Session = Depends(get_db)):
#     return db.query(RiderRequest).filter(RiderRequest.status == "pending").all()

# @router.post("/rider-approve/{request_id}")
# def approve_rider(request_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
#     # 1. Fetch Request
#     req = db.query(RiderRequest).filter(RiderRequest.id == request_id).first()
#     if not req: raise HTTPException(status_code=404, detail="Request not found")
#     if req.status == "approved": return {"message": "Already approved"}

#     # 2. Generate Credentials
#     base_username = req.email.split("@")[0]
#     generated_username = f"{base_username}_rider"
#     if db.query(User).filter(User.username == generated_username).first():
#         generated_username = f"{generated_username}_{req.id}"

#     temp_password = f"Ride{req.id}Now!"
#     hashed_pw = get_password_hash(temp_password)

#     # 3. Create User Account
#     existing_user = db.query(User).filter(User.email == req.email).first()
#     if not existing_user:
#         new_user = User(
#             username=generated_username, full_name=req.full_name, email=req.email,
#             phone=req.phone, hashed_password=hashed_pw, role="driver", 
#             profile_image="https://cdn-icons-png.flaticon.com/512/1996/1996055.png"
#         )
#         db.add(new_user)
#         db.commit()
#         db.refresh(new_user)
#         user_id = new_user.id
#     else:
#         user_id = existing_user.id
#         if existing_user.role == "customer":
#             existing_user.role = "driver"
#             db.commit()

#     # 4. Create Rider Profile
#     existing_rider = db.query(Rider).filter(Rider.user_id == user_id).first()
#     if not existing_rider:
#         new_rider = Rider(
#             user_id=user_id, vehicle_type=req.vehicle_type, city=req.city,
#             is_active=True, is_available=True
#         )
#         db.add(new_rider)
#         db.commit()

#     # 5. Update Request Status
#     req.status = "approved"
#     db.commit()

#     # 6. SEND EMAIL (Replaced SMS with this line)
#     background_tasks.add_task(send_rider_welcome_email, req.email, generated_username, temp_password)

#     return {"message": "Rider approved", "username": generated_username}

# @router.post("/rider-reject/{request_id}")
# def reject_rider_request(request_id: int, db: Session = Depends(get_db)):
#     req = db.query(RiderRequest).filter(RiderRequest.id == request_id).first()
#     if not req: raise HTTPException(status_code=404, detail="Request not found")
#     req.status = "rejected"
#     db.commit()
#     return {"message": "Rider request rejected"}



import os
import smtplib
import ssl
import base64
import httpx
from typing import Optional, List
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from passlib.context import CryptContext
from pydantic import BaseModel

# --- INTERNAL IMPORTS ---
from app.db.session import get_db
from app.models.restaurant_request import RestaurantRequest
from app.models.rider_request import RiderRequest 
from app.models.user import User, Restaurant
from app.models.rider import Rider
from app.models.order import Order  # Ensure this model exists for stats

# --- CONFIGURATION ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
router = APIRouter(prefix="/admin", tags=["Admin"])

# ===========================
# 1. PYDANTIC SCHEMAS
# ===========================

class AdminUserResponse(BaseModel):
    id: int
    username: Optional[str] = None
    email: Optional[str] = None
    role: str
    phone: Optional[str] = None
    # Dashboard Fields
    rating: Optional[float] = 0.0
    total_earnings: Optional[float] = 0.0
    total_trips: Optional[int] = 0
    total_spent: Optional[float] = 0.0
    
    class Config:
        from_attributes = True

class AdminRequestResponse(BaseModel):
    id: int
    restaurant_name: str
    owner_name: str
    email: str
    phone: str
    address: str
    status: str
    class Config:
        from_attributes = True

class AdminRiderResponse(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str
    city: str
    vehicle_type: str
    status: str
    class Config:
        from_attributes = True

# ===========================
# 2. HELPER FUNCTIONS
# ===========================

def get_password_hash(password):
    return pwd_context.hash(password)

# --- CORE EMAIL ENGINE ---
def _send_email_core(to_email, subject, body, image_base64=None):
    sender_email = os.getenv("MAIL_USERNAME") or os.getenv("SENDER_EMAIL")
    sender_password = os.getenv("MAIL_PASSWORD") or os.getenv("SENDER_PASSWORD")
    brevo_api_key = os.getenv("BREVO_API_KEY")
    resend_api_key = os.getenv("RESEND_API_KEY")

    print(f"📧 [Email System] Triggered for target: {to_email}")

    # 1. Brevo (Sendinblue) HTTP API (Priority 1 - Port 443 HTTPS)
    if brevo_api_key:
        from_email = sender_email or "no-reply@crave.com"
        try:
            resp = httpx.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={"api-key": brevo_api_key, "Content-Type": "application/json", "accept": "application/json"},
                json={
                    "sender": {"name": "Crave Support", "email": from_email},
                    "to": [{"email": to_email}],
                    "subject": subject,
                    "htmlContent": body
                },
                timeout=15.0
            )
            if resp.status_code in [200, 201]:
                print(f"✅ [Email System] Delivered via Brevo HTTPS API to {to_email}")
                return
            else:
                print(f"⚠️ [Email System] Brevo API returned status {resp.status_code}: {resp.text}")
        except Exception as b_err:
            print(f"⚠️ [Email System] Brevo HTTPS API failed: {b_err}")

    # 2. Resend HTTP API (Port 443 HTTPS - Fallback)
    if resend_api_key:
        try:
            resp = httpx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {resend_api_key}", "Content-Type": "application/json"},
                json={
                    "from": "Crave Support <onboarding@resend.dev>",
                    "to": [to_email],
                    "subject": subject,
                    "html": body
                },
                timeout=15.0
            )
            if resp.status_code in [200, 201]:
                print(f"✅ [Email System] Delivered via Resend HTTPS API to {to_email}")
                return
            else:
                print(f"⚠️ [Email System] Resend API returned status {resp.status_code}: {resp.text}")
        except Exception as r_err:
            print(f"⚠️ [Email System] Resend HTTPS API failed: {r_err}")

    # 3. Fallback to Standard SMTP
    if not sender_email or not sender_password:
        print(f"⚠️ [Email System] SKIPPED! Missing BREVO_API_KEY, RESEND_API_KEY, or SENDER_EMAIL in Render Environment Variables.")
        return

    print(f"📧 [Email System] Attempting SMTP via sender: {sender_email} to: {to_email}")

    msg = MIMEMultipart("related")
    msg["From"] = f"Crave Support <{sender_email}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg_html = MIMEText(body, "html")
    msg.attach(msg_html)

    if image_base64 and "base64," in image_base64:
        try:
            header, encoded = image_base64.split("base64,", 1)
            img_data = base64.b64decode(encoded)
            img = MIMEImage(img_data)
            img.add_header('Content-ID', '<profile_pic>')
            img.add_header('Content-Disposition', 'inline')
            msg.attach(img)
        except Exception: pass

    try:
        context = ssl.create_default_context()
        try:
            # Try Port 465 (SSL) first - works reliably on Render / Cloud platforms
            server = smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context, timeout=15)
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, to_email, msg.as_string())
            server.quit()
            print(f"✅ [Email System] Sent via SMTP_SSL port 465 to {to_email}")
        except Exception as ssl_err:
            print(f"⚠️ [Email System] Port 465 failed ({ssl_err}), trying TLS port 587...")
            server = smtplib.SMTP("smtp.gmail.com", 587, timeout=15)
            server.starttls(context=context)
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, to_email, msg.as_string())
            server.quit()
            print(f"✅ [Email System] Sent via SMTP port 587 to {to_email}")
            
        if sender_email.lower() == to_email.lower():
            print(f"💡 [Note] Email sent from {sender_email} to ITSELF ({to_email}). In Gmail, check your 'Sent' or 'All Mail' folder!")

    except Exception as e:
        print(f"❌ [Email System] FAILED to send email to {to_email}: {e}")
        print("💡 TIP: Set RESEND_API_KEY in Render Environment Variables to use Resend HTTPS API (Port 443) which is never blocked by cloud firewalls.")

# --- SPECIFIC EMAIL TEMPLATES ---

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://crave-jbjv.onrender.com")

def send_login_email(to_email: str, username: str, password: str):
    login_url = f"{FRONTEND_URL}/login"
    subject = "Welcome to the Crave Family! 🍽️"
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #ea580c;">Welcome to Crave! 🎉</h2>
        <p>Your Restaurant application has been approved.</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px;">
            <p><strong>Username:</strong> {username}</p>
            <p><strong>Password:</strong> {password}</p>
        </div>
        <p><a href="{login_url}">Click here to Login</a></p>
    </body>
    </html>
    """
    _send_email_core(to_email, subject, body)

def send_rider_welcome_email(to_email: str, username: str, password: str):
    login_url = f"{FRONTEND_URL}/login"
    subject = "Welcome to the Crave Fleet! 🚴‍♂️"
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #2563eb;">You're Hired! 🚴‍♂️</h2>
        <p>Your application to become a rider has been approved.</p>
        <div style="background: #eff6ff; padding: 15px; border-radius: 8px;">
            <p><strong>Username:</strong> {username}</p>
            <p><strong>Password:</strong> {password}</p>
        </div>
        <p><a href="{login_url}">Click here to Login to start earning</a></p>
    </body>
    </html>
    """
    _send_email_core(to_email, subject, body)

# --- CRITICAL FIX: The missing function app/main.py is looking for ---
def send_update_email(to_email, name, username, address, password=None, profile_image=None):
    """Placeholder for profile update notifications required by main.py."""
    subject = "Crave Profile Updated 📝"
    body = f"Hello {name}, your profile details have been updated successfully."
    _send_email_core(to_email, subject, body)

# ===========================
# 3. ROUTES
# ===========================

@router.get("/dashboard")
def get_admin_stats(db: Session = Depends(get_db)):
    return {
        "stats": {
            "revenue": "₹0",
            "total_orders": "0",
            "active_drivers": db.query(User).filter(User.role == "driver").count(),
            "pending_requests": db.query(RestaurantRequest).filter(RestaurantRequest.status == "pending").count()
        }
    }

@router.get("/users", response_model=List[AdminUserResponse])
def get_all_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    response_data = []
    
    for u in users:
        user_data = {
            "id": u.id, "username": u.username, "email": u.email,
            "role": u.role, "phone": u.phone,
            "total_earnings": 0.0, "total_trips": 0, "rating": 0.0, "total_spent": 0.0
        }
        
        # Calculate Customer Stats
        if u.role == "customer":
            spent = db.query(func.sum(Order.total_amount)).filter(
                Order.user_id == u.id, Order.status == "delivered"
            ).scalar()
            user_data["total_spent"] = float(spent) if spent else 0.0
                
        # Calculate Rider Stats
        elif u.role in ["rider", "driver"] and getattr(u, "rider", None):
            user_data["total_earnings"] = getattr(u.rider, "total_earnings", 0.0) or 0.0
            user_data["total_trips"] = getattr(u.rider, "total_trips", 0) or 0
            
            t_rating = getattr(u.rider, "total_rating", 0.0) or 0.0
            r_count = getattr(u.rider, "rating_count", 0) or 0
            if r_count > 0:
                user_data["rating"] = round(t_rating / r_count, 1)
                
        response_data.append(user_data)
    return response_data

# --- APPROVAL & REJECTION LOGIC ---

@router.post("/approve/{request_id}")
def approve_restaurant(request_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    req = db.query(RestaurantRequest).filter(RestaurantRequest.id == request_id).first()
    if not req: raise HTTPException(status_code=404, detail="Request not found")
    if req.status == "approved": return {"message": "Already approved"}

    generated_username = req.email.split("@")[0] + "_owner"
    temp_password = f"Pass{req.id}word!" 
    hashed_pw = get_password_hash(temp_password)

    existing_user = db.query(User).filter(User.email == req.email).first()
    if not existing_user:
        new_user = User(
            username=generated_username, full_name=req.owner_name, email=req.email,
            phone=req.phone, hashed_password=hashed_pw, role="restaurant",
            profile_image="https://cdn-icons-png.flaticon.com/512/1996/1996055.png"
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    else:
        generated_username = existing_user.username

    if not db.query(Restaurant).filter(Restaurant.email == req.email).first():
        db.add(Restaurant(name=req.restaurant_name, email=req.email, password=hashed_pw, is_active=True, address=req.address))
    
    req.status = "approved"
    db.commit()
    background_tasks.add_task(send_login_email, req.email, generated_username, temp_password)
    return {"message": "Restaurant approved", "username": generated_username}

@router.post("/rider-approve/{request_id}")
def approve_rider(request_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    req = db.query(RiderRequest).filter(RiderRequest.id == request_id).first()
    if not req: raise HTTPException(status_code=404, detail="Request not found")
    
    generated_username = f"{req.email.split('@')[0]}_rider"
    temp_password = f"Ride{req.id}Now!"
    hashed_pw = get_password_hash(temp_password)

    existing_user = db.query(User).filter(User.email == req.email).first()
    if not existing_user:
        new_user = User(username=generated_username, full_name=req.full_name, email=req.email, phone=req.phone, hashed_password=hashed_pw, role="driver")
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        user_id = new_user.id
    else:
        user_id = existing_user.id
        existing_user.role = "driver"
        db.commit()

    if not db.query(Rider).filter(Rider.user_id == user_id).first():
        db.add(Rider(user_id=user_id, vehicle_type=req.vehicle_type, city=req.city, is_active=True, is_available=True))
    
    req.status = "approved"
    db.commit()
    background_tasks.add_task(send_rider_welcome_email, req.email, generated_username, temp_password)
    return {"message": "Rider approved"}