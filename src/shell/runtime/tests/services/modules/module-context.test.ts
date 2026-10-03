/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { type Event, QualifiedName } from "@noldova/teamrun-shell-protocol";
import {
  CommandRegistry,
  DataDirectory,
  EventRegistry,
  MethodRegistry,
  ModuleContext,
  ModuleDeclaration,
  RegistrationException,
  RuntimeCommand,
  ServiceAccessException,
  ServiceRegistry
} from "@noldova/teamrun-shell-runtime";

@TestClass
export class ModuleContextTests {
  private static readonly ROOT: string = path.resolve("teamrun-data");
  private static readonly NOTES: ModuleDeclaration = new ModuleDeclaration(
    "notes",
    "Notes",
    ["tasks"],
    "@noldova/teamrun-modules-notes-runtime",
    new Map([["methods", ["notes.list"]], ["events", ["notes.changed"]], ["commands", ["notes.newNote"]]]));

  @TestMethod
  public namesTheModuleAndItsFolder(): void {
    const context = ModuleContextTests.create(new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), new ServiceRegistry());

    Assert.areEqual("notes", context.moduleId);
    Assert.areEqual(path.join(ModuleContextTests.ROOT, "modules", "notes"), context.moduleFolder);
  }

  @TestMethod
  public registersOnlyTheMethodsAndEventsItsDeclarationContributes(): void {
    const methods = new MethodRegistry();
    const events: Event[] = [];
    const context = ModuleContextTests.create(methods, new EventRegistry({ broadcast: t => events.push(t) }), new ServiceRegistry());

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
  public registersOnlyTheCommandsItsDeclarationContributes(): void {
    const commands = new CommandRegistry();
    const context = ModuleContextTests.create(new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), new ServiceRegistry(), commands);

    context.registerCommand(new RuntimeCommand("notes.newNote", "New note", "note_add", "Mod+Alt+N", { handleAsync: async () => null }));
    const undeclared = Assert.throws(() => context.registerCommand(new RuntimeCommand("notes.delete", "Delete note", null, null, { handleAsync: async () => null })), RegistrationException);
    const foreign = Assert.throws(() => context.registerCommand(new RuntimeCommand("tasks.add", "Add task", null, null, { handleAsync: async () => null })), RegistrationException);

    Assert.areEqual("notes.newNote", commands.list.commands.map(t => t.name.text).join(","));
    Assert.areEqual("The module notes does not declare notes.delete among its commands.", undeclared.message);
    Assert.areEqual("The module notes does not declare tasks.add among its commands.", foreign.message);
  }

  @TestMethod
  public publishesServicesOnlyUnderItsOwnId(): void {
    const services = new ServiceRegistry();
    const context = ModuleContextTests.create(new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), services);
    const store = new Map<string, string>();

    context.publishService("notes.store", store);
    const foreign = Assert.throws(() => context.publishService("tasks.store", new Map()), RegistrationException);
    const twice = Assert.throws(() => context.publishService("notes.store", new Map()), RegistrationException);

    Assert.areEqual<unknown>(store, services.find(new QualifiedName("notes", "store")));
    Assert.areEqual("The module notes may publish services only under its own id, not tasks.store.", foreign.message);
    Assert.areEqual("The service notes.store is already published.", twice.message);
  }

  @TestMethod
  public findsTheServicesOfTheShellAndItsDependenciesByType(): void {
    const services = new ServiceRegistry();
    const tasks = new Map<string, string>([["first", "Write the plan"]]);
    const clock = new Set<string>();
    services.publish(new QualifiedName("tasks", "store"), tasks);
    services.publish(new QualifiedName("shell", "clock"), clock);
    services.publish(new QualifiedName("calendar", "store"), new Map());
    const context = ModuleContextTests.create(new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), services);

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
  public withdrawsEverythingItRegisteredWhenDisposed(): void {
    const methods = new MethodRegistry();
    const events: Event[] = [];
    const eventRegistry = new EventRegistry({ broadcast: t => events.push(t) });
    const services = new ServiceRegistry();
    const commands = new CommandRegistry();
    const context = ModuleContextTests.create(methods, eventRegistry, services, commands);
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

  private static create(methods: MethodRegistry, events: EventRegistry, services: ServiceRegistry, commands: CommandRegistry = new CommandRegistry()): ModuleContext {
    return new ModuleContext(ModuleContextTests.NOTES, new DataDirectory(ModuleContextTests.ROOT), methods, events, commands, services);
  }
}
