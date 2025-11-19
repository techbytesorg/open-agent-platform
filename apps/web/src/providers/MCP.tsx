import React, {
  createContext,
  useContext,
  PropsWithChildren,
  useEffect,
  useRef,
  useState,
} from "react";
import useMCP from "../hooks/use-mcp";
import { useAuthContext } from "./Auth";

type MCPContextType = ReturnType<typeof useMCP> & { loading: boolean };

const MCPContext = createContext<MCPContextType | null>(null);

export const MCPProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const { session } = useAuthContext();
  
  // Debug logging
  useEffect(() => {
    console.warn("[MCP Provider] Session state:", {
      hasSession: !!session,
      hasAccessToken: !!session?.accessToken,
      accessTokenPreview: session?.accessToken?.substring(0, 20) + "...",
    });
  }, [session]);
  
  const mcpState = useMCP({
    name: "Tools Interface",
    version: "1.0.0",
    accessToken: session?.accessToken ?? undefined,
  });
  const fetchAttempted = useRef(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only fetch if we don't have tools and haven't attempted yet
    // Reset on session change to allow retry on refresh
    if (mcpState.tools.length > 0) {
      return;
    }
    
    if (!session?.accessToken) {
      // Reset fetch attempt flag when session is not ready
      fetchAttempted.current = false;
      return;
    }

    // Prevent duplicate fetches, but allow retry after a delay on failure
    if (fetchAttempted.current && mcpState.tools.length === 0) {
      // Already attempted, wait a bit before retry
      return;
    }

    console.warn("[MCP Provider] Fetching tools with access token");
    fetchAttempted.current = true;
    setLoading(true);
    
    const fetchTools = async () => {
      try {
        const tools = await mcpState.getTools();
        console.warn("[MCP Provider] Tools fetched successfully:", tools.length);
        mcpState.setTools(tools);
      } catch (error) {
        console.error("[MCP Provider] Error fetching tools:", error);
        // Reset flag to allow retry after delay
        setTimeout(() => {
          fetchAttempted.current = false;
        }, 2000);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken]);

  return (
    <MCPContext.Provider value={{ ...mcpState, loading }}>
      {children}
    </MCPContext.Provider>
  );
};

export const useMCPContext = () => {
  const context = useContext(MCPContext);
  if (context === null) {
    throw new Error("useMCPContext must be used within a MCPProvider");
  }
  return context;
};
