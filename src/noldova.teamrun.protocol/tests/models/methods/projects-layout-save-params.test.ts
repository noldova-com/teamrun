/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProjectsLayoutSaveParams } from "@noldova/teamrun.protocol";

@TestClass
export class ProjectsLayoutSaveParamsTests {
  @TestMethod
  public roundTripsALayoutThroughJsonAsItIs(): void {
    const json = { layout: { pinnedChats: ["c1"], chatOrder: { p1: ["c2", "c1"] } }, onlyIfNone: true };

    Assert.areEqual(JSON.stringify(json), JSON.stringify(ProjectsLayoutSaveParams.fromJson(json).toJson()));
    Assert.isFalse(ProjectsLayoutSaveParams.fromJson({ layout: {} }).onlyIfNone);
    Assert.areEqual("$.onlyIfNone", Assert.throws(() => ProjectsLayoutSaveParams.fromJson({ layout: {}, onlyIfNone: "yes" }), JsonException).path);
  }

  @TestMethod
  public rejectsAMissingLayoutOrOneThatIsNotAnObjectWithItsPath(): void {
    for (const json of [{}, { layout: null }, { layout: ["c1"] }, { layout: "{}" }])
      Assert.areEqual("$.layout", Assert.throws(() => ProjectsLayoutSaveParams.fromJson(json), JsonException).path);
  }
}
