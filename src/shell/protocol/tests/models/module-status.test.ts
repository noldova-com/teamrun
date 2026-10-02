/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ModuleState, ModuleStatus } from "@noldova/teamrun-shell-protocol";

@TestClass
export class ModuleStatusTests {
  @TestMethod
  public pinsItsWireFormWithACauseOnlyWhenNotActive(): void {
    const active = "{\"id\":\"notes\",\"state\":\"Active\"}";
    const blocked = "{\"id\":\"notes\",\"state\":\"Blocked\",\"cause\":\"It depends on tasks, which is not active.\"}";

    Assert.areEqual(active, JSON.stringify(new ModuleStatus("notes", ModuleState.Active, null).toJson()));
    Assert.areEqual(blocked, JSON.stringify(new ModuleStatus("notes", ModuleState.Blocked, "It depends on tasks, which is not active.").toJson()));
    Assert.areEqual(active, JSON.stringify(ModuleStatus.fromJson(JSON.parse(active)).toJson()));
    Assert.areEqual(blocked, JSON.stringify(ModuleStatus.fromJson(JSON.parse(blocked)).toJson()));
  }

  @TestMethod
  public ignoresFieldsALaterBuildAdds(): void {
    const status = ModuleStatus.fromJson({ id: "notes", state: "Failed", cause: "Its runtime part could not be loaded.", retryable: true });

    Assert.areEqual(ModuleState.Failed, status.state);
    Assert.areEqual("Its runtime part could not be loaded.", status.cause);
  }

  @TestMethod
  public refusesACauseThatDoesNotMatchTheState(): void {
    Assert.throws(() => new ModuleStatus(" ", ModuleState.Active, null), ArgumentException);
    Assert.throws(() => new ModuleStatus("notes", ModuleState.Active, "Its runtime part failed to activate."), ArgumentException);
    Assert.throws(() => new ModuleStatus("notes", ModuleState.Failed, null), ArgumentException);
    Assert.throws(() => new ModuleStatus("notes", ModuleState.Blocked, " "), ArgumentException);
    Assert.areEqual("$.cause", Assert.throws(() => ModuleStatus.fromJson({ id: "notes", state: "Failed" }), JsonException).path);
    Assert.areEqual("$.state", Assert.throws(() => ModuleStatus.fromJson({ id: "notes", state: "Paused" }), JsonException).path);
  }
}
