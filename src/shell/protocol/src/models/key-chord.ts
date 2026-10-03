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

  public static parse(text: string, parameterName: string = Resources.keyParameterName): KeyChord {
    const tokens = text.split(Resources.keySeparator);
    const key = KeyName.find(String(tokens.pop()));
    const modifiers = new Set(tokens);
    if (Object.isUndefined(key) || modifiers.size !== tokens.length || tokens.some(t => !Resources.modifierTokens.includes(t)))
      throw new ArgumentException(Resources.formatKeyInvalid(text), parameterName);

    const hasMod = modifiers.has(Resources.modToken);
    const hasCtrl = modifiers.has(Resources.ctrlToken);
    if (hasMod && hasCtrl)
      throw new ArgumentException(Resources.formatKeyAmbiguous(text), parameterName);
    return new KeyChord(hasMod, hasCtrl, modifiers.has(Resources.altToken), modifiers.has(Resources.shiftToken), key);
  }

  public static parseDefault(text: string, parameterName: string = Resources.keyParameterName): KeyChord {
    const chord = KeyChord.parse(text, parameterName);
    if (!chord.hasMod && !chord.hasCtrl && !chord.hasAlt && !chord.key.isFunctionKey)
      throw new ArgumentException(Resources.formatKeyNeedsModifier(chord.text), parameterName);

    for (const [platform, owner, reserved] of Resources.reservedKeys) {
      if (reserved.some(t => KeyChord.parse(t).isSameOn(chord, platform)))
        throw new ArgumentException(Resources.formatKeyReserved(chord.text, owner), parameterName);
    }
    return chord;
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
}
