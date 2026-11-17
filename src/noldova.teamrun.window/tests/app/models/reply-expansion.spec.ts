/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WritableSignal } from "@angular/core";

import { ReplyExpansion } from "../../../src/app/models/reply-expansion";

describe("ReplyExpansion", () => {
  it("has changes once any part of a reply is expanded", () => {
    expect(new ReplyExpansion().hasChanges).toBe(false);
    const numbered = (pick: (expansion: ReplyExpansion) => WritableSignal<ReadonlySet<number>>): boolean => {
      const expansion = new ReplyExpansion();
      pick(expansion).set(new Set([1]));
      return expansion.hasChanges;
    };
    const named = (pick: (expansion: ReplyExpansion) => WritableSignal<ReadonlySet<string>>): boolean => {
      const expansion = new ReplyExpansion();
      pick(expansion).set(new Set(["a.ts"]));
      return expansion.hasChanges;
    };

    expect(numbered(t => t.activity)).toBe(true);
    expect(numbered(t => t.activityBodies)).toBe(true);
    expect(numbered(t => t.handovers)).toBe(true);
    expect(named(t => t.files)).toBe(true);
    expect(named(t => t.wrappedFiles)).toBe(true);
    const shown = new ReplyExpansion();
    shown.activityChildren.set(new Map([[1, 40]]));
    expect(shown.hasChanges).toBe(true);
    const all = new ReplyExpansion();
    all.allFiles.set(true);
    expect(all.hasChanges).toBe(true);
  });
});
