/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { NotificationPost, NotificationSeverity, NotificationUpdate, QualifiedName } from "@noldova/teamrun-shell-protocol";

@TestClass
export class NotificationUpdateTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"id\":3,\"post\":{\"kind\":\"clock.alarm\",\"title\":\"Alarm\",\"severity\":\"Success\",\"actions\":[],\"progress\":1}}";

    const update = NotificationUpdate.fromJson(JSON.parse(text));

    Assert.areEqual("3|1", `${update.id}|${String(update.post.progress)}`);
    Assert.areEqual(text, JSON.stringify(update.toJson()));
  }

  @TestMethod
  public refusesAnInvalidIdAndInvalidFields(): void {
    const post = new NotificationPost(QualifiedName.parse("clock.alarm"), null, "Alarm", null, NotificationSeverity.Info, null, [], null);

    Assert.areEqual("id", Assert.throws(() => new NotificationUpdate(0, post), ArgumentException).parameterName);
    Assert.areEqual("$.post", Assert.throws(() => NotificationUpdate.fromJson({ id: 1 }), JsonException).path);
    Assert.areEqual("$.extra", Assert.throws(() => NotificationUpdate.fromJson({ id: 1, post: post.toJson(), extra: 1 }), JsonException).path);
  }
}
