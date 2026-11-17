/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DownloadAddress } from "@noldova/teamrun.providers";

@TestClass
export class DownloadAddressTests {
  @TestMethod
  public takesHttpsAndThisComputersOwnPlainAddressesOnly(): void {
    for (const url of ["https://example.com/a", "http://localhost:8080/a", "http://127.0.0.1/a", "http://[::1]:8080/a"])
      Assert.isTrue(DownloadAddress.isSafe(url), url);
    for (const url of ["", "not an address", "http://example.com/a", "http://localhost.example.com/a", "ftp://example.com/a", "file:///a"])
      Assert.isFalse(DownloadAddress.isSafe(url), url);
  }
}
