/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ToolCallImage, ToolCallPermission, ToolCallRecord } from "@noldova/teamrun.core";

@TestClass
export class ToolCallRecordTests {
  @TestMethod
  public holdsACallsFieldsImageAndPermissionForItsStep(): void {
    const record = new ToolCallRecord("browser_screenshot", {}, { page: { url: "https://shop.test/cart", title: "Cart" } }, new ToolCallImage("AA==", "image/png"),
      new ToolCallPermission("request-1", "Low", "AllowedOnce", true));
    const plain = new ToolCallRecord("browser_console", {}, {});

    Assert.areEqual(JSON.stringify(["browser_screenshot", {}, { page: { url: "https://shop.test/cart", title: "Cart" } }, { data: "AA==", mediaType: "image/png" },
      { id: "request-1", risk: "Low", decision: "AllowedOnce", isRemembered: true }, null, null]),
      JSON.stringify([record.tool, record.input, record.fields, record.image, record.permission, plain.image, plain.permission]));
  }

  @TestMethod
  public rejectsABlankToolName(): void {
    Assert.areEqual("tool", Assert.throws(() => new ToolCallRecord(" ", {}, {}), ArgumentException).parameterName);
  }

  @TestMethod
  public matchesAStepOfTheSameToolAndInputInAnyKeyOrderOrAStepThatKeptNoInput(): void {
    const record = new ToolCallRecord("browser_click", { ref: "e5", element: "Pay", options: { button: "left", count: 1 } }, {});

    Assert.areEqual(JSON.stringify([true, true, false, false, false]), JSON.stringify([
      record.isCallOf("browser_click", { options: { count: 1, button: "left" }, element: "Pay", ref: "e5" }),
      record.isCallOf("browser_click", undefined),
      record.isCallOf("browser_click", { ref: "e6", element: "Pay", options: { button: "left", count: 1 } }),
      record.isCallOf("browser_type", { ref: "e5", element: "Pay", options: { button: "left", count: 1 } }),
      record.isCallOf(undefined, undefined)
    ]));
  }
}
