import { createHash } from "node:crypto";

import {
  extractDatasheet,
  type ExtractionMeasurement,
  type ExtractionPin,
} from "@/lib/ai";
import {
  PACKAGE_CATEGORY_FIELDS,
  type MeasurementFieldRow,
  type PackageCategory,
  type PinRow,
} from "@/lib/package-categories";
import { MongoConfigError } from "@/lib/mongodb";
import { PdfSourceError, readPdfFromUrl } from "@/lib/pdf-source";
import {
  createSubmission,
  type ExtractionSnapshot,
  type SubmissionDetail,
  type SubmissionIntakeSnapshot,
  type UploadSourceMeta,
} from "@/lib/submissions";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const PDF_SIGNATURE = "%PDF-";

class RouteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RouteError";
  }
}

function assertPackageCategory(value: string): asserts value is PackageCategory {
  if (!Object.prototype.hasOwnProperty.call(PACKAGE_CATEGORY_FIELDS, value)) {
    throw new RouteError("Please choose a valid package category.", 400);
  }
}

function getStringValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    throw new RouteError(`Missing required field: ${key}.`, 400);
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw new RouteError(`Missing required field: ${key}.`, 400);
  }

  return trimmedValue;
}

function looksLikePdf(bytes: Uint8Array) {
  return Buffer.from(bytes.subarray(0, PDF_SIGNATURE.length)).toString("ascii") === PDF_SIGNATURE;
}

function ensurePdfSize(bytes: Uint8Array) {
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new RouteError("PDF exceeds the 20 MB upload limit for v1.", 413);
  }
}

async function readUploadedPdf(formData: FormData) {
  const uploadedFile = formData.get("datasheetFile");

  if (!(uploadedFile instanceof File)) {
    throw new RouteError("Please upload a datasheet PDF file.", 400);
  }

  if (
    uploadedFile.type !== "application/pdf" &&
    !uploadedFile.name.toLowerCase().endsWith(".pdf")
  ) {
    throw new RouteError("Uploaded file must be a PDF.", 400);
  }

  const pdfBytes = new Uint8Array(await uploadedFile.arrayBuffer());

  ensurePdfSize(pdfBytes);

  if (!looksLikePdf(pdfBytes)) {
    throw new RouteError("Uploaded file does not appear to be a valid PDF.", 400);
  }

  const checksumSha256 = createHash("sha256").update(pdfBytes).digest("hex");
  const fileName = uploadedFile.name || "datasheet.pdf";
  const mimeType = uploadedFile.type || "application/pdf";

  return {
    pdfBytes,
    pdfFileName: fileName,
    sourceLabel: fileName,
    sourceMeta: {
      checksumSha256,
      fileName,
      kind: "upload",
      mimeType,
      sizeBytes: pdfBytes.byteLength,
    } satisfies UploadSourceMeta,
  };
}

function toFieldRow(measurement: ExtractionMeasurement): MeasurementFieldRow {
  const status =
    measurement.status === "not_found"
      ? "Not found"
      : measurement.status === "needs_review"
        ? "Needs review"
        : "Extracted";

  return {
    confidence: measurement.confidence,
    evidencePages: measurement.evidencePages,
    field: measurement.field,
    status,
    value: measurement.value ?? "Not found in datasheet",
  };
}

function toPinRow(pin: ExtractionPin): PinRow {
  return {
    confidence: pin.confidence,
    evidencePages: pin.evidencePages,
    pinName: pin.pinName,
    pinNumber: pin.pinNumber,
  };
}

function toRouteError(error: unknown) {
  if (error instanceof RouteError) {
    return error;
  }

  if (error instanceof PdfSourceError) {
    return error;
  }

  if (error instanceof MongoConfigError) {
    return new RouteError(error.message, 500);
  }

  if (error instanceof Error) {
    return new RouteError(error.message, 500);
  }

  return new RouteError("Unexpected extraction error.", 500);
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new RouteError("OPENAI_API_KEY is not configured on the server.", 500);
    }

    const formData = await request.formData();
    const sourceMode = getStringValue(formData, "sourceMode");
    const partNumber = getStringValue(formData, "partNumber");
    const packageCategoryValue = getStringValue(formData, "packageCategory");

    if (sourceMode !== "upload" && sourceMode !== "url") {
      throw new RouteError("Please choose a valid PDF source mode.", 400);
    }

    assertPackageCategory(packageCategoryValue);

    const pdfSource =
      sourceMode === "upload"
        ? await readUploadedPdf(formData)
        : await readPdfFromUrl(getStringValue(formData, "datasheetUrl"));

    const extraction = await extractDatasheet({
      packageCategory: packageCategoryValue,
      partNumber,
      pdfBytes: pdfSource.pdfBytes,
      pdfFileName: pdfSource.pdfFileName,
      requestedFields: PACKAGE_CATEGORY_FIELDS[packageCategoryValue],
      sourceLabel: pdfSource.sourceLabel,
    });

    const extractionSnapshot: ExtractionSnapshot = {
      fields: extraction.measurements.map(toFieldRow),
      packageSelection: extraction.packageSelection,
      pinRows: extraction.pins.map(toPinRow),
      providerMeta: extraction.providerMeta,
      review: extraction.review,
    };
    const intakeSnapshot: SubmissionIntakeSnapshot = {
      packageCategory: packageCategoryValue,
      partNumber,
      requestedFields: [...PACKAGE_CATEGORY_FIELDS[packageCategoryValue]],
      sourceLabel: pdfSource.sourceLabel,
      sourceMeta: pdfSource.sourceMeta,
      sourceMode,
    };
    const submission = await createSubmission({
      extraction: extractionSnapshot,
      intake: intakeSnapshot,
    });

    return Response.json(submission satisfies SubmissionDetail);
  } catch (error) {
    const routeError = toRouteError(error);

    return Response.json(
      {
        error: routeError.message,
      },
      {
        status: routeError.status,
      },
    );
  }
}
