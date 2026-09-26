import { AppPageLayout } from "@/components/app-page-layout";
import {
  INTAKE_PAGE_META,
  INTAKE_PAGE_TITLE,
  IntakeSkeleton,
} from "@/components/intake/intake-skeleton";

/**
 * Route-level fallback for `/`, so the intake shell is prefetched and a
 * navigation to it switches with no round trip. The page streams the same
 * skeleton behind its own Suspense boundary.
 *
 * It lives in the (intake) route group rather than at the app root on
 * purpose: a root loading.tsx wraps every route in a Suspense boundary, which
 * starts streaming before any page can call notFound() and so locks unknown
 * submissions at HTTP 200 instead of 404.
 */
export default function IntakeLoading() {
  return (
    <AppPageLayout meta={INTAKE_PAGE_META} title={INTAKE_PAGE_TITLE} width="narrow">
      <IntakeSkeleton />
    </AppPageLayout>
  );
}
