export interface StructuredReportSafetyOptions {
  readonly unsafeFieldNameRe: RegExp;
  readonly unsafeStringValueRe?: RegExp;
}

export function containsUnsafeReportContent(
  value: unknown,
  options: StructuredReportSafetyOptions,
): boolean {
  if (typeof value === "string") {
    return options.unsafeStringValueRe?.test(value) ?? false;
  }
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    return value.some((entry) => containsUnsafeReportContent(entry, options));
  }
  for (const [key, nested] of Object.entries(value)) {
    if (options.unsafeFieldNameRe.test(key)) return true;
    if (containsUnsafeReportContent(nested, options)) return true;
  }
  return false;
}
