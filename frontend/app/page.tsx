"use client";

import { useEffect, useState } from "react";
import { AuthScreen } from "@/components/auth-screen";
import { ChatApp } from "@/components/chat-app";
import { api, getToken, setToken, type User } from "@/lib/api";

export default function Home() {
  const [status, setStatus] = useState<"loading" | "signed_out" | "signed_in">(
    "loading"
  );
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const tok = getToken();
    if (!tok) {
      setStatus("signed_out");
      return;
    }
    api
      .me()
      .then((u) => {
        setUser(u);
        setStatus("signed_in");
      })
      .catch(() => {
        setToken(null);
        setStatus("signed_out");
      });
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    );
  }

  if (status === "signed_out") {
    return (
      <AuthScreen
        onAuthenticated={async () => {
          const u = await api.me();
          setUser(u);
          setStatus("signed_in");
        }}
      />
    );
  }

  return (
    <ChatApp
      user={user!}
      onSignOut={() => {
        setToken(null);
        setUser(null);
        setStatus("signed_out");
      }}
    />
  );
}
