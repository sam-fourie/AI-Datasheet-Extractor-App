import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI Datasheet Extractor",
  description:
    "Stage datasheet PDF extraction requests with package-aware UI and preview the output structure before the AI backend is wired in.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
