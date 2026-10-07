/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ShellNotifications } from "@noldova/teamrun-shell-protocol";

@TestClass
export class ShellNotificationsTests {
  @TestMethod
  public namesTheShellsOwnNotificationKinds(): void {
    Assert.areEqual("shell.saveFailed,shell.saveUnfinished,shell.updateReady", ShellNotifications.all.map(t => t.text).join(","));
    Assert.isTrue(ShellNotifications.all.every(t => t.isShell));
  }
}
