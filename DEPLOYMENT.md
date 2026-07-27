# 🚀 CRAVE Deployment Guide: Render & Cloudinary Setup

This guide provides step-by-step instructions for setting up **Cloudinary Image Storage** and deploying the **CRAVE** food delivery application to **Render**.

---

## 1. ☁️ Cloudinary Configuration

1. **Create Account**: Sign up for a free account at [Cloudinary.com](https://cloudinary.com).
2. **Retrieve API Credentials**:
   - Go to your Cloudinary Dashboard.
   - Copy your **Cloud Name**, **API Key**, and **API Secret**.
3. **Update Local Environment**:
   - Open `server/.env` and paste your credentials:
     ```env
     CLOUDINARY_CLOUD_NAME=your_cloud_name
     CLOUDINARY_API_KEY=your_api_key
     CLOUDINARY_API_SECRET=your_api_secret
     ```
   - *Note*: If these credentials are left empty, the application automatically falls back to optimized local image compression.

---

## 2. 🌐 Deploying to Render

Render will automatically deploy both the Backend (FastAPI) and Frontend (React/Vite).

### Step 1: Connect your Git Repository
1. Push your code to your GitHub / GitLab repository.
2. Log into [Render.com](https://dashboard.render.com).
3. Click **New +** -> **Blueprint**.
4. Connect your `CRAVE` Git repository. Render will automatically detect the `render.yaml` blueprint file.

---

### Step 2: Configure Backend Environment Variables
In the Render Dashboard for `crave-backend`, add the following environment variables:
- `DATABASE_URL`: Your PostgreSQL database URL (Render PostgreSQL, Supabase, or Neon).
- `SECRET_KEY`: Random secret key for JWT auth (Render can auto-generate this).
- `CLOUDINARY_CLOUD_NAME`: Your Cloudinary Cloud Name.
- `CLOUDINARY_API_KEY`: Your Cloudinary API Key.
- `CLOUDINARY_API_SECRET`: Your Cloudinary API Secret.
- `GEMINI_API_KEY`: Your Google Gemini API Key (optional for AI Chatbot).
- `RAZORPAY_KEY_ID`: Your Razorpay Key ID (optional for payment gateway).
- `RAZORPAY_KEY_SECRET`: Your Razorpay Key Secret (optional).

---

### Step 3: Configure Frontend Environment Variable
In the Render Dashboard for `crave-frontend`, add:
- `VITE_API_BASE_URL`: The URL of your deployed Render backend (e.g., `https://crave-backend.onrender.com`).

---

## 3. ⚡ Local Testing before Deployment

To test locally before pushing to Git:
Double-click `start.bat` in the root folder or run:
```cmd
start.bat
```
This launches both Backend (`http://localhost:8000`) and Frontend (`http://localhost:5173`).
