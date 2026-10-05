/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { QualifiedName, SettingDefinition, SettingLocality, SettingType } from "@noldova/teamrun-shell-protocol";
import {
  CommandRegistry, DataDirectory, DiagnosticRedactor, type EventRegistry, type MethodRegistry, ModuleContext, ModuleDeclaration, NotificationCenter, NotificationPolicy, type ServiceRegistry, WorkTracker
} from "@noldova/teamrun-shell-runtime";

import type { SettingsFixture } from "./settings.fixture.js";
import { TextOutputFixture } from "./text-output.fixture.js";

export class ModuleContextFixture {
  public static readonly ROOT: string = path.resolve("teamrun-data");
  public static readonly HOME: string = path.resolve("home", "person");
  public static readonly NOTES: ModuleDeclaration = new ModuleDeclaration(
    "notes",
    "0.0.1",
    "Notes",
    "Keeps notes.",
    ["tasks"],
    "@noldova/teamrun-modules-notes-runtime",
    new Map([
      ["methods", ["notes.list"]], ["events", ["notes.changed"]], ["commands", ["notes.newNote"]], ["notifications", ["notes.saved"]], ["settings", ["notes.sortBy"]],
      ["settingScopes", ["notes.folder"]]
    ]));
  public static readonly SETTINGS: readonly SettingDefinition[] = ["notes.sortBy", "tasks.size", "clock.speed", "shell.mode"].map(t => new SettingDefinition(
    QualifiedName.parse(t), t, "A setting.", SettingType.text(20), "a", SettingLocality.Shared, t === "notes.sortBy" ? [QualifiedName.parse("notes.folder")] : [], "Page", "Group"));

  public static create(
    settings: SettingsFixture,
    methods: MethodRegistry,
    events: EventRegistry,
    services: ServiceRegistry,
    commands: CommandRegistry = new CommandRegistry(),
    notifications: NotificationCenter = new NotificationCenter(() => undefined, () => new Date(), randomUUID),
    work: WorkTracker = new WorkTracker(() => undefined),
    diagnostics: TextOutputFixture = new TextOutputFixture(),
    root: string = ModuleContextFixture.ROOT): ModuleContext {
    return new ModuleContext(
      ModuleContextFixture.NOTES, new DataDirectory(root), methods, events, commands,
      notifications, new NotificationPolicy([ModuleContextFixture.NOTES], () => true), services, settings.service,
      work, settings.processes, diagnostics, new DiagnosticRedactor(ModuleContextFixture.HOME));
  }
}
