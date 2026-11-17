/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { type AppServerClient, CodexLogin } from "@noldova/teamrun.providers";

@TestClass
export class CodexLoginTests {
  @TestMethod
  public async endsWhenCodexReportsTheEndAfterTheLoginStarts(): Promise<void> {
    const succeeded = CodexLoginTests.createLogin();
    const failed = CodexLoginTests.createLogin();

    succeeded.begin("login-1");
    await CodexLoginTests.completeAsync(succeeded, { loginId: "login-1", success: true, error: null });
    failed.begin("login-1");
    await CodexLoginTests.completeAsync(failed, { loginId: "login-1", success: false, error: "access denied" });

    await succeeded.wait();
    Assert.areEqual("Codex couldn't sign in: access denied.", (await Assert.throwsAsync(() => failed.wait(), Error)).message);
  }

  @TestMethod
  public async endsWhenCodexReportsTheEndBeforeTheLoginStarts(): Promise<void> {
    const succeeded = CodexLoginTests.createLogin();
    const failed = CodexLoginTests.createLogin();

    await CodexLoginTests.completeAsync(succeeded, { loginId: "login-1", success: true, error: null });
    succeeded.begin("login-1");
    await CodexLoginTests.completeAsync(failed, { loginId: "login-1", success: false, error: "access denied" });
    failed.begin("login-1");

    await succeeded.wait();
    Assert.areEqual("Codex couldn't sign in: access denied.", (await Assert.throwsAsync(() => failed.wait(), Error)).message);
  }

  private static createLogin(): CodexLogin {
    const client = { request: (): Promise<JsonValue> => Promise.resolve(null) } as unknown as AppServerClient;
    return new CodexLogin(client, 1_000);
  }

  private static completeAsync(login: CodexLogin, params: JsonValue): Promise<void> {
    return login.handleNotificationAsync("account/login/completed", JsonReader.fromValue(params));
  }
}
