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
import { DialogService } from "@noldova/teamrun-shell-ui";

import { CommandNotFoundException } from "../exceptions/command-not-found.exception";
import type { CommandContribution } from "../models/command-contribution";
import type { ShortcutBinding } from "../models/shortcut-binding";
import { ShortcutMap } from "../models/shortcut-map";
import { Resources } from "../../resources";
import { DesktopBridgeService } from "./desktop-bridge.service";
import { ShellCommandsService } from "./shell-commands.service";

@Injectable({ providedIn: "root" })
export class CommandService {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly shell: ShellCommandsService = inject(ShellCommandsService);
  private readonly shellCommands: readonly CommandContribution[] = this.shell.commands;
  private readonly moduleCommands: WritableSignal<readonly CommandContribution[]> = signal([]);
  private readonly bindingsValue: WritableSignal<readonly ShortcutBinding[]> = signal([]);

  public readonly commands: Signal<readonly CommandContribution[]> = computed(() => [...this.shellCommands, ...this.moduleCommands()]);
  public readonly shortcuts: Signal<ShortcutMap> = computed(() => new ShortcutMap(this.shell.keys(this.bridge.platform), this.commands(), this.bindingsValue(), this.bridge.platform));

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

  public setBindings(bindings: readonly ShortcutBinding[]): void {
    this.bindingsValue.set([...bindings]);
  }

  public async runAsync(name: string, commandArguments: JsonValue = null): Promise<JsonValue> {
    return this.find(name).runAsync(commandArguments);
  }

  public run(name: string, commandArguments: JsonValue = null): void {
    this.report(this.runAsync(name, commandArguments));
  }

  public isEnabled(name: string, commandArguments: JsonValue = null): boolean {
    return this.canRun(this.find(name), commandArguments);
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

  public keyLabel(name: string): string | null {
    return this.shortcuts().keyOf(this.find(name).name)?.label(this.bridge.platform) ?? null;
  }

  public dispatch(event: KeyboardEvent): boolean {
    if (event.defaultPrevented || event.isComposing || event.repeat)
      return false;
    const name = this.shortcuts().find(event);
    if (this.dialogs.isOpen && !Resources.modalCommands.some(t => t === name))
      return false;
    const command = this.commands().find(t => t.name === name);
    if (Object.isUndefined(command) || !this.canRun(command, null))
      return false;

    event.preventDefault();
    this.report(command.runAsync(null));
    return true;
  }

  private canRun(command: CommandContribution, commandArguments: JsonValue): boolean {
    return this.ask(() => command.isEnabled(commandArguments));
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
