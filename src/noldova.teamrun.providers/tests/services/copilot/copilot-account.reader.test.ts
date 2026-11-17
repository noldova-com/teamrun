/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { ProviderIdentity } from "@noldova/teamrun.protocol";
import { CopilotAccountReader } from "@noldova/teamrun.providers";

@TestClass
export class CopilotAccountReaderTests {
  @TestMethod
  public readsTheGitHubUserNameAndTheSignInOfASignedInStatus(): void {
    const full = CopilotAccountReader.read({ isAuthenticated: true, authType: "gh-cli", host: "https://github.com", login: "octocat", statusMessage: "Signed in" });
    const named = CopilotAccountReader.read({ isAuthenticated: true, login: "octocat" });
    const typed = CopilotAccountReader.read({ isAuthenticated: true, authType: "env", login: " " });

    Assert.areEqual("octocat gh-cli", CopilotAccountReaderTests.describe(full));
    Assert.areEqual("octocat none", CopilotAccountReaderTests.describe(named));
    Assert.areEqual("none env", CopilotAccountReaderTests.describe(typed));
    Assert.isUndefined(full?.email);
  }

  @TestMethod
  public readsNoAccountUnlessSignedInWithOneNamed(): void {
    const answers = [{ isAuthenticated: false, login: "octocat" }, { login: "octocat" }, { isAuthenticated: "true", login: "octocat" }, { isAuthenticated: true },
      { isAuthenticated: true, login: 7, authType: null }, null, "signed in"];

    Assert.areEqual(answers.length, answers.filter(t => Object.isNull(CopilotAccountReader.read(t))).length);
  }

  private static describe(identity: ProviderIdentity | null): string {
    return [identity?.userName ?? "none", identity?.authMethod ?? "none"].join(" ");
  }
}
