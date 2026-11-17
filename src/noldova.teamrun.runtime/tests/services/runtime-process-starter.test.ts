/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { join } from "node:path";
import { PassThrough } from "node:stream";

import { type OwnedProcess, ProcessExit } from "@noldova/desktop.runtime";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AcpClient, AgentSdkQueryFactory, ProcessCommand, ProcessOrigin, ProviderTimings } from "@noldova/teamrun.providers";
import { ProcessNotStartedException, RuntimeProcessStarter } from "@noldova/teamrun.runtime";

import { MemoryModuleDatabase } from "../fixtures/memory-module-database.fixture.js";
import { RecordingPartContext } from "../fixtures/recording-part-context.fixture.js";

@TestClass
export class RuntimeProcessStarterTests {
  private static readonly TIMINGS: ProviderTimings = new ProviderTimings(2000, 2000, 2000, 2000, 100, 100, 100, 250, 100, 1, 10);

  @TestMethod
  public async startsTheProgramThroughDesktopCoreInTheWorkFolderAndStopsItThere(): Promise<void> {
    using database = new MemoryModuleDatabase();
    const context = new RecordingPartContext("/module", database, "/work");
    const exit = Promise.withResolvers<ProcessExit>();
    const output = new PassThrough();
    let stops = 0;
    context.startProcess = () => Promise.resolve({
      processId: 42,
      input: new PassThrough(),
      output,
      errors: new PassThrough(),
      exited: exit.promise,
      stopAsync: () => {
        stops++;
        exit.resolve(new ProcessExit(null, "SIGTERM"));
        return Promise.resolve();
      }
    } as unknown as OwnedProcess);
    const starter = new RuntimeProcessStarter(context, "/work");

    const child = starter.start(new ProcessCommand("tool", ["--flag"]), { KEPT: "1", "=C:": "C:\\", MISSING: undefined }, null);
    await once(child, "spawn");
    const read = once(child.stdout, "data");
    output.write("hello");
    const [chunk] = await read as [Buffer];
    const exited = once(child, "exit");
    await child.stopAsync();
    const [code, signal] = await exited as [number | null, string | null];

    Assert.areEqual(42, child.pid);
    Assert.areEqual("hello", chunk.toString());
    Assert.areEqual(1, stops);
    Assert.isNull(code);
    Assert.areEqual("SIGTERM", signal);
    Assert.areEqual("tool", context.requests[0]?.program);
    Assert.areEqual("--flag", context.requests[0]?.arguments.join(" "));
    Assert.areEqual("/work", context.requests[0]?.workingFolder);
    Assert.areEqual("{\"KEPT\":\"1\"}", JSON.stringify(context.requests[0]?.environment));
    Assert.areEqual(false, context.requests[0]?.isVerbatim);
  }

  @TestMethod
  public leavesTheCrashHandlerPipeOutOfAProgramsEnvironment(): void {
    using database = new MemoryModuleDatabase();
    const context = new RecordingPartContext("/module", database, "/work");
    const starter = new RuntimeProcessStarter(context, "/work");

    starter.start(new ProcessCommand("tool", []), { KEPT: "1", CHROME_CRASHPAD_PIPE_NAME: "pipe" }, null).on("error", () => {});

    Assert.areEqual("{\"KEPT\":\"1\"}", JSON.stringify(context.requests[0]?.environment));
  }

  @TestMethod
  public async asksDesktopCoreForVerbatimArgumentsWhenTheCommandIsVerbatim(): Promise<void> {
    using database = new MemoryModuleDatabase();
    const context = new RecordingPartContext("/module", database, "/work");
    const starter = new RuntimeProcessStarter(context, "/work");

    const child = starter.start(new ProcessCommand("cmd.exe", ["/d", "/s", "/c", "\"echo \"a b\"\""], null, true), {}, null);
    await once(child, "error");

    Assert.areEqual(true, context.requests[0]?.isVerbatim);
    Assert.areEqual("/d|/s|/c|\"echo \"a b\"\"", context.requests[0]?.arguments.join("|"));
  }

  @TestMethod
  public async readsTheCurrentEnvironmentFromDesktopCoreForEachStartInPlaceOfTheOneTeamRunStartedWith(): Promise<void> {
    using database = new MemoryModuleDatabase();
    const context = new RecordingPartContext("/module", database, "/work");
    const starter = new RuntimeProcessStarter(context, "/work");
    const before = { SET_SINCE: "before" };
    context.environment = before;

    const first = await starter.readEnvironmentAsync({ OWN: "1" });
    first["SET_SINCE"] = "changed by a provider";
    context.environment = { SET_SINCE: "after" };
    const next = await starter.readEnvironmentAsync({ OWN: "1" });

    Assert.areEqual("{\"SET_SINCE\":\"after\"}", JSON.stringify(next));
    Assert.areEqual("before", before.SET_SINCE);
  }

  @TestMethod
  public async reportsARefusedStartAsAnErrorInItsOwnFolder(): Promise<void> {
    using database = new MemoryModuleDatabase();
    const context = new RecordingPartContext("/module", database, "/work");
    const starter = new RuntimeProcessStarter(context, "/work");

    const refused = starter.start(new ProcessCommand("tool", []), {}, "/project");
    const [error] = await once(refused, "error") as [Error];
    context.startProcess = () => Promise.reject("not an error");
    const odd = starter.start(new ProcessCommand("tool", []), {}, null);
    const [oddError] = await once(odd, "error") as [Error];

    Assert.areEqual("The fixture starts no programs.", error.message);
    Assert.areEqual("/project", context.requests[0]?.workingFolder);
    Assert.isInstanceOf(oddError, ProcessNotStartedException);
    Assert.areEqual("Noldova Desktop refused to start the program tool with a value that isn't an error.", oddError.message);
    Assert.areEqual("not an error", oddError.cause);
  }

  @TestMethod
  public async logsARefusedStartByItsProgramProviderAndKindButNeverItsText(): Promise<void> {
    using database = new MemoryModuleDatabase();
    const context = new RecordingPartContext("/module", database, "/work");
    const starter = new RuntimeProcessStarter(context, "/work");
    const prompt = "Summarize the plan in secret.md";
    const provider = "0192f3a4-5b6c-7d8e-9f01-23456789abcd";

    context.startProcess = () => Promise.reject(Object.assign(new Error(prompt), { code: "ENOENT" }));
    await once(starter.start(new ProcessCommand(join("tools", "bin", "agent.exe"), [prompt], new ProcessOrigin("codex", provider)), {}, null), "error");
    context.startProcess = () => Promise.reject(prompt);
    await once(starter.start(new ProcessCommand("agent", [], new ProcessOrigin("claude", null)), {}, null), "error");
    await once(starter.start(new ProcessCommand("unzip", [prompt]), {}, null), "error");

    Assert.areEqual([
      "The provider program agent.exe of codex for the provider ending in \"23456789abcd\" could not start: Error ENOENT.",
      "The provider program agent of claude for no provider could not start: string.",
      "The program unzip could not start: string."
    ].join("\n"), context.lines.join("\n"));
    Assert.isFalse(context.lines.some(t => t.includes(prompt) || t.includes(provider)));
  }

  @TestMethod
  public async endsARefusedStartAfterItsErrorSoAStopAfterItReturns(): Promise<void> {
    using database = new MemoryModuleDatabase();
    const starter = new RuntimeProcessStarter(new RecordingPartContext("/module", database, "/work"), "/work");
    const events: string[] = [];
    const closed = Promise.withResolvers<void>();

    const refused = starter.start(new ProcessCommand("tool", []), {}, null);
    refused.on("error", (error: Error) => events.push(`error ${error.message}`));
    refused.on("close", (code: number | null, signal: string | null) => {
      events.push(`close ${code} ${signal}`);
      closed.resolve();
    });
    await closed.promise;

    Assert.areEqual("error The fixture starts no programs.,close null null", events.join(","));
    Assert.isTrue(refused.hasExited);
    await refused.stopAsync();
  }

  @TestMethod
  public async failsTheRequestsOfAnAcpClientWhoseStartDesktopCoreRefusesAndStopsIt(): Promise<void> {
    using database = new MemoryModuleDatabase();
    const starter = new RuntimeProcessStarter(new RecordingPartContext("/module", database, "/work"), "/work");
    const client = new AcpClient(new ProcessCommand("agent", []), {}, "/work", starter, RuntimeProcessStarterTests.TIMINGS);

    client.start();
    await Assert.throwsAsync(() => client.request("initialize", {}), Error);
    await client.stop();
  }

  @TestMethod
  public async failsAClaudeQueryWhoseStartDesktopCoreRefuses(): Promise<void> {
    using database = new MemoryModuleDatabase();
    const context = new RecordingPartContext("/module", database, "/work");
    const starter = new RuntimeProcessStarter(context, "/work");
    const query = new AgentSdkQueryFactory(starter).start("hello", {
      env: {},
      pathToClaudeCodeExecutable: process.execPath,
      settingSources: [],
      strictMcpConfig: true,
      mcpServers: {}
    }, new ProcessOrigin("claude", "0192f3a4-5b6c-7d8e-9f01-23456789abcd"));

    try {
      await Assert.throwsAsync(async () => {
        for await (const message of query)
          Assert.isDefined(message);
      }, Error);
    }
    finally {
      query.close();
    }
    Assert.isTrue(context.lines.some(t => t.includes("of claude for the provider ending in \"23456789abcd\" could not start")), context.lines.join("\n"));
  }
}
