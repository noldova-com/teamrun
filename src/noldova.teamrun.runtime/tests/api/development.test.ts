/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import * as runtime from "@noldova/teamrun.runtime";
import * as api from "@noldova/teamrun.runtime/development";

@TestClass
export class DevelopmentApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    const expected = [
      "PngEncoder", "StressChatCommand", "StressChatComposer", "StressChatImage", "StressChatProject", "StressChatResources", "StressChatScenario",
      "StressChatSeeder"
    ];

    Assert.areEqual([...expected].sort().join(","), Object.keys(api).sort().join(","));
  }

  @TestMethod
  public staysOutOfTheRuntimesEntry(): void {
    Assert.isFalse(Object.keys(runtime).some(t => Object.keys(api).includes(t)));
  }
}
