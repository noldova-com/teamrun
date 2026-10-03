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

import { CommandNotFoundException } from "../exceptions/command-not-found.exception";
import type { CommandContribution } from "../models/command-contribution";
import type { ShortcutBinding } from "../models/shortcut-binding";
import { ShortcutMap } from "../models/shortcut-map";
import { Resources } from "../../resources";
import { DesktopBridgeService } from "./desktop-bridge.service";

@Injectable({ providedIn: "root" })
export class CommandService {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly commandsValue: WritableSignal<readonly CommandContribution[]> = signal([]);
  private readonly bindingsValue: WritableSignal<readonly ShortcutBinding[]> = signal([]);

  public readonly commands: Signal<readonly CommandContribution[]> = this.commandsValue.asReadonly();
  public readonly shortcuts: Signal<ShortcutMap> = computed(() => new ShortcutMap(this.commandsValue(), this.bindingsValue(), this.bridge.platform));

  public constructor() {
    const document = inject(DOCUMENT);
    const listener = (event: KeyboardEvent): void => {
      this.dispatch(event);
    };
    document.addEventListener(Resources.keyDownEvent, listener);
    inject(DestroyRef).onDestroy(() => document.removeEventListener(Resources.keyDownEvent, listener));
  }

  public setCommands(commands: readonly CommandContribution[]): void {
    this.commandsValue.set([...commands]);
  }

  public setBindings(bindings: readonly ShortcutBinding[]): void {
    this.bindingsValue.set([...bindings]);
  }

  public async runAsync(name: string, commandArguments: JsonValue = null): Promise<JsonValue> {
    const command = this.commandsValue().find(t => t.name === name);
    if (Object.isUndefined(command))
      throw new CommandNotFoundException(Resources.formatCommandNotFound(name));
    return command.runAsync(commandArguments);
  }

  public dispatch(event: KeyboardEvent): boolean {
    if (event.defaultPrevented || event.isComposing || event.repeat)
      return false;
    const name = this.shortcuts().find(event);
    if (Object.isUndefined(name))
      return false;

    event.preventDefault();
    this.runAsync(name).catch((error: unknown) => this.errors.handleError(error));
    return true;
  }
}
