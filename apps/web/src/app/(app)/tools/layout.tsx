"use client";

import { MCPProvider } from "@/providers/MCP";
import React from "react";

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MCPProvider>{children}</MCPProvider>;
}

