import type { Metadata } from "next";

import { AppSidebarNav } from "@/components/app-sidebar-nav";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI Datasheet Extractor",
  description:
    "Persist datasheet extraction requests, review AI output, and manage human corrections from a shared intake and submissions workflow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full" suppressHydrationWarning>
        <div className="min-h-screen lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="border-b border-border bg-white/80 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0">
            <div className="flex h-full flex-col gap-4 px-4 py-4 sm:px-6 lg:px-4 lg:py-6">
              <div className="border-b border-border px-3 pb-4">
                <h1 className="text-base font-semibold tracking-[-0.02em]">
                  AI Datasheet Extractor
                </h1>
              </div>
              <AppSidebarNav />
            </div>
          </aside>

          <main className="min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
