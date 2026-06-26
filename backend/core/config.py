import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'), override=True)

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""  # JWT secret for token validation
    SUPABASE_BUCKET: str = "resumes"
    
    # AI Services
    GROQ_API_KEY: str = ""
    
    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://your-app.vercel.app",
    ]
    
    # File Upload
    MAX_FILE_SIZE_MB: int = 10
    
    # Authentication
    REQUIRE_EMAIL_VERIFICATION: bool = False  # Set to True to require email verification
    
    # Environment
    DEBUG: bool = True  # Set to False in production

    class Config:
        env_file = os.path.join(os.path.dirname(__file__), '..', '.env')
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()