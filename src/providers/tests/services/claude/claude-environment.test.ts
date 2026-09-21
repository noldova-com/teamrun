/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ClaudeEnvironment } from "@noldova/teamrun-providers";

@TestClass
export class ClaudeEnvironmentTests {
  @TestMethod
  public dropsCredentialsKeepsRoutingAndPointsAtTheProfile(): void {
    const base = {
      PATH: "p",
      ANTHROPIC_API_KEY: "secret",
      CLAUDE_CODE_OAUTH_TOKEN: "secret",
      CLAUDEPID: "1",
      CLAUDE_CONFIG_DIR: "C:/default",
      CLAUDE_CODE_USE_BEDROCK: "1",
      claude_lowercase: "x"
    };

    const profiled = ClaudeEnvironment.build(base, "C:/profile", "1.2.3");
    const shared = ClaudeEnvironment.build(base, null, "1.2.3");

    Assert.areEqual("p", profiled["PATH"]);
    Assert.isUndefined(profiled["ANTHROPIC_API_KEY"]);
    Assert.isUndefined(profiled["CLAUDE_CODE_OAUTH_TOKEN"]);
    Assert.isUndefined(profiled["CLAUDEPID"]);
    Assert.isUndefined(profiled["claude_lowercase"]);
    Assert.areEqual("1", profiled["CLAUDE_CODE_USE_BEDROCK"]);
    Assert.areEqual("C:/profile", profiled["CLAUDE_CONFIG_DIR"]);
    Assert.areEqual("teamrun/1.2.3", profiled["CLAUDE_AGENT_SDK_CLIENT_APP"]);
    Assert.areEqual("1", profiled["DISABLE_AUTOUPDATER"]);
    Assert.areEqual("C:/default", shared["CLAUDE_CONFIG_DIR"]);
    Assert.isUndefined(shared["ANTHROPIC_API_KEY"]);
  }
}
