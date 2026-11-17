/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppLook } from "@noldova/teamrun.core";

@TestClass
export class AppLookTests {
  @TestMethod
  public holdsTheNameAndIcon(): void {
    const look = new AppLook("Notes", "iVBORw0KGgo=");

    Assert.areEqual(JSON.stringify(["Notes", "iVBORw0KGgo="]), JSON.stringify([look.name, look.icon]));
    Assert.isNull(new AppLook("Notes", null).icon);
  }

  @TestMethod
  public rejectsABlankNameOrIcon(): void {
    const name = Assert.throws(() => new AppLook(" ", null), ArgumentException);
    const icon = Assert.throws(() => new AppLook("Notes", String.empty), ArgumentException);

    Assert.areEqual(JSON.stringify(["name", "icon"]), JSON.stringify([name.parameterName, icon.parameterName]));
  }
}
