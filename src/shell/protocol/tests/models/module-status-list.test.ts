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
    const text = "{\"modules\":[{\"id\":\"tasks\",\"state\":\"Active\"},{\"id\":\"notes\",\"state\":\"Failed\",\"cause\":\"Its runtime part failed to activate.\"}]}";
    const statuses = [new ModuleStatus("tasks", ModuleState.Active, null), new ModuleStatus("notes", ModuleState.Failed, "Its runtime part failed to activate.")];

    const list = new ModuleStatusList(statuses);
    statuses.pop();

    Assert.areEqual(text, JSON.stringify(list.toJson()));
    Assert.areEqual(text, JSON.stringify(ModuleStatusList.fromJson({ ...JSON.parse(text), build: "later" }).toJson()));
  }

  @TestMethod
  public namesTheInvalidStatusByItsPath(): void {
    Assert.areEqual("$.modules", Assert.throws(() => ModuleStatusList.fromJson({}), JsonException).path);
    Assert.areEqual("$.modules.1.cause", Assert.throws(() => ModuleStatusList.fromJson({ modules: [{ id: "tasks", state: "Active" }, { id: "notes", state: "Blocked" }] }), JsonException).path);
  }
}
