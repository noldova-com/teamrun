/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CommandRun, type Event, NotificationAction, NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";
import {
  CommandRegistry,
  EventRegistry,
  MethodRegistry,
  NotificationCenter,
  RegistrationException,
  RuntimeCommand,
  ServiceAccessException,
  ServiceRegistry,
  WorkTracker
} from "@noldova/teamrun-shell-runtime";

import { ModuleContextFixture } from "../../fixtures/module-context.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class ModuleContextTests {
  @TestMethod
  public async namesTheModuleAndItsFolder(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), new ServiceRegistry());

    Assert.areEqual("notes", context.moduleId);
    Assert.areEqual(path.join(ModuleContextFixture.ROOT, "modules", "notes"), context.moduleFolder);
  }

  @TestMethod
  public async createsTheModulesWorkFolderWhenFirstAskedForIt(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const context = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), new ServiceRegistry(), undefined, undefined, undefined, undefined, folder.path);
    const expected = path.join(folder.path, "work", "notes");
    const before = existsSync(expected);

    const first = await context.getWorkFolderAsync();
    await writeFile(path.join(first, "draft.txt"), "kept");
    const second = await context.getWorkFolderAsync();

    Assert.isFalse(before);
    Assert.areEqual(expected, first);
    Assert.areEqual(expected, second);
    Assert.areEqual("kept", await readFile(path.join(second, "draft.txt"), "utf8"));
  }

  @TestMethod
  public async reportsTheModulesWorkAndAbortsAndEndsWhatIsStillOpenWhenDisposed(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const work = new WorkTracker(() => undefined);
    const shell = work.begin("Backing up");
    const context = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), new ServiceRegistry(), undefined, undefined, work);

    const saving = context.beginWork("Saving the notes");
    const indexing = context.beginWork("Indexing the notes");
    indexing[Symbol.dispose]();
    const reported = work.descriptions.join(",");
    Assert.throws(() => context.beginWork(" "), ArgumentException);
    context[Symbol.dispose]();

    Assert.areEqual("Backing up,Saving the notes", reported);
    Assert.isTrue(saving.signal.aborted);
    Assert.isFalse(indexing.signal.aborted);
    Assert.isFalse(shell.signal.aborted);
    Assert.areEqual("Backing up", work.descriptions.join(","));
  }

  @TestMethod
  public async startsTheModulesProgramsInTheRuntimesName(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), new ServiceRegistry());

    const owned = await context.startProcessAsync(ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "0"]));
    const owners = settings.processes.programs.map(t => t.moduleId).join(",");
    await owned.exited;

    Assert.areEqual("notes", owners);
    Assert.areEqual(process.execPath, owned.program);
  }

  @TestMethod
  public async registersOnlyTheMethodsAndEventsItsDeclarationContributes(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const methods = new MethodRegistry();
    const events: Event[] = [];
    const context = ModuleContextFixture.create(settings, methods, new EventRegistry({ broadcast: t => events.push(t) }), new ServiceRegistry());

    context.registerMethod("notes.list", { handleAsync: async () => [] });
    context.declareEvent("notes.changed").publish(1);
    const method = Assert.throws(() => context.registerMethod("notes.open", { handleAsync: async () => null }), RegistrationException);
    const event = Assert.throws(() => context.declareEvent("tasks.changed"), RegistrationException);

    Assert.isDefined(methods.find(new QualifiedName("notes", "list")));
    Assert.areEqual("notes.changed", events[0]?.name.text);
    Assert.areEqual("The module notes does not declare notes.open among its methods.", method.message);
    Assert.areEqual("The module notes does not declare tasks.changed among its events.", event.message);
  }

  @TestMethod
  public async registersOnlyTheCommandsItsDeclarationContributes(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const commands = new CommandRegistry();
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), new ServiceRegistry(), commands);

    context.registerCommand(new RuntimeCommand("notes.newNote", "New note", "note_add", "Mod+Alt+N", { handleAsync: async () => null }));
    const undeclared = Assert.throws(() => context.registerCommand(new RuntimeCommand("notes.delete", "Delete note", null, null, { handleAsync: async () => null })), RegistrationException);
    const foreign = Assert.throws(() => context.registerCommand(new RuntimeCommand("tasks.add", "Add task", null, null, { handleAsync: async () => null })), RegistrationException);

    Assert.areEqual("notes.newNote", commands.list.commands.map(t => t.name.text).join(","));
    Assert.areEqual("The module notes does not declare notes.delete among its commands.", undeclared.message);
    Assert.areEqual("The module notes does not declare tasks.add among its commands.", foreign.message);
  }

  @TestMethod
  public async publishesServicesOnlyUnderItsOwnId(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const services = new ServiceRegistry();
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), services);
    const store = new Map<string, string>();

    context.publishService("notes.store", store);
    const foreign = Assert.throws(() => context.publishService("tasks.store", new Map()), RegistrationException);
    const twice = Assert.throws(() => context.publishService("notes.store", new Map()), RegistrationException);

    Assert.areEqual<unknown>(store, services.find(new QualifiedName("notes", "store")));
    Assert.areEqual("The module notes may publish services only under its own id, not tasks.store.", foreign.message);
    Assert.areEqual("The service notes.store is already published.", twice.message);
  }

  @TestMethod
  public async findsTheServicesOfTheShellAndItsDependenciesByType(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const services = new ServiceRegistry();
    const tasks = new Map<string, string>([["first", "Write the plan"]]);
    const clock = new Set<string>();
    services.publish(new QualifiedName("tasks", "store"), tasks);
    services.publish(new QualifiedName("shell", "clock"), clock);
    services.publish(new QualifiedName("calendar", "store"), new Map());
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), services);

    const found = context.getService("tasks.store", Map);
    const shell = context.getService("shell.clock", Set);
    const notAllowed = Assert.throws(() => context.getService("calendar.store", Map), ServiceAccessException);
    const missing = Assert.throws(() => context.getService("tasks.index", Map), ServiceAccessException);
    const wrongType = Assert.throws(() => context.getService("tasks.store", Set), ServiceAccessException);

    Assert.areEqual("Write the plan", found.get("first"));
    Assert.areEqual<unknown>(clock, shell);
    Assert.areEqual("The module notes may use only the shell's services and those of the modules it depends on, not calendar.store.", notAllowed.message);
    Assert.areEqual("No service tasks.index is published.", missing.message);
    Assert.areEqual("The service tasks.store is not a Set.", wrongType.message);
  }

  @TestMethod
  public async withdrawsEverythingItRegisteredWhenDisposed(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const methods = new MethodRegistry();
    const events: Event[] = [];
    const eventRegistry = new EventRegistry({ broadcast: t => events.push(t) });
    const services = new ServiceRegistry();
    const commands = new CommandRegistry();
    const context = ModuleContextFixture.create(settings, methods, eventRegistry, services, commands);
    context.registerMethod("notes.list", { handleAsync: async () => [] });
    context.registerCommand(new RuntimeCommand("notes.newNote", "New note", null, null, { handleAsync: async () => null }));
    const channel = context.declareEvent("notes.changed");
    context.publishService("notes.store", new Map());

    context[Symbol.dispose]();
    context[Symbol.dispose]();

    Assert.isUndefined(methods.find(new QualifiedName("notes", "list")));
    Assert.isUndefined(services.find(new QualifiedName("notes", "store")));
    Assert.isUndefined(commands.find(new QualifiedName("notes", "newNote")));
    Assert.throws(() => channel.publish(null), RegistrationException);
    eventRegistry.declare(new QualifiedName("notes", "changed")).publish(null);
    Assert.areEqual(1, events.length);
  }

  @TestMethod
  public async postsUpdatesAndDismissesItsNotificationsAndDismissesThemAllWhenDisposed(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    let ids = 0;
    const notifications = new NotificationCenter(() => undefined, () => new Date(), () => String(++ids));
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), new ServiceRegistry(), new CommandRegistry(), notifications);
    notifications.post(ModuleContextTests.post("tasks.due", "Due", "tasks.show"));

    const saved = context.postNotification(ModuleContextTests.post("notes.saved", "Saved", "tasks.show"));
    const second = context.postNotification(ModuleContextTests.post("notes.saved", "Second", "notes.newNote"));
    saved.update(ModuleContextTests.post("notes.saved", "Saved again", null));
    second.dismiss();
    second.dismiss();
    const isBack = second.update(ModuleContextTests.post("notes.saved", "Back", null));
    const listed = notifications.list.notifications.map(t => `${t.id}:${t.post.title}`).join(",");
    context[Symbol.dispose]();

    Assert.isFalse(isBack);
    Assert.areEqual("2:Saved again,1:Due", listed);
    Assert.areEqual("Due", notifications.list.notifications.map(t => t.post.title).join(","));
  }

  @TestMethod
  public async refusesAnUndeclaredKindOrAnotherModulesCommandOnPostAndOnUpdate(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const notifications = new NotificationCenter(() => undefined, () => new Date(), randomUUID);
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), new ServiceRegistry(), new CommandRegistry(), notifications);
    const saved = context.postNotification(ModuleContextTests.post("notes.saved", "Saved", null));

    const undeclared = Assert.throws(() => context.postNotification(ModuleContextTests.post("notes.deleted", "Deleted", null)), RegistrationException);
    const foreign = Assert.throws(() => saved.update(ModuleContextTests.post("notes.saved", "Saved", "calendar.show")), RegistrationException);

    Assert.areEqual("The module notes does not declare notes.deleted among its notifications.", undeclared.message);
    Assert.areEqual("The module notes may not offer the command calendar.show in a notification; it must be its own or a dependency's.", foreign.message);
    Assert.areEqual("Saved", notifications.list.notifications.map(t => t.post.title).join(","));
  }

  private static post(kind: string, title: string, action: string | null): NotificationPost {
    const actions = action === null ? [] : [new NotificationAction("Show", new CommandRun(QualifiedName.parse(action), null))];
    return new NotificationPost(QualifiedName.parse(kind), null, title, null, NotificationSeverity.Info, null, actions, null);
  }
}
