/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join, sep } from "node:path";

import { ChangeOperation } from "@noldova/teamrun-foundation-data";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ChangeEntity, SignInCheck } from "@noldova/teamrun-core";
import { AuthStatus, ErrorCode, EventName, ProviderAccountCreateParams, ProviderAccountIdParams } from "@noldova/teamrun-protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class ProviderAccountsServiceTests {
  @TestMethod
  public createsListsAndFindsAccounts(): void {
    using host = new CoreHost();

    const account = host.accounts.create(new ProviderAccountCreateParams("fake", "Work", join(host.directory.path, "profiles", "work") + sep));

    Assert.areEqual("fake", account.provider);
    Assert.areEqual("Work", account.label);
    Assert.areEqual(join(host.directory.path, "profiles", "work"), account.profileDir);
    Assert.areEqual(AuthStatus.Unknown, account.authStatus);
    Assert.areEqual(account.id, host.accounts.list()[0]?.id);
    Assert.areEqual(account.id, host.accounts.find(account.id)?.id);
    Assert.isNull(host.accounts.find("nope"));
  }

  @TestMethod
  public rejectsUnknownProvidersAndRelativeDirectories(): void {
    using host = new CoreHost();

    const unknown = Assert.throws(() => host.accounts.create(new ProviderAccountCreateParams("nope", "Work", join(host.directory.path, "p"))), ServiceException);
    const relative = Assert.throws(() => host.accounts.create(new ProviderAccountCreateParams("fake", "Work", "profiles/work")), ServiceException);

    Assert.areEqual(ErrorCode.NotFound, unknown.info.name);
    Assert.areEqual(ErrorCode.InvalidParams, relative.info.name);
  }

  @TestMethod
  public async checksAnAccountThroughItsAdapterAndPublishesTheUpdate(): Promise<void> {
    using host = new CoreHost();
    const account = host.createAccount();

    const checked = await host.accounts.check(new ProviderAccountIdParams(account.id));
    host.adapter.signInCheck = new SignInCheck(AuthStatus.Error, null, null, "codex.exe not found");
    const failed = await host.accounts.check(new ProviderAccountIdParams(account.id));

    Assert.areEqual(AuthStatus.LoggedIn, checked.authStatus);
    Assert.areEqual("dev@example.com", checked.identity?.email);
    Assert.areEqual("1.0.0", checked.harnessVersion);
    Assert.isFalse(checked.lastCheckedAt === null);
    Assert.areEqual(AuthStatus.Error, failed.authStatus);
    Assert.areEqual("codex.exe not found", failed.lastError);
    Assert.areEqual(AuthStatus.Error, host.accounts.find(account.id)?.authStatus);
    Assert.areEqual(2, host.adapter.checkedAccounts.length);
    Assert.areEqual(2, host.listener.count(EventName.ProviderAccountUpdated));
    Assert.areEqual(ErrorCode.NotFound, (await ProviderAccountsServiceTests.rejection(host.accounts.check(new ProviderAccountIdParams("nope")))).info.name);
  }

  @TestMethod
  public deletesAnAccountAndLogsIt(): void {
    using host = new CoreHost();
    const account = host.createAccount();

    host.accounts.delete(new ProviderAccountIdParams(account.id));

    Assert.areEqual(0, host.accounts.list().length);
    const last = host.context.database.changeFeed.readAfter(0).at(-1);
    Assert.areEqual(ChangeEntity.ProviderAccount, last?.entity);
    Assert.areEqual(ChangeOperation.Delete, last?.operation);
    Assert.areEqual(ErrorCode.NotFound, Assert.throws(() => host.accounts.delete(new ProviderAccountIdParams(account.id)), ServiceException).info.name);
  }

  private static async rejection(promise: Promise<unknown>): Promise<ServiceException> {
    try {
      await promise;
    }
    catch (error) {
      if (error instanceof ServiceException)
        return error;
      throw error;
    }
    throw new Error("The promise did not reject.");
  }
}
