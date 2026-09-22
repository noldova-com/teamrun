/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from "node:events";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CliSettings, CommandContext, CommandLine, OutputFormat } from "@noldova/teamrun-cli";

import { FakeConsole } from "../fixtures/fake-console.fixture.js";

@TestClass
export class CommandContextTests {
  @TestMethod
  public keepsItsParts(): void {
    const commandLine = CommandLine.parse(["help"]);
    const settings = new CliSettings("/data", OutputFormat.Json, 5, null, "1.0.0");
    const console = new FakeConsole();
    const signals = new EventEmitter();
    const connections = { readLiveLock: () => null, connect: () => Promise.reject(new Error("unused")) };

    const context = new CommandContext(commandLine, settings, console, connections, signals);

    Assert.areEqual(commandLine, context.commandLine);
    Assert.areEqual(settings, context.settings);
    Assert.areEqual(console, context.console);
    Assert.areEqual(connections, context.connections);
    Assert.areEqual(signals, context.signals);
  }
}
