/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { DestroyRef, ErrorHandler, Injectable, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import type { KeyChord } from "@noldova/teamrun-shell-protocol";
import { DialogService } from "@noldova/teamrun-shell-ui";

import { CommandNotFoundException } from "../exceptions/command-not-found.exception";
import type { CommandContribution } from "../models/command-contribution";
import { KeyBindings } from "../models/key-bindings";
import { ShortcutMap } from "../models/shortcut-map";
import { WindowPartTokens } from "../models/window-part-tokens";
import { Resources } from "../../resources";
import { DesktopBridgeService } from "./desktop-bridge.service";
import { SettingsService } from "./settings.service";
import { ShellCommandsService } from "./shell-commands.service";
import { StartupService } from "./startup.service";
import { ViewDialogService } from "./view-dialog.service";

@Injectable({ providedIn: "root" })
export class CommandService {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly viewDialogs: ViewDialogService = inject(ViewDialogService);
  private readonly shell: ShellCommandsService = inject(ShellCommandsService);
  private readonly startup: StartupService = inject(StartupService);
  private readonly shellCommands: readonly CommandContribution[] = this.shell.commands;
  private readonly moduleCommands: WritableSignal<readonly CommandContribution[]> = signal([]);
  private readonly settingValues: Signal<ReadonlyMap<string, JsonValue>> = inject(SettingsService).values;
  private readonly bindingsValue: Signal<JsonValue | undefined> = computed(() => this.settingValues().get(Resources.keyBindingsSetting));
  private readonly ownerNames: ReadonlyMap<string, string> = new Map([
    [Resources.shellOwner, Resources.productName],
    ...inject(WindowPartTokens.sources).map(t => [t.moduleId, t.displayName] as const)
  ]);

  public readonly commands: Signal<readonly CommandContribution[]> = computed(() => [...this.shellCommands, ...this.moduleCommands()]);
  public readonly bindings: Signal<KeyBindings> = computed(() => KeyBindings.fromJson(this.bindingsValue()));
  public readonly shortcuts: Signal<ShortcutMap> = computed(() => new ShortcutMap(this.shell.keys(this.bridge.platform), this.commands(), this.bindings().list, this.bridge.platform));

  public constructor() {
    const document = inject(DOCUMENT);
    const listener = (event: KeyboardEvent): void => {
      this.dispatch(event);
    };
    document.addEventListener(Resources.keyDownEvent, listener);
    inject(DestroyRef).onDestroy(() => document.removeEventListener(Resources.keyDownEvent, listener));
  }

  public setCommands(commands: readonly CommandContribution[]): void {
    this.moduleCommands.set([...commands]);
  }

  public async runAsync(name: string, commandArguments: JsonValue = null): Promise<JsonValue> {
    const command = this.find(name);
    return this.isHeldByReconnect(command.name) ? null : command.runAsync(commandArguments);
  }

  public run(name: string, commandArguments: JsonValue = null): void {
    this.report(this.runAsync(name, commandArguments));
  }

  public isEnabled(name: string, commandArguments: JsonValue = null): boolean {
    return this.canRun(this.find(name), commandArguments);
  }

  public isAvailable(name: string, commandArguments: JsonValue = null): boolean {
    const command = this.commands().find(t => t.name === name);
    return !Object.isUndefined(command) && this.canRun(command, commandArguments);
  }

  public isChecked(name: string, commandArguments: JsonValue = null): boolean {
    return this.ask(() => this.find(name).isChecked?.(commandArguments) ?? false);
  }

  public isApplicable(name: string, commandArguments: JsonValue = null): boolean {
    return this.ask(() => this.find(name).isApplicable(commandArguments));
  }

  public titleOf(name: string): string {
    return this.find(name).title;
  }

  public ownerOf(name: string): string {
    const owner = name.slice(0, name.indexOf(Resources.contributionSeparator));
    return this.ownerNames.get(owner) ?? owner;
  }

  public defaultKeysOf(name: string): readonly KeyChord[] {
    const command = this.find(name);
    return [...this.shell.keys(this.bridge.platform).filter(t => t[1] === command.name).map(t => t[0]), ...Object.isNull(command.defaultKey) ? [] : [command.defaultKey]];
  }

  public keyLabel(name: string): string | null {
    return this.shortcuts().keyOf(this.find(name).name)?.label(this.bridge.platform) ?? null;
  }

  public isHeldByDialog(name: string): boolean {
    return this.dialogs.isOpen && !Resources.modalCommands.includes(name) && !this.viewDialogs.ownsCommand(name);
  }

  public dispatch(event: KeyboardEvent): boolean {
    if (event.defaultPrevented || event.isComposing || event.repeat)
      return false;
    const name = this.shortcuts().find(event);
    const command = this.commands().find(t => t.name === name);
    if (Object.isUndefined(command) || this.isHeldByDialog(command.name) || !this.canRun(command, null))
      return false;

    event.preventDefault();
    this.report(command.runAsync(null));
    return true;
  }

  private canRun(command: CommandContribution, commandArguments: JsonValue): boolean {
    return !this.isHeldByReconnect(command.name) && this.ask(() => command.isEnabled(commandArguments));
  }

  private isHeldByReconnect(name: string): boolean {
    return this.startup.isReconnecting() && !Resources.modalCommands.includes(name);
  }

  private ask(question: () => boolean): boolean {
    try {
      return question();
    }
    catch (error) {
      this.errors.handleError(error);
      return false;
    }
  }

  private report(running: Promise<JsonValue>): void {
    running.catch((error: unknown) => this.errors.handleError(error));
  }

  private find(name: string): CommandContribution {
    const command = this.commands().find(t => t.name === name);
    if (Object.isUndefined(command))
      throw new CommandNotFoundException(Resources.formatCommandNotFound(name));
    return command;
  }
}
