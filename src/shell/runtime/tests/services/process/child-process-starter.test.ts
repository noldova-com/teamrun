/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ChildProcessStarter, LaunchException } from "@noldova/teamrun-shell-runtime";

import { RuntimeLaunchFixture } from "../../fixtures/runtime-launch.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class ChildProcessStarterTests {
  @TestMethod
  public startsADetachedProgramWhoseErrorsGoToTheFile(): Promise<void> {
    return ChildProcessStarterTests.runAsync(async errorFile => {
      await writeFile(errorFile, "earlier\n");

      const processId = await new ChildProcessStarter().startAsync(process.execPath, ["-e", "console.error('started'); console.log('not kept')"], process.env, errorFile);

      Assert.isTrue(processId > 0);
      Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));
      Assert.areEqual("earlier\nstarted\n", (await readFile(errorFile, "utf8")).replaceAll("\r\n", "\n"));
    });
  }

  @TestMethod
  public reportsAProgramThatCannotStart(): Promise<void> {
    return ChildProcessStarterTests.runAsync(async errorFile => {
      const missing = path.join(path.dirname(errorFile), "missing-program");

      const exception = await Assert.throwsAsync(() => new ChildProcessStarter().startAsync(missing, [], process.env, errorFile), LaunchException);

      Assert.areEqual(`The runtime could not be started with ${missing}.`, exception.message);
      Assert.isInstanceOf(exception.cause, Error);
    });
  }

  private static async runAsync(test: (errorFile: string) => Promise<void>): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await test(path.join(folder.path, "start.log"));
  }
}
