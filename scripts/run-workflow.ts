import "dotenv/config";
import { spawn } from "node:child_process";
import { once } from "node:events";

import { runJobs } from "./run-jobs";

type FlagValue = string | boolean;

interface ParsedCli {
  positional: string[];
  flags: Record<string, FlagValue>;
}

interface CrawlWorkflowOptions {
  mode: string;
  dryRun: boolean;
  allowMissingEnv: boolean;
  only: string[] | null;
}

interface KeywordWorkflowOptions {
  scripts: string[];
  installPlaywright: boolean;
}

function parseCli(argv: string[]): ParsedCli {
  const positional: string[] = [];
  const flags: Record<string, FlagValue> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const withoutPrefix = arg.slice(2);
    if (withoutPrefix.includes("=")) {
      const [key, rawValue] = withoutPrefix.split(/=(.+)/, 2) as [string, string];
      flags[key] = rawValue;
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      flags[withoutPrefix] = next;
      i += 1;
    } else {
      flags[withoutPrefix] = true;
    }
  }

  return { positional, flags };
}

function getStringFlag(flags: Record<string, FlagValue>, key: string): string | undefined {
  const value = flags[key];
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

function getBooleanFlag(flags: Record<string, FlagValue>, key: string): boolean {
  if (!(key in flags)) {
    return false;
  }
  const value = flags[key];
  if (typeof value === "boolean") {
    return value;
  }
  const normalised = value.toLowerCase();
  return !["false", "0", "no", "off"].includes(normalised);
}

function parseOnlyFlag(raw: string | undefined): string[] | null {
  if (!raw) return null;
  const values = raw
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  return values.length > 0 ? values : null;
}

function buildCrawlEnvOverrides(mode: string): Record<string, string> {
  switch (mode) {
    case "high-frequency":
      return {
        USE_SEARCH: "false",
        CRAWLER_RUN_MODE: "high-frequency"
      };
    case "keyword-sweep":
      return {
        USE_BEST_SELLERS: "false",
        USE_NEW_RELEASES: "false",
        USE_MOVERS: "false",
        USE_SEARCH: "true",
        CRAWLER_RUN_MODE: "keyword-sweep"
      };
    case "backlog-touch":
      return {
        USE_SEARCH: "false",
        CRAWLER_RUN_MODE: "backlog-touch"
      };
    default:
      return {};
  }
}

async function runCrawlWorkflow(options: CrawlWorkflowOptions): Promise<void> {
  const envOverrides = buildCrawlEnvOverrides(options.mode);
  if (Object.keys(envOverrides).length > 0) {
    console.log(`[workflow] Applying crawl mode overrides for ${options.mode}`);
    for (const [key, value] of Object.entries(envOverrides)) {
      console.log(`[workflow]   ${key}=${value}`);
    }
  }

  await runJobs({
    dryRun: options.dryRun,
    allowMissingEnv: options.allowMissingEnv,
    only: options.only,
    env: envOverrides
  });
}

function parseScriptList(rawScripts: string | undefined, extra: string[]): string[] {
  const chunks: string[] = [];
  if (rawScripts) {
    chunks.push(rawScripts);
  }
  chunks.push(...extra);

  const scripts = chunks
    .flatMap(chunk => chunk.split(/[\n,;]+/))
    .map(value => value.trim())
    .filter(Boolean);

  if (scripts.length === 0) {
    return ["keywords:serp"];
  }
  return scripts;
}

async function runCommand(command: string, args: string[], env?: NodeJS.ProcessEnv): Promise<void> {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: env ? { ...process.env, ...env } : process.env
  });

  const [exitCode] = (await once(child, "exit")) as [number | null];
  if (exitCode !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with code ${exitCode}`);
  }
}

async function runKeywordWorkflow(options: KeywordWorkflowOptions): Promise<void> {
  console.log(`[workflow] Running keyword scripts: ${options.scripts.join(", ")}`);
  if (options.installPlaywright) {
    console.log("[workflow] Installing Playwright browsers");
    await runCommand("npx", ["playwright", "install", "--with-deps"]);
  }

  for (const script of options.scripts) {
    console.log(`[workflow] Starting npm run ${script}`);
    await runCommand("npm", ["run", script]);
  }
}

async function main() {
  const { positional, flags } = parseCli(process.argv.slice(2));
  const workflow = positional[0];

  if (!workflow) {
    throw new Error("No workflow specified. Use `crawl` or `keywords`.");
  }

  if (workflow !== "crawl" && workflow !== "keywords") {
    throw new Error(`Unknown workflow: ${workflow}`);
  }

  if (workflow === "crawl") {
    const mode = getStringFlag(flags, "mode") ?? "default";
    const only = parseOnlyFlag(getStringFlag(flags, "only"));
    const dryRun = getBooleanFlag(flags, "dry-run");
    const allowMissingEnv = getBooleanFlag(flags, "allow-missing-env");
    await runCrawlWorkflow({ mode, dryRun, allowMissingEnv, only });
    return;
  }

  const scripts = parseScriptList(getStringFlag(flags, "scripts"), positional.slice(1));
  const installPlaywright = getBooleanFlag(flags, "install-playwright");
  await runKeywordWorkflow({ scripts, installPlaywright });
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
