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
import { PermissionDetail, PermissionDetailKind, PermissionPayload, PermissionRisk } from "@noldova/teamrun.protocol";

@TestClass
export class PermissionPayloadTests {
  @TestMethod
  public roundTripsThroughJson(): void {
    const json = { module: "teamrun", subject: "chat-1", risk: "High", details: [{ label: "Chat", kind: "Text", value: "Release" }, { label: "Token", kind: "Secret", value: null }] };
    const payload = PermissionPayload.fromJson(json);

    Assert.areEqual(PermissionRisk.High, payload.risk);
    Assert.areEqual("Release,", payload.details.map(t => t.value ?? String.empty).join(","));
    Assert.areEqual(JSON.stringify(json), JSON.stringify(payload.toJson()));
  }

  @TestMethod
  public keepsACopyOfItsDetailsAndAllowsNoSubject(): void {
    const details = [new PermissionDetail("Folder", PermissionDetailKind.Code, "/work")];
    const payload = new PermissionPayload("notes", null, PermissionRisk.Low, details);
    details.pop();

    Assert.isNull(payload.subject);
    Assert.areEqual(1, payload.details.length);
  }

  @TestMethod
  public rejectsABlankModuleOrAnUnknownRisk(): void {
    Assert.areEqual("module", Assert.throws(() => new PermissionPayload(" ", null, PermissionRisk.Low, []), ArgumentException).parameterName);
    Assert.throws(() => PermissionPayload.fromJson({ module: "teamrun", subject: null, risk: "Severe", details: [] }), JsonException);
  }

  @TestMethod
  public roundTripsTheServedCallThatAskedAndLeavesItOutWhenTheRequestNamesNone(): void {
    const named = { module: "browser", subject: "c1", risk: "Medium", details: [], servedTool: "browser_click", servedInput: { ref: "e5", element: "Choose Team" } };
    const unnamed = { module: "browser", subject: "c1", risk: "Medium", details: [] };

    Assert.areEqual(JSON.stringify([named, unnamed]), JSON.stringify([PermissionPayload.fromJson(named).toJson(), PermissionPayload.fromJson(unnamed).toJson()]));
    Assert.isNull(PermissionPayload.fromJson(unnamed).served);
  }

  @TestMethod
  public rejectsABlankServedToolOrAServedToolWithoutItsInput(): void {
    Assert.areEqual("servedTool", Assert.throws(() => new PermissionPayload("browser", null, PermissionRisk.Low, [], { tool: " ", input: {} }), ArgumentException)
      .parameterName);
    Assert.throws(() => PermissionPayload.fromJson({ module: "browser", subject: null, risk: "Low", details: [], servedTool: "browser_click" }), JsonException);
    Assert.throws(() => PermissionPayload.fromJson({ module: "browser", subject: null, risk: "Low", details: [], servedTool: " ", servedInput: {} }), JsonException);
  }

  @TestMethod
  public tellsTheStepOfTheCallThatAskedFromAnotherOpenStepOfTheSameToolOrOneWithoutItsInput(): void {
    const payload = new PermissionPayload("browser", "c1", PermissionRisk.Medium, [], { tool: "browser_click", input: { ref: "e5", element: "Choose Team" } });

    Assert.areEqual(JSON.stringify([true, false, false, false, false]), JSON.stringify([
      payload.isCallOf("browser_click", { element: "Choose Team", ref: "e5" }),
      payload.isCallOf("browser_click", { ref: "e7", element: "Cancel" }),
      payload.isCallOf("browser_type", { ref: "e5", element: "Choose Team" }),
      payload.isCallOf("browser_click", undefined),
      new PermissionPayload("browser", "c1", PermissionRisk.Medium, []).isCallOf("browser_click", { ref: "e5", element: "Choose Team" })
    ]));
  }
}
