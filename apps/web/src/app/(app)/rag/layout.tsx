"use client";

import { RagProvider } from "@/features/rag/providers/RAG";
import React from "react";

export default function RAGLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RagProvider>{children}</RagProvider>;
}

