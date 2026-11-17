/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { OpencodeEnvironment } from "@noldova/teamrun.providers";

@TestClass
export class OpencodeEnvironmentTests {
  private static rules(environment: NodeJS.ProcessEnv): Record<string, string> {
    return OpencodeEnvironmentTests.content(environment).agent["build"]!.permission;
  }

  private static global(environment: NodeJS.ProcessEnv): Record<string, string> {
    return JSON.parse(environment["OPENCODE_PERMISSION"]!) as Record<string, string>;
  }

  private static content(environment: NodeJS.ProcessEnv): { readonly agent: Record<string, { readonly permission: Record<string, string> }>; readonly [name: string]: unknown } {
    return JSON.parse(environment["OPENCODE_CONFIG_CONTENT"]!) as { readonly agent: Record<string, { readonly permission: Record<string, string> }> };
  }

  private static merged(under: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
    const result = { ...under };
    for (const [name, value] of Object.entries(over)) {
      const kept = result[name];
      result[name] = OpencodeEnvironmentTests.isPlain(kept) && OpencodeEnvironmentTests.isPlain(value) ? OpencodeEnvironmentTests.merged(kept, value) : value;
    }
    return result;
  }

  private static isPlain(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && !Object.isNull(value) && !Array.isArray(value);
  }

  private static agentRules(project: Record<string, unknown>, agent: string): Record<string, string> {
    const launch = JSON.parse(OpencodeEnvironment.build({}, "/data", false)["OPENCODE_CONFIG_CONTENT"]!) as Record<string, unknown>;
    const merged = OpencodeEnvironmentTests.merged(project, launch) as { readonly agent: Record<string, { readonly permission: Record<string, string> }> };
    return merged.agent[agent]!.permission;
  }

  private static decide(rules: Record<string, string>, tool: string): string | undefined {
    return Object.entries(rules).findLast(([name]) => name === tool || (name.endsWith("*") && tool.startsWith(name.slice(0, -1))))?.[1];
  }

  private static decision(environment: NodeJS.ProcessEnv, files: Record<string, unknown>, agent: string, tool: string, pattern: string = "*"): string | undefined {
    const config = OpencodeEnvironmentTests.merged(files, JSON.parse(environment["OPENCODE_CONFIG_CONTENT"]!) as Record<string, unknown>);
    for (const [name, mode] of Object.entries((config["mode"] ?? {}) as Record<string, Record<string, unknown>>))
      config["agent"] = OpencodeEnvironmentTests.merged((config["agent"] ?? {}) as Record<string, unknown>, { [name]: { ...mode, mode: "primary" } });
    const permission = OpencodeEnvironmentTests.merged((config["permission"] ?? {}) as Record<string, unknown>, OpencodeEnvironmentTests.global(environment));
    const own = ((config["agent"] ?? {}) as Record<string, { readonly permission?: Record<string, unknown> }>)[agent]?.permission ?? {};
    const defaults = { "*": "allow", doom_loop: "ask", read: { "*": "allow", "*.env": "ask", "*.env.*": "ask", "*.env.example": "allow" } };
    const rules = [defaults, permission, own].flatMap(t => Object.entries(t).flatMap(([name, value]) => typeof value === "string"
      ? [[name, "*", value] as const]
      : Object.entries(value as Record<string, string>).map(([rule, action]) => [name, rule, action] as const)));
    const matches = (value: string, glob: string): boolean => new RegExp(`^${glob.split("*").map(t => t.replaceAll(".", "[.]")).join(".*")}$`).test(value);
    return rules.findLast(([name, rule]) => matches(tool, name) && matches(pattern, rule))?.[2];
  }

  @TestMethod
  public keepsThePersonsEnvironmentAndKeysInTheirOwnFolderAndSetsOnlyTheDataFolderAndTheApprovalRules(): void {
    const base = { HOME: "/home/person", XDG_CONFIG_HOME: "/home/person/.config", XDG_CACHE_HOME: "/cache", TMPDIR: "/scratch", ANTHROPIC_API_KEY: "fixture",
      OPENCODE_CONFIG: "/person/opencode.json", OPENCODE_DISABLE_AUTOUPDATE: "1", GIT_ASKPASS: "/askpass", GIT_CONFIG_GLOBAL: "/git", SSH_ASKPASS: "/ssh" };

    const environment = OpencodeEnvironment.build(base, "/data", false);

    Assert.areEqual("/data", environment["XDG_DATA_HOME"]);
    for (const name of ["HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "TMPDIR", "ANTHROPIC_API_KEY", "OPENCODE_CONFIG", "OPENCODE_DISABLE_AUTOUPDATE"] as const)
      Assert.areEqual(base[name], environment[name], name);
    for (const name of ["GIT_ASKPASS", "GIT_CONFIG_GLOBAL", "SSH_ASKPASS", "OPENCODE_DISABLE_PROJECT_CONFIG", "OPENCODE_DISABLE_CLAUDE_CODE", "OPENCODE_DISABLE_EXTERNAL_SKILLS",
      "OPENCODE_TEST_HOME", "OPENCODE_CONFIG_DIR"])
      Assert.isUndefined(environment[name], name);
  }

  @TestMethod
  public leavesKeysOutOfAnAddedFolderSoItUsesItsOwnSignInAndKeepsEverythingElse(): void {
    const environment = OpencodeEnvironment.build({ HOME: "/home/person", OPENAI_API_KEY: "a", GITHUB_TOKEN: "b", OPENCODE_API_KEY: "c", OPENCODE_AUTH_CONTENT: "d",
      GOOGLE_CLOUD_PROJECT: "e", OPENCODE_CONFIG: "/person/opencode.json", GIT_ASKPASS: "/askpass" }, "/work", true);

    Assert.areEqual("/work:/home/person:/person/opencode.json", [environment["XDG_DATA_HOME"], environment["HOME"], environment["OPENCODE_CONFIG"]].join(":"));
    for (const name of ["OPENAI_API_KEY", "GITHUB_TOKEN", "OPENCODE_API_KEY", "OPENCODE_AUTH_CONTENT", "GOOGLE_CLOUD_PROJECT", "GIT_ASKPASS"])
      Assert.isUndefined(environment[name], name);
  }

  @TestMethod
  @TestData(null, "ask")
  @TestData("build", "ask")
  @TestData("plan", "deny")
  public asksBeforeEveryToolWhateverThePersonsOwnVariableSaysAndAllowsOnlyTheApprovedToolsOfTeamRun(mode: string | null, edit: string): void {
    const environment = OpencodeEnvironment.build({ OPENCODE_PERMISSION: JSON.stringify({ bash: "allow", edit: "allow" }) }, "/data", false, mode,
      ["open_panel", "not a tool name"]);
    const rules = OpencodeEnvironmentTests.rules(environment);

    Assert.areEqual(edit, rules["edit"]);
    for (const tool of ["bash", "webfetch", "websearch", "codesearch", "external_directory", "doom_loop", "teamrun_*"])
      Assert.areEqual("ask", rules[tool], tool);
    Assert.areEqual("allow", rules["teamrun_open_panel"]);
    Assert.isUndefined(rules["*"]);
    Assert.areEqual(1, Object.keys(rules).filter(t => t.startsWith("teamrun_") && t !== "teamrun_*").length);
  }

  @TestMethod
  public allowsEveryToolByNameForAllowAllAndEverythingLastOnlyWithThePersonsOwnToolsOn(): void {
    const on = OpencodeEnvironment.build({}, "/data", false, "allowAll", ["open_panel"], true);
    const off = OpencodeEnvironment.build({}, "/data", false, "allowAll", ["open_panel"]);

    for (const rules of [OpencodeEnvironmentTests.rules(on), OpencodeEnvironmentTests.global(on), OpencodeEnvironmentTests.rules(off)]) {
      Assert.areEqual("allow", [...new Set(Object.values(rules))].join(","));
      for (const tool of ["edit", "bash", "webfetch", "websearch", "codesearch", "external_directory", "doom_loop", "teamrun_*", "read", "glob", "todowrite", "task"])
        Assert.isTrue(Object.keys(rules).includes(tool), tool);
    }
    Assert.areEqual("*,*", [Object.keys(OpencodeEnvironmentTests.rules(on)).at(-1), Object.keys(OpencodeEnvironmentTests.global(on)).at(-1)].join(","));
    Assert.isUndefined(OpencodeEnvironmentTests.rules(off)["*"]);
    Assert.areEqual(JSON.stringify({ "*": "deny", ...OpencodeEnvironmentTests.rules(off) }), JSON.stringify(OpencodeEnvironmentTests.global(off)));
  }

  @TestMethod
  @TestData(null)
  @TestData("plan")
  public asksInTheChatsAgentsAndRefusesInSubAgentsAndEverywhereElseSinceASubAgentsAskNeverReachesACard(mode: string | null): void {
    const environment = OpencodeEnvironment.build({ OPENCODE_PERMISSION: JSON.stringify({ bash: "allow" }) }, "/data", false, mode, ["open_panel"]);
    const content = OpencodeEnvironmentTests.content(environment);

    Assert.areEqual("build,explore,general,plan", Object.keys(content.agent).sort().join(","));
    Assert.areEqual("ask,ask", [content.agent["build"]?.permission["bash"], content.agent["plan"]?.permission["bash"]].join(","));
    Assert.areEqual(JSON.stringify(content.agent["build"]?.permission), JSON.stringify(content.agent["plan"]?.permission));
    for (const rules of [content.agent["general"]!.permission, content.agent["explore"]!.permission, OpencodeEnvironmentTests.global(environment)]) {
      for (const tool of ["edit", "bash", "webfetch", "websearch", "codesearch", "external_directory", "doom_loop", "teamrun_*"])
        Assert.areEqual("deny", rules[tool], tool);
      Assert.areEqual("allow", rules["teamrun_open_panel"]);
      Assert.areEqual("*", Object.keys(rules)[0]);
      Assert.areEqual("deny", rules["*"]);
    }
  }

  @TestMethod
  @TestData(false, "deny")
  @TestData(true, "allow")
  public allowsEverythingInEveryAgentForAllowAllButThePersonsOwnToolsWithTheirSwitchOff(ownTools: boolean, own: string): void {
    const environment = OpencodeEnvironment.build({}, "/data", false, "allowAll", ["open_panel"], ownTools);
    const content = OpencodeEnvironmentTests.content(environment);

    Assert.areEqual("build,explore,general,plan", Object.keys(content.agent).sort().join(","));
    for (const agent of Object.values(content.agent))
      Assert.areEqual(JSON.stringify(content.agent["build"]?.permission), JSON.stringify(agent.permission));
    for (const agent of ["build", "plan", "general", "explore", "review"]) {
      Assert.areEqual(`allow,allow,allow,${own}`, ["bash", "edit", "teamrun_open_panel", "own_search"]
        .map(t => OpencodeEnvironmentTests.decision(environment, {}, agent, t)).join(","), agent);
      Assert.areEqual("allow", OpencodeEnvironmentTests.decision(environment, {}, agent, "read", ".env"), agent);
    }
  }

  @TestMethod
  @TestData(null)
  @TestData("plan")
  public putsTheRulesOverBuildsEntryInTheDeprecatedModeKeyThatOpencodeMergesIntoItsAgentAfterTheLaunchsContent(mode: string | null): void {
    const files = { mode: { build: { permission: { bash: "allow", edit: "allow" }, disable: true, prompt: "own" } } };
    const environment = OpencodeEnvironment.build({}, "/data", false, mode);
    const content = OpencodeEnvironmentTests.content(environment) as unknown as Record<string, Record<string, Record<string, unknown>>>;
    const entry = (OpencodeEnvironmentTests.merged(files, content)["mode"] as Record<string, Record<string, unknown>>)["build"];

    Assert.areEqual(`ask,${mode === "plan" ? "deny" : "ask"}`, ["bash", "edit"].map(t => OpencodeEnvironmentTests.decision(environment, files, "build", t)).join(","));
    Assert.areEqual(JSON.stringify(content["agent"]?.["build"]), JSON.stringify(content["mode"]?.["build"]));
    Assert.areEqual("false,own", [entry?.["disable"], entry?.["prompt"]].join(","));
  }

  @TestMethod
  public putsTheRulesOverPlansEntryInTheDeprecatedModeKeyThatOpencodeMergesIntoItsAgentAfterTheLaunchsContent(): void {
    const files = { mode: { plan: { permission: { bash: "allow", webfetch: "allow", edit: "allow" }, hidden: true } } };
    const environment = OpencodeEnvironment.build({}, "/data", false, "plan");
    const content = OpencodeEnvironmentTests.content(environment) as unknown as Record<string, Record<string, Record<string, unknown>>>;
    const entry = (OpencodeEnvironmentTests.merged(files, content)["mode"] as Record<string, Record<string, unknown>>)["plan"];

    Assert.areEqual("ask,ask,deny", ["bash", "webfetch", "edit"].map(t => OpencodeEnvironmentTests.decision(environment, files, "plan", t)).join(","));
    Assert.areEqual(JSON.stringify(content["agent"]?.["plan"]), JSON.stringify(content["mode"]?.["plan"]));
    Assert.areEqual("false", String(entry?.["hidden"]));
  }

  @TestMethod
  public leavesAModeEntryForABuiltInSubAgentOverItsRulesAsTheArchitectureSays(): void {
    const files = { mode: { general: { permission: { bash: "allow" } } } };
    const environment = OpencodeEnvironment.build({}, "/data", false);
    const content = OpencodeEnvironmentTests.content(environment) as unknown as Record<string, Record<string, unknown>>;

    Assert.areEqual("build,plan", Object.keys(content["mode"] ?? {}).join(","));
    Assert.areEqual("allow", OpencodeEnvironmentTests.decision(environment, files, "general", "bash"));
  }

  @TestMethod
  @TestData(null)
  @TestData("plan")
  public refusesAnEnvFilesReadOutsideTheChatsAgentsWhereItsAskWouldNeverReachACardAndAsksInThem(mode: string | null): void {
    const environment = OpencodeEnvironment.build({}, "/data", false, mode);

    for (const file of [".env", "app/.env.local"]) {
      Assert.areEqual("ask,ask", ["build", "plan"].map(t => OpencodeEnvironmentTests.decision(environment, {}, t, "read", file)).join(","), file);
      Assert.areEqual("deny,deny,deny", ["general", "explore", "review"].map(t => OpencodeEnvironmentTests.decision(environment, {}, t, "read", file)).join(","), file);
    }
    for (const agent of ["build", "plan", "general", "explore", "review"]) {
      Assert.areEqual("allow,allow", ["app/.env.example", "src/a.ts"].map(t => OpencodeEnvironmentTests.decision(environment, {}, agent, "read", t)).join(","), agent);
      Assert.areEqual(["build", "plan"].includes(agent) ? "ask" : "deny", OpencodeEnvironmentTests.decision(environment, {}, agent, "doom_loop"), agent);
    }
  }

  @TestMethod
  @TestData(false, "deny")
  @TestData(true, "ask")
  public refusesThePersonsOwnServersAndCustomToolsInEveryAgentWithTheirSwitchOffAndAsksOutsideTheBuiltInSubAgentsWithItOn(ownTools: boolean, own: string): void {
    const environment = OpencodeEnvironment.build({}, "/data", false, null, ["open_panel"], ownTools);
    const decide = (agent: string, tool: string): string | undefined => OpencodeEnvironmentTests.decision(environment, {}, agent, tool);

    for (const tool of ["own-server_search", "own_tool", "custom"]) {
      Assert.areEqual(`${own},${own},${own}`, ["build", "plan", "review"].map(t => decide(t, tool)).join(","), tool);
      Assert.areEqual("deny,deny", ["general", "explore"].map(t => decide(t, tool)).join(","), tool);
    }
    for (const agent of ["build", "plan", "general", "explore", "review"]) {
      for (const tool of ["glob", "grep", "list", "skill", "lsp", "teamrun_open_panel"])
        Assert.areEqual("allow", decide(agent, tool), `${agent} ${tool}`);
      Assert.areEqual(["general", "explore"].includes(agent) ? "deny" : "allow", decide(agent, "todowrite"), agent);
    }
  }

  @TestMethod
  public keepsAskingForAToolTheChatsAgentsOwnSettingsNameSinceTheirRulesFromTeamRunNameNoToolItDoesntKnow(): void {
    const files = { agent: { build: { permission: { bash: "allow", read: "deny", glob: "deny", own_tool: "deny" } } } };

    for (const ownTools of [false, true]) {
      const environment = OpencodeEnvironment.build({}, "/data", false, null, [], ownTools);
      Assert.areEqual("ask,allow,allow,deny", [["bash"], ["read", "src/a.ts"], ["glob"], ["own_tool"]]
        .map(([tool, file]) => OpencodeEnvironmentTests.decision(environment, files, "build", tool!, file)).join(","));
    }
  }

  @TestMethod
  public keepsThePersonsOwnRulesVariableUnderTeamRunsAfterItsRuleForEveryTool(): void {
    const own = { bash: "allow", own_tool: "deny", "*": "allow", read: { "secret/*": "deny", "*.env": "allow" } };

    const environment = OpencodeEnvironment.build({ OPENCODE_PERMISSION: JSON.stringify(own) }, "/data", false, null, [], true);
    const rules = OpencodeEnvironmentTests.global(environment) as unknown as Record<string, unknown>;

    Assert.areEqual("*,bash,own_tool,read", Object.keys(rules).slice(0, 4).join(","));
    Assert.areEqual("ask,deny,deny", [rules["*"], rules["bash"], rules["own_tool"]].join(","));
    Assert.areEqual(JSON.stringify({ "*": "allow", "secret/*": "deny", "*.env": "deny", "*.env.*": "deny", "*.env.example": "allow" }), JSON.stringify(rules["read"]));
    Assert.areEqual("deny,deny,allow,ask", [["own_tool"], ["read", "secret/key"], ["read", "src/a.ts"], ["other_tool"]]
      .map(([tool, file]) => OpencodeEnvironmentTests.decision(environment, {}, "review", tool!, file)).join(","));
  }

  @TestMethod
  @TestData(null)
  @TestData("plan")
  public carriesThePersonsOwnReadRulesFromTheVariableAndTheContentIntoTheBuiltInAgentsButNotFromTheirSettingsFiles(mode: string | null): void {
    const own = { read: { "secret/*": "deny", "*.env": "allow" } };
    const content = { permission: { read: { "keys/*": "deny" } } };
    const files = { permission: { read: { "vault/*": "deny" } } };

    const environment = OpencodeEnvironment.build({ OPENCODE_PERMISSION: JSON.stringify(own), OPENCODE_CONFIG_CONTENT: JSON.stringify(content) }, "/data", false, mode);

    for (const agent of ["build", "general"])
      Assert.areEqual(`deny,deny,allow,${agent === "build" ? "ask" : "deny"},allow`, ["secret/key", "keys/a", "src/a.ts", "app/.env", "vault/key"]
        .map(t => OpencodeEnvironmentTests.decision(environment, files, agent, "read", t)).join(","), agent);
  }

  @TestMethod
  public keepsThePersonsOwnConfigContentAndAgentsButPutsTheRulesOverTheirBuiltInAgentsRules(): void {
    const own = JSON.stringify({ model: "anthropic/claude", instructions: ["/person/rules.md"], agent: { build: { model: "a/b", permission: { bash: "allow" } }, review: { mode: "subagent" } } });

    const content = OpencodeEnvironmentTests.content(OpencodeEnvironment.build({ OPENCODE_CONFIG_CONTENT: own }, "/data", false));

    Assert.areEqual("anthropic/claude", content["model"]);
    Assert.areEqual("/person/rules.md", (content["instructions"] as readonly string[]).join(","));
    Assert.areEqual("a/b", (content.agent["build"] as unknown as Record<string, string>)["model"]);
    Assert.areEqual("ask", content.agent["build"]?.permission["bash"]);
    Assert.areEqual("subagent", (content.agent["review"] as unknown as Record<string, string>)["mode"]);
  }

  @TestMethod
  public aProjectsRulesOnABuiltInAgentCantSkipTheCardSinceTheLaunchsContentComesAfterAProjectsFiles(): void {
    const project = { agent: { build: { permission: { bash: "allow", edit: "allow", webfetch: "allow" } }, general: { permission: { bash: "allow" } } } };

    for (const tool of ["bash", "edit", "webfetch"])
      Assert.areEqual("ask", OpencodeEnvironmentTests.decide(OpencodeEnvironmentTests.agentRules(project, "build"), tool), tool);
    Assert.areEqual("deny", OpencodeEnvironmentTests.decide(OpencodeEnvironmentTests.agentRules(project, "general"), "bash"));
  }

  @TestMethod
  public keepsTheChatsAgentsOnWhateverAProjectSaysSoTeamRunCanSelectThemOverItsOwnDefaultAgent(): void {
    const project = { default_agent: "own", agent: { build: { disable: true, mode: "subagent", hidden: true }, plan: { disable: true } } };
    const launch = JSON.parse(OpencodeEnvironment.build({}, "/data", false)["OPENCODE_CONFIG_CONTENT"]!) as Record<string, unknown>;
    const merged = OpencodeEnvironmentTests.merged(project, launch) as { readonly agent: Record<string, Record<string, unknown>> };

    for (const name of ["build", "plan"])
      Assert.areEqual("false,false,primary", [merged.agent[name]?.["disable"], merged.agent[name]?.["hidden"], merged.agent[name]?.["mode"]].join(","), name);
  }

  @TestMethod
  public asksBeforeAChatsAgentStartsASubAgentTeamRunCantNameAndLetsItStartTheBuiltInOnes(): void {
    const decideTask = (project: Record<string, unknown>, subAgent: string): string | undefined => OpencodeEnvironmentTests.decide(
      OpencodeEnvironmentTests.agentRules(project, "build")["task"] as unknown as Record<string, string>, subAgent);
    const allowed = { agent: { build: { permission: { task: { review: "allow" } } } } };

    for (const project of [{}, allowed]) {
      Assert.areEqual("ask", decideTask(project, "review"));
      Assert.areEqual("allow", decideTask(project, "general"));
      Assert.areEqual("allow", decideTask(project, "explore"));
    }
    Assert.areEqual("ask", decideTask({ agent: { build: { permission: { task: "allow" } } } }, "review"));
  }

  @TestMethod
  public leavesAProjectsOwnAgentsRulesAndATrailingStarOnABuiltInAgentPastTheCardAsTheArchitectureSays(): void {
    const own = { agent: { review: { permission: { bash: "allow" } } } };
    const star = { agent: { build: { permission: { bash: "allow", "*": "allow" } } } };

    Assert.areEqual("allow", OpencodeEnvironmentTests.decide(OpencodeEnvironmentTests.agentRules(own, "review"), "bash"));
    Assert.areEqual("allow", OpencodeEnvironmentTests.decide(OpencodeEnvironmentTests.agentRules(star, "build"), "bash"));
  }

  @TestMethod
  @TestData("not json")
  @TestData("[1]")
  @TestData("null")
  @TestData("{\"agent\":\"none\"}")
  public takesConfigContentThatIsntAnObjectAsEmpty(own: string): void {
    const content = OpencodeEnvironmentTests.content(OpencodeEnvironment.build({ OPENCODE_CONFIG_CONTENT: own }, "/data", false));

    Assert.areEqual("build,explore,general,plan", Object.keys(content.agent).sort().join(","));
  }
}
