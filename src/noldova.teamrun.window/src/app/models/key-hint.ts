/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { KeyChord } from "@noldova/desktop.protocol";

import { Resources } from "../../resources";

export class KeyHint {
  public constructor(public readonly label: string, public readonly keys: readonly string[]) {
  }

  public static of(label: string, chord: string, isMac: boolean): KeyHint {
    const parsed = KeyChord.parseDefault(chord);
    const key = parsed.key.label(isMac);
    const whole = parsed.label(isMac ? Resources.macPlatform : Resources.windowsPlatform);
    const modifiers = whole.slice(0, whole.length - key.length);
    return new KeyHint(label, [...(isMac ? Array.from(modifiers) : modifiers.split(Resources.keySeparator).filter(t => t.length > 0)), key]);
  }
}
