/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ThreadStartResult } from "@noldova/teamrun.providers";

@TestClass
export class ThreadStartResultTests {
  @TestMethod
  public readsTheThreadWithAnOptionalEffortAndTierKeepingAMissingTierApartFromNone(): void {
    const withEffort = ThreadStartResult.fromJson({ thread: { id: "t-1" }, model: "gpt", reasoningEffort: "high", serviceTier: "priority" });
    const withoutEffort = ThreadStartResult.fromJson({ thread: { id: "t-2" }, model: "gpt", serviceTier: null });

    Assert.areEqual("t-1", withEffort.threadId);
    Assert.areEqual("high", withEffort.reasoningEffort);
    Assert.isNull(withoutEffort.reasoningEffort);
    Assert.areEqual("priority|null|undefined", [withEffort.serviceTier, withoutEffort.serviceTier,
      ThreadStartResult.fromJson({ thread: { id: "t-3" }, model: "gpt" }).serviceTier].map(String).join("|"));
    Assert.areEqual("threadId", Assert.throws(() => new ThreadStartResult("", "m", null), ArgumentException).parameterName);
    Assert.areEqual("model", Assert.throws(() => new ThreadStartResult("t", " ", null), ArgumentException).parameterName);
  }

  @TestMethod
  public readsTheCollaborationModeAResumedThreadReportsAndNullWhenItReportsNone(): void {
    const read = (collaboration: object): string | null => ThreadStartResult.fromJson({ thread: { id: "t" }, model: "gpt", ...collaboration }).collaborationMode;

    Assert.areEqual(JSON.stringify(["plan", "default", null, null, null]), JSON.stringify([read({ collaborationMode: { mode: "plan", settings: { model: "gpt" } } }),
      read({ collaborationMode: { mode: "default" } }), read({ collaborationMode: {} }), read({ collaborationMode: null }), read({})]));
    Assert.isNull(new ThreadStartResult("t", "m", null).collaborationMode);
  }
}
