/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ModuleState, ModuleStatus, ModuleStatusList } from "@noldova/teamrun-shell-protocol";

@TestClass
export class ModuleStatusListTests {
  @TestMethod
  public pinsItsWireFormAndKeepsItsOwnCopy(): void {
    const declared = (id: string): string => `"id":"${id}","version":"0.0.1","displayName":"${id}","description":"Used by the tests.","dependencies":[],"contributes":{}`;
    const text = `{"modules":[{${declared("tasks")},"state":"Active"},{${declared("notes")},"state":"Failed","cause":"Its runtime part failed to activate."}]}`;
    const statuses = [
      new ModuleStatus("tasks", "0.0.1", "tasks", "Used by the tests.", [], new Map(), ModuleState.Active, null),
      new ModuleStatus("notes", "0.0.1", "notes", "Used by the tests.", [], new Map(), ModuleState.Failed, "Its runtime part failed to activate.")
    ];

    const list = new ModuleStatusList(statuses);
    statuses.pop();

    Assert.areEqual(text, JSON.stringify(list.toJson()));
    Assert.areEqual(text, JSON.stringify(ModuleStatusList.fromJson({ ...JSON.parse(text), build: "later" }).toJson()));
  }

  @TestMethod
  public namesTheInvalidStatusByItsPath(): void {
    Assert.areEqual("$.modules", Assert.throws(() => ModuleStatusList.fromJson({}), JsonException).path);
    const modules = [ModuleStatusListTests.declared("tasks", "Active"), ModuleStatusListTests.declared("notes", "Blocked")];
    Assert.areEqual("$.modules.1.cause", Assert.throws(() => ModuleStatusList.fromJson({ modules }), JsonException).path);
  }

  private static declared(id: string, state: string): Readonly<Record<string, unknown>> {
    return { id, version: "0.0.1", displayName: id, description: "Used by the tests.", dependencies: [], contributes: {}, state };
  }
}
