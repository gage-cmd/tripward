/** Public product / CLI names. FuseCap was the working name only. */
export const PRODUCT_NAME = "Tripward";
export const CLI_NAME = "tripward";
export const HOME_DIRNAME = ".tripward";
/** Leftover local state from the FuseCap working name. Read-compat only. */
export const LEGACY_HOME_DIRNAME = ".fusecap";

export const ENV = {
  HOME: "TRIPWARD_HOME",
  RUN_DIR: "TRIPWARD_RUN_DIR",
  RUN_ID: "TRIPWARD_RUN_ID",
  STUB: "TRIPWARD_STUB",
  STUB_SCENARIO: "TRIPWARD_STUB_SCENARIO",
  STUB_SLEEP_MS: "TRIPWARD_STUB_SLEEP_MS",
} as const;

/** Same values as ENV, read when the current names are unset. */
export const LEGACY_ENV = {
  HOME: "FUSECAP_HOME",
  RUN_DIR: "FUSECAP_RUN_DIR",
  RUN_ID: "FUSECAP_RUN_ID",
  STUB: "FUSECAP_STUB",
  STUB_SCENARIO: "FUSECAP_STUB_SCENARIO",
  STUB_SLEEP_MS: "FUSECAP_STUB_SLEEP_MS",
} as const;

export function envValue(env: NodeJS.ProcessEnv, current: string, legacy: string): string | undefined {
  const now = env[current];
  if (now !== undefined && now !== "") return now;
  const old = env[legacy];
  if (old !== undefined && old !== "") return old;
  return undefined;
}

/** Child process env: current names plus legacy aliases so leftover hooks still find the run. */
export function childCompatEnv(values: {
  home: string;
  runDir: string;
  runId: string;
  stub?: boolean;
  stubScenario?: string;
}): NodeJS.ProcessEnv {
  const extra: NodeJS.ProcessEnv = {
    [ENV.HOME]: values.home,
    [ENV.RUN_DIR]: values.runDir,
    [ENV.RUN_ID]: values.runId,
    [LEGACY_ENV.HOME]: values.home,
    [LEGACY_ENV.RUN_DIR]: values.runDir,
    [LEGACY_ENV.RUN_ID]: values.runId,
  };
  if (values.stub) {
    extra[ENV.STUB] = "1";
    extra[LEGACY_ENV.STUB] = "1";
    extra[ENV.STUB_SCENARIO] = values.stubScenario ?? "healthy";
    extra[LEGACY_ENV.STUB_SCENARIO] = values.stubScenario ?? "healthy";
  }
  return extra;
}

export function isLegacyHomeDir(home: string): boolean {
  return home.replace(/[/\\]+$/, "").endsWith(LEGACY_HOME_DIRNAME);
}

/** Hook command owned by this CLI (current or leftover FuseCap install). */
export function isTripwardHookCommand(command: string): boolean {
  return (
    command.includes("tripward") ||
    command.includes("fusecap") ||
    command.includes("cli.ts hook") ||
    command.includes("cli.js hook")
  );
}
