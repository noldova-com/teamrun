/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";
import { KeyChord, QualifiedName } from "@noldova/teamrun-shell-protocol";

import { ShortcutBinding } from "./shortcut-binding";

export class KeyBindings {
  private readonly keys: ReadonlyMap<string, KeyChord | null>;

  private constructor(keys: ReadonlyMap<string, KeyChord | null>) {
    this.keys = keys;
  }

  public get list(): readonly ShortcutBinding[] {
    return [...this.keys].map(([command, key]) => new ShortcutBinding(command, key));
  }

  public static fromJson(value: JsonValue | undefined): KeyBindings {
    const entries = Object.isObject(value) && !Array.isArray(value) ? Object.entries(value) : [];
    return new KeyBindings(new Map(entries.flatMap(([command, key]) => {
      const binding = KeyBindings.read(command, key);
      return Object.isUndefined(binding) ? [] : [[command, binding] as const];
    })));
  }

  public has(command: string): boolean {
    return this.keys.has(command);
  }

  public isSameAs(other: KeyBindings): boolean {
    return this.keys.size === other.keys.size && [...this.keys].every(([command, key]) => other.keys.has(command) && other.keys.get(command)?.text === key?.text);
  }

  public with(command: string, key: KeyChord | null): KeyBindings {
    return new KeyBindings(new Map([...this.keys, [command, key]]));
  }

  public without(command: string): KeyBindings {
    return new KeyBindings(new Map([...this.keys].filter(t => t[0] !== command)));
  }

  public toJson(): JsonObject {
    return Object.fromEntries([...this.keys].map(([command, key]) => [command, key?.text ?? null]));
  }

  private static read(command: string, key: JsonValue | undefined): KeyChord | null | undefined {
    const name = QualifiedName.find(command);
    if (Object.isNull(name) || (!Object.isNull(key) && !Object.isString(key)))
      return undefined;
    if (Object.isNull(key))
      return null;
    const chord = KeyChord.find(key);
    return chord?.canBind(name) === true ? chord : undefined;
  }
}
