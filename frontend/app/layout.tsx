import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Omni — AI Agent",
  description:
    "An AI agent that can browse the web, run code, edit files, send emails, and more.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
