/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { GrokEnvironment } from "@noldova/teamrun.providers";

@TestClass
export class GrokEnvironmentTests {
  @TestMethod
  public keepsThePersonsVariablesButOtherProvidersAndNamesTheHomeLeavingGroksKeysOutOnlyForAnAddedOne(): void {
    const base = { PATH: "native-bin", USER_TOKEN: "fixture", GIT_ASKPASS: "fixture", SSH_ASKPASS: "fixture", GROK_HOME: "personal", GROK_CONFIG: "fixture",
      XAI_API_KEY: "fixture", OPENAI_BASE_URL: "fixture", HOME: "personal" };

    const own = GrokEnvironment.build(base, "home", false, false);
    const added = GrokEnvironment.build(base, "home", true, true);

    Assert.areEqual(JSON.stringify(["native-bin", "fixture", "fixture", "fixture", "personal", "home", "1", null]), JSON.stringify(["PATH", "USER_TOKEN", "GROK_CONFIG",
      "XAI_API_KEY", "HOME", "GROK_HOME", "GROK_FOLDER_TRUST", "GROK_MEMORY"].map(t => own[t] ?? null)));
    for (const key of ["GIT_ASKPASS", "SSH_ASKPASS", "OPENAI_BASE_URL"])
      Assert.isUndefined(own[key]);
    Assert.areEqual(JSON.stringify([null, "fixture", "0", "home"]), JSON.stringify(["XAI_API_KEY", "GROK_CONFIG", "GROK_MEMORY", "GROK_HOME"].map(t => added[t] ?? null)));
    const off = ["GROK_MEMORY", "GROK_MANAGED_MCPS_ENABLED", "GROK_CLAUDE_MCPS_ENABLED", "GROK_CURSOR_MCPS_ENABLED", "GROK_CODEX_MCPS_ENABLED",
      "GROK_CLAUDE_HOOKS_ENABLED", "GROK_CURSOR_HOOKS_ENABLED", "GROK_CODEX_HOOKS_ENABLED"];
    Assert.areEqual(off.map(() => "0").join(), off.map(t => added[t]).join());
    Assert.isTrue(off.every(t => Object.isUndefined(own[t])));
    Assert.areEqual("personal", base.GROK_HOME);
  }
}
