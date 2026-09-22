/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { OutputFormat } from "@noldova/teamrun-cli";

@TestClass
export class OutputFormatTests {
  @TestMethod
  public namesBothFormats(): void {
    Assert.areEqual("Text,Json", Object.values(OutputFormat).join(","));
  }
}
