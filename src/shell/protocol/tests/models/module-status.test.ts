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
  private static readonly DECLARED: string =
    "\"id\":\"notes\",\"displayName\":\"Notes\",\"description\":\"Keeps notes.\",\"dependencies\":[\"tasks\"],\"contributes\":{\"commands\":[\"notes.newNote\"],\"views\":[]}";
  private static readonly CONTRIBUTIONS: ReadonlyMap<string, readonly string[]> = new Map([["commands", ["notes.newNote"]], ["views", []]]);

  @TestMethod
  public pinsItsWireFormWithACauseOnlyWhenNotActiveAndTheBlockerOnlyWhenBlocked(): void {
    const active = `{${ModuleStatusTests.DECLARED},"state":"Active"}`;
    const failed = `{${ModuleStatusTests.DECLARED},"state":"Failed","cause":"Its runtime part could not be loaded."}`;
    const blocked = `{${ModuleStatusTests.DECLARED},"state":"Blocked","cause":"It depends on tasks, which is not active.","blockedBy":"tasks"}`;

    Assert.areEqual(active, JSON.stringify(ModuleStatusTests.create(ModuleState.Active, null).toJson()));
    Assert.areEqual(failed, JSON.stringify(ModuleStatusTests.create(ModuleState.Failed, "Its runtime part could not be loaded.").toJson()));
    Assert.areEqual(blocked, JSON.stringify(ModuleStatusTests.create(ModuleState.Blocked, "It depends on tasks, which is not active.", "tasks").toJson()));
    for (const text of [active, failed, blocked])
      Assert.areEqual(text, JSON.stringify(ModuleStatus.fromJson(JSON.parse(text)).toJson()));
  }

  @TestMethod
  public listsWhatItDeclaresByKindAndKeepsItsOwnCopies(): void {
    const dependencies = ["tasks"];
    const commands = ["notes.newNote"];
    const status = new ModuleStatus("notes", "Notes", "Keeps notes.", dependencies, new Map([["commands", commands]]), ModuleState.Active, null);
    dependencies.push("clock");
    commands.push("notes.open");

    Assert.areEqual("Notes Keeps notes.", `${status.displayName} ${status.description}`);
    Assert.areEqual("tasks", status.dependencies.join(","));
    Assert.areEqual("notes.newNote", status.listContributions("commands").join(","));
    Assert.areEqual(0, status.listContributions("menus").length);
    Assert.isNull(status.blockedBy);
  }

  @TestMethod
  public returnsTheSameModuleInAnotherState(): void {
    const blocked = ModuleStatusTests.create(ModuleState.Active, null).withState(ModuleState.Blocked, "It depends on tasks, which is not active.", "tasks");
    const failed = blocked.withState(ModuleState.Failed, "Its window part could not be loaded.");

    Assert.areEqual(`Blocked tasks ${ModuleStatusTests.CONTRIBUTIONS.size}`, `${blocked.state} ${blocked.blockedBy} ${blocked.contributions.size}`);
    Assert.areEqual("Failed null Notes", `${failed.state} ${failed.blockedBy} ${failed.displayName}`);
  }

  @TestMethod
  public ignoresFieldsALaterBuildAdds(): void {
    const status = ModuleStatus.fromJson({ ...JSON.parse(`{${ModuleStatusTests.DECLARED}}`), state: "Failed", cause: "Its runtime part could not be loaded.", retryable: true });

    Assert.areEqual(ModuleState.Failed, status.state);
    Assert.areEqual("Its runtime part could not be loaded.", status.cause);
  }

  @TestMethod
  public refusesBlankNamesAndACauseOrBlockerThatDoesNotMatchTheState(): void {
    Assert.throws(() => new ModuleStatus(" ", "Notes", "Keeps notes.", [], new Map(), ModuleState.Active, null), ArgumentException);
    Assert.throws(() => new ModuleStatus("notes", " ", "Keeps notes.", [], new Map(), ModuleState.Active, null), ArgumentException);
    Assert.throws(() => new ModuleStatus("notes", "Notes", " ", [], new Map(), ModuleState.Active, null), ArgumentException);
    Assert.throws(() => ModuleStatusTests.create(ModuleState.Active, "Its runtime part failed to activate."), ArgumentException);
    Assert.throws(() => ModuleStatusTests.create(ModuleState.Failed, null), ArgumentException);
    Assert.throws(() => ModuleStatusTests.create(ModuleState.Blocked, " ", "tasks"), ArgumentException);
    Assert.areEqual("blockedBy", Assert.throws(() => ModuleStatusTests.create(ModuleState.Blocked, "It depends on tasks.", null), ArgumentException).parameterName);
    Assert.areEqual("blockedBy", Assert.throws(() => ModuleStatusTests.create(ModuleState.Blocked, "It depends on clock.", "clock"), ArgumentException).parameterName);
    Assert.areEqual("blockedBy", Assert.throws(() => ModuleStatusTests.create(ModuleState.Failed, "It broke.", "tasks"), ArgumentException).parameterName);
  }

  @TestMethod
  public namesTheFieldOfAnInvalidWireForm(): void {
    const declared = JSON.parse(`{${ModuleStatusTests.DECLARED}}`) as Record<string, unknown>;
    const cases: readonly (readonly [Record<string, unknown>, string])[] = [
      [{ ...declared, state: "Failed" }, "$.cause"],
      [{ ...declared, state: "Paused" }, "$.state"],
      [{ ...declared, state: "Active", displayName: 1 }, "$.displayName"],
      [{ ...declared, state: "Active", dependencies: "tasks" }, "$.dependencies"],
      [{ ...declared, state: "Active", contributes: [] }, "$.contributes"],
      [{ ...declared, state: "Active", contributes: { commands: [1] } }, "$.contributes.commands.0"],
      [{ ...declared, state: "Blocked", cause: "It depends on tasks.", blockedBy: 2 }, "$.blockedBy"]
    ];
    for (const [value, path] of cases)
      Assert.areEqual(path, Assert.throws(() => ModuleStatus.fromJson(value), JsonException).path);
  }

  private static create(state: ModuleState, cause: string | null, blockedBy: string | null = null): ModuleStatus {
    return new ModuleStatus("notes", "Notes", "Keeps notes.", ["tasks"], ModuleStatusTests.CONTRIBUTIONS, state, cause, blockedBy);
  }
}
