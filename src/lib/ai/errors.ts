export class ExtractionTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(
      `The AI model did not finish within ${Math.round(timeoutMs / 1000)} seconds. Try a lower reasoning effort or a smaller PDF.`,
    );
    this.name = "ExtractionTimeoutError";
  }
}

/** Thrown when the caller's AbortSignal (e.g. the client cancelling) stops the extraction. */
export class ExtractionCancelledError extends Error {
  constructor() {
    super("The extraction was cancelled.");
    this.name = "ExtractionCancelledError";
  }
}
