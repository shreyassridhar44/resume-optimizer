# Authentication & Authorization - Complete Technical Explanation

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication Flow](#authentication-flow)
4. [Authorization Flow](#authorization-flow)
5. [Technical Implementation](#technical-implementation)
6. [Security Measures](#security-measures)
7. [Data Flow Diagrams](#data-flow-diagrams)
8. [Code Examples](#code-examples)
9. [Testing & Verification](#testing--verification)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What is Authentication?
**Authentication** answers the question: *"Who are you?"*

It's the process of verifying a user's identity. In our application, we use **JWT (JSON Web Tokens)** issued by Supabase Auth to authenticate users.

### What is Authorization?
**Authorization** answers the question: *"What are you allowed to do?"*

It's the process of verifying what an authenticated user has access to. In our application, users are only authorized to access their own data (resumes, analyses, history).

### Why Both Matter

```
Authentication: User proves they are "John Doe"
Authorization: User can only access John Doe's resumes, not anyone else's
```

Without **authentication**: Anyone could claim to be any user  
Without **authorization**: Authenticated users could access other users' data

---

## Architecture

### High-Level Architecture

```
┌─────────────┐         ┌──────────────┐         ┌───────────────┐
│   Frontend  │◄────────┤  Supabase    │         │   Backend     │
│   (React)   │         │    Auth      │         │   (FastAPI)   │
└──────┬──────┘         └──────────────┘         └───────┬───────┘
       │                                                  │
       │ 1. User logs in                                 │
       │────────────────────────────────────────────────►│
       │                                                  │
       │ 2. Receives JWT token                           │
       │◄────────────────────────────────────────────────│
       │                                                  │
       │ 3. Sends API request with JWT token             │
       │────────────────────────────────────────────────►│
       │                                                  │
       │                          4. Backend validates   │
       │                             JWT token           │
       │                          5. Extracts user_id    │
       │                          6. Queries database    │
       │                             for user's data     │
       │                                                  │
       │ 7. Returns only user's data                     │
       │◄────────────────────────────────────────────────│
       │                                                  │
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend Auth** | Supabase Auth | User login, JWT token management |
| **Backend Auth** | python-jose | JWT token validation |
| **Token Type** | JWT (HS256) | Stateless authentication |
| **Database RLS** | PostgreSQL RLS | Database-level security |
| **API Security** | FastAPI Depends | Dependency injection for auth |

---

## Authentication Flow

### Step 1: User Registration/Login

**Frontend** (`useAuth.tsx`):
```typescript
// User logs in with email/password
const signInWithEmail = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
}

// Or with Google OAuth
const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/dashboard' },
  })
  if (error) throw new Error(error.message)
}
```

**What happens**:
1. User enters credentials
2. Frontend calls Supabase Auth API
3. Supabase validates credentials
4. Supabase returns a **JWT access token**
5. Frontend stores token in session (automatic via Supabase client)

### Step 2: JWT Token Structure

A JWT token has three parts (separated by dots):

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkLTEyMyIsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSIsImV4cCI6MTcwMzEyMzQ1Nn0.signature
│                                      │                                                                              │
│          Header                      │                   Payload (Claims)                                           │   Signature
│      (algorithm & type)              │        (user data, expiration, etc.)                                         │
```

**Decoded Payload Example**:
```json
{
  "sub": "abc123-def456-ghi789",        // User ID (subject)
  "email": "john@example.com",           // User email
  "aud": "authenticated",                // Audience
  "exp": 1703123456,                     // Expiration timestamp
  "iat": 1703119856,                     // Issued at timestamp
  "email_confirmed_at": "2024-01-01T..."
}
```

**Security**: The signature is created using `SUPABASE_JWT_SECRET` - only Supabase and your backend know this secret, making tokens impossible to forge.

### Step 3: Storing the Token

**Automatic via Supabase**:
```typescript
// Supabase client automatically stores token in localStorage
// and includes it in session management
const { data: { session } } = await supabase.auth.getSession()

// session.access_token contains the JWT
// session.refresh_token used to get new tokens when expired
```

**Session Management**:
- Access token: Valid for 1 hour (default)
- Refresh token: Valid for 30 days (default)
- Auto-refresh: Supabase automatically refreshes expired tokens

---

## Authorization Flow

### Step 1: Frontend Sends Authenticated Request

**API Client** (`services/api.ts`):
```typescript
// Helper function to get auth headers
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.access_token) {
    throw new Error('Not authenticated. Please log in.')
  }
  
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

// Example: Upload resume with authentication
export async function uploadResume(file: File): Promise<ResumeUploadResponse> {
  const { data: { session } } = await supabase.auth.getSession()
  
  const fd = new FormData()
  fd.append('file', file)

  const res = await fetch(`${BASE_URL}/upload-resume`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,  // JWT token here!
    },
    body: fd,
  })
  return handleResponse<ResumeUploadResponse>(res)
}
```

**HTTP Request**:
```http
POST /api/upload-resume HTTP/1.1
Host: localhost:8000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: multipart/form-data

[file data]
```

### Step 2: Backend Validates Token

**Authentication Module** (`backend/core/auth.py`):
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from core.config import settings

# Security scheme for extracting Bearer token
security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """
    Extract and validate user ID from Supabase JWT token.
    
    This is the CORE of our authentication system.
    Every protected endpoint uses this function.
    """
    
    # Step 1: Check if Authorization header exists
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Missing authentication credentials"
        )
    
    try:
        # Step 2: Extract token from "Bearer <token>"
        token = credentials.credentials
        
        # Step 3: Validate and decode JWT
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,  # Secret key from .env
            algorithms=["HS256"],           # Algorithm used by Supabase
            audience="authenticated",       # Expected audience
        )
        
        # Step 4: Extract user ID from 'sub' claim
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid token: missing user ID"
            )
        
        # Step 5: Return validated user ID
        return user_id
    
    except JWTError:
        # Token is invalid, expired, or signature doesn't match
        raise HTTPException(
            status_code=401,
            detail="Could not validate authentication credentials"
        )
```

**What gets validated**:
1. ✅ Token signature (using `SUPABASE_JWT_SECRET`)
2. ✅ Token expiration (automatic in `jwt.decode`)
3. ✅ Token audience claim
4. ✅ User ID exists in token

**If validation fails**: Returns `401 Unauthorized`  
**If validation succeeds**: Returns authenticated `user_id`

### Step 3: Backend Uses Validated User ID

**Protected Endpoint Example** (`backend/routers/resume.py`):
```python
from core.auth import get_current_user
from fastapi import Depends

@router.post("/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    current_user: str = Depends(get_current_user),  # ← Authentication here!
):
    """
    Upload resume endpoint - requires authentication.
    
    The 'current_user' parameter is automatically populated
    with the validated user ID from the JWT token.
    """
    
    # current_user is now a validated user ID from the JWT token
    # We can trust it - it's not from user input!
    
    # Upload file to user's folder
    file_url = await upload_resume_file(file_bytes, filename, current_user)
    
    # Save to database under this user's ID
    resume_id = await save_resume_record_with_latex(
        user_id=current_user,  # ← Validated user ID
        file_url=file_url,
        parsed_text=raw_text,
        latex_code=latex_code,
        filename=filename,
    )
    
    return ResumeUploadResponse(
        resume_id=resume_id,
        file_url=file_url,
        parsed_text=raw_text[:500]
    )
```

**Key Security Feature**: `current_user` comes from a validated JWT token, not from user input. Users cannot fake this value.

### Step 4: Database Queries Filter by User

**Storage Service** (`backend/services/storage.py`):
```python
async def get_resume_text(resume_id: str, user_id: str) -> str:
    """
    Fetch resume text - only if it belongs to the user.
    """
    supabase = get_supabase()
    
    result = (
        supabase.table("resumes")
        .select("parsed_text")
        .eq("id", resume_id)        # ← Resume ID from request
        .eq("user_id", user_id)     # ← User ID from validated token
        .single()
        .execute()
    )
    
    if not result.data:
        # Resume not found OR doesn't belong to this user
        raise HTTPException(status_code=404, detail="Resume not found")
    
    return result.data["parsed_text"]
```

**Authorization Logic**:
```sql
-- SQL query generated:
SELECT parsed_text 
FROM resumes 
WHERE id = 'resume-123' 
  AND user_id = 'validated-user-id-from-token'
```

If the resume belongs to a different user, the query returns no results → 404 error.

---

## Technical Implementation

### Backend Components

#### 1. Configuration (`backend/core/config.py`)
```python
class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""  # ← Required for JWT validation
    SUPABASE_BUCKET: str = "resumes"
    
    # Authentication
    REQUIRE_EMAIL_VERIFICATION: bool = False
    
    class Config:
        env_file = ".env"
```

**Environment Variables** (`.env`):
```bash
SUPABASE_JWT_SECRET=your-actual-jwt-secret-from-supabase
```

**Where to find JWT secret**:
1. Go to Supabase Dashboard
2. Project Settings → API
3. JWT Settings → JWT Secret
4. Copy the secret key

#### 2. Authentication Dependency (`backend/core/auth.py`)

**Full Implementation**:
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Optional
from core.config import settings
from core.logging_config import get_logger

logger = get_logger("auth")
security = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> str:
    """Validate JWT and return user ID."""
    
    if not credentials:
        logger.warning("Missing Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        token = credentials.credentials
        
        # Decode and verify JWT
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        
        # Extract user ID
        user_id: str = payload.get("sub")
        if not user_id:
            logger.warning("Token missing 'sub' claim")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID",
            )
        
        # Optional: Verify email confirmation
        if settings.REQUIRE_EMAIL_VERIFICATION:
            email_confirmed = payload.get("email_confirmed_at")
            if not email_confirmed:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Please verify your email address",
                )
        
        logger.debug(f"✅ Authenticated user: {user_id[:8]}...")
        return user_id
    
    except JWTError as e:
        logger.warning(f"JWT validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
```

**Error Responses**:

| Error | Status Code | Response |
|-------|-------------|----------|
| No token | 401 | `{"detail": "Missing authentication credentials"}` |
| Invalid token | 401 | `{"detail": "Could not validate credentials"}` |
| Expired token | 401 | `{"detail": "Could not validate credentials"}` |
| Missing user ID | 401 | `{"detail": "Invalid token: missing user ID"}` |
| Email not verified | 403 | `{"detail": "Please verify your email address"}` |

#### 3. Protected Endpoints

**Pattern Used**:
```python
from core.auth import get_current_user
from fastapi import Depends

@router.post("/protected-endpoint")
async def protected_endpoint(
    request_data: RequestModel,
    current_user: str = Depends(get_current_user),  # ← Add this line
):
    # current_user is now validated user ID from JWT token
    # Use it for database queries, file operations, etc.
    pass
```

**All Protected Endpoints** (11 total):

| Endpoint | Method | Router | Purpose |
|----------|--------|--------|---------|
| `/api/upload-resume` | POST | resume.py | Upload resume |
| `/api/analyze` | POST | analysis.py | Full analysis |
| `/api/cover-letter` | POST | analysis.py | Generate cover letter |
| `/api/skill-gap` | POST | analysis.py | Skill gap roadmap |
| `/api/analysis/{id}` | GET | analysis.py | Get analysis by ID |
| `/api/history` | GET | history.py | Get user history |
| `/api/history/{id}` | DELETE | history.py | Delete analysis |
| `/api/evolution/{resume_id}` | GET | evolution.py | Resume evolution |
| `/api/evolution/compare` | GET | evolution.py | Compare versions |
| `/api/auto-edit-suggestions` | POST | auto_editor.py | Get edit suggestions |
| `/api/apply-edits` | POST | auto_editor.py | Apply edits |

**Unprotected Endpoints** (Public):

| Endpoint | Reason |
|----------|--------|
| `/`, `/health`, `/api/status` | Public health checks |
| `/api/live-feedback` | No data persistence, instant feedback |
| `/api/red-flags` | No data persistence, analysis only |
| `/api/rewrite` | Standalone tool, no user data |

#### 4. Request Schemas

**Before Authentication** ❌:
```python
class AnalyzeRequest(BaseModel):
    resume_id: str
    job_description: str
    user_id: str  # ❌ Trusted from user input!
    role_type: Optional[str] = "general"
    persona: Optional[str] = "standard"
```

**After Authentication** ✅:
```python
class AnalyzeRequest(BaseModel):
    resume_id: str
    job_description: str
    # user_id removed - obtained from JWT token
    role_type: Optional[str] = "general"
    persona: Optional[str] = "standard"
```

**Changed Schemas** (7 total):
1. `AnalyzeRequest`
2. `CoverLetterRequest`
3. `SkillGapRequest`
4. `JobDescriptionInput`
5. `VersionCompareRequest`
6. `AutoEditSuggestionsRequest`
7. `ApplyEditsRequest`

### Frontend Components

#### 1. Supabase Auth Hook (`useAuth.tsx`)

**Authentication Context**:
```typescript
import { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Initialize session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, loading, ... }}>
      {children}
    </AuthContext.Provider>
  )
}
```

**Usage in Components**:
```typescript
import { useAuth } from '../hooks/useAuth'

function MyComponent() {
  const { user, session, signOut } = useAuth()
  
  if (!user) {
    return <div>Please log in</div>
  }
  
  // User is authenticated
  // session.access_token contains JWT
}
```

#### 2. API Client (`services/api.ts`)

**Authentication Helper**:
```typescript
import { supabase } from '../lib/supabase'

// Helper to get authenticated headers
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.access_token) {
    throw new Error('Not authenticated. Please log in.')
  }
  
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

// Example API function
export async function analyzeResume(params: {
  resumeId: string
  jobDescription: string
  roleType: RoleType
  persona: PersonaType
}): Promise<AnalysisResponse> {
  const headers = await getAuthHeaders()  // ← Get auth headers

  const res = await fetch(`${BASE_URL}/analyze`, {
    method: 'POST',
    headers,  // ← Include JWT token
    body: JSON.stringify({
      resume_id: params.resumeId,
      job_description: params.jobDescription,
      // user_id removed - comes from JWT token
      role_type: params.roleType,
      persona: params.persona,
    }),
  })
  
  return handleResponse<AnalysisResponse>(res)
}
```

**All API Functions Updated** (14 functions):
1. `uploadResume()` - Resume upload
2. `analyzeResume()` - Full analysis
3. `getAnalysis()` - Get analysis by ID
4. `generateCoverLetter()` - Cover letter
5. `generateSkillGapRoadmap()` - Skill gap
6. `getUserHistory()` - History
7. `deleteAnalysis()` - Delete analysis
8. `getResumeEvolution()` - Evolution tracking
9. `compareVersions()` - Version comparison
10. `getAutoEditSuggestions()` - Edit suggestions
11. `applyResumeEdits()` - Apply edits
12. `getLiveFeedback()` - Live feedback (no auth)
13. `detectRedFlags()` - Red flags (no auth)
14. `rewrite()` - Rewrite bullets (not shown, no auth)

---

## Security Measures

### 1. Token Validation

**Multi-Layer Verification**:
```python
# 1. Signature verification
payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"])
# ↑ Verifies token was signed by Supabase (not forged)

# 2. Expiration check (automatic)
# jwt.decode() raises JWTError if token is expired

# 3. Audience verification
payload = jwt.decode(token, ..., audience="authenticated")
# ↑ Ensures token is for authenticated users

# 4. User ID extraction
user_id = payload.get("sub")
if not user_id:
    raise HTTPException(401, "Invalid token")
# ↑ Ensures user ID exists in token
```

### 2. Data Isolation

**Query Pattern**:
```python
# ALWAYS filter by authenticated user ID
result = supabase.table("table_name").select("*").eq("user_id", current_user).execute()
```

**Cannot be bypassed** because `current_user` comes from validated JWT, not user input.

### 3. Row-Level Security (RLS)

**Database Policies**:
```sql
-- Users can only access their own resumes
create policy "users_own_resumes" on public.resumes
  for all using (auth.uid() = user_id);

-- Users can only access their own analyses
create policy "users_own_analyses" on public.analyses
  for all using (auth.uid() = user_id);

-- Users can only access their own job descriptions
create policy "users_own_jds" on public.job_descriptions
  for all using (auth.uid() = user_id);

-- Users can only access feedback for their analyses
create policy "users_own_feedback" on public.feedback
  for all using (
    exists (
      select 1 from public.analyses a
      where a.id = feedback.analysis_id and a.user_id = auth.uid()
    )
  );
```

**Note**: Backend uses service key which bypasses RLS. This is acceptable because:
1. Backend validates JWT before any database operation
2. Backend filters all queries by `current_user` from validated token
3. Backend acts as a trusted intermediary

### 4. Error Handling

**Secure Error Messages**:
```python
# ❌ Bad: Leaks information
if user_not_found:
    raise HTTPException(404, "User abc123 not found")

# ✅ Good: Generic message
if user_not_found:
    raise HTTPException(404, "Resource not found")
```

**Production vs Development**:
```python
# In main.py
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}")
    
    if settings.DEBUG:
        # Development: Show full error
        return {"error": str(exc), "traceback": traceback.format_exc()}
    else:
        # Production: Hide details
        return {"error": "Internal Server Error"}
```

### 5. Rate Limiting

**Still Active**:
```python
from core.rate_limiter import limiter, get_rate_limit

@router.post("/analyze")
@limiter.limit(get_rate_limit("ai_heavy"))  # ← Rate limiting
async def analyze_resume(
    request: Request,
    req: AnalyzeRequest,
    current_user: str = Depends(get_current_user),  # ← Authentication
):
    # Both rate limiting AND authentication active
    pass
```

**Rate limits per IP** (not per user) to prevent:
- Brute force attacks
- API abuse
- Resource exhaustion

---

## Data Flow Diagrams

### Complete Request Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND                                     │
└─────────────────────────────────────────────────────────────────────────┘

1. User interacts with UI
   │
   ├─► Login → Supabase Auth → Receive JWT token
   │
2. User action (e.g., upload resume)
   │
   ├─► Get JWT from session: supabase.auth.getSession()
   │
   ├─► Create API request with Authorization header
   │
   └─► fetch('/api/upload-resume', {
         headers: { 'Authorization': 'Bearer <jwt-token>' },
         body: formData
       })

                            ↓ HTTP Request ↓

┌─────────────────────────────────────────────────────────────────────────┐
│                            BACKEND                                      │
└─────────────────────────────────────────────────────────────────────────┘

3. Request arrives at FastAPI
   │
   ├─► Security Middleware checks for suspicious patterns
   │
   ├─► Rate Limiter checks IP-based limits
   │
4. Route Handler with Depends(get_current_user)
   │
   ├─► Extract Authorization header
   │
   ├─► Extract token from "Bearer <token>"
   │
   ├─► Validate JWT signature with SUPABASE_JWT_SECRET
   │
   ├─► Check token expiration
   │
   ├─► Verify audience claim
   │
   ├─► Extract user_id from 'sub' claim
   │
   └─► Return validated user_id OR raise 401 error

5. Business Logic
   │
   ├─► Use validated user_id for all operations
   │
   ├─► Upload file to user's folder: f"{user_id}/filename"
   │
   ├─► Query database: WHERE user_id = validated_user_id
   │
   └─► Return response

                            ↓ HTTP Response ↓

┌─────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND                                     │
└─────────────────────────────────────────────────────────────────────────┘

6. Handle response
   │
   ├─► Success: Display results to user
   │
   ├─► 401 Error: Redirect to login page
   │
   └─► Other Errors: Show error message
```

### Authentication Decision Tree

```
                    Request arrives
                          │
                          ↓
              ┌───────────────────────┐
              │  Has Authorization    │
              │      header?          │
              └───────────┬───────────┘
                    ↓YES       NO↓
                    ↓             ↓
            ┌───────────┐   ┌─────────┐
            │Extract JWT│   │ Return  │
            │   token   │   │  401    │
            └─────┬─────┘   └─────────┘
                  ↓
          ┌───────────────┐
          │ Validate JWT  │
          │  signature    │
          └───────┬───────┘
             ↓VALID    INVALID↓
             ↓               ↓
    ┌────────────┐      ┌─────────┐
    │Check token │      │ Return  │
    │ expiration │      │  401    │
    └──────┬─────┘      └─────────┘
      ↓NOT EXPIRED  EXPIRED↓
      ↓                    ↓
┌─────────────┐       ┌─────────┐
│Extract user │       │ Return  │
│ID from 'sub'│       │  401    │
└──────┬──────┘       └─────────┘
       ↓
┌──────────────┐
│ User ID      │
│ validated!   │
│              │
│ Proceed with │
│ request      │
└──────────────┘
```

---

## Code Examples

### Example 1: Protected Resume Upload

**Frontend**:
```typescript
// components/upload/UploadPage.tsx
const handleUpload = async () => {
  try {
    // No need to pass user.id - comes from JWT
    const result = await uploadResume(file)
    console.log('Resume uploaded:', result.resume_id)
  } catch (error) {
    if (error.message.includes('Not authenticated')) {
      // Redirect to login
      navigate('/auth')
    } else {
      setError(error.message)
    }
  }
}
```

**Backend**:
```python
# routers/resume.py
@router.post("/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    current_user: str = Depends(get_current_user),  # ← Authenticated user ID
):
    # Validate file
    validate_file_type(file.filename, ["pdf", "docx"])
    validate_file_size(file_bytes, 10)
    
    # Extract text
    text = await extract_text_from_file(file)
    
    # Upload to user's folder
    file_url = await upload_resume_file(
        file_bytes,
        filename,
        current_user  # ← User's folder: "user-id-123/resume.pdf"
    )
    
    # Save to database under user's ID
    resume_id = await save_resume_record(
        user_id=current_user,  # ← Validated from JWT
        file_url=file_url,
        parsed_text=text
    )
    
    return {"resume_id": resume_id, "file_url": file_url}
```

### Example 2: Protected Analysis Retrieval

**Frontend**:
```typescript
// components/results/ResultsPage.tsx
useEffect(() => {
  const fetchAnalysis = async () => {
    try {
      // No need to pass user.id
      const data = await getAnalysis(analysisId)
      setAnalysisData(data)
    } catch (error) {
      if (error.message.includes('Not authenticated')) {
        navigate('/auth')
      } else {
        setError('Analysis not found')
      }
    }
  }
  
  if (analysisId) {
    fetchAnalysis()
  }
}, [analysisId])
```

**Backend**:
```python
# routers/analysis.py
@router.get("/analysis/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    current_user: str = Depends(get_current_user),  # ← Authenticated
):
    # Query filters by BOTH analysis_id AND user_id
    result = await get_analysis_by_id(analysis_id, current_user)
    
    if not result:
        # Either analysis doesn't exist OR doesn't belong to this user
        raise HTTPException(404, "Analysis not found")
    
    return result

# services/storage.py
async def get_analysis_by_id(analysis_id: str, user_id: str):
    result = (
        supabase.table("analyses")
        .select("*, resumes(parsed_text), job_descriptions(content)")
        .eq("id", analysis_id)
        .eq("user_id", user_id)  # ← CRITICAL: Filter by authenticated user
        .single()
        .execute()
    )
    return result.data
```

### Example 3: Cross-User Access Attempt (Blocked)

**Scenario**: User A tries to access User B's resume

**Frontend**:
```typescript
// User A is logged in with their JWT token
// They somehow get User B's resume_id (maybe from URL manipulation)

const userBResumeId = 'resume-belongs-to-user-b'

try {
  // Try to get User B's resume
  const result = await getAnalysis(userBResumeId)
} catch (error) {
  // Will receive: "Analysis not found"
  console.error(error)  // ← Request blocked!
}
```

**Backend Processing**:
```python
# User A's JWT token contains: user_id = "user-a-123"

@router.get("/analysis/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    current_user: str = Depends(get_current_user),
):
    # current_user = "user-a-123" (from JWT)
    # analysis_id = "resume-belongs-to-user-b" (from URL)
    
    result = (
        supabase.table("analyses")
        .select("*")
        .eq("id", analysis_id)
        .eq("user_id", current_user)  # ← user_id = "user-a-123"
        .execute()
    )
    
    # Query: SELECT * FROM analyses 
    #        WHERE id = 'resume-belongs-to-user-b' 
    #        AND user_id = 'user-a-123'
    
    # Result: No rows (resume belongs to user-b, not user-a)
    
    if not result.data:
        raise HTTPException(404, "Analysis not found")
        # ↑ Generic message - doesn't reveal if resume exists
```

**Result**: User A cannot access User B's data! ✅

---

## Testing & Verification

### Manual Testing

#### Test 1: Unauthenticated Request
```bash
# Should fail with 401
curl -X POST http://localhost:8000/api/upload-resume \
  -F "file=@test-resume.pdf"

# Expected response:
# {
#   "detail": "Missing authentication credentials"
# }
```

#### Test 2: Invalid Token
```bash
# Should fail with 401
curl -X POST http://localhost:8000/api/upload-resume \
  -H "Authorization: Bearer fake-token-123" \
  -F "file=@test-resume.pdf"

# Expected response:
# {
#   "detail": "Could not validate authentication credentials"
# }
```

#### Test 3: Valid Authentication

**Step 1: Get JWT token**
```typescript
// In browser console on http://localhost:5173
const { data: { session } } = await supabase.auth.getSession()
console.log(session.access_token)
// Copy the token
```

**Step 2: Test with curl**
```bash
TOKEN="<paste-your-token-here>"

curl -X POST http://localhost:8000/api/upload-resume \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-resume.pdf"

# Expected response:
# {
#   "resume_id": "uuid-here",
#   "file_url": "https://...",
#   "parsed_text": "..."
# }
```

#### Test 4: Browser Network Tab

1. Open http://localhost:5173
2. Log in
3. Upload a resume
4. Open Developer Tools → Network tab
5. Find the `/api/upload-resume` request
6. Check Request Headers:
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
7. Verify response is successful

### Automated Testing (Future)

```python
# tests/test_auth.py
import pytest
from fastapi.testclient import TestClient

def test_upload_without_auth():
    """Test that upload fails without authentication"""
    response = client.post("/api/upload-resume", files={"file": file})
    assert response.status_code == 401
    assert "authentication" in response.json()["detail"].lower()

def test_upload_with_invalid_token():
    """Test that upload fails with invalid token"""
    response = client.post(
        "/api/upload-resume",
        headers={"Authorization": "Bearer fake-token"},
        files={"file": file}
    )
    assert response.status_code == 401

def test_upload_with_valid_token():
    """Test that upload succeeds with valid token"""
    token = get_test_jwt_token()  # Helper to get valid token
    response = client.post(
        "/api/upload-resume",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": file}
    )
    assert response.status_code == 200
    assert "resume_id" in response.json()

def test_cross_user_access():
    """Test that users cannot access other users' data"""
    # User A uploads resume
    user_a_token = get_token_for_user_a()
    upload_response = client.post(
        "/api/upload-resume",
        headers={"Authorization": f"Bearer {user_a_token}"},
        files={"file": file}
    )
    resume_id = upload_response.json()["resume_id"]
    
    # User B tries to access User A's resume
    user_b_token = get_token_for_user_b()
    get_response = client.get(
        f"/api/resume/{resume_id}",
        headers={"Authorization": f"Bearer {user_b_token}"}
    )
    assert get_response.status_code == 404  # Not found (for User B)
```

---

## Troubleshooting

### Issue 1: "Missing authentication credentials"

**Cause**: Frontend not sending Authorization header

**Check**:
1. Is user logged in? Check `supabase.auth.getSession()`
2. Is `getAuthHeaders()` being called?
3. Check browser Network tab - is Authorization header present?

**Fix**:
```typescript
// Make sure API functions call getAuthHeaders()
const headers = await getAuthHeaders()
const response = await fetch(url, { headers })
```

### Issue 2: "Could not validate authentication credentials"

**Cause**: JWT token is invalid or expired

**Check**:
1. Is `SUPABASE_JWT_SECRET` correct in backend `.env`?
2. Copy JWT secret from Supabase Dashboard → Settings → API → JWT Settings
3. Is token expired? JWT tokens expire after 1 hour

**Fix**:
1. Verify JWT secret matches Supabase
2. User should log in again to get fresh token
3. Supabase auto-refreshes tokens if refresh token is valid

### Issue 3: Token works but user gets 404 for their own data

**Cause**: Database queries might not be filtering correctly

**Check**:
```python
# Debug: Log the user_id being used
logger.info(f"Querying for user: {current_user}")

result = supabase.table("resumes").select("*").eq("user_id", current_user).execute()

logger.info(f"Found {len(result.data)} resumes")
```

**Common mistake**:
```python
# ❌ Wrong: Not filtering by user
result = supabase.table("resumes").select("*").eq("id", resume_id).execute()

# ✅ Correct: Filter by both ID and user
result = supabase.table("resumes").select("*").eq("id", resume_id).eq("user_id", current_user).execute()
```

### Issue 4: CORS errors with Authorization header

**Symptom**: OPTIONS preflight request fails

**Fix**: Ensure CORS middleware allows Authorization header
```python
# main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],  # ← Allows Authorization header
)
```

### Issue 5: Token decoding error

**Error**: `JWTError: Invalid signature`

**Cause**: Wrong JWT secret

**Fix**:
1. Get correct secret from Supabase Dashboard
2. Make sure `.env` file is being loaded
3. Restart backend server after changing `.env`

**Verify**:
```python
# In Python console
from core.config import settings
print(settings.SUPABASE_JWT_SECRET[:10] + "...")  # Don't print full secret!
```

---

## Summary

### What We Implemented

1. ✅ **JWT Authentication** - Every protected endpoint validates tokens
2. ✅ **User Authorization** - Users can only access their own data
3. ✅ **Secure Token Validation** - Signature, expiration, audience checks
4. ✅ **Frontend Integration** - Automatic token sending
5. ✅ **Error Handling** - Proper 401/403 responses
6. ✅ **Logging** - All auth events logged
7. ✅ **Rate Limiting** - Works alongside authentication

### Security Architecture

```
┌──────────────────────────────────────────────────────────┐
│              Multi-Layer Security                        │
├──────────────────────────────────────────────────────────┤
│ Layer 1: Supabase Auth (JWT issuance)                   │
│ Layer 2: HTTPS (in production)                          │
│ Layer 3: Rate Limiting (IP-based)                       │
│ Layer 4: JWT Validation (backend/core/auth.py)          │
│ Layer 5: Authorization (database queries filter by user)│
│ Layer 6: RLS Policies (database-level)                  │
└──────────────────────────────────────────────────────────┘
```

### Key Takeaways

1. **Authentication** = Proving who you are (JWT token)
2. **Authorization** = Proving what you can access (user ID in queries)
3. **Trust Nothing** = Validate tokens, never trust user input for identity
4. **Defense in Depth** = Multiple security layers protect data
5. **Fail Securely** = 401 errors don't leak information

---

**Documentation Complete** ✅  
**Implementation Status**: PRODUCTION READY 🟢  
**Last Updated**: 2026-06-25
