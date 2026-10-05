/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import type { NotificationPost } from "@noldova/teamrun-shell-protocol";
import { NotificationHandle } from "@noldova/teamrun-shell-runtime";

@TestClass
export class NotificationHandleTests {
  @TestMethod
  public passesAnUpdateAndADismissalToItsNotification(): void {
    const changes: NotificationPost[] = [];
    let removals = 0;
    const post = {} as NotificationPost;
    const handle = new NotificationHandle("n1", t => {
      changes.push(t);
      return changes.length === 1;
    }, () => removals++);

    const updates = [handle.update(post), handle.update(post)];
    handle.dismiss();

    Assert.areEqual("n1", handle.id);
    Assert.areEqual("true,false", updates.join(","));
    Assert.areEqual(2, changes.length);
    Assert.areEqual(post, changes[0]);
    Assert.areEqual(1, removals);
  }
}
