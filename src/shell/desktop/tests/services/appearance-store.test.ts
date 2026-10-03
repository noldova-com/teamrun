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

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { AppearanceStore } from "@noldova/teamrun-shell-desktop";

@TestClass
export class AppearanceStoreTests {
  @TestMethod
  public async readsNothingBeforeTheFirstWriteThenKeepsTheLastOfWritesMadeTogether(): Promise<void> {
    await AppearanceStoreTests.withFolderAsync(async root => {
      const folder = join(root, "device");
      const store = new AppearanceStore(folder);

      const before = await store.readAsync();
      await Promise.all([store.writeAsync({ "shell.mode": "Dark" }), store.writeAsync({ "shell.mode": "Light", "shell.panelSize": 14 })]);

      Assert.isNull(before);
      Assert.areEqual(JSON.stringify({ "shell.mode": "Light", "shell.panelSize": 14 }), JSON.stringify(await new AppearanceStore(folder).readAsync()));
      Assert.areEqual("{\"shell.mode\":\"Light\",\"shell.panelSize\":14}", await readFile(join(folder, "appearance.json"), "utf8"));
      Assert.isFalse(existsSync(join(folder, "appearance.json.tmp")));
    });
  }

  @TestMethod
  public async refusesAFileThatIsNotAJsonObject(): Promise<void> {
    await AppearanceStoreTests.withFolderAsync(async folder => {
      const store = new AppearanceStore(folder);

      await writeFile(join(folder, "appearance.json"), "{\"shell.mode\":");
      await Assert.throwsAsync(() => store.readAsync(), SyntaxError);
      await writeFile(join(folder, "appearance.json"), "[\"Dark\"]");
      await Assert.throwsAsync(() => store.readAsync(), JsonException);
    });
  }

  @TestMethod
  public async rejectsAWriteItCannotMakeAndStillMakesTheNext(): Promise<void> {
    await AppearanceStoreTests.withFolderAsync(async root => {
      const blocked = join(root, "file");
      await writeFile(blocked, "");
      const store = new AppearanceStore(join(blocked, "device"));
      const working = new AppearanceStore(root);

      await Assert.throwsAsync(() => store.writeAsync({ "shell.mode": "Dark" }), Error);
      await Assert.throwsAsync(() => store.writeAsync({ "shell.mode": "Light" }), Error);
      await working.writeAsync({ "shell.mode": "Light" });

      Assert.areEqual(JSON.stringify({ "shell.mode": "Light" }), JSON.stringify(await working.readAsync()));
    });
  }

  private static async withFolderAsync(run: (folder: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "teamrun-appearance-"));
    try {
      await run(folder);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
