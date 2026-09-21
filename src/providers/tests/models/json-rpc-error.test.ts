/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { JsonRpcError } from "@noldova/teamrun-providers";

@TestClass
export class JsonRpcErrorTests {
  @TestMethod
  public roundTripsWithAndWithoutData(): void {
    const withData = JsonRpcError.fromJson({ code: -32000, message: "bad", data: { detail: "x" } });
    const withoutData = JsonRpcError.fromJson({ code: 1, message: "plain" });

    Assert.areEqual(-32000, withData.code);
    Assert.areEqual("bad", withData.message);
    Assert.areEqual("{\"code\":-32000,\"message\":\"bad\",\"data\":{\"detail\":\"x\"}}", JSON.stringify(withData.toJson()));
    Assert.isNull(withoutData.data);
  }
}
