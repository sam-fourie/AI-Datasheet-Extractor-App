export class ExtractionTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(
      `The AI model did not finish within ${Math.round(timeoutMs / 1000)} seconds. Try a lower reasoning effort or a smaller PDF.`,
    );
    this.name = "ExtractionTimeoutError";
  }
}
