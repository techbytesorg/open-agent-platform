# Local Integration Testing Guide

This guide explains how to test the static frontend with the FastAPI backend locally.

---

## Prerequisites

1. **FastAPI Backend** is running (from Phase 1-2)
2. **Static Frontend** is built (Phase 3 complete)
3. Valid environment variables configured

---

## Step 1: Start FastAPI Backend

```bash
cd /home/tim_yung/SynologyDrive/1_projects/47_m2m_open_agent_platform/arc_fastapi_backend

# Make sure you have a .env file with real credentials
# Copy from .env.example if needed

# Start the backend
uv run uvicorn main:app --reload --port 8000
```

**Expected output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**Test the backend:**
```bash
# In a new terminal
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-18T...",
  "environment": "development",
  "version": "1.0.0"
}
```

---

## Step 2: Serve Static Frontend

### Option A: Using npx serve (Recommended for testing)

```bash
cd /home/tim_yung/SynologyDrive/1_projects/47_m2m_open_agent_platform/arc_static_frontend/apps/web

# Serve the static build
npx serve -s out -l 3000
```

**Expected output:**
```
   ┌───────────────────────────────────┐
   │                                   │
   │   Serving!                        │
   │                                   │
   │   Local:  http://localhost:3000   │
   │                                   │
   └───────────────────────────────────┘
```

### Option B: Using development mode (faster iteration)

```bash
cd /home/tim_yung/SynologyDrive/1_projects/47_m2m_open_agent_platform/arc_static_frontend/apps/web

# Start dev server (hot reload enabled)
yarn dev
```

**Note:** Make sure `.env.local` has the correct `NEXT_PUBLIC_BASE_API_URL=http://localhost:8000`

---

## Step 3: Configure Environment Variables

Before testing, ensure your `.env.local` has **real credentials** (not the dummy build values):

```bash
cd /home/tim_yung/SynologyDrive/1_projects/47_m2m_open_agent_platform/arc_static_frontend/apps/web

# Edit .env.local with your real values
nano .env.local
```

**Required values:**
```env
# Real Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-real-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_real_anon_key

# Backend API
NEXT_PUBLIC_BASE_API_URL=http://localhost:8000

# Real deployment configuration
NEXT_PUBLIC_DEPLOYMENTS=[{"id":"your-real-deployment-id","deploymentUrl":"https://your-langgraph-url","tenantId":"your-tenant","name":"Production","isDefault":true,"defaultGraphId":"your-graph-id"}]

# Auth mode (false = use Supabase user tokens)
NEXT_PUBLIC_USE_LANGSMITH_AUTH=false

# Optional: MCP server
NEXT_PUBLIC_MCP_SERVER_URL=http://localhost:8001
NEXT_PUBLIC_MCP_AUTH_REQUIRED=false
```

**After editing, rebuild if using static serve:**
```bash
yarn build
npx serve -s out -l 3000
```

---

## Step 4: Update Supabase Redirect URLs

In your Supabase dashboard:

1. Go to **Authentication** → **URL Configuration**
2. Add redirect URLs:
   - `http://localhost:3000/auth/callback` (for local testing)
   - `http://localhost:5173/auth/callback` (if using dev mode on different port)
3. Save changes

---

## Step 5: Run Integration Tests

Open **http://localhost:3000** in your browser and test the following:

### 5.1 Authentication Flow

- [ ] Navigate to http://localhost:3000
- [ ] Should redirect to `/signin` (auth guard working)
- [ ] Click "Sign In"
- [ ] Enter credentials
- [ ] Should redirect to `/auth/callback` briefly
- [ ] Should complete auth and redirect to home `/`
- [ ] User should be logged in

### 5.2 Agent Operations

- [ ] Navigate to `/agents`
- [ ] Agents list loads from backend
- [ ] Can create new agent
- [ ] Can edit agent
- [ ] Can delete agent

### 5.3 Chat Functionality

- [ ] Select an agent
- [ ] Start a chat
- [ ] Send a message
- [ ] Streaming responses appear correctly
- [ ] Messages persist

### 5.4 Tools

- [ ] Navigate to `/tools`
- [ ] Tools list loads
- [ ] Navigate to `/tools/playground`
- [ ] Can execute a tool
- [ ] Results display correctly

### 5.5 RAG Collections

- [ ] Navigate to `/rag`
- [ ] Collections list loads
- [ ] Can create collection
- [ ] Can upload documents
- [ ] Can search collection

### 5.6 MCP Integration (if enabled)

- [ ] MCP tools load
- [ ] Can execute MCP tool
- [ ] Results return correctly

---

## Step 6: Check Browser Console

Open browser DevTools (F12) and check:

1. **No 404 errors** for API routes
2. **No CORS errors**
3. **Auth tokens** are being sent with requests
4. **Network tab** shows requests going to `http://localhost:8000/api/*`

---

## Step 7: Check Backend Logs

In the terminal running FastAPI, you should see:

```
INFO:     127.0.0.1:xxxxx - "GET /api/langgraph/defaults?deploymentId=... HTTP/1.1" 200 OK
INFO:     127.0.0.1:xxxxx - "POST /api/langgraph/proxy/.../threads HTTP/1.1" 200 OK
```

---

## Troubleshooting

### Issue: Frontend can't reach backend

**Symptoms:** CORS errors, connection refused

**Fix:**
1. Verify backend is running on port 8000
2. Check `NEXT_PUBLIC_BASE_API_URL` in `.env.local`
3. Ensure CORS is enabled in FastAPI (check `config.py`)

### Issue: Authentication fails

**Symptoms:** Redirect loop, "Invalid token" errors

**Fix:**
1. Verify Supabase credentials are correct
2. Check redirect URL is configured in Supabase
3. Clear browser cookies and localStorage
4. Try signing in again

### Issue: 404 on API routes

**Symptoms:** `/api/langgraph/*` returns 404

**Fix:**
1. Verify backend is running
2. Check API prefix is `/api/` in frontend code
3. Test backend directly: `curl http://localhost:8000/health`

### Issue: Streaming doesn't work

**Symptoms:** Messages don't appear character-by-character

**Fix:**
1. Check browser console for errors
2. Verify backend streaming endpoint works
3. Test with curl: `curl http://localhost:8000/api/langgraph/proxy/.../threads/.../stream`

---

## Success Criteria

✅ All tests pass  
✅ No console errors  
✅ Backend logs show successful requests  
✅ Authentication flow works end-to-end  
✅ All features functional  

---

## Next Steps

Once local integration testing is successful:

1. **Phase 4:** Containerize the FastAPI backend
2. **Phase 5:** Deploy to production (AWS ECS + CloudFront)

---

## Notes

- The static build is in `arc_static_frontend/apps/web/out/`
- Backend logs are helpful for debugging API issues
- Use browser DevTools Network tab to inspect requests
- If you make code changes, rebuild with `yarn build`

