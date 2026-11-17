/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { DetailKind } from "@noldova/teamrun.protocol";
import { TerminalToolReader, TerminalToolResult } from "@noldova/teamrun.providers";

@TestClass
export class TerminalToolReaderTests {
  private static readonly report: JsonObject = {
    terminal_id: "t1", title: "bash - project", method: "AtPrompt", status: "Exited", exit_code: 2, cwd: "/work", output: "fail\n",
    omitted_characters: 0, log_file: "/logs/1.log", is_awaiting_secret: false
  };

  @TestMethod
  @TestData("terminal_run", true)
  @TestData("terminal_write", true)
  @TestData("terminal_read", false)
  @TestData("teamrun_check_provider", false)
  public showsOnlyRunAndWriteAsCommandSteps(tool: string, expected: boolean): void {
    Assert.areEqual(expected, TerminalToolReader.isStepTool(tool));
  }

  @TestMethod
  public readsARunningCallWithNoTerminalTitleYet(): void {
    const detail = TerminalToolReader.read("terminal_run", { terminal_id: "t1", command: "npm test" }, null, { toolUseId: "u1" }, "item-1", "agent-1");

    Assert.areEqual(DetailKind.Command, detail.kind);
    Assert.areEqual("$ npm test\n", detail.text);
    Assert.areEqual(JSON.stringify({ toolUseId: "u1", tool: "terminal_run", command: "npm test", terminalId: "t1", terminalTitle: null, exitCode: null,
      status: "inProgress", title: "Run in a terminal" }), JSON.stringify(detail.payload));
    Assert.areEqual("item-1", detail.providerItemId);
    Assert.areEqual("agent-1", detail.parentItemId);
  }

  @TestMethod
  public namesTheTerminalAndShowsTheOutputAndExitCodeFromTerminalsReport(): void {
    const detail = TerminalToolReader.read("terminal_run", { terminal_id: "t1", command: "npm test" },
      new TerminalToolResult(TerminalToolReaderTests.report, "fail\n\n\n[Status: Exited. Exit code: 2.]", false), {}, "item-1");

    Assert.areEqual("$ npm test\nfail\n\n(exit 2)", detail.text);
    Assert.areEqual(JSON.stringify({ tool: "terminal_run", command: "npm test", terminalId: "t1", terminalTitle: "bash - project", exitCode: 2,
      status: "completed", title: "Run in bash - project" }), JSON.stringify(detail.payload));
    Assert.isNull(detail.parentItemId);
  }

  @TestMethod
  public namesNoTerminalWhoseReportedTitleIsBlank(): void {
    const untitled = TerminalToolReader.read("terminal_run", { terminal_id: "t1", command: "ls" },
      new TerminalToolResult({ ...TerminalToolReaderTests.report, title: "" }, "", false), {}, "u");
    const blank = TerminalToolReader.read("terminal_write", { terminal_id: "t1", keys: "q" },
      new TerminalToolResult({ ...TerminalToolReaderTests.report, title: "  " }, "", false), {}, "b");
    const untitledPayload = JsonReader.fromValue(untitled.payload);

    Assert.isNull(untitledPayload.readNullableString("terminalTitle"));
    Assert.areEqual("Run in a terminal", untitledPayload.readString("title"));
    Assert.areEqual("Sent keys to a terminal", JsonReader.fromValue(blank.payload).readString("title"));
  }

  @TestMethod
  public saysACommandStillRunsAndFailsOneTerminalKilled(): void {
    const running = TerminalToolReader.read("terminal_run", { command: "sleep 100" },
      new TerminalToolResult({ ...TerminalToolReaderTests.report, status: "Running", exit_code: null, output: "" }, "", false), {}, "r");
    const waiting = TerminalToolReader.read("terminal_run", { command: "read x" },
      new TerminalToolResult({ ...TerminalToolReaderTests.report, status: "AwaitingInput", exit_code: null }, "", false), {}, "w");
    const killed = TerminalToolReader.read("terminal_run", { command: "yes" },
      new TerminalToolResult({ ...TerminalToolReaderTests.report, status: "Killed", exit_code: null, output: "y\n" }, "", false), {}, "k");

    Assert.areEqual("$ sleep 100\n\n(still running in the terminal)", running.text);
    Assert.areEqual("completed", (running.payload as JsonObject)["status"]);
    Assert.areEqual("$ read x\nfail\n\n(still running in the terminal)", waiting.text);
    Assert.areEqual("$ yes\ny\n", killed.text);
    Assert.areEqual("failed", (killed.payload as JsonObject)["status"]);
    Assert.isNull((killed.payload as JsonObject)["terminalId"]);
  }

  @TestMethod
  public showsAFailedCallsMessageWhenTerminalGaveNoReport(): void {
    const detail = TerminalToolReader.read("terminal_run", { terminal_id: "t9", command: "ls" },
      new TerminalToolResult(null, "terminal.notFound: There's no terminal t9.", true), { denied: true }, "f");

    Assert.areEqual("$ ls\nterminal.notFound: There's no terminal t9.", detail.text);
    Assert.areEqual(JSON.stringify({ denied: true, tool: "terminal_run", command: "ls", terminalId: "t9", terminalTitle: null, exitCode: null,
      status: "failed", title: "Run in a terminal" }), JSON.stringify(detail.payload));
  }

  @TestMethod
  public showsTheKeysTypedEscapedAndNoConfirmationAsOutput(): void {
    const detail = TerminalToolReader.read("terminal_write", { terminal_id: "t1", keys: "y\r" },
      new TerminalToolResult({ terminal_id: "t1", title: "python - project" }, "Sent the keys to terminal t1.", false), {}, "k");

    Assert.areEqual("$ y\\r\n", detail.text);
    Assert.areEqual(JSON.stringify({ tool: "terminal_write", command: "y\\r", terminalId: "t1", terminalTitle: "python - project", exitCode: null,
      status: "completed", title: "Sent keys to python - project" }), JSON.stringify(detail.payload));
  }

  @TestMethod
  @TestData("terminal_run", null, "$ terminal_run\n")
  @TestData("terminal_write", null, "$ terminal_write\n")
  @TestData("terminal_run", [], "$ terminal_run\n")
  @TestData("terminal_write", { keys: 1 }, "$ terminal_write\n")
  public namesTheToolWhenTheCallHoldsNoCommandOrKeys(tool: string, input: JsonValue, expected: string): void {
    Assert.areEqual(expected, TerminalToolReader.read(tool, input, null, {}, "n").text);
  }

  @TestMethod
  public keepsTheLastCharactersOfALongOutput(): void {
    const output = `${"a".repeat(10)}${"b".repeat(4000)}`;
    const detail = TerminalToolReader.read("terminal_run", { command: "cat big" },
      new TerminalToolResult({ ...TerminalToolReaderTests.report, exit_code: 0, output: 7 }, "", false), {}, "o");
    const long = TerminalToolReader.read("terminal_run", { command: "cat big" },
      new TerminalToolResult({ ...TerminalToolReaderTests.report, exit_code: 1.5, output }, "", false), {}, "l");

    Assert.areEqual("$ cat big\n\n(exit 0)", detail.text);
    Assert.areEqual(`$ cat big\n…${"b".repeat(4000)}`, long.text);
    Assert.isNull((long.payload as JsonObject)["exitCode"]);
  }
}
