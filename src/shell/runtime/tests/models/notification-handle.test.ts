/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";
import { NotificationHandle } from "@noldova/teamrun-shell-runtime";

@TestClass
export class NotificationHandleTests {
  @TestMethod
  public passesEachUpdateAndADismissalToItsNotification(): void {
    const changes: NotificationPost[] = [];
    let removals = 0;
    const first = new NotificationPost(QualifiedName.parse("clock.alarm"), "window", "Synced", null, NotificationSeverity.Warning, null, [], null);
    const second = new NotificationPost(QualifiedName.parse("clock.alarm"), "window", "Updated", null, NotificationSeverity.Warning, null, [], null);
    const handle = new NotificationHandle("n1", t => {
      changes.push(t);
      return changes.length === 1;
    }, () => removals++);

    const updates = [handle.update(first), handle.update(second)];
    handle.dismiss();

    Assert.areEqual("n1", handle.id);
    Assert.areEqual("true,false", updates.join(","));
    Assert.areEqual("Synced,Updated", changes.map(t => t.title).join(","));
    Assert.areEqual(first, changes[0]);
    Assert.areEqual(second, changes[1]);
    Assert.areEqual(1, removals);
  }
}
