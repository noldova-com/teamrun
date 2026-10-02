/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Registration } from "@noldova/teamrun-shell-runtime";

@TestClass
export class RegistrationTests {
  @TestMethod
  public releasesWhenDisposed(): void {
    let releases = 0;
    const registration = new Registration(() => releases++);

    registration[Symbol.dispose]();

    Assert.areEqual(1, releases);
  }
}
