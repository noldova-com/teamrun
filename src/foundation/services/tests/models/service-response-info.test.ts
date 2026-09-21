/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { ServiceResponseInfo } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class ServiceResponseInfoTests {
  @TestMethod
  public holdsANameAMessageAndACopyOfTheArguments(): void {
    const args = ["name"];
    const info = new ServiceResponseInfo("requiredField", "The field \"name\" is required.", args);
    args.length = 0;

    Assert.areEqual("requiredField", info.name);
    Assert.areEqual("The field \"name\" is required.", info.message);
    Assert.areEqual("name", info.arguments.join(","));
    Assert.areEqual(0, new ServiceResponseInfo("internal", "Something failed.").arguments.length);
  }

  @TestMethod
  public rejectsABlankNameOrMessage(): void {
    Assert.areEqual("name", Assert.throws(() => new ServiceResponseInfo(" ", "text"), ArgumentException).parameterName);
    Assert.areEqual("message", Assert.throws(() => new ServiceResponseInfo("notFound", ""), ArgumentException).parameterName);
  }
}
