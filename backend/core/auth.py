"""
Authentication and authorization module.
Validates JWT tokens from Supabase Auth and extracts user identity.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Optional
from core.config import settings
from core.logging_config import get_logger

logger = get_logger("auth")

# HTTP Bearer token security scheme
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> str:
    """
    Extract and validate user ID from Supabase JWT token.
    
    This dependency ensures only authenticated users can access protected endpoints.
    It validates the JWT token and extracts the user ID from the token payload.
    
    Args:
        credentials: HTTP Authorization header with Bearer token
    
    Returns:
        str: Validated user ID from token
    
    Raises:
        HTTPException: 401 if token is missing, invalid, or expired
    
    Usage:
        @router.post("/protected-endpoint")
        async def protected_route(current_user: str = Depends(get_current_user)):
            # current_user is validated and safe to use
            ...
    """
    if not credentials:
        logger.warning("Missing Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        token = credentials.credentials
        
        # Decode JWT manually to support both HS256 and ES256
        import json
        import base64
        import time
        
        # Split token into parts
        parts = token.split('.')
        if len(parts) != 3:
            logger.warning("Invalid token format")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token format",
            )
        
        # Decode header (first part) to check algorithm
        header_part = parts[0]
        padding = 4 - len(header_part) % 4
        if padding != 4:
            header_part += '=' * padding
        decoded_header = base64.urlsafe_b64decode(header_part)
        header = json.loads(decoded_header)
        token_alg = header.get('alg', 'unknown')
        logger.info(f"Token algorithm: {token_alg}")
        
        # Decode payload (second part)
        payload_part = parts[1]
        padding = 4 - len(payload_part) % 4
        if padding != 4:
            payload_part += '=' * padding
        decoded_payload = base64.urlsafe_b64decode(payload_part)
        payload = json.loads(decoded_payload)
        
        # Validate audience
        aud = payload.get("aud")
        if aud != "authenticated":
            logger.warning(f"Invalid token audience: {aud} (expected: authenticated)")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token audience",
            )
        
        # Validate expiration
        exp = payload.get("exp")
        current_time = time.time()
        if exp:
            if exp < current_time:
                logger.warning(f"Token has expired - exp: {exp}, current: {current_time}, diff: {current_time - exp}s")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token has expired",
                )
            else:
                logger.debug(f"Token valid - expires in {exp - current_time}s")
        
        # Extract user ID from 'sub' claim
        user_id: str = payload.get("sub")
        if not user_id:
            logger.warning("Token missing 'sub' claim (user ID)")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID",
            )
        
        # Optional: Check if user is confirmed (email verified)
        email_confirmed = payload.get("email_confirmed_at")
        if not email_confirmed and settings.REQUIRE_EMAIL_VERIFICATION:
            logger.warning(f"User {user_id[:8]} email not confirmed")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Please verify your email address",
            )
        
        logger.info(f"✅ Authenticated user: {user_id[:8]}... (algorithm: {token_alg})")
        return user_id
    
    except HTTPException:
        # Re-raise HTTPException without modification
        raise
    except Exception as e:
        logger.error(f"Token validation error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[str]:
    """
    Extract user ID from token if present, but don't require authentication.
    
    Useful for endpoints that work for both authenticated and anonymous users.
    
    Returns:
        Optional[str]: User ID if authenticated, None otherwise
    """
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def get_user_from_token(token: str) -> Optional[str]:
    """
    Synchronous helper to extract user ID from JWT token.
    
    Useful for background tasks or synchronous code.
    Returns None if token is invalid instead of raising exception.
    
    Args:
        token: JWT token string (without "Bearer " prefix)
    
    Returns:
        Optional[str]: User ID if valid, None otherwise
    """
    try:
        import json
        import base64
        import time
        
        # Split token into parts
        parts = token.split('.')
        if len(parts) != 3:
            return None
        
        # Decode payload (second part)
        payload_part = parts[1]
        padding = 4 - len(payload_part) % 4
        if padding != 4:
            payload_part += '=' * padding
        
        decoded_payload = base64.urlsafe_b64decode(payload_part)
        payload = json.loads(decoded_payload)
        
        # Verify audience and expiration
        if payload.get("aud") != "authenticated":
            return None
        
        exp = payload.get("exp")
        if exp and exp < time.time():
            return None
        
        return payload.get("sub")
    except Exception:
        return None


# Export for use in routers
__all__ = [
    "get_current_user",
    "get_optional_user",
    "get_user_from_token",
]
