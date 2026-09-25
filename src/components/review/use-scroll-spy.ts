"use client";

import { useEffect, useState } from "react";

/**
 * Scroll-spy for the toolbar section links (§4.3). The active section is the
 * last one whose top has passed the line just under the sticky header and
 * toolbar. At the very bottom of the page the last section wins, so short
 * final sections (Notes, Runs) can still become active.
 *
 * An IntersectionObserver on the sections wakes the check; scroll and resize
 * events (rAF-throttled) keep it exact while sections move under the line.
 */
export function useScrollSpy(sectionIds: readonly string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(sectionIds[0] ?? null);
  const idsKey = sectionIds.join("|");

  useEffect(() => {
    const ids = idsKey ? idsKey.split("|") : [];
    let frame: number | null = null;

    function readOffset() {
      const styles = getComputedStyle(document.documentElement);
      const header = Number.parseFloat(styles.getPropertyValue("--ui-header-height")) || 56;
      const toolbar = Number.parseFloat(styles.getPropertyValue("--ui-toolbar-height")) || 48;
      const workspace = document.querySelector<HTMLElement>("[data-review-workspace]");

      if (workspace) {
        const local = getComputedStyle(workspace);
        const localHeader = Number.parseFloat(local.getPropertyValue("--ui-header-height"));
        const localToolbar = Number.parseFloat(local.getPropertyValue("--ui-toolbar-height"));

        return (localHeader || header) + (localToolbar || toolbar) + 24;
      }

      return header + toolbar + 24;
    }

    function update() {
      frame = null;

      const offset = readOffset();
      const scrollBottom = window.scrollY + window.innerHeight;
      const atBottom = scrollBottom >= document.documentElement.scrollHeight - 4;
      let next: string | null = ids[0] ?? null;

      for (const id of ids) {
        const element = document.getElementById(id);

        if (!element) {
          continue;
        }

        if (element.getBoundingClientRect().top - offset <= 0) {
          next = id;
        }
      }

      if (atBottom && window.scrollY > 0) {
        const last = [...ids].reverse().find((id) => document.getElementById(id));

        if (last) {
          next = last;
        }
      }

      setActiveId((current) => (current === next ? current : next));
    }

    function schedule() {
      if (frame === null) {
        frame = window.requestAnimationFrame(update);
      }
    }

    const observer = new IntersectionObserver(schedule, {
      threshold: [0, 0.25, 0.5, 0.75, 1],
    });

    for (const id of ids) {
      const element = document.getElementById(id);

      if (element) {
        observer.observe(element);
      }
    }

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);

      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [idsKey]);

  return activeId;
}
