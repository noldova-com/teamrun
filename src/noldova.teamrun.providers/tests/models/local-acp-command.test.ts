/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFileSync } from "node:fs";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SharedMcpSecret } from "@noldova/teamrun.protocol";
import { LocalAcpCommand, Resources } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

const REFERENCE = `teamrun.mcpSecret${"a".repeat(32)}`;

@TestClass
export class LocalAcpCommandTests {
  @TestMethod
  public runsAsAKindOfItsOwnThatStartsItsCommandWithItsSavedValues(): void {
    const command = new LocalAcpCommand("my-agent", " My agent ", " node ", ["agent.js", "--acp"], [new SharedMcpSecret("MY_AGENT_KEY", REFERENCE)]);

    const agent = command.toAgent({ MY_AGENT_KEY: "value" }, { HOME: "home" }, "home");
    const launch = agent.launch(null, null, "chat");

    Assert.areEqual("local-my-agent|My agent|node", [command.kindId, command.name, command.command].join("|"));
    Assert.areEqual("local-my-agent|My agent", `${agent.descriptor.id}|${agent.descriptor.displayName}`);
    Assert.areEqual("node|agent.js,--acp|chat|value|home", [launch.command.executable, launch.command.arguments.join(","), launch.directory,
      launch.environment["MY_AGENT_KEY"], launch.environment["HOME"]].join("|"));
    Assert.isNull(agent.readTerminalSignIn(JsonReader.fromValue({ authMethods: [{ type: "terminal", id: "login", args: ["login"] }] })));
  }

  @TestMethod
  public signsInInATerminalWithItsCommandAloneOnlyWhenItTakesNoArguments(): void {
    const command = new LocalAcpCommand("my-agent", "My agent", "agent", [], [new SharedMcpSecret("MY_AGENT_KEY", REFERENCE)]);

    const terminal = command.toAgent({ MY_AGENT_KEY: "value" }, { HOME: "home" }, "home")
      .readTerminalSignIn(JsonReader.fromValue({ authMethods: [{ type: "terminal", id: "login", args: ["login"] }] }));

    Assert.areEqual("agent login", terminal?.command);
    Assert.isUndefined(terminal?.environment["MY_AGENT_KEY"]);
  }

  @TestMethod
  public writesOnlyItsValuesReferencesAndReadsWithoutArgumentsOrSecrets(): void {
    const command = new LocalAcpCommand("my-agent", "My agent", "C:\\Tools\\agent.exe", ["--acp"], [new SharedMcpSecret("A", REFERENCE)]);

    const read = LocalAcpCommand.fromJson(JsonReader.fromValue(JSON.parse(JSON.stringify(command.toJson())) as unknown));
    const bare = LocalAcpCommand.fromJson(JsonReader.fromValue({ id: "bare", name: "Bare", cmd: "bare-agent" }));

    Assert.areEqual(JSON.stringify({ id: "my-agent", name: "My agent", cmd: "C:\\Tools\\agent.exe", args: ["--acp"], secrets: [{ variable: "A", reference: REFERENCE, updatedAt: null }] }),
      JSON.stringify(read.toJson()));
    Assert.areEqual("bare|bare-agent||0", [bare.id, bare.command, bare.arguments.join(","), bare.secrets.length].join("|"));
  }

  @TestMethod
  public failsAtLaunchWithTheReasonWhenItsValuesCantBeRead(): void {
    const command = new LocalAcpCommand("agent", "Agent", "node");

    const agent = command.toAgent(() => {
      throw new Error("The value is no longer saved.");
    }, {}, "home");

    Assert.areEqual("The value is no longer saved.", Assert.throws(() => agent.launch(null, null), Error).message);
  }

  @TestMethod
  public refusesAnIdThatIsntOneAndABlankNameOrCommand(): void {
    const cases: readonly [() => LocalAcpCommand, string][] = [
      [() => new LocalAcpCommand("My Agent", "Name", "node"), Resources.idField],
      [() => new LocalAcpCommand("1agent", "Name", "node"), Resources.idField],
      [() => new LocalAcpCommand("a".repeat(65), "Name", "node"), Resources.idField],
      [() => new LocalAcpCommand("agent", " ", "node"), Resources.nameField],
      [() => new LocalAcpCommand("agent", "Name", ""), Resources.acpRegistryCommandField]
    ];
    for (const [create, parameter] of cases)
      Assert.areEqual(parameter, Assert.throws(create, ArgumentException).parameterName);
    Assert.isTrue(Assert.throws(() => new LocalAcpCommand("My Agent", "Name", "node"), ArgumentException).message.includes(Resources.formatLocalAcpIdInvalid("My Agent")));
    Assert.areEqual(`local-${"a".repeat(64)}`, new LocalAcpCommand("a".repeat(64), "Name", "node").kindId);
  }

  @TestMethod
  public runsAWindowsBatchFileThePathFindsThroughItsShellWithItsArgumentsEscapedTwice(): void {
    using directory = new TemporaryDirectory();
    const batch = directory.resolve("agent.cmd");
    const program = directory.resolve("tool.exe");
    writeFileSync(batch, "@echo off");
    writeFileSync(program, "");
    const shell = "C:\\Windows\\System32\\cmd.exe";
    const environment = { PATH: directory.path, PATHEXT: ".exe;.cmd", HOME: "home" };
    const meta = /([()\][%!^"`<>&|;, *?])/gu;

    const command = new LocalAcpCommand("agent", "Agent", "agent", ['say "hi" & exit', "plain"]);
    const started = command.commandFor("win32", environment, { COMSPEC: shell });
    const plain = new LocalAcpCommand("tool", "Tool", "tool", ["a & b"]).commandFor("win32", environment);
    const elsewhere = command.commandFor("linux", environment);
    const launched = command.toAgent({ COMSPEC: shell }, environment, "home", "win32").launch(null, null);
    const unread = command.toAgent(() => ({}), { ...environment, COMSPEC: shell }, "home", "win32").launch(null, null);

    Assert.areEqual(shell, started.executable);
    Assert.areEqual(JSON.stringify(["/d", "/s", "/c", `"${batch.replace(meta, "^$1")} ^^^"say^^^ \\^^^"hi\\^^^"^^^ ^^^&^^^ exit^^^" ^^^"plain^^^""`]),
      JSON.stringify(started.arguments));
    Assert.isTrue(started.isVerbatim);
    Assert.areEqual(`${program}|a & b|false`, [plain.executable, plain.arguments.join(","), plain.isVerbatim].join("|"));
    Assert.areEqual("agent|say \"hi\" & exit,plain|false", [elsewhere.executable, elsewhere.arguments.join(","), elsewhere.isVerbatim].join("|"));
    Assert.areEqual(`${shell}|true`, `${launched.command.executable}|${launched.command.isVerbatim}`);
    Assert.areEqual(`${shell}|true`, `${unread.command.executable}|${unread.command.isVerbatim}`);
  }
}
