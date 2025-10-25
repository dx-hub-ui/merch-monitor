import "dotenv/config";

interface JobDefinition {
  name: string;
  description: string;
  requires?: string[];
  loader: () => Promise<unknown>;
}

interface JobResult {
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
  only: Set<string> | null;
}

function parseArgs(argv: string[]): ParsedArgs {
  const dryRun = argv.includes("--dry-run");
  const allowMissingEnv = argv.includes("--allow-missing-env");
  let only: Set<string> | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--only" && argv[i + 1]) {
      only = new Set(argv[i + 1].split(",").map(value => value.trim()).filter(Boolean));
      break;
    }
    if (arg.startsWith("--only=")) {
      only = new Set(
        arg
          .slice("--only=".length)
          .split(",")
          .map(value => value.trim())
          .filter(Boolean)
      );
      break;
    }
  }

  return { dryRun, allowMissingEnv, only };
}

function selectJobs(only: Set<string> | null): JobDefinition[] {
  if (!only || only.size === 0) {
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

function validateEnvironment(job: JobDefinition): string[] {
  return (job.requires ?? []).filter(key => {
    const value = process.env[key];
    return value == null || value === "";
  });
}

async function runJob(job: JobDefinition, dryRun: boolean, allowMissingEnv: boolean): Promise<JobResult> {
  const start = Date.now();
  if (dryRun) {
    console.log(`[jobs] Dry run: ${job.name} (${job.description})`);
    return { name: job.name, skipped: true, durationMs: 0 };
  }

  const missingEnv = validateEnvironment(job);

  if (missingEnv.length > 0) {
    const message = `Skipping ${job.name} because required environment variables are missing: ${missingEnv.join(", ")}`;
    if (!allowMissingEnv) {
      throw new Error(message);
    }
    console.warn(message);
    return { name: job.name, skipped: true, durationMs: 0 };
  }

  console.log(`[jobs] Starting ${job.name}…`);
  await job.loader();
  const durationMs = Date.now() - start;
  console.log(`[jobs] Completed ${job.name} in ${durationMs}ms`);
  return { name: job.name, skipped: false, durationMs };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const jobs = selectJobs(args.only);

  const results: JobResult[] = [];
  for (const job of jobs) {
    try {
      const result = await runJob(job, args.dryRun, args.allowMissingEnv);
      results.push(result);
    } catch (error) {
      console.error(`[jobs] ${job.name} failed`, error);
      throw error;
    }
  }

  const summary = results.map(result => ({
    name: result.name,
    skipped: result.skipped,
    durationMs: result.durationMs
  }));
  console.log(JSON.stringify({ jobs: summary }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
