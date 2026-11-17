/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources";

export class ChatIds {
  public static readonly none: ChatIds = new ChatIds("", []);

  public readonly text: string;
  public readonly found: readonly (readonly [number, string])[];

  private constructor(text: string, found: readonly (readonly [number, string])[]) {
    this.text = text;
    this.found = found;
  }

  public static of(text: string): ChatIds {
    return ChatIds.none.extendedTo(text);
  }

  public extendedTo(text: string): ChatIds {
    if (text === this.text)
      return this;
    const settled = text.startsWith(this.text) ? this.text.length - Resources.chatIdTail : 0;
    const kept = this.found.filter(([offset]) => offset < settled);
    const last = kept.at(-1);
    const pattern = new RegExp(Resources.chatIdPattern);
    pattern.lastIndex = Math.max(0, settled, Object.isUndefined(last) ? 0 : last[0] + last[1].length);
    return new ChatIds(text, [...kept, ...[...text.matchAll(pattern)].map(t => [t.index, t[0]] as const)]);
  }
}
