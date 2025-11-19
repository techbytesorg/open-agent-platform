"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    // Supabase automatically detects the auth code in URL and exchanges it
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        // Successful authentication - redirect to home
        router.push("/");
      } else if (event === "SIGNED_OUT" || !session) {
        // Auth failed - redirect to signin
        router.push("/signin?error=Authentication failed");
      }
    });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Completing sign in...</h2>
        <p className="mt-2 text-muted-foreground">Please wait</p>
      </div>
    </div>
  );
}

