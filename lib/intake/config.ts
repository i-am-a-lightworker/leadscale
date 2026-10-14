const configuredMaxBytes = Number(process.env.INTAKE_MAX_BYTES);

export const INTAKE_LIMITS = {
  maxRequestBytes: Number.isSafeInteger(configuredMaxBytes) && configuredMaxBytes > 0 ? configuredMaxBytes : 2_000_000,
  maxCsvRows: 10_000,
  maxEmailBodyChars: 200_000,
} as const;

export const DEFAULT_CURRENCY = "USD";