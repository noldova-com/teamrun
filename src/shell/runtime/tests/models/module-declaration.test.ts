/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DeclarationsFormatException, ModuleDeclaration } from "@noldova/teamrun-shell-runtime";

@TestClass
export class ModuleDeclarationTests {
  private static readonly VALID: Readonly<Record<string, unknown>> = {
    id: "notes",
    displayName: "Notes",
    dependencies: ["tasks"],
    runtimePackage: "@noldova/teamrun-modules-notes-runtime",
    contributes: { methods: ["notes.list"], events: [] }
  };

  @TestMethod
  public readsADeclarationAndListsItsContributionsByKind(): void {
    const declaration = ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, laterField: true });
    const windowOnly = ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, runtimePackage: null });

    Assert.areEqual("notes", declaration.id);
    Assert.areEqual("Notes", declaration.displayName);
    Assert.areEqual("tasks", declaration.dependencies.join(","));
    Assert.areEqual("@noldova/teamrun-modules-notes-runtime", declaration.runtimePackage);
    Assert.areEqual("notes.list", declaration.listContributions("methods").join(","));
    Assert.areEqual(0, declaration.listContributions("events").length);
    Assert.areEqual(0, declaration.listContributions("views").length);
    Assert.isNull(windowOnly.runtimePackage);
  }

  @TestMethod
  public keepsItsOwnCopies(): void {
    const dependencies = ["tasks"];
    const methods = ["notes.list"];
    const contributions = new Map([["methods", methods]]);

    const declaration = new ModuleDeclaration("notes", "Notes", dependencies, null, contributions);
    dependencies.push("clock");
    methods.push("notes.open");
    contributions.set("events", ["notes.changed"]);

    Assert.areEqual("tasks", declaration.dependencies.join(","));
    Assert.areEqual("notes.list", declaration.listContributions("methods").join(","));
    Assert.areEqual(0, declaration.listContributions("events").length);
  }

  @TestMethod
  @TestData("shell")
  @TestData("Notes")
  @TestData("")
  public refusesAnInvalidId(id: string): void {
    Assert.throws(() => new ModuleDeclaration(id, "Notes", [], null, new Map()), ArgumentException);
    Assert.areEqual(
      "A module declaration's id is missing or invalid.",
      Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, id }), DeclarationsFormatException).message);
  }

  @TestMethod
  public refusesABlankDisplayName(): void {
    Assert.throws(() => new ModuleDeclaration("notes", " ", [], null, new Map()), ArgumentException);
  }

  @TestMethod
  public namesTheFirstMissingOrInvalidField(): void {
    const cases: readonly (readonly [unknown, string])[] = [
      [[], "A module declaration is not a JSON object."],
      [null, "A module declaration is not a JSON object."],
      [ModuleDeclarationTests.without("id"), "A module declaration's id is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, id: 3 }, "A module declaration's id is missing or invalid."],
      [ModuleDeclarationTests.without("contributes"), "A module declaration's contributes is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, contributes: [] }, "A module declaration's contributes is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, contributes: { methods: "notes.list" } }, "A module declaration's contributes is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, contributes: { methods: [" "] } }, "A module declaration's contributes is missing or invalid."],
      [ModuleDeclarationTests.without("displayName"), "A module declaration's displayName is missing or invalid."],
      [ModuleDeclarationTests.without("dependencies"), "A module declaration's dependencies is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, dependencies: [1] }, "A module declaration's dependencies is missing or invalid."],
      [ModuleDeclarationTests.without("runtimePackage"), "A module declaration's runtimePackage is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, runtimePackage: "" }, "A module declaration's runtimePackage is missing or invalid."]
    ];
    for (const [value, message] of cases)
      Assert.areEqual(message, Assert.throws(() => ModuleDeclaration.fromJson(value), DeclarationsFormatException).message);
  }

  @TestMethod
  public readsTheSettingsItDeclaresAndRefusesAnotherOwnersOrAnInvalidOne(): void {
    const setting = { name: "notes.sortBy", title: "Sort by", description: "Orders the list.", type: { kind: "Text", maxLength: 20 }, default: "title", locality: "Shared", scopes: [], page: "Notes", group: "List" };

    const declaration = ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, settings: [setting] });

    Assert.areEqual("notes.sortBy", declaration.settings.map(t => t.name.text).join(","));
    Assert.areEqual(0, ModuleDeclaration.fromJson(ModuleDeclarationTests.VALID).settings.length);
    Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, settings: {} }), DeclarationsFormatException);
    Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, settings: [{ ...setting, default: 1 }] }), DeclarationsFormatException);
    Assert.areEqual("The module notes declares the setting tasks.size, which it does not own. (Parameter 'settings')",
      Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, settings: [{ ...setting, name: "tasks.size" }] }), ArgumentException).message);
  }

  private static without(field: string): Readonly<Record<string, unknown>> {
    return Object.fromEntries(Object.entries(ModuleDeclarationTests.VALID).filter(([name]) => name !== field));
  }
}
