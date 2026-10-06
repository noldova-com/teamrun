/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Assert, Wait } from "@noldova/teamrun-foundation-testing";
import { BuildIdentity } from "@noldova/teamrun-shell-protocol";
import { DataDirectory, ProductInfo, RuntimeBuild, RuntimeEntry } from "@noldova/teamrun-shell-runtime";

export class ProbeBuildFixture implements AsyncDisposable {
  public static readonly PARTS_LOG: string = "parts.log";
  public static readonly CLI_WAITING_MARKER: string = "cli-waiting";
  public static readonly STALLED_MARKER: string = "stalled";
  public static readonly SLOW_MARKER: string = "slow";
  public static readonly SLOW_RELEASE: string = "slow-released";
  public static readonly SLOW_STICKS: string = "slow-sticks";
  public static readonly CALL_WAITING_MARKER: string = "call-waiting";
  public static readonly CALL_RELEASE: string = "call-released";
  private static readonly WAITING_MARKER: string = "waiting";
  private static readonly RELEASE_MARKER: string = "released";
  private static readonly WAIT_LIMIT: number = 15_000;
  private static readonly PROBE_PART: string = [
    "import { existsSync, writeFileSync } from \"node:fs\";",
    "import { writeFile } from \"node:fs/promises\";",
    "import path from \"node:path\";",
    "import { RuntimeCommand } from \"@noldova/teamrun-shell-runtime\";",
    "export class RuntimePart {",
    "  migrations = [];",
    "  async activateAsync(context) {",
    "    context.registerCommand(new RuntimeCommand(\"probe.block\", \"Block\", null, null, {",
    `      handleAsync: async () => { writeFileSync(path.join(context.moduleFolder, "${ProbeBuildFixture.WAITING_MARKER}"), "yes");`,
    `        const pause = new Int32Array(new SharedArrayBuffer(4)); const deadline = Date.now() + ${ProbeBuildFixture.WAIT_LIMIT};`,
    `        while (!existsSync(path.join(context.moduleFolder, "${ProbeBuildFixture.RELEASE_MARKER}"))) {`,
    `          if (Date.now() > deadline) throw new Error("The probe's block was not released within ${ProbeBuildFixture.WAIT_LIMIT} ms.");`,
    "          Atomics.wait(pause, 0, 0, 20); }",
    "        return null; }",
    "    }));",
    "    context.registerCommand(new RuntimeCommand(\"probe.echo\", \"Echo\", null, null, { handleAsync: async t => t.payload }));",
    "    context.registerCommand(new RuntimeCommand(\"probe.fail\", \"Fail\", null, null, {",
    "      handleAsync: async () => { throw new Error(\"The probe broke.\"); }",
    "    }));",
    "    context.registerCommand(new RuntimeCommand(\"probe.wait\", \"Wait\", null, null, {",
    `      handleAsync: async t => { await writeFile(path.join(context.moduleFolder, "${ProbeBuildFixture.WAITING_MARKER}"), "yes");`,
    "        await new Promise(resolve => t.signal.addEventListener(\"abort\", resolve)); return null; }",
    "    }));",
    "    context.registerMethod(\"probe.ping\", { handleAsync: async t => ({ pong: t.payload }) });",
    "  }",
    "  async deactivateAsync() {}",
    "}"
  ].join("\n");
  private static readonly LOGGING_PART: string = [
    "import { appendFileSync, existsSync } from \"node:fs\";",
    "const log = new URL(\"./parts.log\", import.meta.url);",
    "export class LoggingPart {",
    "  constructor(id) { this.id = id; }",
    "  async activateAsync(context) { this.log(\"activate\"); await this.register(context); }",
    "  async deactivateAsync() { this.log(\"deactivate\"); }",
    "  log(action) { appendFileSync(log, `${action} ${this.id}\\n`); }",
    "  register() {}",
    "}",
    "export async function waitForFileAsync(name) {",
    "  const file = new URL(`./${name}`, import.meta.url);",
    `  const deadline = Date.now() + ${ProbeBuildFixture.WAIT_LIMIT};`,
    "  while (!existsSync(file)) {",
    `    if (Date.now() > deadline) throw new Error(\`\${name} did not appear within ${ProbeBuildFixture.WAIT_LIMIT} ms.\`);`,
    "    await new Promise(resolve => setTimeout(resolve, 20));",
    "  }",
    "}"
  ].join("\n");
  private static readonly PROBE_CLI_PART: string = [
    "import { writeFileSync } from \"node:fs\";",
    "import { CliCommandException, CliCommandResult, UsageException } from \"@noldova/teamrun-shell-cli\";",
    "import { LoggingPart, waitForFileAsync } from \"./logging-part.mjs\";",
    `const waiting = new URL("./${ProbeBuildFixture.CLI_WAITING_MARKER}", import.meta.url);`,
    "export class CliPart extends LoggingPart {",
    "  constructor() { super(\"probe\"); }",
    "  register(context) {",
    "    context.registerCommand(\"probe.echoValues\", { handleAsync: async values => new CliCommandResult(values, JSON.stringify(values)) });",
    "    context.registerCommand(\"probe.callRuntime\", {",
    "      handleAsync: async (values, signal) => { const answer = await context.requestAsync(\"probe.ping\", values.text, signal);",
    "        return new CliCommandResult(answer, `The runtime answered ${answer.pong}.\\n`); }",
    "    });",
    "    context.registerCommand(\"probe.callMissing\", { handleAsync: (values, signal) => context.requestAsync(\"probe.missing\", null, signal) });",
    "    context.registerCommand(\"probe.callMalformed\", { handleAsync: (values, signal) => context.requestAsync(\"nodot\", null, signal) });",
    "    context.registerCommand(\"probe.callOther\", { handleAsync: (values, signal) => context.requestAsync(\"needy.secret\", null, signal) });",
    "    context.registerCommand(\"probe.throwPlain\", { handleAsync: async () => { throw new Error(\"The probe tripped.\"); } });",
    "    context.registerCommand(\"probe.callLater\", {",
    `      handleAsync: async (values, signal) => { writeFileSync(new URL("./${ProbeBuildFixture.CALL_WAITING_MARKER}", import.meta.url), "yes");`,
    `        await waitForFileAsync("${ProbeBuildFixture.CALL_RELEASE}"); return await context.requestAsync("probe.ping", "late", signal); }`,
    "    });",
    "    context.registerCommand(\"probe.waitForever\", { handleAsync: () => { writeFileSync(waiting, \"yes\"); return new Promise(() => undefined); } });",
    "    context.registerCommand(\"probe.failWithCode\", {",
    "      handleAsync: async () => { throw new CliCommandException(\"ProbeBroke\", \"The probe's command broke.\", { why: \"asked\" }); }",
    "    });",
    "    context.registerCommand(\"probe.refuse\", { handleAsync: async () => { throw new UsageException(\"The probe refuses these arguments.\"); } });",
    "    context.registerCommand(\"probe.stayQuiet\", { handleAsync: async () => new CliCommandResult(null, \"\") });",
    "  }",
    "}"
  ].join("\n");
  private static readonly CLI_PARTS: Readonly<Record<string, string>> = {
    "needy": [
      "import { CliCommandResult } from \"@noldova/teamrun-shell-cli\";",
      "import { LoggingPart } from \"./logging-part.mjs\";",
      "export class CliPart extends LoggingPart {",
      "  constructor() { super(\"needy\"); }",
      "  register(context) {",
      "    context.registerCommand(\"needy.run\", {",
      "      handleAsync: async (values, signal) => new CliCommandResult(await context.requestAsync(\"probe.ping\", context.moduleId, signal), \"Needy ran.\")",
      "    });",
      "  }",
      "}"
    ].join("\n"),
    "hollow": "export const CliPart = {};",
    "nameless": "export class Part { async activateAsync() {} async deactivateAsync() {} }",
    "inert": "export class CliPart { async deactivateAsync() {} }",
    "lopsided": "export class CliPart { activateAsync = 1; async deactivateAsync() {} }",
    "unfinished": "export class CliPart { async activateAsync() {} }",
    "clumsy": [
      "import { LoggingPart } from \"./logging-part.mjs\";",
      "export class CliPart extends LoggingPart {",
      "  constructor() { super(\"clumsy\"); }",
      "  register(context) { context.registerCommand(\"clumsy.run\", { handleAsync: async () => null }); throw new Error(\"The clumsy part tripped.\"); }",
      "}"
    ].join("\n"),
    "stalled": [
      "import { writeFileSync } from \"node:fs\";",
      "import { LoggingPart } from \"./logging-part.mjs\";",
      "export class CliPart extends LoggingPart {",
      "  constructor() { super(\"stalled\"); }",
      `  register() { writeFileSync(new URL("./${ProbeBuildFixture.STALLED_MARKER}", import.meta.url), "yes"); return new Promise(() => undefined); }`,
      "}"
    ].join("\n"),
    "sticky": [
      "import { CliCommandException, CliCommandResult } from \"@noldova/teamrun-shell-cli\";",
      "import { LoggingPart } from \"./logging-part.mjs\";",
      "export class CliPart extends LoggingPart {",
      "  constructor() { super(\"sticky\"); }",
      "  register(context) {",
      "    context.registerCommand(\"sticky.run\", { handleAsync: async () => new CliCommandResult(\"ran\", \"Sticky ran.\") });",
      "    context.registerCommand(\"sticky.fail\", { handleAsync: async () => { throw new CliCommandException(\"StickyBroke\", \"The sticky command broke.\"); } });",
      "  }",
      "  async deactivateAsync() { await super.deactivateAsync(); throw new Error(\"The sticky part would not let go.\"); }",
      "}"
    ].join("\n"),
    "greedy": "export class CliPart { async activateAsync(context) { context.registerCommand(\"greedy.extra\", {}); } async deactivateAsync() {} }",
    "doubled": [
      "export class CliPart {",
      "  async activateAsync(context) { context.registerCommand(\"doubled.run\", {}); context.registerCommand(\"doubled.run\", {}); }",
      "  async deactivateAsync() {}",
      "}"
    ].join("\n"),
    "halfway": "export class CliPart { deactivateAsync = 1; async activateAsync() {} }",
    "slow": [
      "import { existsSync, writeFileSync } from \"node:fs\";",
      "import { LoggingPart, waitForFileAsync } from \"./logging-part.mjs\";",
      "export class CliPart extends LoggingPart {",
      "  constructor() { super(\"slow\"); }",
      "  async register(context) {",
      `    writeFileSync(new URL("./${ProbeBuildFixture.SLOW_MARKER}", import.meta.url), "yes");`,
      `    await waitForFileAsync("${ProbeBuildFixture.SLOW_RELEASE}");`,
      "    context.registerCommand(\"slow.run\", { handleAsync: async () => { this.log(\"run\"); return null; } });",
      "  }",
      "  async deactivateAsync() {",
      "    await super.deactivateAsync();",
      `    if (existsSync(new URL("./${ProbeBuildFixture.SLOW_STICKS}", import.meta.url))) throw "The slow part would not let go.";`,
      "  }",
      "}"
    ].join("\n"),
    "tardy": [
      "import { LoggingPart } from \"./logging-part.mjs\";",
      "export class CliPart extends LoggingPart {",
      "  constructor() { super(\"tardy\"); }",
      "  register(context) { context.registerCommand(\"tardy.run\", { handleAsync: async () => null }); }",
      "}"
    ].join("\n"),
    "distant": [
      "import { LoggingPart } from \"./logging-part.mjs\";",
      "export class CliPart extends LoggingPart {",
      "  constructor() { super(\"distant\"); }",
      "  register(context) { context.registerCommand(\"distant.run\", { handleAsync: (values, signal) => context.requestAsync(\"probe.ping\", null, signal) }); }",
      "}"
    ].join("\n")
  };

  private readonly folder: string;

  public readonly identity: BuildIdentity;
  public readonly entryPath: string;
  public readonly declarationsFile: string;

  private constructor(folder: string, identity: BuildIdentity, entryPath: string, declarationsFile: string) {
    this.folder = folder;
    this.identity = identity;
    this.entryPath = entryPath;
    this.declarationsFile = declarationsFile;
  }

  public static async createAsync(productVersion: string, hasCliModules: boolean = false): Promise<ProbeBuildFixture> {
    const installed = path.resolve(path.dirname(RuntimeEntry.entryPath), "..");
    const folder = path.resolve(installed, "..", "..", "..", "_build", "cli-test-builds", `${productVersion}-${process.pid}-${Date.now()}`);
    const copy = path.join(folder, "node_modules", "@noldova", "teamrun-shell-runtime");
    await cp(installed, copy, { recursive: true });
    const identity = new BuildIdentity(productVersion, RuntimeBuild.identity.protocolVersion, `${RuntimeBuild.identity.fingerprint}-${productVersion}`);
    const probe = path.join(folder, "probe.mjs");
    await writeFile(probe, ProbeBuildFixture.PROBE_PART);
    const modules = path.join(folder, "_build", "modules");
    await mkdir(modules, { recursive: true });
    const product = { ...JSON.parse(await readFile(ProductInfo.file, "utf8")), version: identity.productVersion, build: identity.fingerprint };
    await writeFile(path.join(folder, "_build", "product.json"), JSON.stringify(product));
    const declaration = {
      ...ProbeBuildFixture.declare("probe", "Probe", [], [], pathToFileURL(probe).href, null),
      contributes: { commands: ["probe.block", "probe.echo", "probe.fail", "probe.wait"], methods: ["probe.ping"] }
    };
    const declarations = hasCliModules ? await ProbeBuildFixture.writeCliModulesAsync(folder, declaration) : [declaration];
    const declarationsFile = path.join(modules, "declarations.json");
    await writeFile(declarationsFile, JSON.stringify({ formatVersion: 1, modules: declarations }));
    return new ProbeBuildFixture(folder, identity, path.join(copy, "services", "runtime-entry.js"), declarationsFile);
  }

  public static markerPath(dataDirectory: string): string {
    return path.join(new DataDirectory(dataDirectory).locateModuleFolder("probe"), ProbeBuildFixture.WAITING_MARKER);
  }

  public static releasePath(dataDirectory: string): string {
    return path.join(new DataDirectory(dataDirectory).locateModuleFolder("probe"), ProbeBuildFixture.RELEASE_MARKER);
  }

  public static async waitUntilWaitingAsync(marker: string): Promise<void> {
    Assert.isTrue(await Wait.untilAsync(() => existsSync(marker), ProbeBuildFixture.WAIT_LIMIT),
      `The probe's command did not start waiting within ${ProbeBuildFixture.WAIT_LIMIT} ms: it did not write ${marker}.`);
  }

  public static command(
    name: string,
    commandArguments: readonly Readonly<Record<string, unknown>>[] = [],
    options: readonly Readonly<Record<string, unknown>>[] = [],
    description: string | null = null,
    examples: readonly Readonly<Record<string, unknown>>[] = []): Readonly<Record<string, unknown>> {
    return { name, summary: `Runs ${name}.`, description, arguments: commandArguments, options, examples };
  }

  public static declare(
    id: string,
    displayName: string,
    dependencies: readonly string[],
    cliCommands: readonly Readonly<Record<string, unknown>>[],
    runtimePackage: string | null = null,
    cliPackage: string | null = null): Readonly<Record<string, unknown>> {
    return {
      id,
      version: "0.0.1",
      displayName,
      description: `${displayName} answers the command line tests.`,
      dependencies,
      runtimePackage,
      cliPackage,
      contributes: { cliCommands: cliCommands.map(t => t["name"]) },
      settings: [],
      cliCommands
    };
  }

  public locate(file: string): string {
    return path.join(this.folder, file);
  }

  public async readPartsLogAsync(): Promise<string> {
    const log = this.locate(ProbeBuildFixture.PARTS_LOG);
    return existsSync(log) ? await readFile(log, "utf8") : "";
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  }

  private static async writeCliModulesAsync(folder: string, probe: Readonly<Record<string, unknown>>): Promise<readonly Readonly<Record<string, unknown>>[]> {
    await writeFile(path.join(folder, "logging-part.mjs"), ProbeBuildFixture.LOGGING_PART);
    await writeFile(path.join(folder, "probe-cli.mjs"), ProbeBuildFixture.PROBE_CLI_PART);
    for (const [id, source] of Object.entries(ProbeBuildFixture.CLI_PARTS))
      await writeFile(path.join(folder, `${id}-cli.mjs`), source);
    const cliPackage = (id: string): string => pathToFileURL(path.join(folder, `${id}-cli.mjs`)).href;
    const text = { name: "text", description: "The text.", required: true, variadic: false };
    const more = { name: "moreText", description: "More text.", required: false, variadic: true };
    const option = (name: string, type: string, required: boolean = false, repeated: boolean = false, fallback: unknown = null): Readonly<Record<string, unknown>> =>
      ({ name, description: `The ${name}.`, type, required, repeated, default: fallback });
    const echo = ProbeBuildFixture.command("probe.echoValues", [text, more], [
      option("times", "Number", false, false, 1),
      option("loud", "Boolean"),
      option("tag", "Text", false, true),
      option("level", "Number", true),
      option("prefix", "Text", false, false, "Probe"),
      option("note", "Text")
    ], "Echoes the values it was given.", [{ arguments: "hello --level 2", description: "Echoes hello." }, { arguments: "", description: "Fails for want of a level." }]);
    const plain = (name: string): Readonly<Record<string, unknown>> => ProbeBuildFixture.command(name);
    const probeCommands = [
      echo,
      ProbeBuildFixture.command("probe.callRuntime", [text]),
      ...[
        "probe.callMissing", "probe.callMalformed", "probe.callOther", "probe.throwPlain", "probe.callLater", "probe.waitForever", "probe.failWithCode", "probe.refuse", "probe.stayQuiet",
        "probe.unregistered"
      ].map(plain)
    ];
    return [
      { ...probe, cliPackage: cliPackage("probe"), contributes: { ...probe["contributes"] as object, cliCommands: probeCommands.map(t => t["name"]) }, cliCommands: probeCommands },
      ProbeBuildFixture.declare("needy", "Needy", ["probe"], [plain("needy.run")], null, cliPackage("needy")),
      ProbeBuildFixture.declare("quiet", "Quiet", [], [], null, null),
      ...["hollow", "clumsy", "greedy", "doubled", "halfway", "nameless", "inert", "lopsided", "unfinished", "stalled"]
        .map(t => ProbeBuildFixture.declare(t, t, [], [plain(`${t}.run`)], null, cliPackage(t))),
      ProbeBuildFixture.declare("sticky", "Sticky", ["probe"], [plain("sticky.run"), plain("sticky.fail")], null, cliPackage("sticky")),
      ProbeBuildFixture.declare("distant", "Distant", ["needy"], [plain("distant.run")], null, cliPackage("distant")),
      ProbeBuildFixture.declare("slow", "Slow", [], [plain("slow.run")], null, cliPackage("slow")),
      ProbeBuildFixture.declare("tardy", "Tardy", ["slow"], [plain("tardy.run")], null, cliPackage("tardy")),
      ProbeBuildFixture.declare("absent", "Absent", [], [plain("absent.run")], null, pathToFileURL(path.join(folder, "absent-cli.mjs")).href),
      ProbeBuildFixture.declare("failing", "Failing", [], [plain("failing.run")], pathToFileURL(path.join(folder, "missing-runtime.mjs")).href, null),
      ProbeBuildFixture.declare("blocked", "Blocked", ["failing"], [plain("blocked.run")], null, null)
    ];
  }
}
