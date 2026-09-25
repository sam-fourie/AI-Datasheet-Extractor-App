import type { Metadata } from "next";

import { AppPageLayout } from "@/components/app-page-layout";
import { AccuracyDistribution } from "@/components/reports/accuracy-distribution";
import { AgreementMatrix } from "@/components/reports/agreement-matrix";
import { CostAgreementChart } from "@/components/reports/cost-agreement-chart";
import { FieldCorrectionChart } from "@/components/reports/field-correction-chart";
import { MetricDefinitions } from "@/components/reports/metric-definitions";
import { ModelLeaderboard } from "@/components/reports/model-leaderboard";
import { OverviewStats } from "@/components/reports/overview-stats";
import { pluralize } from "@/components/reports/report-format";
import { ReportSection } from "@/components/reports/report-section";
import { ReportsEmptyState } from "@/components/reports/reports-empty-state";
import { ReportsFilters } from "@/components/reports/reports-filters";
import { formatRunLabel } from "@/lib/ai/provider-meta";
import { getDefaultExtractionSettings } from "@/lib/ai/settings";
import {
  buildReports,
  parseReportsQuery,
  serializeReportsQuery,
} from "@/lib/submissions/reports";
import { listReportSubmissions } from "@/lib/submissions/repository";

export const metadata: Metadata = {
  title: "Reports",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseReportsQuery(await searchParams);
  const submissions = await listReportSubmissions();
  const settings = getDefaultExtractionSettings();
  const defaults = { model: settings.model, reasoningEffort: settings.reasoningEffort };
  const reports = buildReports(submissions, query, { defaults });

  const reviewedBaselines = submissions.filter(
    (submission) => submission.isBaseline && submission.reviewStatus === "reviewed",
  ).length;
  const isFiltered =
    query.range !== "all" ||
    query.model !== null ||
    query.effort !== null ||
    query.category !== null ||
    query.datasheet !== null;
  const clearSearch = serializeReportsQuery({ dir: query.dir, sort: query.sort });
  const clearFiltersHref = `/reports${clearSearch ? `?${clearSearch}` : ""}`;
  const emptyKind =
    reviewedBaselines === 0
      ? "no-reviews"
      : isFiltered && reports.inScope.length === 0
        ? "no-matches"
        : null;
  const datasheetChip = query.datasheet
    ? {
        partNumber: reports.datasheet?.partNumber ?? null,
        submissionId: query.datasheet,
      }
    : null;
  const defaultLabel = formatRunLabel(settings);
  const scopeReviewed = isFiltered ? reports.overview.reviewedDatasheets : reviewedBaselines;

  return (
    <AppPageLayout
      meta={
        // A filtered view counts only the datasheets it covers, so the meta
        // line agrees with the "Reviewed datasheets" stat below.
        scopeReviewed > 0
          ? `Model accuracy and agreement across ${pluralize(scopeReviewed, "reviewed datasheet")}${isFiltered ? " in this view" : ""}`
          : "Model accuracy and agreement across reviewed datasheets"
      }
      title="Reports"
    >
      <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
        <div className="flex flex-col gap-4">
          <ReportsFilters
            categories={reports.filterOptions.categories}
            datasheet={datasheetChip}
            efforts={reports.filterOptions.efforts}
            models={reports.filterOptions.models}
            query={query}
          />
          {emptyKind ? (
            <ReportsEmptyState clearFiltersHref={clearFiltersHref} kind={emptyKind} />
          ) : null}
        </div>

        <ReportSection id="overview" title="Overview">
          <OverviewStats overview={reports.overview} />
        </ReportSection>

        <ReportSection id="accuracy" title="Accuracy and value">
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <AccuracyDistribution
              distribution={reports.accuracyDistribution}
              filtered={isFiltered}
            />
            <CostAgreementChart chart={reports.costAgreement} filtered={isFiltered} />
          </div>
        </ReportSection>

        <ReportSection
          description={`Every model and effort in this view. The default is ${defaultLabel}.`}
          id="leaderboard"
          title="Model leaderboard"
        >
          <ModelLeaderboard
            defaults={defaults}
            filtered={isFiltered}
            query={query}
            stats={reports.leaderboard}
          />
        </ReportSection>

        <ReportSection
          description="Agreement of each re-run with the reviewed baseline"
          id="matrix"
          title="Agreement by datasheet"
        >
          <AgreementMatrix
            defaults={defaults}
            filtered={isFiltered}
            matrix={reports.agreementMatrix}
          />
        </ReportSection>

        <ReportSection id="fields" title="Fields the AI gets wrong most">
          <FieldCorrectionChart filtered={isFiltered} report={reports.fieldCorrections} />
        </ReportSection>

        <MetricDefinitions />
      </div>
    </AppPageLayout>
  );
}
