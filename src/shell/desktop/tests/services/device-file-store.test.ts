/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DeviceFileStore } from "@noldova/teamrun-shell-desktop";

@TestClass
export class DeviceFileStoreTests {
  @TestMethod
  public async readsNothingBeforeTheFirstWriteThenKeepsTheLastOfWritesMadeTogether(): Promise<void> {
    await DeviceFileStoreTests.withFolderAsync(async root => {
      const folder = join(root, "device");
      const store = new DeviceFileStore(folder, "appearance.json");

      const before = await store.readAsync();
      await Promise.all([store.writeAsync({ "shell.mode": "Dark" }), store.writeAsync({ "shell.mode": "Light", "shell.panelSize": 14 })]);

      Assert.isNull(before);
      Assert.areEqual(JSON.stringify({ "shell.mode": "Light", "shell.panelSize": 14 }), JSON.stringify(await new DeviceFileStore(folder, "appearance.json").readAsync()));
      Assert.areEqual("{\"shell.mode\":\"Light\",\"shell.panelSize\":14}", await readFile(join(folder, "appearance.json"), "utf8"));
      Assert.isFalse(existsSync(join(folder, "appearance.json.tmp")));
    });
  }

  @TestMethod
  public async keepsEachFileOfAFolderApart(): Promise<void> {
    await DeviceFileStoreTests.withFolderAsync(async folder => {
      await new DeviceFileStore(folder, "appearance.json").writeAsync({ "shell.mode": "Dark" });
      await new DeviceFileStore(folder, "device-state.json").writeAsync({ trayCloseHintShown: true });

      Assert.areEqual("{\"shell.mode\":\"Dark\"}", JSON.stringify(await new DeviceFileStore(folder, "appearance.json").readAsync()));
      Assert.areEqual("{\"trayCloseHintShown\":true}", await readFile(join(folder, "device-state.json"), "utf8"));
    });
  }

  @TestMethod
  public refusesAnEmptyFileName(): void {
    Assert.areEqual("fileName", Assert.throws(() => new DeviceFileStore("/devices/this", " "), ArgumentException).parameterName);
  }

  @TestMethod
  public async refusesAFileThatIsNotAJsonObject(): Promise<void> {
    await DeviceFileStoreTests.withFolderAsync(async folder => {
      const store = new DeviceFileStore(folder, "appearance.json");

      await writeFile(join(folder, "appearance.json"), "{\"shell.mode\":");
      await Assert.throwsAsync(() => store.readAsync(), SyntaxError);
      await writeFile(join(folder, "appearance.json"), "[\"Dark\"]");
      await Assert.throwsAsync(() => store.readAsync(), JsonException);
    });
  }

  @TestMethod
  public async rejectsAWriteItCannotMakeAndStillMakesTheNext(): Promise<void> {
    await DeviceFileStoreTests.withFolderAsync(async root => {
      const blocked = join(root, "file");
      await writeFile(blocked, "");
      const store = new DeviceFileStore(join(blocked, "device"), "appearance.json");
      const working = new DeviceFileStore(root, "appearance.json");

      await Assert.throwsAsync(() => store.writeAsync({ "shell.mode": "Dark" }), Error);
      await Assert.throwsAsync(() => store.writeAsync({ "shell.mode": "Light" }), Error);
      await working.writeAsync({ "shell.mode": "Light" });

      Assert.areEqual(JSON.stringify({ "shell.mode": "Light" }), JSON.stringify(await working.readAsync()));
    });
  }

  private static async withFolderAsync(run: (folder: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "teamrun-device-files-"));
    try {
      await run(folder);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
