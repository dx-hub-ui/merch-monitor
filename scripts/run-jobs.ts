import "dotenv/config";

export interface JobDefinition {
  name: string;
  description: string;
  requires?: string[];
  loader: () => Promise<unknown>;
}

export interface JobResult {
  name: string;
  skipped: boolean;
  durationMs: number;
}

const JOBS: JobDefinition[] = [
  {
    name: "crawl",
    description: "Playwright crawler inserting and refreshing merch_products rows",
    requires: ["SUPABASE_DB_URL"],
    loader: () => import(new URL("../crawler/run.ts", import.meta.url).href)
  },
  {
    name: "embed",
    description: "Generate OpenAI embeddings for new or changed merch listings",
    requires: ["SUPABASE_DB_URL", "OPENAI_API_KEY"],
    loader: () => import(new URL("./embed.ts", import.meta.url).href)
  },
  {
    name: "metrics",
    description: "Compute merch product and keyword trend metrics",
    requires: ["SUPABASE_DB_URL"],
    loader: () => import(new URL("./metrics.ts", import.meta.url).href)
  }
];

interface ParsedArgs {
  dryRun: boolean;
  allowMissingEnv: boolean;
  only: string[] | null;
}

function parseArgs(argv: string[]): ParsedArgs {
  const dryRun = argv.includes("--dry-run");
  const allowMissingEnv = argv.includes("--allow-missing-env");
  let only: string[] | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--only" && argv[i + 1]) {
      only = argv[i + 1]
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);
      break;
    }
    if (arg.startsWith("--only=")) {
      only = arg
        .slice("--only=".length)
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);
      break;
    }
  }

  return { dryRun, allowMissingEnv, only };
}

function selectJobs(only: string[] | null): JobDefinition[] {
  if (!only || only.length === 0) {
    return JOBS;
  }

  const lookup = new Map(JOBS.map(job => [job.name, job] as const));
  const selected: JobDefinition[] = [];
  for (const name of only) {
    const job = lookup.get(name);
    if (!job) {
      throw new Error(`Unknown job name: ${name}`);
    }
    selected.push(job);
  }
  return selected;
}

function validateEnvironment(job: JobDefinition, env: NodeJS.ProcessEnv): string[] {
  return (job.requires ?? []).filter(key => {
    const value = env[key];
    return value == null || value === "";
  });
}

async function runJob(
  job: JobDefinition,
  env: NodeJS.ProcessEnv,
  dryRun: boolean,
  allowMissingEnv: boolean,
  logger: Pick<typeof console, "log" | "warn">
): Promise<JobResult> {
  const start = Date.now();
  if (dryRun) {
    logger.log(`[jobs] Dry run: ${job.name} (${job.description})`);
    return { name: job.name, skipped: true, durationMs: 0 };
  }

  const missingEnv = validateEnvironment(job, env);

  if (missingEnv.length > 0) {
    const message = `Skipping ${job.name} because required environment variables are missing: ${missingEnv.join(", ")}`;
    if (!allowMissingEnv) {
      throw new Error(message);
    }
    logger.warn(message);
    return { name: job.name, skipped: true, durationMs: 0 };
  }

  logger.log(`[jobs] Starting ${job.name}…`);
  await job.loader();
  const durationMs = Date.now() - start;
  logger.log(`[jobs] Completed ${job.name} in ${durationMs}ms`);
  return { name: job.name, skipped: false, durationMs };
}

export interface RunJobsOptions {
  dryRun?: boolean;
  allowMissingEnv?: boolean;
  only?: string[] | null;
  env?: Record<string, string | undefined>;
  logger?: Pick<typeof console, "log" | "warn" | "error">;
}

function applyEnvOverrides(envOverrides: Record<string, string | undefined> | undefined): () => void {
  if (!envOverrides) {
    return () => {};
  }

  const previousValues = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(envOverrides)) {
    previousValues.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return () => {
    for (const [key, value] of previousValues.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

export async function runJobs(options: RunJobsOptions = {}): Promise<JobResult[]> {
  const dryRun = options.dryRun ?? false;
  const allowMissingEnv = options.allowMissingEnv ?? false;
  const only = options.only ?? null;
  const logger = options.logger ?? console;

  const jobs = selectJobs(only);
  const envForValidation: NodeJS.ProcessEnv = { ...process.env, ...(options.env ?? {}) };

  const restoreEnv = applyEnvOverrides(options.env);

  try {
    const results: JobResult[] = [];
    for (const job of jobs) {
      try {
        const result = await runJob(job, envForValidation, dryRun, allowMissingEnv, logger);
        results.push(result);
      } catch (error) {
        logger.error?.(`[jobs] ${job.name} failed`, error);
        throw error;
      }
    }

    logger.log(
      JSON.stringify(
        {
          jobs: results.map(result => ({
            name: result.name,
            skipped: result.skipped,
            durationMs: result.durationMs
          }))
        },
        null,
        2
      )
    );
    return results;
  } finally {
    restoreEnv();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await runJobs({
    dryRun: args.dryRun,
    allowMissingEnv: args.allowMissingEnv,
    only: args.only
  });
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
