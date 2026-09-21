/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ErrorCode } from "@noldova/teamrun-protocol";

@TestClass
export class ErrorCodeTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("InvalidParams", ErrorCode.InvalidParams);
    Assert.areEqual("UnknownMethod", ErrorCode.UnknownMethod);
    Assert.areEqual("NotFound", ErrorCode.NotFound);
    Assert.areEqual("Conflict", ErrorCode.Conflict);
    Assert.areEqual("Unauthorized", ErrorCode.Unauthorized);
    Assert.areEqual("VersionMismatch", ErrorCode.VersionMismatch);
    Assert.areEqual("ProviderError", ErrorCode.ProviderError);
    Assert.areEqual("Unavailable", ErrorCode.Unavailable);
    Assert.areEqual("Internal", ErrorCode.Internal);
  }

  @TestMethod
  public valuesAreDistinct(): void {
    const values = Object.values(ErrorCode);

    Assert.areEqual(values.length, new Set(values).size);
  }
}
