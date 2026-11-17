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
import { FirstLaunch } from "@noldova/teamrun.protocol";

@TestClass
export class FirstLaunchTests {
  @TestMethod
  public roundTripsThroughJsonFinishedOrNot(): void {
    const finished = FirstLaunch.fromJson({ finishedAt: "2026-10-23T20:00:00.000Z" });
    const open = FirstLaunch.fromJson({ finishedAt: null });

    Assert.areEqual(JSON.stringify({ finishedAt: "2026-10-23T20:00:00.000Z" }), JSON.stringify(finished.toJson()));
    Assert.areEqual(JSON.stringify({ finishedAt: null }), JSON.stringify(open.toJson()));
    Assert.isTrue(finished.isFinished);
    Assert.isFalse(open.isFinished);
  }

  @TestMethod
  public rejectsABlankTimeAndInvalidJson(): void {
    Assert.throws(() => new FirstLaunch(" "), ArgumentException);
    Assert.areEqual("$.finishedAt", Assert.throws(() => FirstLaunch.fromJson({ finishedAt: 3 }), JsonException).path);
  }
}
