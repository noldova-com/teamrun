/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ServiceResponseStatus } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class ServiceResponseStatusTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("Success", ServiceResponseStatus.Success);
    Assert.areEqual("Failure", ServiceResponseStatus.Failure);
    Assert.areEqual(2, Object.values(ServiceResponseStatus).length);
  }
}
