/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PendingDocument } from "../../../src/app/models/pending-document";

describe("PendingDocument", () => {
  it("is kept out of preview only when the same document is kept, and stays as it is for another", () => {
    const pending = new PendingDocument("notes", "notes.note", "plan", "Plan", true);

    const kept = pending.kept("notes", "notes.note", "plan");

    expect([kept.moduleId, kept.name, kept.instance, kept.title, kept.isPreview]).toEqual(["notes", "notes.note", "plan", "Plan", false]);
    expect(pending.isPreview).toBe(true);
    expect([pending.kept("notes", "notes.note", "todo"), pending.kept("notes", "notes.other", "plan"), pending.kept("tasks", "notes.note", "plan")])
      .toEqual([pending, pending, pending]);
  });
});
