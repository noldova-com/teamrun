/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CommandRun, NotificationAction, NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";
import { ModuleDeclaration, NotificationPolicy, RegistrationException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class NotificationPolicyTests {
  private static readonly NOTES: ModuleDeclaration = new ModuleDeclaration("notes", "0.0.1", "Notes", "Keeps notes.", ["tasks"], null, new Map([["notifications", ["notes.saved"]]]));
  private static readonly TASKS: ModuleDeclaration = new ModuleDeclaration("tasks", "0.0.1", "Tasks", "Tracks tasks.", [], null, new Map([["notifications", ["tasks.due"]]]));

  @TestMethod
  public allowsADeclaredKindWithTheModulesOwnAndItsDependenciesCommands(): void {
    const policy = new NotificationPolicy([NotificationPolicyTests.NOTES, NotificationPolicyTests.TASKS], () => true);

    Assert.isNull(policy.findRefusal(NotificationPolicyTests.post("notes.saved", "notes.open", ["tasks.show", "notes.undo"])));
    Assert.doesNotThrow(() => policy.requireDeclared(NotificationPolicyTests.NOTES, NotificationPolicyTests.post("notes.saved", null, [])));
  }

  @TestMethod
  public refusesAnUndeclaredKindAndAnotherModulesCommand(): void {
    const policy = new NotificationPolicy([NotificationPolicyTests.NOTES, NotificationPolicyTests.TASKS], () => true);

    const undeclared = Assert.throws(() => policy.requireDeclared(NotificationPolicyTests.NOTES, NotificationPolicyTests.post("notes.deleted", null, [])), RegistrationException);
    const open = policy.findRefusal(NotificationPolicyTests.post("tasks.due", "notes.open", []));
    const action = policy.findRefusal(NotificationPolicyTests.post("notes.saved", null, ["calendar.show"]));
    const windowUndeclared = policy.findRefusal(NotificationPolicyTests.post("notes.deleted", null, []));

    Assert.areEqual("The module notes does not declare notes.deleted among its notifications.", undeclared.message);
    Assert.areEqual("The module tasks may not offer the command notes.open in a notification; it must be its own or a dependency's.", open);
    Assert.areEqual("The module notes may not offer the command calendar.show in a notification; it must be its own or a dependency's.", action);
    Assert.areEqual(undeclared.message, windowUndeclared);
  }

  @TestMethod
  public refusesAWindowsPostForAModuleThatIsInactiveOrAbsent(): void {
    const policy = new NotificationPolicy([NotificationPolicyTests.NOTES], t => t !== "notes");

    const inactive = policy.findRefusal(NotificationPolicyTests.post("notes.saved", null, []));
    const absent = policy.findRefusal(NotificationPolicyTests.post("calendar.due", null, []));

    Assert.areEqual("The notification kind notes.saved belongs to notes, which is not an active module.", inactive);
    Assert.areEqual("The notification kind calendar.due belongs to calendar, which is not an active module.", absent);
  }

  private static post(kind: string, open: string | null, actions: readonly string[]): NotificationPost {
    return new NotificationPost(
      QualifiedName.parse(kind), null, "Title", null, NotificationSeverity.Info,
      open === null ? null : NotificationPolicyTests.run(open), actions.map(t => new NotificationAction("Run", NotificationPolicyTests.run(t))), null);
  }

  private static run(name: string): CommandRun {
    return new CommandRun(QualifiedName.parse(name), null);
  }
}
