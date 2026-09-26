import { Suspense } from "react";
import type { Metadata } from "next";

import { AppLink } from "@/components/app-link";
import { AppMobileNav, BrandGlyph } from "@/components/app-mobile-nav";
import { SIDEBAR_REVEAL_CLASS_NAME } from "@/components/app-sidebar-classes";
import { AppSidebarNav } from "@/components/app-sidebar-nav";
import { BackgroundTasksProvider } from "@/components/background-tasks-provider";
import { NavigationGuardProvider } from "@/components/navigation-blocker-provider";
import { ReviewQueueBadge } from "@/components/review-queue-badge";
import { cn, ToastProvider } from "@/components/ui";
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
              <div className="lg:grid lg:min-h-dvh lg:grid-cols-[var(--ui-rail-width)_minmax(0,1fr)]">
                {/*
                  Desktop sidebar: a thin icon rail that holds its grid column,
                  so pages never reflow. On hover (after a short dwell) or when
                  keyboard focus enters it, the panel widens over the content
                  and shows the labels; it collapses when the pointer or focus
                  leaves. CSS only, keyed on the group/sidebar group.
                */}
                <aside className="relative z-40 hidden lg:sticky lg:top-0 lg:block lg:h-dvh">
                  <div className="group/sidebar absolute inset-y-0 left-0 flex w-(--ui-rail-width) flex-col gap-4 overflow-hidden border-r border-border bg-surface-subtle px-2 pt-3 pb-4 transition-[width,box-shadow] delay-75 duration-(--ui-duration) ease-ui hover:w-(--ui-sidebar-width) hover:shadow-overlay hover:delay-150 has-[:focus-visible]:w-(--ui-sidebar-width) has-[:focus-visible]:shadow-overlay has-[:focus-visible]:delay-0">
                    <AppLink
                      className="flex h-10 shrink-0 items-center gap-2.5 rounded-sm px-2 text-text"
                      href="/"
                    >
                      <BrandGlyph />
                      <p className={cn("truncate text-[15px] leading-5 font-semibold", SIDEBAR_REVEAL_CLASS_NAME)}>
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
                    <div
                      className={cn(
                        "mt-auto space-y-0.5 px-3 text-caption whitespace-nowrap text-text-muted",
                        SIDEBAR_REVEAL_CLASS_NAME,
                      )}
                    >
                      <p>Default model</p>
                      <p>{formatDefaultModelLabel()}</p>
                    </div>
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
