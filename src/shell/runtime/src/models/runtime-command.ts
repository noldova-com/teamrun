/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { CommandInfo, KeyChord, QualifiedName } from "@noldova/teamrun-shell-protocol";

import type { IMethodHandler } from "../interfaces/i-method-handler.js";
import { Resources } from "../resources.js";
import { Registration } from "./registration.js";

export class RuntimeCommand {
  private readonly listeners: Set<() => void> = new Set();
  private infoValue: CommandInfo;

  public readonly handler: IMethodHandler;

  public constructor(name: string, title: string, icon: string | null, defaultKey: string | null, handler: IMethodHandler, isChecked: boolean | null = null) {
    this.infoValue = new CommandInfo(
      QualifiedName.parse(name, Resources.nameParameterName),
      title,
      icon,
      Object.isNull(defaultKey) ? null : KeyChord.parseDefault(defaultKey, Resources.defaultKeyParameterName),
      true,
      isChecked);
    this.handler = handler;
  }

  public get info(): CommandInfo {
    return this.infoValue;
  }

  public setEnabled(isEnabled: boolean): void {
    this.change(isEnabled, this.infoValue.isChecked);
  }

  public setChecked(isChecked: boolean): void {
    if (Object.isNull(this.infoValue.isChecked))
      throw new ArgumentException(Resources.formatCommandNotCheckable(this.infoValue.name.text), Resources.isCheckedParameterName);
    this.change(this.infoValue.isEnabled, isChecked);
  }

  public onChanged(listener: () => void): Registration {
    const entry = (): void => listener();
    this.listeners.add(entry);
    return new Registration(() => this.listeners.delete(entry));
  }

  private change(isEnabled: boolean, isChecked: boolean | null): void {
    const info = this.infoValue;
    if (isEnabled === info.isEnabled && isChecked === info.isChecked)
      return;
    this.infoValue = new CommandInfo(info.name, info.title, info.icon, info.defaultKey, isEnabled, isChecked);
    for (const listener of [...this.listeners])
      listener();
  }
}
