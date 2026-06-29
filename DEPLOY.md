# Deploy to Vercel + Render (15 Minutes)

Simple step-by-step guide to deploy your Resume Optimizer.

---

## ✅ Prerequisites

- [x] Code pushed to GitHub (main branch)
- [x] Supabase working locally
- [x] Render account: https://dashboard.render.com/register
- [x] Vercel account: https://vercel.com/signup

---

## PART 1: Deploy Backend to Render (8 minutes)

### Step 1: Create New Web Service

1. Go to https://dashboard.render.com/
2. Click **"New +"** → **"Web Service"**
3. Click **"Connect account"** (if first time) → Authorize GitHub
4. Find your repository: `resume-optimizer`
5. Click **"Connect"**

### Step 2: Basic Configuration

Fill these **EXACTLY**:

```
Name: resume-optimizer-backend
Region: Oregon (US West)
Branch: main
Root Directory: backend
Runtime: Python 3
Build Command: pip install -r requirements.txt
Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
Instance Type: Free
```

⚠️ **STOP! Don't click "Create Web Service" yet!**

### Step 3: Add Environment Variables

Click **"Advanced"** button. Add these environment variables:

```bash
SUPABASE_URL
https://your-project.supabase.co

SUPABASE_SERVICE_KEY
eyJhbGci... (your service role key from Supabase)

SUPABASE_JWT_SECRET
your-jwt-secret-from-supabase

SUPABASE_BUCKET
resumes

GROQ_API_KEY
gsk_... (your Groq API key)

ALLOWED_ORIGINS
["http://localhost:5173"]

MAX_FILE_SIZE_MB
10

REQUIRE_EMAIL_VERIFICATION
false

DEBUG
false
```

**Important Notes:**
- Copy-paste exactly as shown
- `ALLOWED_ORIGINS` will be updated after frontend deployment
- All keys are case-sensitive

### Step 4: Deploy Backend

1. Click **"Create Web Service"**
2. Watch logs for "Build succeeded"
3. Wait for "Live" status (3-5 minutes)
4. **Copy your backend URL** - looks like:
   ```
   https://resume-optimizer-backend-xxxx.onrender.com
   ```
   
### Step 5: Test Backend

Open in browser:
```
https://your-backend-url.onrender.com/health
```

Should show:
```json
{"status":"ok","timestamp":1234567890.123,"version":"2.0.0"}
```

✅ **Backend deployed!** Keep this URL - you'll need it for frontend.

---

## PART 2: Deploy Frontend to Vercel (5 minutes)

### Step 1: Import Project

1. Go to https://vercel.com/dashboard
2. Click **"Add New..."** → **"Project"**
3. Find your repository: `resume-optimizer`
4. Click **"Import"**

### Step 2: Configure Project

```
Framework Preset: Vite (auto-detected)
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

⚠️ **STOP! Don't click "Deploy" yet!**

### Step 3: Add Environment Variables

Click **"Environment Variables"**. Add these 3 variables:

```bash
VITE_API_URL
https://your-backend-url.onrender.com/api

VITE_SUPABASE_URL
https://your-project.supabase.co

VITE_SUPABASE_ANON_KEY
eyJhbGci... (your anon key from Supabase)
```

**Critical:**
- `VITE_API_URL` must be YOUR Render backend URL
- Must end with `/api`
- No trailing slash after `/api`

### Step 4: Deploy Frontend

1. Click **"Deploy"**
2. Wait for "Building..." → "Deployment Ready" (2-3 minutes)
3. **Copy your frontend URL** - looks like:
   ```
   https://resume-optimizer-xxxx.vercel.app
   ```

✅ **Frontend deployed!**

---

## PART 3: Connect Frontend ↔ Backend (2 minutes)

Right now they can't talk! Let's fix CORS:

### Step 1: Update Backend CORS

1. Go back to https://dashboard.render.com/
2. Click your backend service
3. Click **"Environment"** tab (left sidebar)
4. Find `ALLOWED_ORIGINS` variable
5. Click **Edit** (pencil icon)
6. Change value to include your Vercel URL:
   ```json
   ["https://your-frontend-url.vercel.app","http://localhost:5173"]
   ```
   👆 Replace with YOUR actual Vercel URL from Part 2, Step 4
7. Click **"Save Changes"**
8. Render will auto-redeploy (2-3 minutes)

### Step 2: Wait for Redeploy

Wait until you see "Live" status again in Render.

---

## PART 4: Test Everything (2 minutes)

### Test 1: Backend Still Works
```
https://your-backend-url.onrender.com/health
```
Should return `{"status":"ok",...}`

### Test 2: Frontend Works

1. Open: `https://your-frontend-url.vercel.app`
2. Press F12 (DevTools) → Console tab
3. Try to **Register** or **Login**
4. Check console:
   - ✅ No red errors = SUCCESS!
   - ✅ Login works = SUCCESS!
   - ❌ CORS error = Check ALLOWED_ORIGINS spelling

### Test 3: Full Flow

- [ ] Register new account
- [ ] Upload a resume (PDF)
- [ ] Analyze against job description
- [ ] See results

---

## 🎉 Done!

Your app is live!

**Your URLs:**
- Frontend: `https://your-app.vercel.app`
- Backend: `https://your-backend.onrender.com`
- API Docs: `https://your-backend.onrender.com/docs`

---

## Troubleshooting

### "CORS error" in browser console

**Fix:**
1. Render → Environment → `ALLOWED_ORIGINS`
2. Make sure it includes your exact Vercel URL
3. No typos, no extra spaces
4. Example: `["https://resume-optimizer-neon.vercel.app"]`

### "Failed to fetch" / Network errors

**Check:**
1. Vercel → Settings → Environment Variables
2. `VITE_API_URL` should be your Render URL + `/api`
3. Example: `https://resume-optimizer-rin3.onrender.com/api`

### Backend returns "could not validate credentials"

**Check:**
1. Render → Environment → `SUPABASE_JWT_SECRET`
2. Should be: `2a30152d-799e-45f8-b93e-c14a4334f53f`
3. No extra spaces

### Backend takes 30 seconds to respond (first request)

**This is normal on free tier!**
- Free tier sleeps after 15 minutes
- First request wakes it up (30s delay)
- Upgrade to $7/month to remove cold starts

### Frontend shows blank page

**Check:**
1. Vercel → Deployments → Latest → View logs
2. Look for build errors
3. Common fix: Verify Root Directory = `frontend`

---

## Quick Commands

### Redeploy Backend
1. Render → Your Service → Manual Deploy → Deploy latest commit

### Redeploy Frontend
1. Vercel → Your Project → Deployments → Latest → "..." → Redeploy

### View Logs
- **Backend:** Render → Your Service → Logs
- **Frontend:** Vercel → Your Project → Deployments → View Function Logs

---

## Next Steps

After deployment works:

1. **Test on mobile** - Open URLs on phone
2. **Share with friends** - Get feedback
3. **Monitor logs** - Check for errors
4. **Add custom domain** (optional)
5. **Upgrade if needed** - Remove cold starts

---

## Need Help?

If something breaks:

1. **Check exact error message** in browser console
2. **Check backend logs** on Render
3. **Verify all URLs** match (no typos)
4. **Hard refresh** browser (Ctrl+Shift+R)

**Still stuck?** Share:
- Error message from console
- Backend logs screenshot
- Which step failed
