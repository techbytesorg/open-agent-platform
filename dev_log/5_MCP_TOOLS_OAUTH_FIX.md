# MCP Tools OAuth Token Exchange Fix

**Date:** November 19, 2025  
**Issue:** Agents cannot use MCP tools even when selected during creation  
**Root Cause:** Supabase token not forwarded to LangGraph when using proxy route  
**Status:** ✅ Fixed

## Problem

After Phase 3 static frontend transformation, agents could chat and use RAG, but MCP tools were not working. The agents couldn't perform OAuth token exchange to get MCP access tokens.

## Root Cause Analysis

### The Issue

When using the FastAPI proxy route (`useProxyRoute: true`), the frontend was:
1. ✅ Sending `x-auth-scheme: langsmith` header
2. ❌ **NOT** sending the Supabase token

The FastAPI backend was:
1. ❌ Replacing the Authorization header with LangSmith API key
2. ❌ **NOT** forwarding the Supabase token to LangGraph

### Why This Breaks MCP Tools

LangGraph agents need the Supabase token to:
1. Authenticate with the MCP server
2. Perform OAuth token exchange (`Supabase JWT → MCP access token`)
3. Access MCP tools that require authentication

The token must be available in `config["configurable"]["x-supabase-access-token"]` for the agent's `fetch_tokens()` function to work.

## Solution

### Frontend Changes

**File:** `arc_static_frontend/apps/web/src/features/chat/providers/Stream.tsx`

**Before:**
```typescript
defaultHeaders: {
  ...(!useProxyRoute
    ? {
        Authorization: `Bearer ${accessToken}`,
        "x-supabase-access-token": accessToken,
      }
    : {
        "x-auth-scheme": "langsmith",  // ❌ No Supabase token!
      }),
},
```

**After:**
```typescript
defaultHeaders: {
  ...(useProxyRoute && accessToken
    ? {
        // When using proxy route, still send Supabase token so backend can forward it to LangGraph
        // This is needed for MCP tools OAuth token exchange
        Authorization: `Bearer ${accessToken}`,
        "x-supabase-access-token": accessToken,
        "x-auth-scheme": "langsmith",
      }
    : !useProxyRoute && accessToken
    ? {
        Authorization: `Bearer ${accessToken}`,
        "x-supabase-access-token": accessToken,
      }
    : {
        "x-auth-scheme": "langsmith",
      }),
},
```

**File:** `arc_static_frontend/apps/web/src/lib/client.ts`

**Before:**
```typescript
if (!accessToken || process.env.NEXT_PUBLIC_USE_LANGSMITH_AUTH === "true") {
  const baseApiUrl = getBaseApiUrl();
  const client = new Client({
    apiUrl: `${baseApiUrl}/api/langgraph/proxy/${deploymentId}`,
    defaultHeaders: {
      "x-auth-scheme": "langsmith",  // ❌ No Supabase token!
    },
  });
  return client;
}
```

**After:**
```typescript
if (!accessToken || process.env.NEXT_PUBLIC_USE_LANGSMITH_AUTH === "true") {
  const baseApiUrl = getBaseApiUrl();
  const client = new Client({
    apiUrl: `${baseApiUrl}/api/langgraph/proxy/${deploymentId}`,
    defaultHeaders: {
      "x-auth-scheme": "langsmith",
      // Still send Supabase token if available for MCP tools OAuth token exchange
      ...(accessToken && {
        Authorization: `Bearer ${accessToken}`,
        "x-supabase-access-token": accessToken,
      }),
    },
  });
  return client;
}
```

### Backend Changes

**File:** `arc_fastapi_backend/api/langgraph/routes.py`

**Before:**
```python
# Prepare headers
headers = dict(request.headers)
headers.pop("host", None)
# Add LangSmith API key for authentication
headers["Authorization"] = f"Bearer {settings.LANGSMITH_API_KEY}"  # ❌ Always replaces!
```

**After:**
```python
# Prepare headers
headers = dict(request.headers)
headers.pop("host", None)

# Forward Supabase token if present (needed for MCP tools OAuth token exchange)
# LangGraph agents need x-supabase-access-token header to access token in configurable fields
authorization_header = request.headers.get("authorization", "")
x_supabase_token = request.headers.get("x-supabase-access-token")

# Extract token value from Authorization header if present
supabase_token_value = None
if authorization_header.startswith("Bearer "):
    supabase_token_value = authorization_header.replace("Bearer ", "").strip()
elif x_supabase_token:
    supabase_token_value = x_supabase_token

if supabase_token_value:
    # Forward Supabase token to LangGraph for agent authentication and MCP tools
    headers["Authorization"] = f"Bearer {supabase_token_value}"
    # Ensure x-supabase-access-token is present so it gets into configurable fields
    # This is critical for MCP tools OAuth token exchange
    headers["x-supabase-access-token"] = supabase_token_value
else:
    # Fallback to LangSmith API key if no Supabase token
    headers["Authorization"] = f"Bearer {settings.LANGSMITH_API_KEY}"
```

## How It Works Now

1. **Frontend** sends Supabase token in both `Authorization` and `x-supabase-access-token` headers when using proxy route
2. **FastAPI Backend** forwards both headers to LangGraph (doesn't replace with LangSmith API key)
3. **LangGraph Platform** puts `x-supabase-access-token` into `config["configurable"]` (via `langgraph.json` config)
4. **Agent** accesses token via `config.get("configurable", {}).get("x-supabase-access-token")`
5. **Agent** performs OAuth token exchange: `Supabase JWT → MCP access token`
6. **Agent** uses MCP tools with the exchanged token ✅

## Testing

To verify the fix works:

1. Create an agent with MCP tools selected
2. Start a chat with the agent
3. Ask the agent to use an MCP tool
4. Check backend logs for:
   - `[MCP] Authentication required, fetching tokens...`
   - `[MCP] Token fetch successful`
   - `[MCP] Added tool: <tool_name>`
5. Verify the agent successfully uses the MCP tool

## Files Modified

### Frontend
- `apps/web/src/features/chat/providers/Stream.tsx` - Send Supabase token when using proxy route
- `apps/web/src/lib/client.ts` - Send Supabase token in LangGraph client

### Backend
- `api/langgraph/routes.py` - Forward Supabase token to LangGraph instead of replacing with LangSmith API key

## Related Documentation

- `overview/supabase-token-handling.md` - Detailed explanation of token flow
- `dev_log/4_MCP_AUTH_AND_PROXY_DEBUGGING.md` - MCP authentication debugging

