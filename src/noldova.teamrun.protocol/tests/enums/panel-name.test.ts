/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PanelName } from "@noldova/teamrun.protocol";

@TestClass
export class PanelNameTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    for (const [name, value] of Object.entries(PanelName))
      Assert.areEqual(name, value);
    Assert.areEqual(JSON.stringify(["Teammates", "Providers", "Chat", "Projects", "Activity", "Changes", "Plan", "SubAgents", "BackgroundTasks", "Page"]), JSON.stringify(Object.values(PanelName)));
  }
}
