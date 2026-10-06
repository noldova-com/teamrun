/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from "node:events";
import path from "node:path";
import { PassThrough } from "node:stream";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CliContext, DesktopOpener } from "@noldova/teamrun-shell-cli";
import { ChildProcessStarter, RuntimeBuild } from "@noldova/teamrun-shell-runtime";

@TestClass
export class CliContextTests {
  @TestMethod
  public startsTheRuntimeDirectlyAndTheDesktopDetachedByDefault(): void {
    const streams = new PassThrough();
    const signals = new EventEmitter();

    const entry = path.join("/opt", "teamrun", "node_modules", "@noldova", "teamrun-shell-runtime", "services", "runtime-entry.js");

    const context = new CliContext({ A: "1" }, "linux", "/home/person", "/opt/teamrun/teamrun", entry, RuntimeBuild.identity, streams, streams, streams, signals);

    Assert.isInstanceOf(context.runtimeStarter, ChildProcessStarter);
    Assert.isInstanceOf(context.desktopOpener, DesktopOpener);
    Assert.areEqual("1", context.environment["A"]);
    Assert.areEqual(`linux/home/person/opt/teamrun/teamrun${entry}`, `${context.platform}${context.homeFolder}${context.executablePath}${context.runtimeEntryPath}`);
    Assert.areEqual(RuntimeBuild.identity, context.identity);
    Assert.areEqual(signals, context.signals);
    Assert.isTrue(context.output === streams && context.error === streams && context.input === streams);
  }
}
