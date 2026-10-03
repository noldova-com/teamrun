/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DesktopOpener } from "@noldova/teamrun-shell-cli";

@TestClass
export class DesktopOpenerTests {
  @TestMethod
  public async startsAProgramDetached(): Promise<void> {
    await new DesktopOpener().openAsync(process.execPath, ["-e", "process.exit(0)"], process.env);
  }

  @TestMethod
  public async rejectsAProgramThatCannotStart(): Promise<void> {
    await Assert.throwsAsync(() => new DesktopOpener().openAsync(path.join(process.cwd(), "missing-program"), [], process.env), Error);
  }
}
