/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ClaudeEnvironment } from "@noldova/teamrun.providers";

@TestClass
export class ClaudeEnvironmentTests {
  @TestMethod
  public dropsCredentialsKeepsRoutingAndPointsAtTheProfile(): void {
    const base = {
      PATH: "p",
      ANTHROPIC_API_KEY: "secret",
      CLAUDE_CODE_OAUTH_TOKEN: "secret",
      CLAUDEPID: "1",
      CLAUDE_CONFIG_DIR: "C:/default",
      CLAUDE_CODE_USE_BEDROCK: "1",
      claude_lowercase: "x"
    };

    const profiled = ClaudeEnvironment.build(base, "C:/profile", "1.2.3");
    const shared = ClaudeEnvironment.build(base, null, "1.2.3");

    Assert.areEqual("p", profiled["PATH"]);
    Assert.isUndefined(profiled["ANTHROPIC_API_KEY"]);
    Assert.isUndefined(profiled["CLAUDE_CODE_OAUTH_TOKEN"]);
    Assert.isUndefined(profiled["CLAUDEPID"]);
    Assert.isUndefined(profiled["claude_lowercase"]);
    Assert.areEqual("1", profiled["CLAUDE_CODE_USE_BEDROCK"]);
    Assert.areEqual("C:/profile", profiled["CLAUDE_CONFIG_DIR"]);
    Assert.areEqual("teamrun/1.2.3", profiled["CLAUDE_AGENT_SDK_CLIENT_APP"]);
    Assert.areEqual("1", profiled["DISABLE_AUTOUPDATER"]);
    Assert.areEqual("C:/default", shared["CLAUDE_CONFIG_DIR"]);
    Assert.isUndefined(shared["ANTHROPIC_API_KEY"]);
  }

  @TestMethod
  public keepsThePersonsOwnClaudeSettingsInAChatTurnButNoSecretOrOuterSessionMarkerAndNoneOutsideOne(): void {
    const base = {
      PATH: "p",
      CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",
      CLAUDE_CODE_MAX_OUTPUT_TOKENS: "9000",
      CLAUDE_CODE_OAUTH_TOKEN: "secret",
      CLAUDE_CODE_OAUTH_REFRESH_TOKEN: "secret",
      CLAUDE_CODE_CLIENT_KEY: "secret",
      CLAUDE_CODE_ENTRYPOINT: "cli",
      CLAUDE_CODE_SSE_PORT: "1",
      CLAUDE_CODE_USE_BEDROCK: "1",
      CLAUDEPID: "1",
      ANTHROPIC_API_KEY: "secret",
      ANTHROPIC_MODEL: "fixture"
    };
    const kept = ["CLAUDE_CODE_DISABLE_AUTO_MEMORY", "CLAUDE_CODE_MAX_OUTPUT_TOKENS"];
    const others = Object.keys(base).filter(t => t !== "PATH" && t !== "CLAUDE_CODE_USE_BEDROCK" && !kept.includes(t));

    const chat = ClaudeEnvironment.build(base, "C:/profile", "1.2.3", true);
    const outside = ClaudeEnvironment.build(base, "C:/profile", "1.2.3");

    Assert.areEqual("1|9000|1", [chat["CLAUDE_CODE_DISABLE_AUTO_MEMORY"], chat["CLAUDE_CODE_MAX_OUTPUT_TOKENS"], chat["CLAUDE_CODE_USE_BEDROCK"]].join("|"));
    Assert.areEqual(JSON.stringify([]), JSON.stringify(others.filter(t => t in chat)));
    Assert.areEqual(JSON.stringify([]), JSON.stringify([...kept, ...others].filter(t => t in outside)));
    Assert.areEqual("1", outside["CLAUDE_CODE_USE_BEDROCK"]);
    Assert.areEqual(JSON.stringify([false, false, true, true]), JSON.stringify(["CLAUDE_CODE_DISABLE_AUTO_MEMORY", "CLAUDE_CODE_MAX_OUTPUT_TOKENS",
      "CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_MODEL"].map(t => ClaudeEnvironment.withholds(t))));
  }

  @TestMethod
  public leavesOutWhatAnOuterClaudeCodeSessionSetsForItsProcessesInEveryLaunch(): void {
    const markers = ["CLAUDECODE", "CLAUDE_PID", "CLAUDE_EFFORT", "CLAUDE_JOB_DIR", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_HOST_SESSION_ID",
      "CLAUDE_CODE_BRIDGE_SESSION_ID", "CLAUDE_CODE_REMOTE", "CLAUDE_CODE_REMOTE_SESSION_ID", "CLAUDE_CODE_CHILD_SESSION", "CLAUDE_CODE_SESSION_ATTENDED",
      "CLAUDE_CODE_ACCOUNT_UUID", "CLAUDE_CODE_ORGANIZATION_UUID", "CLAUDE_CODE_USER_EMAIL", "CLAUDE_CODE_EXECPATH", "CLAUDE_CODE_ENTRYPOINT",
      "CLAUDE_CODE_SSE_PORT", "CLAUDE_CODE_MESSAGING_SOCKET", "CLAUDE_CODE_MESSAGING_TOKEN", "CLAUDE_CODE_DESKTOP_APP_VERSION",
      "CLAUDE_CODE_SDK_HAS_HOST_AUTH_REFRESH", "CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING", "CLAUDE_AGENT_SDK_VERSION", "CLAUDE_CODE_EFFORT_LEVEL"];
    const base: Record<string, string> = { PATH: "p", CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1" };
    for (const name of markers)
      base[name] = "outer";

    const chat = ClaudeEnvironment.build(base, "C:/profile", "1.2.3", true);
    const outside = ClaudeEnvironment.build(base, null, "1.2.3");

    Assert.areEqual(JSON.stringify([]), JSON.stringify(markers.filter(t => t in chat)));
    Assert.areEqual(JSON.stringify([]), JSON.stringify(markers.filter(t => t in outside)));
    Assert.areEqual("1", chat["CLAUDE_CODE_DISABLE_AUTO_MEMORY"]);
  }

  @TestMethod
  public routesAChatTurnTheWayTheSignInAndTheModelListRouteWhateverSwitchesTheShellSets(): void {
    const switches = ["CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY", "CLAUDE_CODE_USE_MANTLE", "CLAUDE_CODE_USE_ANTHROPIC_AWS",
      "CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST", "CLAUDE_CODE_SKIP_BEDROCK_AUTH", "CLAUDE_CODE_SKIP_VERTEX_AUTH", "CLAUDE_CODE_SKIP_FOUNDRY_AUTH",
      "CLAUDE_CODE_SKIP_MANTLE_AUTH", "CLAUDE_CODE_SKIP_ANTHROPIC_AWS_AUTH", "ANTHROPIC_BEDROCK_BASE_URL", "ANTHROPIC_VERTEX_BASE_URL",
      "ANTHROPIC_FOUNDRY_BASE_URL", "ANTHROPIC_BEDROCK_MANTLE_BASE_URL"];
    const base: Record<string, string> = { PATH: "p" };
    for (const name of switches)
      base[name] = "1";

    const chat = switches.filter(t => t in ClaudeEnvironment.build(base, "C:/profile", "1.2.3", true));
    const listing = switches.filter(t => t in ClaudeEnvironment.build(base, "C:/profile", "1.2.3"));

    Assert.areEqual(JSON.stringify(listing), JSON.stringify(chat));
    Assert.areEqual(JSON.stringify(["CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY", "CLAUDE_CODE_SKIP_BEDROCK_AUTH",
      "CLAUDE_CODE_SKIP_VERTEX_AUTH", "CLAUDE_CODE_SKIP_FOUNDRY_AUTH", "ANTHROPIC_BEDROCK_BASE_URL", "ANTHROPIC_VERTEX_BASE_URL", "ANTHROPIC_FOUNDRY_BASE_URL"]),
      JSON.stringify(chat));
  }

  @TestMethod
  public leavesTheSettingsOnlyTheAgentSdkModeReadsAndThePermissionSkipOutOfAChatTurn(): void {
    const names = ["CLAUDE_CODE_EXIT_AFTER_STOP_DELAY", "CLAUDE_CODE_RESUME_INTERRUPTED_TURN", "CLAUDE_CODE_RESUME_INTERRUPTED_TURN_MAX_AGE_MS",
      "CLAUDE_CODE_STARTUP_FAILURE_RESULTS", "CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS", "CLAUDE_AGENT_SDK_MCP_NO_PREFIX",
      "CLAUDE_CODE_EVEN_MORE_DANGEROUSLY_SKIP_PERMISSIONS"];
    const base: Record<string, string> = { PATH: "p", CLAUDE_CODE_MAX_OUTPUT_TOKENS: "8000" };
    for (const name of names)
      base[name] = "1";

    const chat = ClaudeEnvironment.build(base, "C:/profile", "1.2.3", true);

    Assert.areEqual(JSON.stringify([]), JSON.stringify(names.filter(t => t in chat)));
    Assert.areEqual("8000", chat["CLAUDE_CODE_MAX_OUTPUT_TOKENS"]);
  }

  @TestMethod
  public optsEverySessionInToClaudeCodesToDoToolsWhateverItsOwnEnvironmentSays(): void {
    const built = ClaudeEnvironment.build({ PATH: "p", CLAUDE_CODE_ENABLE_TODO_TOOLS: "0" }, null, "1.2.3");

    Assert.areEqual("1", built["CLAUDE_CODE_ENABLE_TODO_TOOLS"]);
  }
}
