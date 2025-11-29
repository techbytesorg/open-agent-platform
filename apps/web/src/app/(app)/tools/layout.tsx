"use client";

import React from "react";

/**
 * Tools layout - no longer wraps with MCPProvider since SidebarLayout
 * already provides it at the app level. This ensures the MCP client
 * persists across page navigation.
 */
export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
