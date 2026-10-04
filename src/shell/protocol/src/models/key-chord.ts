/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import type { IKeyStroke } from "../interfaces/key-stroke.js";
import { Resources } from "../resources.js";
import { KeyName } from "./key-name.js";
import type { QualifiedName } from "./qualified-name.js";

export class KeyChord {
  public readonly hasMod: boolean;
  public readonly hasCtrl: boolean;
  public readonly hasAlt: boolean;
  public readonly hasShift: boolean;
  public readonly key: KeyName;
  public readonly text: string;

  private constructor(hasMod: boolean, hasCtrl: boolean, hasAlt: boolean, hasShift: boolean, key: KeyName) {
    this.hasMod = hasMod;
    this.hasCtrl = hasCtrl;
    this.hasAlt = hasAlt;
    this.hasShift = hasShift;
    this.key = key;
    this.text = [...Resources.modifierTokens.filter((_, index) => [hasMod, hasCtrl, hasAlt, hasShift][index]), key.token].join(Resources.keySeparator);
  }

  public get isTypingKey(): boolean {
    return !this.hasMod && !this.hasCtrl && !this.hasAlt && !this.key.isFunctionKey;
  }

  public static find(text: string): KeyChord | null {
    const chord = KeyChord.read(text);
    return Object.isNull(chord) || chord.isAmbiguous ? null : chord;
  }

  public static parse(text: string, parameterName: string = Resources.keyParameterName): KeyChord {
    const chord = KeyChord.read(text);
    if (Object.isNull(chord))
      throw new ArgumentException(Resources.formatKeyInvalid(text), parameterName);
    if (chord.isAmbiguous)
      throw new ArgumentException(Resources.formatKeyAmbiguous(text), parameterName);
    return chord;
  }

  public static parseDefault(text: string, parameterName: string = Resources.keyParameterName): KeyChord {
    const chord = KeyChord.parse(text, parameterName);
    if (chord.isTypingKey)
      throw new ArgumentException(Resources.formatKeyNeedsModifier(chord.text), parameterName);

    const owner = chord.findReservedOwner(null);
    if (!Object.isNull(owner))
      throw new ArgumentException(Resources.formatKeyReserved(chord.text, owner), parameterName);
    return chord;
  }

  public static fromStroke(stroke: IKeyStroke, platform: string): KeyChord | null {
    const isMac = platform === Resources.macPlatform;
    const key = KeyName.fromStroke(stroke);
    if (Object.isUndefined(key) || (!isMac && stroke.metaKey))
      return null;
    const chord = new KeyChord(isMac ? stroke.metaKey : stroke.ctrlKey, isMac && stroke.ctrlKey, stroke.altKey, stroke.shiftKey, key);
    return chord.isAmbiguous ? null : chord;
  }

  public findReservedOwner(command: QualifiedName | null): string | null {
    if (command?.isShell === true && Resources.shellCommandKeys.includes(this.text))
      return null;
    return Resources.reservedKeys.find(([platform, , reserved]) => reserved.some(t => KeyChord.parse(t).isSameOn(this, platform)))?.[1] ?? null;
  }

  public canBind(command: QualifiedName): boolean {
    return !this.isTypingKey && Object.isNull(this.findReservedOwner(command));
  }

  public matches(stroke: IKeyStroke, platform: string): boolean {
    const isMac = platform === Resources.macPlatform;
    return stroke.ctrlKey === (isMac ? this.hasCtrl : this.hasMod || this.hasCtrl)
      && stroke.metaKey === (isMac && this.hasMod)
      && stroke.altKey === this.hasAlt
      && stroke.shiftKey === this.hasShift
      && this.key.matches(stroke);
  }

  public isSameOn(other: KeyChord, platform: string): boolean {
    const isMac = platform === Resources.macPlatform;
    return other.key === this.key
      && other.hasAlt === this.hasAlt
      && other.hasShift === this.hasShift
      && (isMac
        ? other.hasMod === this.hasMod && other.hasCtrl === this.hasCtrl
        : (other.hasMod || other.hasCtrl) === (this.hasMod || this.hasCtrl));
  }

  public label(platform: string): string {
    const isMac = platform === Resources.macPlatform;
    if (isMac) {
      const symbols = [[this.hasCtrl, Resources.macControlSymbol], [this.hasAlt, Resources.macOptionSymbol], [this.hasShift, Resources.macShiftSymbol], [this.hasMod, Resources.macCommandSymbol]] as const;
      return `${symbols.filter(t => t[0]).map(t => t[1]).join(String.empty)}${this.key.label(true)}`;
    }
    const names = [[this.hasMod || this.hasCtrl, Resources.controlLabel], [this.hasAlt, Resources.altLabel], [this.hasShift, Resources.shiftLabel]] as const;
    return [...names.filter(t => t[0]).map(t => t[1]), this.key.label(false)].join(Resources.keySeparator);
  }

  public toString(): string {
    return this.text;
  }

  private get isAmbiguous(): boolean {
    return this.hasMod && this.hasCtrl;
  }

  private static read(text: string): KeyChord | null {
    const tokens = text.split(Resources.keySeparator);
    const key = KeyName.find(String(tokens.pop()));
    const modifiers = new Set(tokens);
    if (Object.isUndefined(key) || modifiers.size !== tokens.length || tokens.some(t => !Resources.modifierTokens.includes(t)))
      return null;
    return new KeyChord(modifiers.has(Resources.modToken), modifiers.has(Resources.ctrlToken), modifiers.has(Resources.altToken), modifiers.has(Resources.shiftToken), key);
  }
}
