/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CodexEnvironment } from "@noldova/teamrun-providers";

@TestClass
export class CodexEnvironmentTests {
  @TestMethod
  public dropsApiKeysAndPointsAtTheProfile(): void {
    const base = { PATH: "p", OPENAI_API_KEY: "secret", CODEX_API_KEY: "secret", CODEX_HOME: "C:/default" };

    const profiled = CodexEnvironment.build(base, "C:/profile");
    const shared = CodexEnvironment.build(base, null);

    Assert.areEqual("p", profiled["PATH"]);
    Assert.isUndefined(profiled["OPENAI_API_KEY"]);
    Assert.isUndefined(profiled["CODEX_API_KEY"]);
    Assert.areEqual("C:/profile", profiled["CODEX_HOME"]);
    Assert.areEqual("C:/default", shared["CODEX_HOME"]);
    Assert.isUndefined(shared["OPENAI_API_KEY"]);
  }
}
