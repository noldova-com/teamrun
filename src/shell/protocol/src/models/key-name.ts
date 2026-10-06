/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import type { IKeyStroke } from "../interfaces/i-key-stroke.js";
import { Resources } from "../resources.js";

export class KeyName {
  private static readonly CATALOG: ReadonlyMap<string, KeyName> = KeyName.createCatalog();

  private readonly eventKey: string | null;
  private readonly eventCode: string | null;
  private readonly macLabel: string;
  private readonly standardLabel: string;

  public readonly token: string;
  public readonly isFunctionKey: boolean;

  private constructor(token: string, eventKey: string | null, eventCode: string | null, macLabel: string, standardLabel: string, isFunctionKey: boolean) {
    this.token = token;
    this.eventKey = eventKey;
    this.eventCode = eventCode;
    this.macLabel = macLabel;
    this.standardLabel = standardLabel;
    this.isFunctionKey = isFunctionKey;
  }

  public static find(token: string): KeyName | undefined {
    return KeyName.CATALOG.get(token);
  }

  public static fromStroke(stroke: IKeyStroke): KeyName | undefined {
    return [...KeyName.CATALOG.values()].find(t => t.matches(stroke));
  }

  public matches(stroke: IKeyStroke): boolean {
    if (!Object.isNull(this.eventKey) && stroke.key.toLowerCase() === this.eventKey)
      return true;
    return !Object.isNull(this.eventCode) && stroke.code === this.eventCode && (Object.isNull(this.eventKey) || !Resources.asciiLetterPattern.test(stroke.key));
  }

  public label(isMac: boolean): string {
    return isMac ? this.macLabel : this.standardLabel;
  }

  private static createCatalog(): ReadonlyMap<string, KeyName> {
    const names: KeyName[] = [];
    for (const letter of Resources.letterKeys)
      names.push(new KeyName(letter, letter.toLowerCase(), `${Resources.letterCodePrefix}${letter}`, letter, letter, false));
    for (const digit of Resources.digitKeys)
      names.push(new KeyName(digit, null, `${Resources.digitCodePrefix}${digit}`, digit, digit, false));
    for (const [token, glyph] of Resources.punctuationKeys)
      names.push(new KeyName(token, null, token, glyph, glyph, false));
    for (const [token, macLabel, standardLabel] of Resources.namedKeys)
      names.push(new KeyName(token, token === Resources.spaceKey ? null : token.toLowerCase(), token === Resources.spaceKey ? token : null, macLabel, standardLabel, false));
    for (let number = 1; number <= Resources.functionKeyCount; number++) {
      const token = `${Resources.functionKeyPrefix}${number}`;
      names.push(new KeyName(token, token.toLowerCase(), null, token, token, true));
    }
    return new Map(names.map(t => [t.token, t]));
  }
}
