import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Tool } from "@/types/tool";
import { useState, useRef, useEffect, useCallback } from "react";
import { getBaseApiUrl } from "@/lib/api-url";

function getMCPUrlOrThrow() {
  const baseUrl = getBaseApiUrl();
  const url = new URL(baseUrl);
  url.pathname = `${url.pathname}${url.pathname.endsWith("/") ? "" : "/"}api/oap_mcp`;
  return url;
}

/**
 * Custom hook for interacting with the Model Context Protocol (MCP).
 * Provides functions to connect to an MCP server and list available tools.
 * 
 * IMPORTANT: This hook reuses the same MCP client instance across all requests
 * to avoid creating multiple sessions. Each new session triggers server-side
 * resource allocation (idle server conversion, cache warming), so reusing
 * the client is critical for performance.
 */
export default function useMCP({
  name,
  version,
  accessToken,
}: {
  name: string;
  version: string;
  accessToken?: string;
}) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [cursor, setCursor] = useState("");
  
  // Store the MCP client instance to reuse across requests
  const clientRef = useRef<Client | null>(null);
  // Track if a connection is in progress to prevent race conditions
  const connectingRef = useRef<Promise<Client> | null>(null);
  // Track the access token used to create the current client
  const clientAccessTokenRef = useRef<string | undefined>(undefined);
  
  // Disconnect and clean up the client when access token changes
  useEffect(() => {
    // If access token changed and we have an existing client, disconnect it
    if (clientRef.current && clientAccessTokenRef.current !== accessToken) {
      console.warn("[useMCP] Access token changed, disconnecting existing client");
      clientRef.current.close().catch(() => {});
      clientRef.current = null;
      connectingRef.current = null;
    }
  }, [accessToken]);

  /**
   * Internal function to create a new MCP client connection.
   * This should not be called directly - use getOrCreateMCPClient instead.
   */
  const createMCPClientInternal = async (): Promise<Client> => {
    const url = getMCPUrlOrThrow();
    
    console.warn("[useMCP] Creating NEW MCP client:", {
      hasAccessToken: !!accessToken,
      accessTokenPreview: accessToken ? accessToken.substring(0, 20) + "..." : "none",
      url: url.toString(),
    });
    
    // Prepare transport options with authentication header if available
    const transportOptions: {
      requestInit?: RequestInit;
    } = {};
    
    if (accessToken) {
      transportOptions.requestInit = {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        // Include credentials (cookies) for same-origin requests
        credentials: "include",
      };
    } else {
      // Still include credentials even without auth token (for cookie-based auth)
      transportOptions.requestInit = {
        credentials: "include",
      };
    }
    
    const connectionClient = new StreamableHTTPClientTransport(
      new URL(url),
      transportOptions
    );
    const mcp = new Client({
      name,
      version,
    });

    await mcp.connect(connectionClient);
    
    // Store the client and the token used to create it
    clientRef.current = mcp;
    clientAccessTokenRef.current = accessToken;
    
    return mcp;
  };

  /**
   * Gets an existing MCP client or creates a new one if needed.
   * This ensures we reuse the same session across pagination and tool calls,
   * avoiding resource exhaustion from creating multiple sessions.
   */
  const getOrCreateMCPClient = useCallback(async (): Promise<Client> => {
    // Return existing client if available
    if (clientRef.current) {
      console.warn("[useMCP] Reusing existing MCP client");
      return clientRef.current;
    }
    
    // If a connection is already in progress, wait for it
    if (connectingRef.current) {
      console.warn("[useMCP] Connection in progress, waiting...");
      return connectingRef.current;
    }
    
    // Create new client and store the promise to prevent concurrent connections
    console.warn("[useMCP] No existing client, creating new connection");
    connectingRef.current = createMCPClientInternal();
    
    try {
      const client = await connectingRef.current;
      return client;
    } finally {
      connectingRef.current = null;
    }
  }, [accessToken, name, version]);
  
  /**
   * Creates a fresh MCP client, disconnecting any existing one.
   * Use this when you need to force a new connection.
   */
  const createAndConnectMCPClient = useCallback(async (): Promise<Client> => {
    // Disconnect existing client if any
    if (clientRef.current) {
      console.warn("[useMCP] Force creating new client, disconnecting existing");
      await clientRef.current.close().catch(() => {});
      clientRef.current = null;
    }
    
    return getOrCreateMCPClient();
  }, [getOrCreateMCPClient]);

  /**
   * Retrieves the list of available tools from the MCP server.
   * Reuses the existing client connection for pagination efficiency.
   * @param nextCursor - Optional cursor for pagination.
   * @returns A promise that resolves to an array of available tools.
   */
  const getTools = useCallback(async (nextCursor?: string): Promise<Tool[]> => {
    const mcp = await getOrCreateMCPClient();
    const toolsResponse = await mcp.listTools({ cursor: nextCursor });
    if (toolsResponse.nextCursor) {
      setCursor(toolsResponse.nextCursor);
    } else {
      setCursor("");
    }
    return toolsResponse.tools;
  }, [getOrCreateMCPClient]);

  /**
   * Calls a tool on the MCP server.
   * Reuses the existing client connection for efficiency.
   * @param toolName - The name of the tool.
   * @param toolVersion - The version of the tool. Optional.
   * @param args - The arguments to pass to the tool.
   * @returns A promise that resolves to the response from the tool.
   */
  const callTool = useCallback(async ({
    name: toolName,
    args,
    version: toolVersion,
  }: {
    name: string;
    args: Record<string, unknown>;
    version?: string;
  }) => {
    const mcp = await getOrCreateMCPClient();
    const response = await mcp.callTool({
      name: toolName,
      version: toolVersion,
      arguments: args,
    });
    return response;
  }, [getOrCreateMCPClient]);
  
  /**
   * Disconnects the MCP client and cleans up resources.
   * Call this when the component unmounts or when you need to force a reconnect.
   */
  const disconnect = useCallback(async () => {
    if (clientRef.current) {
      console.warn("[useMCP] Disconnecting MCP client");
      await clientRef.current.close().catch(() => {});
      clientRef.current = null;
      connectingRef.current = null;
    }
  }, []);

  return {
    getTools,
    callTool,
    createAndConnectMCPClient,
    disconnect,
    tools,
    setTools,
    cursor,
  };
}
