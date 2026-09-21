/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { GrokEnvironment, GrokProfile } from "@noldova/teamrun-providers";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class GrokEnvironmentTests {
  @TestMethod
  public isolatesDiscoveryAndRemovesInheritedCredentials(): void {
    using directory = new TemporaryDirectory();
    const base = { PATH: "native-bin", USER_TOKEN: "fixture", GIT_ASKPASS: "fixture", SSH_ASKPASS: "fixture", GROK_HOME: "personal", GROK_CONFIG: "fixture", OPENAI_BASE_URL: "fixture", HOME: "personal" };
    const profile = new GrokProfile(directory.path);
    const env = GrokEnvironment.build(base, profile);
    Assert.areEqual("native-bin", env["PATH"]);
    for (const key of ["USER_TOKEN", "GIT_ASKPASS", "SSH_ASKPASS", "GROK_CONFIG", "OPENAI_BASE_URL"])
      Assert.isUndefined(env[key]);
    Assert.areEqual(directory.path, env["GROK_HOME"]);
    Assert.areEqual(profile.homeDirectory, env["HOME"]);
    Assert.areEqual(profile.homeDirectory, env["USERPROFILE"]);
    Assert.areEqual("0", env["GROK_MANAGED_MCPS_ENABLED"]);
    Assert.areEqual("reject", env["GROK_DEFAULT_SELECTED_PERMISSION"]);
    Assert.areEqual("personal", base.GROK_HOME);
  }
}
