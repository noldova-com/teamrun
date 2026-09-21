/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Change, ChangeOperation } from "@noldova/teamrun-foundation-data";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class ChangeTests {
  @TestMethod
  public holdsOneEntryOfAFeed(): void {
    const change = new Change(7, "message", "msg-1", ChangeOperation.Update, "{\"id\":\"msg-1\"}", "t");

    Assert.areEqual(7, change.sequence);
    Assert.areEqual("message", change.entity);
    Assert.areEqual("msg-1", change.entityId);
    Assert.areEqual(ChangeOperation.Update, change.operation);
    Assert.areEqual("{\"id\":\"msg-1\"}", change.payload);
    Assert.areEqual("t", change.createdAt);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.areEqual("sequence", Assert.throws(() => new Change(0, "e", "id", ChangeOperation.Insert, "", "t"), ArgumentOutOfRangeException).parameterName);
    Assert.throws(() => new Change(1.5, "e", "id", ChangeOperation.Insert, "", "t"), ArgumentOutOfRangeException);
    Assert.areEqual("entity", Assert.throws(() => new Change(1, " ", "id", ChangeOperation.Insert, "", "t"), ArgumentException).parameterName);
    Assert.areEqual("entityId", Assert.throws(() => new Change(1, "e", "", ChangeOperation.Insert, "", "t"), ArgumentException).parameterName);
    Assert.areEqual("createdAt", Assert.throws(() => new Change(1, "e", "id", ChangeOperation.Insert, "", " "), ArgumentException).parameterName);
  }
}
