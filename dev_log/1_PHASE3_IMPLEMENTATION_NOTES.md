# Phase 3 Implementation Notes

**Date:** 2025-01-18  
**Status:** ✅ Complete

## Summary

Successfully converted the OAP Next.js application at `arc_static_frontend` to a fully static SPA that integrates with the FastAPI backend.

---

## Changes Made

### 1. Configure Static Export

**File:** `apps/web/next.config.mjs`

```javascript
const nextConfig = {
  output: 'export',           // Export as static site
  trailingSlash: true,        // Better static hosting
  images: {
    unoptimized: true,        // Required for static export
  },
};
```

### 2. Auth Callback Migration

**Deleted:** `src/app/api/auth/callback/route.ts` (server-side route)

**Created:** `src/app/auth/callback/page.tsx` (client-side page)

- Uses Supabase's built-in PKCE flow for client-side OAuth
- Automatically handles token exchange and storage
- No new dependencies (already using `@supabase/ssr`)

### 3. API Route Updates

**Updated files to use FastAPI backend (`/api/` prefix):**

- `src/lib/client.ts` - LangGraph client proxy path
- `src/providers/Agents.tsx` - Defaults endpoint path
- `src/hooks/use-mcp.tsx` - MCP proxy path

**Changes:**
- `/langgraph/proxy/${deploymentId}` → `/api/langgraph/proxy/${deploymentId}`
- `/langgraph/defaults` → `/api/langgraph/defaults`
- `/oap_mcp` → `/api/oap_mcp`

### 4. Removed Server-Side Code

**Deleted:**
- `src/app/api/` - All API routes (replaced by FastAPI)
- `src/middleware.ts` - Next.js middleware
- `src/lib/auth/middleware.ts` - Auth middleware
- `src/app/debug-auth/` - Debug route

### 5. Client-Side Auth Protection

**Created:** `src/components/auth/auth-guard.tsx`

- Replaces server-side middleware
- Redirects unauthenticated users client-side
- Shows loading state during auth check

**Updated:** `src/app/(app)/layout.tsx`

- Wrapped protected routes with `<AuthGuard>`
- Maintains auth state via `AuthProvider`

### 6. Environment Configuration

**Created:** `apps/web/.env.local` (for build)

Required environment variables:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_BASE_API_URL=http://localhost:8000
NEXT_PUBLIC_DEPLOYMENTS=[{"id":"...","deploymentUrl":"..."}]
NEXT_PUBLIC_USE_LANGSMITH_AUTH=false
NEXT_PUBLIC_MCP_SERVER_URL=http://localhost:8001
NEXT_PUBLIC_MCP_AUTH_REQUIRED=false
```

---

## Build Results

✅ **Build successful**

```
Route (app)                                 Size  First Load JS
┌ ○ /                                      38 kB         649 kB
├ ○ /_not-found                            982 B         109 kB
├ ○ /agents                              19.5 kB         425 kB
├ ○ /auth/callback                         641 B         147 kB
├ ○ /forgot-password                     5.83 kB         163 kB
├ ○ /inbox                               23.6 kB         526 kB
├ ○ /rag                                 10.2 kB         313 kB
├ ○ /reset-password                      1.27 kB         175 kB
├ ○ /settings                            3.27 kB         157 kB
├ ○ /signin                              7.69 kB         165 kB
├ ○ /signup                              2.37 kB         180 kB
├ ○ /tools                                6.4 kB         246 kB
└ ○ /tools/playground                    16.8 kB         278 kB

Output: out/ (6.5MB, all static files)
```

---

## Issues Encountered & Fixes

### Issue 1: API Routes Not Found (404)

**Problem:** Frontend was calling backend without `/api/` prefix.

**Solution:** Updated all API calls to include `/api/` prefix:
- `${baseApiUrl}/langgraph/...` → `${baseApiUrl}/api/langgraph/...`
- `${baseApiUrl}/oap_mcp` → `${baseApiUrl}/api/oap_mcp`

### Issue 2: Build Failed - Missing Environment Variables

**Problem:** Static export requires all env vars at build time.

**Solution:** Created `.env.local` with dummy values for build process. Actual values are set in production deployment configuration.

### Issue 3: Auth Callback Requires Server

**Problem:** OAuth callback traditionally needs server-side route.

**Solution:** Implemented client-side callback using Supabase's PKCE flow:
- Supabase client detects auth code in URL
- Automatically exchanges for session
- Stores tokens in localStorage
- No server needed

---

## Next Steps (Phase 4)

1. **Local Integration Testing:**
   - Start FastAPI backend: `cd arc_fastapi_backend && uv run uvicorn main:app --reload --port 8000`
   - Serve static frontend: `cd arc_static_frontend/apps/web && npx serve -s out -l 3000`
   - Test all features end-to-end

2. **Containerization:**
   - Create Dockerfile for FastAPI backend
   - Test with docker-compose
   - Deploy to AWS ECS Fargate

3. **Production Deployment:**
   - Deploy static frontend to CloudFront/Vercel
   - Deploy backend to AWS ECS
   - Configure environment variables
   - Update Supabase redirect URLs

---

## Verification Checklist

- [x] Static export configured in `next.config.mjs`
- [x] Auth callback converted to client-side
- [x] API routes updated with `/api/` prefix
- [x] Server-side code removed
- [x] Client-side auth guard implemented
- [x] Build succeeds without errors
- [x] Output directory contains only static files
- [ ] Local integration test (pending - Phase 4)
- [ ] All features work end-to-end (pending - Phase 4)

---

## Architecture Changes

**Before:**
```
Next.js App (Server + Client)
├── API Routes (/api/*)
├── Middleware (auth)
├── Pages (SSR/SSG)
└── Client Components
```

**After:**
```
Static Frontend                FastAPI Backend
├── Pages (Static HTML)  →→→  ├── /api/langgraph/*
├── Client Components          ├── /api/oap_mcp/*
└── Auth (Client-side)         └── /health
```

**Benefits:**
- ✅ True static frontend (CDN-ready)
- ✅ Independent backend scaling
- ✅ Simpler deployment
- ✅ Reduced hosting costs
- ✅ Better security (server secrets isolated)

