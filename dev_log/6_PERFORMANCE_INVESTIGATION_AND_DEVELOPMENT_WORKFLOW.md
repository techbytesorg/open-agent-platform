# Performance Investigation and Development Workflow Improvements

**Date:** 2025-11-19  
**Status:** In Progress  
**Related Issues:** App slowness after MCP tools integration

## Summary

This document covers performance investigation work, development workflow improvements, and infrastructure fixes completed during the performance debugging session.

## Issues Addressed

### 1. App Performance Degradation

**Problem:** After implementing MCP tools OAuth fix, the application became noticeably slow. Users reported ~35-second delay between submitting chat messages and seeing API calls to the LangGraph backend.

**Root Cause Identified:** MCP server has 2584 tools, causing slow responses and timeouts when fetching tool lists.

**Investigation:**
- Added performance logging to frontend (`handleSubmit` flow)
- Added performance logging to backend (proxy route timing)
- Added performance logging to MCP proxy routes
- Created backend log file for easier debugging
- Tested with test_Nov19 agent (MCP tools) vs Default Assistant (no MCP tools)

**Findings:**
- Frontend `stream.submit()` returns immediately (~1-3ms)
- POST requests to `/api/oap_mcp` (tools/list) succeed but return ~2.4MB responses (2461961 bytes)
- GET requests to `/api/oap_mcp` (SSE connections) timeout with 504 Gateway Timeout
- MCP server takes significant time to process and return 2584 tools
- 60-second timeout insufficient for large tool lists

**Solution:**
- Created separate HTTP client for MCP requests with extended timeout (180s total, 30s connect)
- Added performance logging to MCP proxy to measure actual response times
- MCP client properly cleaned up on application shutdown

**Status:** Partially resolved. POST requests now succeed with longer timeout, but GET/SSE requests still timing out. Further investigation needed for streaming connections.

### 2. Backend Connection Pooling

**Problem:** Initial performance optimization identified that `httpx.AsyncClient` was being created for every request, preventing connection reuse.

**Solution:** Implemented shared HTTP client with connection pooling:
- Created `get_http_client()` function that returns singleton client
- Configured connection pooling: `max_keepalive_connections=20`, `max_connections=100`
- Added proper cleanup in application shutdown lifecycle
- Applied to both LangGraph proxy and MCP proxy routes

**Files Modified:**
- `arc_fastapi_backend/api/langgraph/routes.py`
- `arc_fastapi_backend/api/mcp/routes.py`
- `arc_fastapi_backend/main.py`

**Expected Impact:** Reduced latency from repeated TCP handshakes, improved throughput for multiple concurrent requests.

### 3. Nginx Cookie Header Size Limit

**Problem:** Nginx was rejecting requests with "400 Bad Request - Request Header Or Cookie Too Large" error due to large cookie headers (Supabase auth tokens, analytics cookies, etc.).

**Solution:** Increased Nginx buffer sizes to handle large headers:
```nginx
client_header_buffer_size 16k;
large_client_header_buffers 8 32k;
```

**Files Modified:**
- `arc_static_frontend/arc_nginx_test/nginx.conf`

**Status:** Fixed. Nginx now handles large cookie headers without errors.

### 4. Development Workflow - Service Management

**Problem:** Starting the development environment required manually starting three services in separate terminals:
1. Frontend (npm run dev)
2. Backend (uvicorn with --reload)
3. Nginx (docker compose)

**Solution:** Created Makefile for simplified service management:

**Available Commands:**
```bash
make start      # Start all services (frontend, backend, nginx)
make stop       # Stop all services
make restart    # Restart all services
make status     # Check status of all services
make logs       # Show logs from all services
make frontend   # Start only frontend
make backend    # Start only backend
make nginx      # Start only nginx
make clean      # Stop all services and clean up
```

**Files Created:**
- `Makefile` (project root)

**Benefits:**
- Single command to start entire development environment
- Easy service status checking
- Centralized log viewing
- Individual service control when needed

## Performance Logging Implementation

### Frontend Logging

Added detailed performance logging to chat submission flow:

```typescript
[PERF] handleSubmit called at {timestamp}
[PERF] Message creation started at {timestamp}
[PERF] Tool messages processing started at {timestamp}
[PERF] Config retrieval started at {timestamp}
[PERF] Config retrieval completed at {timestamp}
[PERF] stream.submit() called at {timestamp}
[PERF] stream.submit() returned at {timestamp}
```

**Location:** `arc_static_frontend/apps/web/src/features/chat/components/thread/index.tsx`

### Backend Logging

Added performance logging to LangGraph proxy route:

```python
[PERF] LangGraph proxy request received at {timestamp}
[PERF] Sending request to LangGraph at {timestamp}
[PERF] Received response from LangGraph at {timestamp}
[PERF] LangGraph proxy request completed at {timestamp}
```

**Location:** `arc_fastapi_backend/api/langgraph/routes.py`

### MCP Proxy Logging

Added performance logging to MCP proxy route:

```python
[PERF] MCP proxy request received at {timestamp}: {method} {url}
[PERF] Sending request to MCP server at {timestamp}
[PERF] Received response from MCP server at {timestamp}: {status} (took {duration}s)
[PERF] MCP proxy request completed at {timestamp} (total time: {duration}s)
```

**Location:** `arc_fastapi_backend/api/mcp/routes.py`

### Backend Log File

Configured backend to write logs to file for easier debugging:
- Log file: `arc_fastapi_backend/logs/backend.log`
- Logs both to console (stdout) and file
- Enables filtering and analysis of performance logs

**Location:** Backend logs written to file when started via Makefile

## HTTP Request Interception Attempts

Attempted to intercept HTTP requests to identify delay source:

1. **Fetch Interceptor:** Intercepted `window.fetch` calls
2. **XMLHttpRequest Interceptor:** Intercepted `XMLHttpRequest` calls
3. **EventSource Interceptor:** Intercepted `EventSource` (SSE) connections

**Status:** Interceptors installed but not capturing LangGraph SDK requests, suggesting:
- SDK uses custom HTTP client (not fetch/XHR/EventSource)
- SDK delays request internally before sending
- Request may be sent via different mechanism

**Location:** `arc_static_frontend/apps/web/src/features/chat/components/thread/index.tsx`

## Next Steps

1. **MCP Server Optimization:**
   - Investigate why GET/SSE requests timeout (may need different timeout or connection handling)
   - Consider MCP server-side optimizations for large tool lists (pagination, caching, lazy loading)
   - Evaluate if all 2584 tools need to be loaded at once

2. **Connection Handling:**
   - Review SSE connection timeout configuration
   - Consider streaming/chunked responses for large tool lists
   - Monitor MCP server response times with performance logs

3. **Production Readiness:**
   - Test with production MCP server configuration
   - Monitor connection pool metrics and timeout rates
   - Verify nginx configuration handles large responses

## Files Modified

### Frontend
- `arc_static_frontend/apps/web/src/features/chat/components/thread/index.tsx` - Performance logging and HTTP interceptors
- `arc_static_frontend/arc_nginx_test/nginx.conf` - Increased buffer sizes for large headers

### Backend
- `arc_fastapi_backend/api/langgraph/routes.py` - Performance logging and connection pooling
- `arc_fastapi_backend/api/mcp/routes.py` - Performance logging, separate HTTP client with 180s timeout for MCP requests
- `arc_fastapi_backend/main.py` - HTTP client cleanup in shutdown lifecycle (both LangGraph and MCP clients)

### Infrastructure
- `Makefile` - Development workflow automation

## Testing

### Manual Testing
1. Start services: `make start`
2. Check status: `make status`
3. Submit chat message and observe console logs
4. Check backend logs: `make logs` or `tail -f arc_fastapi_backend/logs/backend.log`

### Verification
- ✅ Backend connection pooling implemented
- ✅ Nginx handles large cookie headers
- ✅ Makefile simplifies development workflow
- ✅ Performance logging in place (frontend, backend, MCP proxy)
- ✅ MCP HTTP client with extended timeout (180s) for large tool lists
- ⚠️ GET/SSE requests to MCP server still timing out (504 errors)
- ⚠️ Root cause: MCP server has 2584 tools causing slow responses

## Notes

- Performance logging adds minimal overhead but provides valuable debugging information
- Makefile runs services in background; use individual terminals for detailed log viewing during active development
- Backend log file rotates; consider log rotation for production
- HTTP interceptors can be removed once performance issue is resolved

---

**Signed off by:** Auto (AI Assistant)  
**Date:** 2025-11-19

