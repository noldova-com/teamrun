/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DataDirectory, OwnershipLock } from "@noldova/desktop.runtime";
import { StressChatCommand } from "@noldova/teamrun.runtime/development";

import { RecordingOutput } from "../../fixtures/recording-output.fixture.js";
import { SeededChat } from "../../fixtures/seeded-chat.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class StressChatCommandTests {
  private static readonly USAGE: string = "Usage: npm run seed:stress [-- --pairs <count>], with a count from 1 to 5000; 5000 when left out.\n";

  @TestMethod
  public async writesTheChatIntoTheAppsDevelopmentDataFolderWhenNoVariableNamesOne(): Promise<void> {
    using folder = new TemporaryDirectory();
    const app = StressChatCommandTests.createApp(folder);
    const output = new RecordingOutput();

    const exitCode = await new StressChatCommand(app, { FIXTURE_DATA_DIR: " " }, folder.resolve("home"), output).runAsync(["--pairs", "1"]);
    const chat = await SeededChat.readAsync(new DataDirectory(join(app, "_build", "data")));

    Assert.areEqual(0, exitCode);
    Assert.areEqual(2, chat.messages.length);
    Assert.isTrue(output.text.startsWith(`Wrote the chat "2 messages" into the project ${join(app, "_build", "data", "modules", "teamrun", "stress-chat")} in `));
  }

  @TestMethod
  public async writesTheChatIntoTheFolderTheVariableNames(): Promise<void> {
    using folder = new TemporaryDirectory();
    const app = StressChatCommandTests.createApp(folder);
    const data = folder.resolve("data");

    const exitCode = await new StressChatCommand(app, { FIXTURE_DATA_DIR: data }, folder.resolve("home"), new RecordingOutput()).runAsync(["--pairs", "3"]);
    const chat = await SeededChat.readAsync(new DataDirectory(data));

    Assert.areEqual(0, exitCode);
    Assert.areEqual(6, chat.messages.length);
    Assert.isFalse(existsSync(join(app, "_build")));
  }

  @TestMethod
  public async printsTheUsageForArgumentsItDoesNotTake(): Promise<void> {
    using folder = new TemporaryDirectory();
    const app = StressChatCommandTests.createApp(folder);

    for (const commandArguments of [["--count", "5"], ["--pairs"], ["--pairs", "5", "6"], ["--pairs", "0"], ["--pairs", "05"], ["--pairs", "5001"], ["--pairs", "ten"]]) {
      const output = new RecordingOutput();

      const exitCode = await new StressChatCommand(app, {}, folder.resolve("home"), output).runAsync(commandArguments);

      Assert.areEqual(2, exitCode);
      Assert.areEqual(StressChatCommandTests.USAGE, output.text);
    }
    Assert.isFalse(existsSync(join(app, "_build")));
  }

  @TestMethod
  public async refusesARelativeFolder(): Promise<void> {
    using folder = new TemporaryDirectory();
    const output = new RecordingOutput();

    const exitCode = await new StressChatCommand(StressChatCommandTests.createApp(folder), { FIXTURE_DATA_DIR: "data" }, folder.resolve("home"), output)
      .runAsync(["--pairs", "1"]);

    Assert.areEqual(1, exitCode);
    Assert.areEqual("FIXTURE_DATA_DIR names \"data\", which is not an absolute folder; name the development data folder by its absolute path.\n", output.text);
  }

  @TestMethod
  public async refusesTheInstalledAppsDataFolderInAnyCase(): Promise<void> {
    using folder = new TemporaryDirectory();
    const installed = join(folder.resolve("home"), ".fixtures", "app");
    const output = new RecordingOutput();

    const exitCode = await new StressChatCommand(StressChatCommandTests.createApp(folder), { FIXTURE_DATA_DIR: join(folder.resolve("HOME"), ".Fixtures", "App") },
      folder.resolve("home"), output).runAsync(["--pairs", "1"]);

    Assert.areEqual(1, exitCode);
    Assert.areEqual(`${installed} is the installed TeamRun's data folder; the stress chat goes only into a development data folder, `
      + "app/_build/data or another one FIXTURE_DATA_DIR names.\n", output.text);
    Assert.isFalse(existsSync(installed));
  }

  @TestMethod
  public async refusesAFolderTeamRunIsRunningOnBeforeItWritesTheFullChat(): Promise<void> {
    using folder = new TemporaryDirectory();
    const data = folder.resolve("data");
    using lock = OwnershipLock.acquire(new DataDirectory(data));
    const output = new RecordingOutput();

    const exitCode = await new StressChatCommand(StressChatCommandTests.createApp(folder), { FIXTURE_DATA_DIR: data }, folder.resolve("home"), output).runAsync([]);

    Assert.areEqual(1, exitCode);
    Assert.areEqual(`TeamRun is running on ${data}; quit it and run the command again.\n`, output.text);
    Assert.isTrue(lock.isHeld);
  }

  @TestMethod
  public async rejectsWithTheErrorOfAFolderItCannotWrite(): Promise<void> {
    using folder = new TemporaryDirectory();
    const file = folder.resolve("file");
    writeFileSync(file, "not a folder");

    await Assert.throwsAsync(() => new StressChatCommand(StressChatCommandTests.createApp(folder), { FIXTURE_DATA_DIR: file }, folder.resolve("home"),
      new RecordingOutput()).runAsync(["--pairs", "1"]), Error);
  }

  private static createApp(folder: TemporaryDirectory): string {
    const app = folder.resolve("app");
    mkdirSync(app);
    writeFileSync(join(app, "package.json"), JSON.stringify({
      name: "fixture-app",
      desktop: { product: { name: "Fixture App", dataFolder: ".fixtures/app", dataDirectoryVariable: "FIXTURE_DATA_DIR" } }
    }));
    return app;
  }
}
