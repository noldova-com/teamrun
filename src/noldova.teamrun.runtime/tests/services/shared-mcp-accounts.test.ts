/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SharedMcpAccount } from "@noldova/teamrun.protocol";
import { type IGitHubAccess, Resources, SharedMcpAccounts } from "@noldova/teamrun.runtime";

@TestClass
export class SharedMcpAccountsTests {
  @TestMethod
  public async grantsTheGitHubModulesTokenWithNoExpiryAndRefusesWithItsReasonReadingItAfreshEachTime(): Promise<void> {
    const signals: AbortSignal[] = [];
    let answer: { readonly token: string; readonly login: string } | { readonly reason: string } = { token: "gho_7c41a9", login: "octocat" };
    const access: IGitHubAccess = { accessAsync: signal => {
      signals.push(signal);
      return Promise.resolve(answer);
    } };
    const accounts = new SharedMcpAccounts(() => access);

    const granted = await accounts.accessAsync(SharedMcpAccount.GitHub);
    answer = { reason: "Sign in to GitHub in Settings, GitHub." };
    const refused = await accounts.accessAsync(SharedMcpAccount.GitHub);

    Assert.areEqual(JSON.stringify(["gho_7c41a9", null, null]), JSON.stringify([granted.token, granted.expiresAt, granted.needsSignIn]));
    Assert.areEqual(JSON.stringify([String.empty, "Sign in to GitHub in Settings, GitHub."]), JSON.stringify([refused.token, refused.needsSignIn]));
    Assert.areEqual(2, signals.length);
    Assert.isFalse(signals.some(t => t.aborted));
  }

  @TestMethod
  public async refusesWhileTheGitHubModuleIsntOnAndFailsWithTheServicesError(): Promise<void> {
    const failing: IGitHubAccess = { accessAsync: () => Promise.reject(new Error("The sign-in can't be read.")) };

    const inactive = await new SharedMcpAccounts(() => null).accessAsync(SharedMcpAccount.GitHub);
    const error = await Assert.throwsAsync(() => new SharedMcpAccounts(() => failing).accessAsync(SharedMcpAccount.GitHub), Error);

    Assert.areEqual(Resources.formatSharedMcpAccountInactive(SharedMcpAccount.GitHub), inactive.needsSignIn);
    Assert.areEqual("The GitHub module isn't on, so TeamRun can't use its sign-in.", inactive.needsSignIn);
    Assert.areEqual("The sign-in can't be read.", error.message);
  }

  @TestMethod
  public knowsTheGitHubModulesAccessServiceByItsMethod(): void {
    Assert.isTrue(SharedMcpAccounts.isGitHubAccess({ accessAsync: () => Promise.resolve({ reason: "Signed out." }) }));
    Assert.isFalse(SharedMcpAccounts.isGitHubAccess({ accessAsync: "gho_token" }));
    Assert.isFalse(SharedMcpAccounts.isGitHubAccess({}));
    Assert.areEqual("git-github.access", Resources.gitHubAccessService);
  }
}
