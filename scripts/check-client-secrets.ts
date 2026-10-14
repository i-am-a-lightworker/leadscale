import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const CLIENT_OUTPUT_DIRECTORY = ".next/static";
const SECRET_ENV_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "OPENAI_API_KEY",
  "ROUTE_SHARED_SECRET",
] as const;
const SECRET_MARKERS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "OPENAI_API_KEY",
  "ROUTE_SHARED_SECRET",
] as const;

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return nested.flat();
}

async function main(): Promise<void> {
  const paths = await listFiles(CLIENT_OUTPUT_DIRECTORY);
  const forbiddenValues = SECRET_ENV_NAMES.flatMap((name) => {
    const value = process.env[name];
    return value ? [{ name, value }] : [];
  });
  const leakedFiles: string[] = [];
  for (const path of paths) {
    const contents = await readFile(path);
    const source = contents.toString("utf8");
    if (forbiddenValues.some(({ value }) => source.includes(value)) || SECRET_MARKERS.some((marker) => source.includes(marker))) {
      leakedFiles.push(path);
    }
  }
  if (leakedFiles.length > 0) {
    console.error(JSON.stringify({ event: "client_secret_check_failed", files: leakedFiles }));
    process.exitCode = 1;
    return;
  }
  console.info(JSON.stringify({ event: "client_secret_check_passed", scannedFiles: paths.length, configuredSecretsChecked: forbiddenValues.length }));
}

main().catch(() => {
  console.error(JSON.stringify({ event: "client_secret_check_failed", message: "Build client assets before running this check." }));
  process.exitCode = 1;
});