/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { OrganizationIdParams } from "@noldova/teamrun.protocol";

@TestClass
export class OrganizationIdParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const json = new OrganizationIdParams("o1").toJson();

    Assert.areEqual('{"organizationId":"o1"}', JSON.stringify(OrganizationIdParams.fromJson(json).toJson()));
    Assert.areEqual("$.input.organizationId", Assert.throws(() => OrganizationIdParams.fromJson({ organizationId: " " }, "$.input"), JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.areEqual("organizationId", Assert.throws(() => new OrganizationIdParams(" "), ArgumentException).parameterName);
  }
}
