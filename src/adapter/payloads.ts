export const FIXTURE_SOURCE =
  "Official Claude Code hooks reference (https://code.claude.com/docs/en/hooks.md), captured for the 0–72h spike. Not a live CLI dump from this environment.";

export const FIXTURE_CAPTURED_AT = "2026-09-06";
export const DOCUMENTED_CLAUDE_CODE_MIN_VERSION = "2.1.210";

export const sessionStartFixture = {
  session_id: "sess_fixture_healthy",
  transcript_path: "/tmp/tripward-fixtures/transcript.jsonl",
  cwd: "/tmp/tripward-fixtures/repo",
  permission_mode: "default",
  hook_event_name: "SessionStart",
  source: "startup",
};

export const preToolUseBashFixture = {
  session_id: "sess_fixture_healthy",
  prompt_id: "550e8400-e29b-41d4-a716-446655440000",
  transcript_path: "/tmp/tripward-fixtures/transcript.jsonl",
  cwd: "/tmp/tripward-fixtures/repo",
  permission_mode: "default",
  hook_event_name: "PreToolUse",
  tool_name: "Bash",
  tool_input: {
    command: "npm test",
    description: "Run test suite",
    timeout: 120000,
    run_in_background: false,
  },
  tool_use_id: "toolu_01ABC123npmtest",
};

export const preToolUseDeniedToolFixture = {
  ...preToolUseBashFixture,
  tool_name: "NotebookEdit",
  tool_input: {
    notebook_path: "/tmp/tripward-fixtures/repo/notes.ipynb",
    new_source: "print(1)",
  },
  tool_use_id: "toolu_01DENIEDNOTEBOOK",
};

export const preToolUseDangerousRmFixture = {
  ...preToolUseBashFixture,
  tool_input: {
    command: "rm -rf /",
    description: "synthetic catastrophic command",
  },
  tool_use_id: "toolu_01DANGEROUSRM",
};

export const preToolUseGitResetHardFixture = {
  ...preToolUseBashFixture,
  tool_input: {
    command: "git reset --hard HEAD",
    description: "synthetic dangerous git reset",
  },
  tool_use_id: "toolu_01GITRESETHARD",
};

export const preToolUseExactLoopFixture = {
  ...preToolUseBashFixture,
  tool_input: {
    command: "pytest tests/test_flaky.py",
    description: "repeat identical test",
  },
  tool_use_id: "toolu_01EXACTLOOP",
};

export const postToolUseFixture = {
  session_id: "sess_fixture_healthy",
  transcript_path: "/tmp/tripward-fixtures/transcript.jsonl",
  cwd: "/tmp/tripward-fixtures/repo",
  hook_event_name: "PostToolUse",
  tool_name: "Bash",
  tool_input: {
    command: "npm test",
  },
  tool_response: {
    stdout: "ok",
    stderr: "",
    interrupted: false,
  },
  tool_use_id: "toolu_01ABC123npmtest",
};

export const sessionEndFixture = {
  session_id: "sess_fixture_healthy",
  transcript_path: "/tmp/tripward-fixtures/transcript.jsonl",
  cwd: "/tmp/tripward-fixtures/repo",
  hook_event_name: "SessionEnd",
  reason: "complete",
};

export const ALL_FIXTURES = {
  session_start: sessionStartFixture,
  pre_tool_use_bash: preToolUseBashFixture,
  pre_tool_use_denied_tool: preToolUseDeniedToolFixture,
  pre_tool_use_dangerous_rm: preToolUseDangerousRmFixture,
  pre_tool_use_git_reset_hard: preToolUseGitResetHardFixture,
  pre_tool_use_exact_loop: preToolUseExactLoopFixture,
  post_tool_use: postToolUseFixture,
  session_end: sessionEndFixture,
};

export function fixtureCatalog(): Array<{ name: string; event: string; source: string }> {
  return Object.entries(ALL_FIXTURES).map(([name, payload]) => ({
    name,
    event: String((payload as { hook_event_name: string }).hook_event_name),
    source: FIXTURE_SOURCE,
  }));
}
