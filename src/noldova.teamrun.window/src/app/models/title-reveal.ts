/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { GraphemeText, TextReveal } from "@noldova/ui.components.angular";

export class TitleReveal {
  private readonly changed: () => void;
  private readonly shown: Map<string, readonly [GraphemeText, TextReveal]> = new Map();

  public constructor(changed: () => void) {
    this.changed = changed;
  }

  public follow(titles: ReadonlyMap<string, string>, initial: ReadonlySet<string>, streaming: boolean, motionAllowed: boolean): void {
    for (const [key, title] of titles) {
      const known = this.shown.get(key);
      const text = new GraphemeText(title);
      if (!Object.isUndefined(known) && title.startsWith(known[0].text)) {
        this.shown.set(key, [text, known[1]]);
        known[1].follow(text.count, !streaming, motionAllowed);
        continue;
      }
      known?.[1].dispose();
      const isWhole = !streaming || (Object.isUndefined(known) && initial.has(key));
      const reveal = new TextReveal(isWhole ? text.count : TitleReveal.leastOf(title), () => this.changed());
      this.shown.set(key, [text, reveal]);
      reveal.follow(text.count, !streaming, motionAllowed);
    }
    for (const [key, known] of this.shown)
      if (!titles.has(key)) {
        known[1].dispose();
        this.shown.delete(key);
      }
  }

  public shownOf(key: string, title: string): string {
    const known = this.shown.get(key);
    return Object.isUndefined(known) || known[0].text !== title ? title : known[0].prefix(known[1].count);
  }

  public dispose(): void {
    this.shown.forEach(t => t[1].dispose());
    this.shown.clear();
  }

  private static leastOf(title: string): number {
    return new GraphemeText(title.slice(0, title.length - title.trimStart().length)).count + 1;
  }
}
