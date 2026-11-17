/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SignInCheck } from "@noldova/teamrun.core";
import { AuthStatus, ProviderIdentity } from "@noldova/teamrun.protocol";
import { CursorAboutReader } from "@noldova/teamrun.providers";

@TestClass
export class CursorAboutReaderTests {
  @TestMethod
  public readsTheVersionPlanAndEmailCursorsAboutPrints(): void {
    const text = ["About Cursor CLI", "", "CLI Version         2026.10.22-27dcf5f", "Latest              disabled", "Model               Auto",
      "Subscription Tier   Free", "OS                  darwin (arm64)", "Terminal            apple-terminal", "Shell               zsh",
      "User Email          person@example.com", ""].join("\r\n");

    const check = CursorAboutReader.read(text, new SignInCheck(AuthStatus.LoggedIn, null, null, null));

    Assert.areEqual("LoggedIn:2026.10.22-27dcf5f:Free:person@example.com", [check.authStatus, check.harnessVersion, check.identity?.plan, check.identity?.email].join(":"));
  }

  @TestMethod
  public keepsTheCheckWhenAboutNamesNeitherPlanNorEmail(): void {
    const identity = new ProviderIdentity("person@example.com");
    const check = new SignInCheck(AuthStatus.LoggedIn, identity, "1.0.0", null);

    const read = CursorAboutReader.read("About Cursor CLI\n\nnothing here\n", check);

    Assert.areEqual(identity, read.identity);
    Assert.areEqual("1.0.0", read.harnessVersion);
  }
}
