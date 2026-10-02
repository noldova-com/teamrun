/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { BackupVerificationException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class BackupVerificationExceptionTests {
  @TestMethod
  public saysTheBackupFailedItsCheck(): void {
    const exception = new BackupVerificationException();

    Assert.areEqual("The database backup did not pass its integrity check.", exception.message);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("BackupVerificationException", exception.name);
  }
}
