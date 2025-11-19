import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Tool } from "@/types/tool";
import { useState } from "react";
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

  /**
   * Creates an MCP client and connects it to the specified server URL.
   * @param url - The URL of the MCP server.
   * @param options - Client identification options.
   * @param options.name - The name of the client.
   * @param options.version - The version of the client.
   * @returns A promise that resolves to the connected MCP client instance.
   */
  const createAndConnectMCPClient = async () => {
    const url = getMCPUrlOrThrow();
    
    console.warn("[useMCP] Creating MCP client:", {
      hasAccessToken: !!accessToken,
      accessTokenPreview: accessToken?.substring(0, 20) + "...",
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
      console.warn("[useMCP] Adding Authorization header to requestInit");
    } else {
      console.warn("[useMCP] No access token, sending unauthenticated request");
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
    return mcp;
  };

  /**
   * Connects to an MCP server and retrieves the list of available tools.
   * @param url - The URL of the MCP server.
   * @param options - Client identification options.
   * @param options.name - The name of the client.
   * @param options.version - The version of the client.
   * @returns A promise that resolves to an array of available tools.
   */
  const getTools = async (nextCursor?: string): Promise<Tool[]> => {
    const mcp = await createAndConnectMCPClient();
    const tools = await mcp.listTools({ cursor: nextCursor });
    if (tools.nextCursor) {
      setCursor(tools.nextCursor);
    } else {
      setCursor("");
    }
    return tools.tools;
  };

  /**
   * Calls a tool on the MCP server.
   * @param name - The name of the tool.
   * @param version - The version of the tool. Optional.
   * @param args - The arguments to pass to the tool.
   * @returns A promise that resolves to the response from the tool.
   */
  const callTool = async ({
    name,
    args,
    version,
  }: {
    name: string;
    args: Record<string, any>;
    version?: string;
  }) => {
    const mcp = await createAndConnectMCPClient();
    const response = await mcp.callTool({
      name,
      version,
      arguments: args,
    });
    return response;
  };

  return {
    getTools,
    callTool,
    createAndConnectMCPClient,
    tools,
    setTools,
    cursor,
  };
}
