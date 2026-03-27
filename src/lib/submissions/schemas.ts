import { z } from "zod";

import type { SubmissionReviewPayload } from "@/lib/submissions/types";

const reviewDecisionStatusSchema = z.enum(["pending", "confirmed", "corrected"]);
const measurementFieldStatusSchema = z.enum([
  "Extracted",
  "Needs review",
  "Not found",
]);

function trimOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

const optionalTrimmedStringSchema = z.preprocess(
  trimOptionalString,
  z.string().min(1).optional(),
);

const packageSelectionReviewSchema = z
  .object({
    correctionNote: optionalTrimmedStringSchema,
    correctedSelectedPackage: optionalTrimmedStringSchema,
    status: reviewDecisionStatusSchema,
  })
  .superRefine((value, ctx) => {
    if (
      value.status === "corrected" &&
      !value.correctedSelectedPackage
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Corrected package selections must include correctedSelectedPackage.",
        path: ["correctedSelectedPackage"],
      });
    }
  });

const measurementReviewSchema = z
  .object({
    correctionNote: optionalTrimmedStringSchema,
    correctedStatus: measurementFieldStatusSchema.optional(),
    correctedValue: optionalTrimmedStringSchema,
    field: z.string().trim().min(1),
    status: reviewDecisionStatusSchema,
  })
  .superRefine((value, ctx) => {
    if (
      value.status === "corrected" &&
      !value.correctedValue
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Corrected measurements must include correctedValue.",
      });
    }
  });

const pinReviewSchema = z
  .object({
    correctionNote: optionalTrimmedStringSchema,
    correctedPinName: optionalTrimmedStringSchema,
    correctedPinNumber: optionalTrimmedStringSchema,
    pinIndex: z.number().int().nonnegative(),
    status: reviewDecisionStatusSchema,
  })
  .superRefine((value, ctx) => {
    if (
      value.status === "corrected" &&
      (!value.correctedPinName || !value.correctedPinNumber)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Corrected pins must include correctedPinNumber and correctedPinName.",
      });
    }
  });

export const submissionReviewPayloadSchema = z.object({
  measurements: z.array(measurementReviewSchema),
  packageSelection: packageSelectionReviewSchema,
  pins: z.array(pinReviewSchema),
  reviewerNotes: z.string().max(4000).transform((value) => value.trim()),
});

export type SubmissionReviewPayloadInput = SubmissionReviewPayload;

export function formatReviewValidationError(error: z.ZodError) {
  const issue = error.issues[0];

  return issue?.message ?? "Invalid review payload.";
}
