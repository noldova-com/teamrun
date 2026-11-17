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
import { PermissionDetail, PermissionDetailKind } from "@noldova/teamrun.protocol";

@TestClass
export class PermissionDetailTests {
  @TestMethod
  public roundTripsThroughJson(): void {
    const json = { label: "Chat", kind: "AgentText", value: "Release notes" };
    const detail = PermissionDetail.fromJson(json);

    Assert.areEqual(PermissionDetailKind.AgentText, detail.kind);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(detail.toJson()));
  }

  @TestMethod
  public keepsNoValueForASecretAndAValueForEveryOtherDetail(): void {
    Assert.isNull(new PermissionDetail("Token", PermissionDetailKind.Secret, null).value);
    Assert.areEqual("value", Assert.throws(() => new PermissionDetail("Token", PermissionDetailKind.Secret, "abc"), ArgumentException).parameterName);
    Assert.areEqual("value", Assert.throws(() => new PermissionDetail("Folder", PermissionDetailKind.Code, null), ArgumentException).parameterName);
    Assert.areEqual("label", Assert.throws(() => new PermissionDetail(" ", PermissionDetailKind.Text, "x"), ArgumentException).parameterName);
  }

  @TestMethod
  public rejectsAnUnknownKind(): void {
    Assert.throws(() => PermissionDetail.fromJson({ label: "Chat", kind: "Html", value: "x" }), JsonException);
  }
}
