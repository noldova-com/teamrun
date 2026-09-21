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
export class MentionResolverTests {
  @TestMethod
  public resolvesUniqueNamesInTextOrderUsingTheirDurableIdentity(): void {
    const alice = new TeammateMention("a", "Alice");
    const team = new TeammateMention("b", "Équipe");
    const available = [alice, team];
    const result = MentionResolver.resolve("@équipe, @ALICE! @Alice @unknown @Équipe".normalize("NFD"), available);
    Assert.areEqual("b,a", result.map(t => t.teammateId).join(","));
    Assert.areEqual(team, result[0]);
    Assert.areEqual(alice, result[1]);
  }

  @TestMethod
  public ignoresCodeEscapesAddressesAndUnknownNames(): void {
    const available = [new TeammateMention("a", "Alice")];
    for (const text of ["`@Alice`", "```ts\n@Alice\n```", "~~~\n@Alice\n~~~", "\\@Alice", "a@Alice", "https://site/@Alice", "@@Alice",
      "@Alice_suffix", "`unclosed @Alice", "``@Alice```still @Alice``"])
      Assert.areEqual(0, MentionResolver.resolve(text, available).length, text);
    for (const text of ["`code` @Alice", "~~~code~~~ @Alice", "~~text~~ @Alice", "(@Alice)", "\\\\@Alice", "``code```more`` @Alice", "````code```` @Alice"])
      Assert.areEqual(1, MentionResolver.resolve(text, available).length, text);
  }
}
