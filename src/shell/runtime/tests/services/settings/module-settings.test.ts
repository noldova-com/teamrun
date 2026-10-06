/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { QualifiedName, SettingKey, SettingScope, SettingValue } from "@noldova/teamrun-shell-protocol";
import { EventRegistry, MethodRegistry, RegistrationException, ServiceRegistry, SettingException } from "@noldova/teamrun-shell-runtime";

import { ModuleContextFixture } from "../../fixtures/module-context.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";

@TestClass
export class ModuleSettingsTests {
  @TestMethod
  public async readsItsOwnItsDependenciesAndTheShellsSettingsAndChangesOnlyItsOwn(): Promise<void> {
    await using settings = await SettingsFixture.createAsync(ModuleContextFixture.SETTINGS);
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), new ServiceRegistry());
    const folder = new SettingScope(QualifiedName.parse("notes.folder"), "f1");
    const tasks = new SettingScope(QualifiedName.parse("tasks.list"), "l1");

    context.settings.write("notes.sortBy", "title");
    context.settings.write("notes.sortBy", "date", folder);
    const read = ["notes.sortBy", "tasks.size", "shell.mode"].map(t => context.settings.read(t));
    const scoped = context.settings.read("notes.sortBy", folder);
    context.settings.reset("notes.sortBy", folder);
    context.settings.setScopeParent(folder, tasks);
    context.settings.setScopeParent(folder, null);
    context.settings.removeScope(folder);

    Assert.areEqual("title,a,a,date,title", [...read, scoped, context.settings.read("notes.sortBy", folder)].join(","));
    Assert.areEqual("The module notes may only read its own settings, its dependencies' and the shell's, not clock.speed.",
      Assert.throws(() => context.settings.read("clock.speed"), RegistrationException).message);
    Assert.throws(() => context.settings.read("notes.missing"), SettingException);
    const unlisted = Assert.throws(() => context.settings.read("notes.sortBy", tasks), SettingException);
    Assert.areEqual("InvalidParams: The setting notes.sortBy does not list the scope tasks.list.", `${unlisted.failure.code}: ${unlisted.message}`);
    Assert.areEqual("The module notes may only change its own settings, not tasks.size.",
      Assert.throws(() => context.settings.write("tasks.size", "b"), RegistrationException).message);
    Assert.throws(() => context.settings.reset("shell.mode"), RegistrationException);
    Assert.throws(() => context.settings.setScopeParent(tasks, null), RegistrationException);
    Assert.throws(() => context.settings.setScopeParent(folder, new SettingScope(QualifiedName.parse("clock.dial"), "d1")), RegistrationException);
    Assert.throws(() => context.settings.removeScope(tasks), RegistrationException);
  }

  @TestMethod
  public async followsAReadableSettingUntilWithdrawn(): Promise<void> {
    await using settings = await SettingsFixture.createAsync(ModuleContextFixture.SETTINGS);
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), new ServiceRegistry());
    const seen: string[] = [];
    context.settings.onChanged("tasks.size", t => seen.push(String(t.value)));

    settings.service.write(new SettingValue(new SettingKey(QualifiedName.parse("shell.mode")), "b"));
    settings.service.write(new SettingValue(new SettingKey(QualifiedName.parse("tasks.size")), "c"));
    context[Symbol.dispose]();
    settings.service.write(new SettingValue(new SettingKey(QualifiedName.parse("tasks.size")), "d"));

    Assert.areEqual("c", seen.join(","));
    Assert.throws(() => context.settings.onChanged("clock.speed", () => undefined), RegistrationException);
  }
}
