import { Suspense } from "react";
import type { Metadata } from "next";

import { AppLink } from "@/components/app-link";
import { AppMobileNav, BrandGlyph } from "@/components/app-mobile-nav";
import { AppSidebarNav } from "@/components/app-sidebar-nav";
import { BackgroundTasksProvider } from "@/components/background-tasks-provider";
import { NavigationGuardProvider } from "@/components/navigation-blocker-provider";
import { ReviewQueueBadge } from "@/components/review-queue-badge";
import { ToastProvider } from "@/components/ui";
import { getOpenAIModelDefinition } from "@/lib/ai/models";
import { formatReasoningEffortLabel } from "@/lib/ai/provider-meta";
import { getDefaultExtractionSettings } from "@/lib/ai/settings";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AI Datasheet Extractor",
    template: "%s · AI Datasheet Extractor",
  },
  description:
    "Extract package data from component datasheets with AI, then verify every value against the datasheet.",
};

/** "GPT-5.6 Terra · High": the full model name, since the footer has room. */
function formatDefaultModelLabel() {
  const { model, reasoningEffort } = getDefaultExtractionSettings();
  const modelLabel = getOpenAIModelDefinition(model).label;

  return `${modelLabel} · ${formatReasoningEffortLabel(reasoningEffort)}`;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-page text-text" suppressHydrationWarning>
        <NavigationGuardProvider>
          <ToastProvider>
            <BackgroundTasksProvider>
              <a
                className="fixed top-2 left-2 z-[70] -translate-y-20 rounded-sm bg-surface px-3 py-2 text-body font-medium text-accent-text shadow-overlay focus:translate-y-0"
                href="#main"
              >
                Skip to content
              </a>
              <AppMobileNav />
              <div className="lg:grid lg:min-h-dvh lg:grid-cols-[var(--ui-sidebar-width)_minmax(0,1fr)]">
                <aside className="hidden border-r border-border bg-surface-subtle lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-4 lg:px-3 lg:pt-3 lg:pb-4">
                  <AppLink
                    className="flex h-11 shrink-0 items-center gap-2.5 rounded-sm px-2 text-text"
                    href="/"
                  >
                    <BrandGlyph />
                    <p className="truncate text-[15px] leading-5 font-semibold">
                      AI Datasheet Extractor
                    </p>
                  </AppLink>
                  <AppSidebarNav
                    submissionsBadge={
                      <Suspense fallback={null}>
                        <ReviewQueueBadge />
                      </Suspense>
                    }
                  />
                  <div className="mt-auto space-y-0.5 px-2.5 text-caption text-text-muted">
                    <p>Default model</p>
                    <p>
                      {formatDefaultModelLabel()}
                    </p>
                  </div>
                </aside>
                <main className="min-w-0 focus:outline-none" id="main" tabIndex={-1}>
                  {children}
                </main>
              </div>
            </BackgroundTasksProvider>
          </ToastProvider>
        </NavigationGuardProvider>
      </body>
    </html>
  );
}
