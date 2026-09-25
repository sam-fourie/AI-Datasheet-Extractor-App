import { AppPageLayout } from "@/components/app-page-layout";
import {
  INTAKE_PAGE_META,
  INTAKE_PAGE_TITLE,
  IntakeSkeleton,
} from "@/components/intake/intake-skeleton";

/**
 * Route-level fallback for `/`, so the intake shell is prefetched and a
 * navigation to it switches with no round trip. The page streams the same
 * skeleton behind its own Suspense boundary. Routes without their own
 * loading.tsx (the /preview sandbox) fall back to this too, which is harmless.
 */
export default function IntakeLoading() {
  return (
    <AppPageLayout meta={INTAKE_PAGE_META} title={INTAKE_PAGE_TITLE} width="narrow">
      <IntakeSkeleton />
    </AppPageLayout>
  );
}
