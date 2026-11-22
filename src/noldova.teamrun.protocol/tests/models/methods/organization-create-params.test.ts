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
import { OrganizationCreateParams } from "@noldova/teamrun.protocol";

@TestClass
export class OrganizationCreateParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const json = new OrganizationCreateParams("Studio", "/work/studio").toJson();

    Assert.areEqual('{"name":"Studio","folder":"/work/studio"}', JSON.stringify(OrganizationCreateParams.fromJson(json).toJson()));
    Assert.isNull(OrganizationCreateParams.fromJson({ name: "Studio", folder: null }).folder);
    Assert.areEqual("$.input.name", Assert.throws(() => OrganizationCreateParams.fromJson({ name: "", folder: null }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.folder", Assert.throws(() => OrganizationCreateParams.fromJson({ name: "Studio" }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.folder", Assert.throws(() => OrganizationCreateParams.fromJson({ name: "Studio", folder: " " }, "$.input"), JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.areEqual("name", Assert.throws(() => new OrganizationCreateParams(" ", null), ArgumentException).parameterName);
    Assert.areEqual("folder", Assert.throws(() => new OrganizationCreateParams("Studio", ""), ArgumentException).parameterName);
  }
}
