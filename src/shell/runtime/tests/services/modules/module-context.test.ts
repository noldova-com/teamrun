/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import {
  CommandRun, type Event, NotificationAction, NotificationPost, NotificationSeverity, QualifiedName, SettingDefinition, SettingKey, SettingLocality, SettingScope, SettingType, SettingValue
} from "@noldova/teamrun-shell-protocol";
import {
  CommandRegistry,
  DataDirectory,
  DiagnosticRedactor,
  EventRegistry,
  MethodRegistry,
  ModuleContext,
  ModuleDeclaration,
  NotificationCenter,
  NotificationPolicy,
  RegistrationException,
  RuntimeCommand,
  ServiceAccessException,
  ServiceRegistry,
  SettingException,
  WorkTracker
} from "@noldova/teamrun-shell-runtime";

import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class ModuleContextTests {
  private static readonly ROOT: string = path.resolve("teamrun-data");
  private static readonly HOME: string = path.resolve("home", "person");
  private static readonly NOTES: ModuleDeclaration = new ModuleDeclaration(
    "notes",
    "Notes",
    "Keeps notes.",
    ["tasks"],
    "@noldova/teamrun-modules-notes-runtime",
    new Map([
      ["methods", ["notes.list"]], ["events", ["notes.changed"]], ["commands", ["notes.newNote"]], ["notifications", ["notes.saved"]], ["settings", ["notes.sortBy"]],
      ["settingScopes", ["notes.folder"]]
    ]));
  private static readonly SETTINGS: readonly SettingDefinition[] = ["notes.sortBy", "tasks.size", "clock.speed", "shell.mode"].map(t => new SettingDefinition(
    QualifiedName.parse(t), t, "A setting.", SettingType.text(20), "a", SettingLocality.Shared, t === "notes.sortBy" ? [QualifiedName.parse("notes.folder")] : [], "Page", "Group"));

  @TestMethod
  public async namesTheModuleAndItsFolder(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const context = ModuleContextTests.create(settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), new ServiceRegistry());

    Assert.areEqual("notes", context.moduleId);
    Assert.areEqual(path.join(ModuleContextTests.ROOT, "modules", "notes"), context.moduleFolder);
  }

  @TestMethod
  public async writesTheModulesLinesRedactedAndWithoutControlCharactersEachStartingWithItsId(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const diagnostics = new TextOutputFixture();
    const context = ModuleContextTests.create(
      settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), new ServiceRegistry(), undefined, undefined, undefined, diagnostics);
    const token = "a".repeat(40);

    context.log.write(`Synced ${path.join(ModuleContextTests.HOME, "notes")}\r\nwith ${token}\r2026-10-04T12:00:00.000Z shell: faked\u2028\u001b[31mred\u001b[0m\tdone\n`);

    Assert.areEqual(
      `notes: Synced ${path.join("~", "notes")}\nnotes: with [redacted]\nnotes: 2026-10-04T12:00:00.000Z shell: faked\nnotes: [31mred[0m\tdone\n`, diagnostics.text);
  }

  @TestMethod
  public async createsTheModulesWorkFolderWhenFirstAskedForIt(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const context = ModuleContextTests.create(
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
    const context = ModuleContextTests.create(
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
    const context = ModuleContextTests.create(settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), new ServiceRegistry());

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
    const context = ModuleContextTests.create(settings, methods, new EventRegistry({ broadcast: t => events.push(t) }), new ServiceRegistry());

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
    const context = ModuleContextTests.create(settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), new ServiceRegistry(), commands);

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
    const context = ModuleContextTests.create(settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), services);
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
    const context = ModuleContextTests.create(settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), services);

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
    const context = ModuleContextTests.create(settings, methods, eventRegistry, services, commands);
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
    const notifications = new NotificationCenter(() => undefined, () => new Date());
    const context = ModuleContextTests.create(settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), new ServiceRegistry(), new CommandRegistry(), notifications);
    notifications.post(ModuleContextTests.post("tasks.due", "Due", "tasks.show"));

    const saved = context.postNotification(ModuleContextTests.post("notes.saved", "Saved", "tasks.show"));
    const second = context.postNotification(ModuleContextTests.post("notes.saved", "Second", "notes.newNote"));
    saved.update(ModuleContextTests.post("notes.saved", "Saved again", null));
    second.dismiss();
    second.dismiss();
    const gone = Assert.throws(() => second.update(ModuleContextTests.post("notes.saved", "Back", null)), RegistrationException);
    const listed = notifications.list.notifications.map(t => `${t.id}:${t.post.title}`).join(",");
    context[Symbol.dispose]();

    Assert.areEqual("2:Saved again,1:Due", listed);
    Assert.areEqual(`Notification ${second.id} is gone; it was dismissed or its module stopped.`, gone.message);
    Assert.areEqual("Due", notifications.list.notifications.map(t => t.post.title).join(","));
  }

  @TestMethod
  public async refusesAnUndeclaredKindOrAnotherModulesCommandOnPostAndOnUpdate(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const notifications = new NotificationCenter(() => undefined, () => new Date());
    const context = ModuleContextTests.create(settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), new ServiceRegistry(), new CommandRegistry(), notifications);
    const saved = context.postNotification(ModuleContextTests.post("notes.saved", "Saved", null));

    const undeclared = Assert.throws(() => context.postNotification(ModuleContextTests.post("notes.deleted", "Deleted", null)), RegistrationException);
    const foreign = Assert.throws(() => saved.update(ModuleContextTests.post("notes.saved", "Saved", "calendar.show")), RegistrationException);

    Assert.areEqual("The module notes does not declare notes.deleted among its notifications.", undeclared.message);
    Assert.areEqual("The module notes may not offer the command calendar.show in a notification; it must be its own or a dependency's.", foreign.message);
    Assert.areEqual("Saved", notifications.list.notifications.map(t => t.post.title).join(","));
  }

  @TestMethod
  public async readsItsOwnItsDependenciesAndTheShellsSettingsAndChangesOnlyItsOwn(): Promise<void> {
    await using settings = await SettingsFixture.createAsync(ModuleContextTests.SETTINGS);
    const context = ModuleContextTests.create(settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), new ServiceRegistry());
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
    Assert.areEqual("The module notes may only change its own settings, not tasks.size.",
      Assert.throws(() => context.settings.write("tasks.size", "b"), RegistrationException).message);
    Assert.throws(() => context.settings.reset("shell.mode"), RegistrationException);
    Assert.throws(() => context.settings.setScopeParent(tasks, null), RegistrationException);
    Assert.throws(() => context.settings.setScopeParent(folder, new SettingScope(QualifiedName.parse("clock.dial"), "d1")), RegistrationException);
    Assert.throws(() => context.settings.removeScope(tasks), RegistrationException);
  }

  @TestMethod
  public async followsAReadableSettingUntilWithdrawn(): Promise<void> {
    await using settings = await SettingsFixture.createAsync(ModuleContextTests.SETTINGS);
    const context = ModuleContextTests.create(settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), new ServiceRegistry());
    const seen: string[] = [];
    context.settings.onChanged("tasks.size", t => seen.push(String(t.value)));

    settings.service.write(new SettingValue(new SettingKey(QualifiedName.parse("shell.mode")), "b"));
    settings.service.write(new SettingValue(new SettingKey(QualifiedName.parse("tasks.size")), "c"));
    context[Symbol.dispose]();
    settings.service.write(new SettingValue(new SettingKey(QualifiedName.parse("tasks.size")), "d"));

    Assert.areEqual("c", seen.join(","));
    Assert.throws(() => context.settings.onChanged("clock.speed", () => undefined), RegistrationException);
  }

  private static post(kind: string, title: string, action: string | null): NotificationPost {
    const actions = action === null ? [] : [new NotificationAction("Show", new CommandRun(QualifiedName.parse(action), null))];
    return new NotificationPost(QualifiedName.parse(kind), null, title, null, NotificationSeverity.Info, null, actions, null);
  }

  private static create(
    settings: SettingsFixture,
    methods: MethodRegistry,
    events: EventRegistry,
    services: ServiceRegistry,
    commands: CommandRegistry = new CommandRegistry(),
    notifications: NotificationCenter = new NotificationCenter(() => undefined, () => new Date()),
    work: WorkTracker = new WorkTracker(() => undefined),
    diagnostics: TextOutputFixture = new TextOutputFixture(),
    root: string = ModuleContextTests.ROOT): ModuleContext {
    return new ModuleContext(
      ModuleContextTests.NOTES, new DataDirectory(root), methods, events, commands,
      notifications, new NotificationPolicy([ModuleContextTests.NOTES], () => true), services, settings.service,
      work, settings.processes, diagnostics, new DiagnosticRedactor(ModuleContextTests.HOME));
  }
}
