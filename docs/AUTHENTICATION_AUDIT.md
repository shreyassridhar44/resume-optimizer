# Authentication & Authorization Security Audit

## 🔍 Audit Date: 2026-06-25

## Executive Summary

⚠️ **CRITICAL SECURITY ISSUES FOUND** ⚠️

The application has **MAJOR authentication and authorization vulnerabilities** that could allow:
1. **Unauthorized data access** - Any user can access any other user's data
2. **No token validation** - Backend doesn't verify JWT tokens from Supabase
3. **Trust-based security** - Backend blindly trusts `user_id` from request bodies
4. **Storage bucket exposure** - Anyone can access uploaded resume files

**Risk Level**: 🔴 **CRITICAL**

---

## Issues Found

### 🚨 CRITICAL: No Authentication Middleware

**File**: `backend/main.py`, All routers

**Problem**: 
- Backend has **NO authentication middleware** to verify JWT tokens
- All endpoints trust the `user_id` parameter from request body/query
- Anyone can fake a `user_id` and access other users' data

**Example Vulnerable Code**:
```python
# backend/routers/resume.py
@router.post("/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    user_id: str = Form(...),  # ❌ NO VERIFICATION - Can be faked!
):
    # Trusts user_id without checking JWT token
    ...
```

**Attack Scenario**:
```bash
# Attacker can upload resume as ANY user
curl -X POST http://localhost:8000/api/upload-resume \
  -F "file=@malicious.pdf" \
  -F "user_id=victim-uuid-here"  # ❌ No validation!
```

---

### 🚨 CRITICAL: No Authorization Checks in Storage Layer

**File**: `backend/services/storage.py`

**Problem**:
- Functions like `get_resume_text()`, `save_analysis()`, `get_analysis_by_id()` check `user_id` parameter
- BUT the `user_id` is never validated against an actual authenticated user
- Attacker can provide any `user_id` and bypass these checks

**Example**:
```python
# backend/services/storage.py
async def get_resume_text(resume_id: str, user_id: str) -> str:
    # Queries WHERE user_id = user_id
    # But user_id is from untrusted input! ❌
    result = (
        supabase.table("resumes")
        .select("parsed_text")
        .eq("id", resume_id)
        .eq("user_id", user_id)  # ❌ Trusts attacker-supplied value
        .single()
        .execute()
    )
```

---

### 🚨 HIGH: Backend Uses Service Role Key for All Operations

**File**: `backend/core/supabase.py`

**Problem**:
- Backend uses `SUPABASE_SERVICE_KEY` which **bypasses Row-Level Security (RLS)**
- Even though RLS policies exist in database, they're ineffective because service key bypasses them
- Should use user's JWT token to enforce RLS policies

**Current Code**:
```python
# backend/core/supabase.py
def get_supabase_client() -> Client:
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_KEY  # ❌ Bypasses RLS!
    )
```

---

### 🚨 MEDIUM: Storage Bucket RLS Policies Exist But Are Bypassed

**File**: `supabase_schema.sql`

**Problem**:
- Storage RLS policies are correctly defined
- But backend uses service key which bypasses these policies
- Files uploaded with service key are not properly protected

**Current Policies** (Good but ineffective):
```sql
create policy "owner_can_upload" on storage.objects
  for insert with check (
    bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

### ⚠️ MEDIUM: Frontend Sends User ID in Requests

**File**: `frontend/src/services/api.ts`

**Problem**:
- Frontend manually extracts and sends `userId` in every API call
- Should send JWT token in `Authorization` header instead
- Backend should extract user ID from validated token

**Current Code**:
```typescript
// frontend/src/services/api.ts
export async function uploadResume(file: File, userId: string) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('user_id', userId)  // ❌ Easily spoofed
  // Missing: Authorization header with JWT
```

---

## What Should Be Happening

### ✅ Proper Authentication Flow

```
1. User logs in via Supabase Auth
   ↓
2. Frontend receives JWT access token
   ↓
3. Frontend sends token in Authorization header
   ↓
4. Backend middleware validates JWT token
   ↓
5. Backend extracts user_id from validated token
   ↓
6. Backend uses user_id for authorization checks
```

### ✅ Proper Backend Setup

**Should have authentication dependency**:
```python
from fastapi import Depends, HTTPException, Header
from jose import jwt, JWTError

async def get_current_user(authorization: str = Header(...)) -> str:
    """Extract and validate user from JWT token."""
    try:
        # Extract token from "Bearer <token>"
        token = authorization.replace("Bearer ", "")
        
        # Verify JWT with Supabase public key
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated"
        )
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication")
```

**Protected endpoint example**:
```python
@router.post("/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    current_user: str = Depends(get_current_user),  # ✅ Validated!
):
    # Use current_user instead of trusting form data
    file_url = await upload_resume_file(file_bytes, filename, current_user)
    ...
```

---

## Required Fixes

### 🔧 FIX 1: Add JWT Authentication Middleware

**Priority**: 🔴 CRITICAL

**Files to Create/Modify**:
- `backend/core/auth.py` - New file for auth dependencies
- `backend/core/config.py` - Add JWT secret
- All routers - Add `Depends(get_current_user)`

**Implementation**:

1. Add to `.env`:
```bash
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase-settings
```

2. Create `backend/core/auth.py`:
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from core.config import settings
from core.logging_config import get_logger

logger = get_logger("auth")
security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """
    Extract and validate user ID from Supabase JWT token.
    This ensures only authenticated users can access endpoints.
    """
    try:
        token = credentials.credentials
        
        # Decode and verify JWT
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        
        user_id: str = payload.get("sub")
        if not user_id:
            logger.warning("Token missing user ID (sub)")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )
        
        logger.debug(f"Authenticated user: {user_id[:8]}...")
        return user_id
    
    except JWTError as e:
        logger.warning(f"JWT validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
```

3. Update all routers to use dependency:
```python
from core.auth import get_current_user
from fastapi import Depends

@router.post("/upload-resume")
async def upload_resume(
    request: Request,
    file: UploadFile = File(...),
    current_user: str = Depends(get_current_user),  # ✅ Validated!
):
    # Remove user_id from Form parameters
    # Use current_user everywhere instead
    ...
```

---

### 🔧 FIX 2: Update Frontend to Send JWT Tokens

**Priority**: 🔴 CRITICAL

**Files to Modify**:
- `frontend/src/services/api.ts`

**Implementation**:

```typescript
// frontend/src/services/api.ts
import { supabase } from '../lib/supabase'

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.access_token) {
    throw new Error('Not authenticated')
  }
  
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

export async function uploadResume(file: File): Promise<ResumeUploadResponse> {
  const headers = await getAuthHeaders()
  
  const fd = new FormData()
  fd.append('file', file)
  // Remove user_id - backend gets it from token

  const res = await fetch(`${BASE_URL}/upload-resume`, {
    method: 'POST',
    headers: {
      'Authorization': headers['Authorization'],  // ✅ Send JWT token
    },
    body: fd,
  })
  return handleResponse<ResumeUploadResponse>(res)
}
```

---

### 🔧 FIX 3: Use User-Context Supabase Client (Optional but Recommended)

**Priority**: 🟡 MEDIUM

**Files to Modify**:
- `backend/core/supabase.py`
- All storage functions

**Implementation**:

Instead of always using service key, create clients with user's JWT:

```python
# backend/core/supabase.py
def get_user_supabase_client(jwt_token: str) -> Client:
    """
    Create Supabase client with user's JWT token.
    This enforces Row-Level Security policies.
    """
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_ANON_KEY,  # Use anon key, not service key
        options={
            'headers': {
                'Authorization': f'Bearer {jwt_token}'
            }
        }
    )

# Use in storage functions
async def get_resume_text(resume_id: str, user_token: str) -> str:
    supabase = get_user_supabase_client(user_token)
    # RLS policies now enforce authorization! ✅
    result = supabase.table("resumes").select("parsed_text").eq("id", resume_id).single().execute()
    ...
```

---

### 🔧 FIX 4: Update API Schemas

**Priority**: 🟡 MEDIUM

**Files to Modify**:
- `backend/models/schemas.py`

**Remove `user_id` from all request schemas**:

```python
# Before (❌ Insecure)
class AnalyzeRequest(BaseModel):
    resume_id: str
    job_description: str
    user_id: str  # ❌ Remove this
    role_type: Optional[RoleType] = "general"
    persona: Optional[PersonaType] = "standard"

# After (✅ Secure)
class AnalyzeRequest(BaseModel):
    resume_id: str
    job_description: str
    # user_id comes from JWT token, not request body
    role_type: Optional[RoleType] = "general"
    persona: Optional[PersonaType] = "standard"
```

---

## Testing Authentication

### Test 1: Unauthenticated Access Should Fail

```bash
# Should return 401 Unauthorized
curl -X POST http://localhost:8000/api/upload-resume \
  -F "file=@resume.pdf"
```

### Test 2: Invalid Token Should Fail

```bash
# Should return 401 Unauthorized
curl -X POST http://localhost:8000/api/upload-resume \
  -H "Authorization: Bearer fake-token-123" \
  -F "file=@resume.pdf"
```

### Test 3: Valid Token Should Work

```bash
# Get token from Supabase
TOKEN="<valid-jwt-token>"

# Should succeed
curl -X POST http://localhost:8000/api/upload-resume \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@resume.pdf"
```

### Test 4: Cross-User Access Should Fail

```bash
# User A tries to access User B's resume
# Should return 404 or 403
curl -X GET "http://localhost:8000/api/analysis/user-b-analysis-id?user_id=user-a-id" \
  -H "Authorization: Bearer user-a-token"
```

---

## Row-Level Security (RLS) Status

### ✅ Database RLS Policies (Good!)

The Supabase schema has **excellent RLS policies**:

```sql
-- Users can only access their own resumes ✅
create policy "users_own_resumes" on public.resumes
  for all using (auth.uid() = user_id);

-- Users can only access their own analyses ✅
create policy "users_own_analyses" on public.analyses
  for all using (auth.uid() = user_id);

-- Storage: only owner can read/write ✅
create policy "owner_can_read" on storage.objects
  for select using (
    bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]
  );
```

### ❌ But Backend Bypasses RLS (Bad!)

- Backend uses `SUPABASE_SERVICE_KEY` which has **superuser privileges**
- Service key **bypasses all RLS policies**
- This defeats the purpose of having RLS policies

**Fix**: Use user's JWT token for Supabase operations (see FIX 3 above)

---

## Summary of Current State

### Authentication (Frontend) ✅

- ✅ Supabase Auth integration
- ✅ JWT tokens generated
- ✅ Session management
- ✅ Auto-refresh tokens
- ❌ Tokens not sent to backend

### Authorization (Backend) ❌

- ❌ No JWT validation
- ❌ Trusts user_id from requests
- ❌ Service key bypasses RLS
- ❌ No authentication middleware
- ❌ Anyone can access any data

### Database Security ✅

- ✅ RLS enabled on all tables
- ✅ Policies correctly written
- ✅ Foreign key constraints
- ❌ Policies bypassed by service key

---

## Immediate Action Required

### Phase 1: Critical Fixes (Do NOW)

1. ✅ Create `backend/core/auth.py` with JWT validation
2. ✅ Add `SUPABASE_JWT_SECRET` to `.env`
3. ✅ Add `Depends(get_current_user)` to ALL endpoints
4. ✅ Remove `user_id` from request parameters
5. ✅ Update frontend to send JWT tokens

### Phase 2: Enhanced Security (Do SOON)

1. Add request logging with authenticated user IDs
2. Implement rate limiting per authenticated user (not just IP)
3. Add audit trail for data access
4. Use user-context Supabase clients
5. Add permission checks for admin operations

### Phase 3: Monitoring (Do LATER)

1. Track failed authentication attempts
2. Alert on suspicious access patterns
3. Log all data access operations
4. Implement token refresh monitoring

---

## Risk Assessment

| Vulnerability | Risk Level | Impact | Likelihood | Priority |
|---------------|-----------|--------|------------|----------|
| No JWT validation | 🔴 Critical | High | High | P0 |
| Trust-based user_id | 🔴 Critical | High | High | P0 |
| Service key bypass | 🟠 High | High | Medium | P1 |
| Missing auth headers | 🟠 High | High | High | P0 |
| No audit logging | 🟡 Medium | Medium | Low | P2 |

---

## Compliance Notes

### Data Protection

- ❌ **GDPR**: Users can potentially access others' personal data
- ❌ **CCPA**: No proper access controls
- ❌ **SOC 2**: Authorization controls insufficient

### Best Practices

- ❌ **OWASP Top 10**: Broken authentication (#2)
- ❌ **OWASP Top 10**: Broken authorization (#5)
- ✅ **OWASP Top 10**: Sensitive data exposure mitigated by HTTPS

---

## Conclusion

**The application currently has NO effective authentication or authorization on the backend.**

While the frontend properly implements Supabase Auth and the database has good RLS policies, the backend completely bypasses all security measures by:
1. Not validating JWT tokens
2. Trusting user_id from requests
3. Using service role key that bypasses RLS

**All fixes MUST be implemented before deploying to production.**

---

**Audit Conducted By**: Kiro AI Security Analysis  
**Date**: 2026-06-25  
**Status**: 🔴 FAILED - Critical issues found  
**Next Review**: After implementing fixes
