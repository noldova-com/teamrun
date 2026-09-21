/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { MentionResolver, TeammateMention } from "@noldova/teamrun-protocol";

@TestClass
export class MentionSpanTests {
  @TestMethod
  public locatesEveryOccurrenceWithoutCountingCodeOrEscapes(): void {
    const text = "🙂 @Alice and `@Alice` then @ALICE and \\@Alice";
    const spans = MentionResolver.find(text, [new TeammateMention("a", "Alice")]);
    Assert.areEqual("@Alice,@ALICE", spans.map(t => text.slice(t.start, t.end)).join(","));
    Assert.areEqual(3, spans[0]?.start);
    Assert.areEqual("a", spans[1]?.mention.teammateId);
    Assert.areEqual(2, spans.length);
  }
}
