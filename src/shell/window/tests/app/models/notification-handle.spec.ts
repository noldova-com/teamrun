/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";

import { NotificationHandle } from "../../../src/app/models/notification-handle";

describe("NotificationHandle", () => {
  it("passes each update and a dismissal to its notification", async () => {
    const changes: NotificationPost[] = [];
    let removals = 0;
    const handle = new NotificationHandle("7", t => {
      changes.push(t);
      return Promise.resolve(changes.length === 1);
    }, () => removals++);
    const synced = new NotificationPost(QualifiedName.parse("notes.sync"), null, "Synced", null, NotificationSeverity.Info, null, [], null);
    const updated = new NotificationPost(QualifiedName.parse("notes.sync"), null, "Updated", null, NotificationSeverity.Warning, null, [], null);

    const results = [await handle.updateAsync(synced), await handle.updateAsync(updated)];
    handle.dismiss();

    expect([handle.id, results]).toEqual(["7", [true, false]]);
    expect(changes[0]).toBe(synced);
    expect(changes[1]).toBe(updated);
    expect(removals).toBe(1);
  });
});
