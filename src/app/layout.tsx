import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI Datasheet Extractor",
  description: "Shared Apple-style UI foundation for the AI Datasheet Extractor app.",
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
