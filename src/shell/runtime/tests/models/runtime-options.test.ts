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
import { DataDirectory, RuntimeEntry, RuntimeOptions, ServerSettings } from "@noldova/teamrun-shell-runtime";

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
  public findsTheBuildsDeclarationsBesideTheInstalledRuntimeUnlessGiven(): void {
    const installed = path.resolve(path.dirname(RuntimeEntry.entryPath), "..", "..", "..", "..");
    const given = path.resolve("declarations.json");

    const options = RuntimeOptions.parse(["--data-dir", RuntimeOptionsTests.ROOT]);
    const explicit = new RuntimeOptions(new DataDirectory(RuntimeOptionsTests.ROOT), 5, new ServerSettings(), given);

    Assert.areEqual(path.join(installed, "_build", "modules", "declarations.json"), options.declarationsFile);
    Assert.areEqual(given, explicit.declarationsFile);
  }

  @TestMethod
  public readsTheStartLogName(): void {
    const name = "start-0f8b2c1e-6a4d-4e2b-9c3f-1a2b3c4d5e6f.log";

    const options = RuntimeOptions.parse(["--data-dir", RuntimeOptionsTests.ROOT, "--start-log", name]);

    Assert.areEqual(name, options.startLogName);
    Assert.isNull(RuntimeOptions.parse(["--data-dir", RuntimeOptionsTests.ROOT]).startLogName);
  }

  @TestMethod
  public readsTheInstallationsFolder(): void {
    const folder = "/home/person/.local/state/noldova/teamrun/installations/0123456789abcdef";

    const options = RuntimeOptions.parse(["--data-dir", RuntimeOptionsTests.ROOT, "--installation-dir", folder]);

    Assert.areEqual(folder, options.installationFolder);
    Assert.isNull(RuntimeOptions.parse(["--data-dir", RuntimeOptionsTests.ROOT]).installationFolder);
  }

  @TestMethod
  public rejectsAStartLogNameThatIsNotOne(): void {
    for (const name of ["../start-0f8b2c1e-6a4d-4e2b-9c3f-1a2b3c4d5e6f.log", "start-1.log", "runtime.log", "start-0F8B2C1E-6A4D-4E2B-9C3F-1A2B3C4D5E6F.log"]) {
      const exception = Assert.throws(() => RuntimeOptions.parse(["--data-dir", RuntimeOptionsTests.ROOT, "--start-log", name]), ArgumentException, name);
      Assert.areEqual(`"${name}" is not the name of a start log. (Parameter 'startLog')`, exception.message);
    }
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
