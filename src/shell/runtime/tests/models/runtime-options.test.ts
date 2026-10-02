/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DataDirectory, RuntimeOptions, ServerSettings } from "@noldova/teamrun-shell-runtime";

@TestClass
export class RuntimeOptionsTests {
  private static readonly ROOT: string = path.resolve("data");

  @TestMethod
  public readsTheDataDirectoryAndTheIdleGrace(): void {
    const options = RuntimeOptions.parse(["--idle-grace", "250", "--data-dir", RuntimeOptionsTests.ROOT]);

    Assert.areEqual(RuntimeOptionsTests.ROOT, options.dataDirectory.root);
    Assert.areEqual(250, options.idleGraceMilliseconds);
    Assert.areEqual(600_000, options.serverSettings.defaultRequestTimeout);
  }

  @TestMethod
  public defaultsTheIdleGrace(): void {
    Assert.areEqual(30_000, RuntimeOptions.parse(["--data-dir", RuntimeOptionsTests.ROOT]).idleGraceMilliseconds);
  }

  @TestMethod
  public keepsTheGivenValues(): void {
    const directory = new DataDirectory(RuntimeOptionsTests.ROOT);
    const settings = new ServerSettings(10);

    const options = new RuntimeOptions(directory, 5, settings);

    Assert.areEqual(directory, options.dataDirectory);
    Assert.areEqual(5, options.idleGraceMilliseconds);
    Assert.areEqual(settings, options.serverSettings);
    Assert.areEqual(30_000, new RuntimeOptions(directory).idleGraceMilliseconds);
  }

  @TestMethod
  public rejectsArgumentsItDoesNotUnderstand(): void {
    const root = RuntimeOptionsTests.ROOT;
    RuntimeOptionsTests.assertRejected(["--data-dir"], "The argument --data-dir needs a value. (Parameter 'arguments')");
    RuntimeOptionsTests.assertRejected(["--data-dir", root, "--idle-grace", "0"], "The argument --idle-grace 0 is not valid. (Parameter 'arguments')");
    RuntimeOptionsTests.assertRejected(["--data-dir", root, "--idle-grace", "1.5"], "The argument --idle-grace 1.5 is not valid. (Parameter 'arguments')");
    RuntimeOptionsTests.assertRejected(["--port", "1", "--data-dir", root], "The argument --port 1 is not valid. (Parameter 'arguments')");
    RuntimeOptionsTests.assertRejected([], "The --data-dir argument is required. (Parameter 'arguments')");
    RuntimeOptionsTests.assertRejected(["--idle-grace", "10"], "The --data-dir argument is required. (Parameter 'arguments')");
    Assert.throws(() => RuntimeOptions.parse(["--data-dir", "relative"]), ArgumentException);
  }

  private static assertRejected(entryArguments: readonly string[], message: string): void {
    Assert.areEqual(message, Assert.throws(() => RuntimeOptions.parse(entryArguments), ArgumentException, entryArguments.join(" ")).message);
  }
}
