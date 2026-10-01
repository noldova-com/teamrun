/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException, JsonReader } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { WireContract } from "@noldova/teamrun-shell-protocol";

@TestClass
export class WireContractTests {
  private readonly reader: JsonReader = JsonReader.fromValue({ name: "x" }, "$.item");

  @TestMethod
  public returnsTheCreatedModel(): void {
    Assert.areEqual("x", WireContract.create(this.reader, () => this.reader.readString("name")));
  }

  @TestMethod
  public reportsAnArgumentFailureAtTheFieldsPath(): void {
    const cause = new ArgumentException("Bad.", "name");
    const failure = Assert.throws(() => WireContract.create(this.reader, () => {
      throw cause;
    }), JsonException);

    Assert.areEqual("$.item.name", failure.path);
    Assert.areEqual<unknown>(cause, failure.cause);
  }

  @TestMethod
  public reportsAnArgumentFailureWithoutAParameterAtTheReadersPath(): void {
    const failure = Assert.throws(() => WireContract.create(this.reader, () => {
      throw new ArgumentException("Bad.");
    }), JsonException);

    Assert.areEqual("$.item", failure.path);
  }

  @TestMethod
  public keepsOtherFailuresUnchanged(): void {
    const original = new RangeError("other");

    Assert.areEqual<unknown>(original, Assert.throws(() => WireContract.create(this.reader, () => {
      throw original;
    }), RangeError));
  }
}
