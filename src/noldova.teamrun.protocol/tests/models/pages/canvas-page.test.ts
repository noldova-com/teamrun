/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CanvasPage } from "@noldova/teamrun.protocol";

@TestClass
export class CanvasPageTests {
  @TestMethod
  public roundTripsThroughJson(): void {
    const json = { id: "cp1", name: "Options" };

    Assert.areEqual(JSON.stringify(json), JSON.stringify(CanvasPage.fromJson(json).toJson()));
  }

  @TestMethod
  public rejectsABlankIdOrName(): void {
    Assert.throws(() => new CanvasPage(" ", "Options"), ArgumentException);
    Assert.throws(() => new CanvasPage("cp1", " "), ArgumentException);
  }

  @TestMethod
  public takesAnIdAndNameOf120CharactersAndRefusesLonger(): void {
    const at = "x".repeat(120);
    const over = "x".repeat(121);

    Assert.throws(() => new CanvasPage(over, "Options"), ArgumentOutOfRangeException);
    Assert.throws(() => new CanvasPage("cp1", over), ArgumentOutOfRangeException);
    const longest = new CanvasPage(at, at);
    Assert.areEqual(`${at} ${at}`, `${longest.id} ${longest.name}`);
  }

  @TestMethod
  public rejectsAMissingNameWithItsPath(): void {
    Assert.areEqual("$.name", Assert.throws(() => CanvasPage.fromJson({ id: "cp1" }), JsonException).path);
  }
}
