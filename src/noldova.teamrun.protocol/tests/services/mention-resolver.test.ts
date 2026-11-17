/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { MentionResolver, MentionToken, TeammateMention } from "@noldova/teamrun.protocol";

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

  @TestMethod
  public readsANameInQuotesInATeammatesTextAsTextAndKeepsTheMessageRulesElsewhere(): void {
    const available = [new TeammateMention("a", "Alice"), new TeammateMention("b", "Bob")];
    for (const text of ["\"@Alice\"", "'@Alice hi'", "“@Alice”", "‘@Alice’", "„@Alice“", "„@Alice”",
      "«@Alice»", "‹@Alice›", "「@Alice」", "『@Alice』",
      "her \"@Alice hi\" chat", "(\"@Alice\")", "'@Alice's chat'", "‘@Alice hasn’t’", "\"@Alice\"5\""]) {
      Assert.areEqual(0, MentionResolver.resolveTeammateText(text, available).length, text);
      Assert.areEqual("a", MentionResolver.resolve(text, available).map(t => t.teammateId).join(","), text);
    }
    for (const text of ["`@Alice`", "```\n@Alice\n```", "\\@Alice", "a@Alice"])
      Assert.areEqual(0, MentionResolver.resolveTeammateText(text, available).length, text);
    for (const text of ["@Alice", "\"hi\" @Alice", "don't @Alice", "Bob's @Alice", "the teammates' @Alice", "5\" @Alice", "\"unclosed @Alice",
      "\"a line\n@Alice\"", "\\\"@Alice\"", "«@Alice", "\"@Bob\" and @Alice", "In the '90s @Alice didn't reply", "'cause @Alice can't",
      "'em @Alice, Bob's", "‘tis @Alice hasn’t", "\"5\"x @Alice"])
      Assert.areEqual("a", MentionResolver.resolveTeammateText(text, available).map(t => t.teammateId).join(","), text);
    Assert.areEqual("b,a", MentionResolver.resolveTeammateText("@Bob \"@Alice\" `@Bob` @Alice", available).map(t => t.teammateId).join(","));
  }

  @TestMethod
  public addressesOnlyTheMentionsThatStartTheTextOrALineAndTheOnesJoinedToThem(): void {
    const available = [new TeammateMention("a", "Alice"), new TeammateMention("b", "Bob")];
    const cases: readonly (readonly [string, string])[] = [
      ["@Alice please", "a"], ["   @Alice please", "a"], ["Done.\n@Alice please", "a"], ["Done.\r\n @Alice please", "a"],
      ["- @Alice:", "a"], ["* @Alice", "a"], ["+ @Alice", "a"], ["1. @Alice", "a"], ["2)\t@Alice", "a"], ["**@Alice**, please", "a"], ["- *@Alice*", "a"],
      ["@Alice, @Bob: please", "a,b"], ["@Alice @Bob please", "a,b"], ["@Alice,@Bob", "a,b"], ["[@Al](mention:a) please", "a"],
      ["@Alice and @Bob,", "a,b"], ["@Alice, and @Bob", "a,b"], ["**@Alice**, **@Bob**", "a,b"], ["- @Alice AND @Bob", "a,b"],
      ["@Alice please ask @Bob", "a"], ["@Alice, then @Bob", "a"], ["@Bob\n@Alice, @Bob", "b,a"], ["@Alice \"x\" @Bob", "a"], ["@Alice\n, @Bob", "a"],
      ["ask @Alice", String.empty], ["Done. @Alice please", String.empty], ["I sent its teammate, @Alice, a message.", String.empty],
      ["(@Alice)", String.empty], ["-@Alice", String.empty], ["1.@Alice", String.empty], ["- - @Alice", String.empty], ["**Note:** @Alice", String.empty],
      ["    @Alice", String.empty], ["\t@Alice", String.empty], ["    - @Alice", String.empty], ["> @Alice", String.empty], ["\"@Alice\" hi", String.empty],
      ["\"@Alice\" @Bob", String.empty], ["`@Alice` @Bob", String.empty], ["```\n@Alice\n```", String.empty], ["\\@Alice", String.empty]
    ];
    for (const [text, expected] of cases)
      Assert.areEqual(expected, MentionResolver.resolveAddressed(text, available).map(t => t.teammateId).join(","), text);
  }

  @TestMethod
  public findsEachAddressingMentionWithItsOffsetsAndKeepsARepeatedOne(): void {
    const available = [new TeammateMention("a", "Alice"), new TeammateMention("b", "Bob")];

    Assert.areEqual("a:0-6,a:21-27,b:32-36", MentionResolver.findAddressed("@Alice look\nask @Bob\n@Alice and @Bob", available)
      .map(t => `${t.mention.teammateId}:${t.start}-${t.end}`).join(","));
  }

  @TestMethod
  public matchesTheLongestNameAtEachMarker(): void {
    const code = new TeammateMention("c", "Code");
    const reviewer = new TeammateMention("r", "Code Reviewer");
    const lead = new TeammateMention("l", "Code Reviewer Lead");
    const available = [code, reviewer, lead];
    const cases: readonly (readonly [string, string, string])[] = [
      ["@Code Reviewer please", "r", "@Code Reviewer"],
      ["ask @code   reviewer", "r", "@code   reviewer"],
      ["@Code Reviewer, then", "r", "@Code Reviewer"],
      ["@Code Reviewer.", "r", "@Code Reviewer"],
      ["@Code Reviewers", "c", "@Code"],
      ["@Code Review", "c", "@Code"],
      ["@Code Reviewer Lead", "l", "@Code Reviewer Lead"],
      ["@Code Reviewer Leads", "r", "@Code Reviewer"],
      ["@Code", "c", "@Code"],
      ["@Code\nReviewer", "c", "@Code"]
    ];
    for (const [text, id, mentioned] of cases) {
      const spans = MentionResolver.find(text, available);
      Assert.areEqual(1, spans.length, text);
      Assert.areEqual(id, spans[0]!.mention.teammateId, text);
      Assert.areEqual(mentioned, text.slice(spans[0]!.start, spans[0]!.end), text);
    }
    Assert.areEqual("c,r", MentionResolver.resolve("@Code and @Code Reviewer and @Code", available).map(t => t.teammateId).join(","));
    Assert.areEqual(0, MentionResolver.resolve("@Reviewer `@Code Reviewer`", available).length);
  }

  @TestMethod
  public matchesANameOfOneHundredCharacters(): void {
    const name = `${"a".repeat(49)} ${"b".repeat(50)}`;
    const long = new TeammateMention("x", name);
    Assert.areEqual("x", MentionResolver.resolve(`hi @${name}!`, [long]).map(t => t.teammateId).join(","));
    const partial = `hi @${name}b`;
    Assert.areEqual(`@${"a".repeat(49)}`, MentionResolver.find(partial, [long]).map(t => partial.slice(t.start, t.end)).join(","));
    Assert.areEqual(0, MentionResolver.resolve(`hi @${"a".repeat(48)}`, [long]).length);
  }

  @TestMethod
  public resolvesATokenByItsIdWhateverItsLabelSays(): void {
    const chat = new TeammateMention("c", "Chat GPT");
    const alice = new TeammateMention("a", "Alice");
    const text = `${MentionToken.format("a", "Al")} asks ${MentionToken.format("c", "Chat")} and ${MentionToken.format("gone", "Alice")}`;

    const spans = MentionResolver.find(text, [chat, alice]);
    Assert.areEqual("a,c", spans.map(t => t.mention.teammateId).join(","));
    Assert.areEqual(MentionToken.format("c", "Chat"), text.slice(spans[1]!.start, spans[1]!.end));
    Assert.areEqual(0, MentionResolver.resolve(`\`${MentionToken.format("c", "Chat")}\``, [chat]).length);
  }

  @TestMethod
  public matchesAFirstWordThatBeginsExactlyOneName(): void {
    const chat = new TeammateMention("c", "Chat GPT");
    const reviewer = new TeammateMention("r", "Code Reviewer");
    const writer = new TeammateMention("w", "Code Writer");
    const code = new TeammateMention("k", "Code");
    Assert.areEqual("c", MentionResolver.resolve("@chat, look", [chat, reviewer, writer]).map(t => t.teammateId).join(","));
    Assert.areEqual(0, MentionResolver.resolve("@Code, look", [chat, reviewer, writer]).length);
    Assert.areEqual("k,r", MentionResolver.resolve("@Code, then @Code Reviewer", [chat, reviewer, writer, code]).map(t => t.teammateId).join(","));
    Assert.areEqual("c", MentionResolver.resolve("@Chat @Chat", [chat, chat]).map(t => t.teammateId).join(","));
  }

  @TestMethod
  public namesNoOneWithAWordThatGoesOnAsAPackageOrAPath(): void {
    const available = [new TeammateMention("g", "Angular Bot"), new TeammateMention("a", "Alice")];
    for (const text of ["@angular/core", "use @angular/core here", "@Angular.json", "@alice/notes", "@Alice.md", "@Alice_x.md"])
      Assert.areEqual(0, MentionResolver.resolve(text, available).length, text);
    const cases: readonly (readonly [string, string])[] = [
      ["@angular, look", "g"],
      ["@Alice.", "a"],
      ["@Alice. Then @angular/core", "a"],
      ["@Alice: see @Angular Bot.", "a,g"]
    ];
    for (const [text, ids] of cases)
      Assert.areEqual(ids, MentionResolver.resolve(text, available).map(t => t.teammateId).join(","), text);
  }

  @TestMethod
  public reachesTheOneTeammateByTheFirstWordWhenTheNextWordGoesOnAsAPath(): void {
    const available = [new TeammateMention("g", "Angular Bot"), new TeammateMention("a", "Alice")];
    for (const text of ["@Angular Bot/core", "@Angular Bot.json", "@angular, look"])
      Assert.areEqual("g", MentionResolver.resolve(text, available).map(t => t.teammateId).join(","), text);
  }

  @TestMethod
  public endsANameBeforeAnyOfItsWordsThatGoesOnAsAPackageOrAPath(): void {
    const angular = new TeammateMention("n", "Angular");
    const angularBot = new TeammateMention("g", "Angular Bot");
    const review = new TeammateMention("r", "Code Review");
    const reviewTeam = new TeammateMention("t", "Code Review Team");
    const available = [angular, angularBot, review, reviewTeam];
    const cases: readonly (readonly [string, string])[] = [
      ["@Angular Bot/core", "n"],
      ["@Angular Bot.json", "n"],
      ["see @Angular Bot/core here", "n"],
      ["@Angular Bot", "g"],
      ["@Angular Bot.", "g"],
      ["@Angular Bot, look", "g"],
      ["@Angular Bot: look", "g"],
      ["@Angular Bot!", "g"],
      ["(@Angular Bot)", "g"],
      ["@Angular. Bot", "n"],
      ["@Angular, Bot", "n"],
      ["@Code Review Team/notes", "r"],
      ["@Code Review Team.md", "r"],
      ["@Code Review Team.", "t"],
      ["@Code Review Team, then @Code Review.", "t,r"],
      ["@Code Review/notes", ""],
      ["@Code Review, Team", "r"],
      ["@Code Review. Team", "r"],
      ["@Angular Bot\nlook", "g"],
      ["@Angular\nBot", "n"],
      ["@Code Review\r\nTeam", "r"],
      ["@Code Review Team\n", "t"]
    ];
    for (const [text, ids] of cases)
      Assert.areEqual(ids, MentionResolver.resolve(text, available).map(t => t.teammateId).join(","), text);
  }

  @TestMethod
  public reachesNamesWithMarksWholeInAnyScript(): void {
    const available = [new TeammateMention("h", "राहुल शर्मा"), new TeammateMention("t", "สมศักดิ์ ใจดี"), new TeammateMention("p", "प्रिया"),
      new TeammateMention("f", "\u095E\u0930\u093E\u091C\u093C")];
    const cases: readonly (readonly [string, string])[] = [
      ["@राहुल शर्मा, देखो", "h"],
      ["@राहुल शर्मा\nदेखो", "h"],
      ["@राहुल", "h"],
      ["@สมศักดิ์ ใจดี ช่วยดู", "t"],
      ["@प्रिया!", "p"],
      ["@प्रिया @राहुल शर्मा", "p,h"],
      ["@\u092B\u093C\u0930\u093E\u091C\u093C ji", "f"],
      ["@प्रियाजी", ""]
    ];
    for (const [text, ids] of cases)
      Assert.areEqual(ids, MentionResolver.resolve(text, available).map(t => t.teammateId).join(","), text);
  }

  @TestMethod
  public rewritesEachTokenOutsideCodeAsTheNameItIsGiven(): void {
    const token = MentionToken.format("c", "Chat");
    const text = `${token} and \`${token}\`, then ${MentionToken.format("x", "Someone")}.`;
    Assert.areEqual(`@Chat GPT and \`${token}\`, then @Someone.`, MentionResolver.rewrite(text, t => t.teammateId === "c" ? "Chat GPT" : t.label));
    Assert.areEqual("no tokens", MentionResolver.rewrite("no tokens", () => "never"));
  }
}
