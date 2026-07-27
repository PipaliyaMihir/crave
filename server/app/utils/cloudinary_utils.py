import os
import base64
import io
from PIL import Image
from dotenv import load_dotenv

load_dotenv()

# Check for Cloudinary credentials
CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
API_KEY = os.getenv("CLOUDINARY_API_KEY")
API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

CLOUDINARY_AVAILABLE = False

try:
    import cloudinary
    import cloudinary.uploader
    if CLOUD_NAME and API_KEY and API_SECRET:
        cloudinary.config(
            cloud_name=CLOUD_NAME,
            api_key=API_KEY,
            api_secret=API_SECRET,
            secure=True
        )
        CLOUDINARY_AVAILABLE = True
        print("[Cloudinary] Configured successfully with Cloud Name:", CLOUD_NAME)
    else:
        print("[Cloudinary] Credentials missing in .env. Falling back to local image handling.")
except ImportError:
    print("[Cloudinary] SDK not installed or credentials incomplete. Falling back to local image handling.")

def upload_image_to_cloudinary(file_obj, folder="crave_app", max_size=(800, 800), quality=75) -> str:
    """
    Uploads an UploadFile, file-like object, or bytes to Cloudinary.
    Returns the secure Cloudinary HTTPS URL.
    If Cloudinary is not configured, compresses the image and returns a base64 Data URL.
    """
    try:
        # If file_obj is an UploadFile or file object, read bytes
        if hasattr(file_obj, "file"):
            file_bytes = file_obj.file.read()
            # Reset seek position if needed elsewhere
            file_obj.file.seek(0)
        elif hasattr(file_obj, "read"):
            file_bytes = file_obj.read()
        elif isinstance(file_obj, bytes):
            file_bytes = file_obj
        else:
            return None

        # 1. If Cloudinary is configured, upload to Cloudinary
        if CLOUDINARY_AVAILABLE:
            upload_result = cloudinary.uploader.upload(
                file_bytes,
                folder=folder,
                resource_type="auto"
            )
            return upload_result.get("secure_url")

        # 2. Fallback: Compress and convert to base64 Data URL
        img = Image.open(io.BytesIO(file_bytes))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.thumbnail(max_size)
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=quality, optimize=True)
        buffer.seek(0)
        encoded = base64.b64encode(buffer.read()).decode("utf-8")
        return f"data:image/jpeg;base64,{encoded}"

    except Exception as e:
        print(f"[Image Upload Error]: {e}")
        return None
