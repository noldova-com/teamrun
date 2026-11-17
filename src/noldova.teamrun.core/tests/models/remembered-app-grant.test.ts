/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { RememberedAppGrant } from "@noldova/teamrun.core";

@TestClass
export class RememberedAppGrantTests {
  @TestMethod
  public holdsTheGrantsIdAppScopeAndTime(): void {
    const at = new Date("2026-10-29T10:00:00.000Z");
    const grant = new RememberedAppGrant("g1", "com.example.notes", "c1/default", at);

    Assert.areEqual(JSON.stringify(["g1", "com.example.notes", "c1/default", at.toISOString()]),
      JSON.stringify([grant.id, grant.app, grant.scope, grant.rememberedAt.toISOString()]));
  }

  @TestMethod
  public rejectsBlankArguments(): void {
    Assert.throws(() => new RememberedAppGrant(" ", "com.example.notes", "c1/default", new Date()), ArgumentException);
    Assert.throws(() => new RememberedAppGrant("g1", String.empty, "c1/default", new Date()), ArgumentException);
    Assert.isNull(new RememberedAppGrant("g1", null, "c1/default", new Date()).app);
    Assert.throws(() => new RememberedAppGrant("g1", "com.example.notes", " ", new Date()), ArgumentException);
  }
}
