/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Handover, HandoverRange, HandoverSummary, HandoverTurn, Resources } from "@noldova/teamrun.core";
import { MessageAttachment } from "@noldova/teamrun.protocol";

@TestClass
export class HandoverTests {
  @TestMethod
  public leavesTheProviderItsRoomAndThePromptItsTextsAndFilesAndTakesAtMostItsMaximumAndGoesBelowZeroWhenTheyOverrun(): void {
    const files = [new MessageAttachment("chart.png", "image/png", 4, "D:/data/chart.png"), new MessageAttachment("notes.txt", "text/plain", 4, "D:/data/notes.txt")];

    const budgets = [Handover.budgetOf(null, ["abc"], []), Handover.budgetOf(40_000, ["é"], []), Handover.budgetOf(80_000, [], []),
      Handover.budgetOf(40_000, [], files), Handover.budgetOf(16_000, ["x"], [])];

    Assert.areEqual("64000,23998,60000,11712,-1", budgets.join(","));
  }

  @TestMethod
  public keepsEveryTurnInOrderWhenTheyFitToTheByteThoughTheLeftOutLineWouldNot(): void {
    const turns = HandoverTests.turns(["a", "b", "c"], 10);

    Assert.areEqual(turns.map(t => t.text).join(Resources.transcriptSeparator), Handover.build("chat", turns, 34));
    Assert.isNull(Handover.build("chat", turns, 33));
    Assert.areEqual(String.empty, Handover.build("chat", [], 0));
    Assert.isNull(Handover.build("chat", [], -1));
  }

  @TestMethod
  public keepsTheFirstTurnAndTheNewestAndNamesTheOlderTurnsItLeavesOut(): void {
    const turns = HandoverTests.turns(["a", "b", "c", "d"], 200);
    const line = Resources.formatHandoverLeftOut([Resources.formatHandoverRange(2, 3)], "chat");

    const history = Handover.build("chat", turns, 404 + Handover.bytesOf(line));

    Assert.areEqual(["a".repeat(200), "d".repeat(200), line].join(Resources.transcriptSeparator), history);
  }

  @TestMethod
  public leavesOutAFirstTurnThatDoesNotFitAndStillTakesTheNewest(): void {
    const turns = [new HandoverTurn(1, "a".repeat(100)), ...HandoverTests.turns(["b", "c"], 10, 2)];
    const line = Resources.formatHandoverLeftOut(["1"], "chat");

    const history = Handover.build("chat", turns, 24 + Handover.bytesOf(line));

    Assert.areEqual(["b".repeat(10), "c".repeat(10), line].join(Resources.transcriptSeparator), history);
  }

  @TestMethod
  public saysWhichTurnsItChoseAndWhatItCarriedWholeOrByItsFirstTurnTheNewestAndThoseLeftOut(): void {
    const turns = [new HandoverTurn(1, "a".repeat(200)), new HandoverTurn(2, "b".repeat(200), true, true), new HandoverTurn(3, "c".repeat(200)),
      new HandoverTurn(5, "d".repeat(200), true), new HandoverTurn(6, "e".repeat(200), false, true)];
    const line = Resources.formatHandoverLeftOut([Resources.formatHandoverRange(2, 3)], "chat");

    const whole = Handover.choose("chat", turns, 10_000);
    const cut = Handover.choose("chat", turns, 606 + Handover.bytesOf(line));

    Assert.areEqual("0,1,2,3,4", [...whole?.kept ?? []].join(","));
    Assert.areEqual(turns.map(t => t.text).join(Resources.transcriptSeparator), whole?.text);
    Assert.areEqual("0,3,4", [...cut?.kept ?? []].toSorted((a, b) => a - b).join(","));
    Assert.areEqual(Handover.build("chat", turns, 606 + Handover.bytesOf(line)), cut?.text);
    Assert.isNull(Handover.choose("chat", turns, Handover.bytesOf(line) - 1));
    Assert.areEqual(["Messages 1 to 6 whole, with tool calls as one line each; the results of 2 and 5 cut to their start and end"].join("|"),
      Handover.carriedOf(turns, whole?.kept ?? new Set(), "Ana").join("|"));
    Assert.areEqual(["Ana's first message, the original request", "Messages 5 to 6 whole, with tool calls as one line each; the result of 5 cut to its start and end",
      "Left out: messages 2 to 3"].join("|"), Handover.carriedOf(turns, cut?.kept ?? new Set(), "Ana").join("|"));
    Assert.areEqual(["The chat's first message, the original request", "Left out: messages 2 to 6"].join("|"),
      Handover.carriedOf(turns, new Set([0]), null).join("|"));
    Assert.areEqual(["Message 6 whole, with tool calls as one line each", "Left out: messages 1 to 5"].join("|"), Handover.carriedOf(turns, new Set([4]), "Ana").join("|"));
    Assert.areEqual(String.empty, Handover.carriedOf([], new Set(), null).join("|"));
  }

  @TestMethod
  public saysWhatAHandoverAnswersAndWhatTheStoppedReplyWroteAndWhoReadsWhatWasLeftOut(): void {
    Assert.areEqual(["The message this answers", "The message this answers, and what the stopped reply wrote", "What the stopped reply wrote", "null"].join("|"),
      [[true, false], [true, true], [false, true], [false, false]].map(([asked, continued]) => String(Resources.formatHandoverCarriedAnswer(asked ?? false, continued ?? false)))
        .join("|"));
    Assert.areEqual("Codex reads what was left out with list-messages, as it reads any chat.", Resources.formatHandoverReads("Codex"));
    Assert.areEqual("Left out: message 4", Resources.formatHandoverCarriedLeftOut([new HandoverRange(4, 4)]));
  }

  @TestMethod
  public returnsNullWhenEvenTheLeftOutLineDoesNotFit(): void {
    const turns = HandoverTests.turns(["a", "b", "c"], 200);
    const line = Resources.formatHandoverLeftOut([Resources.formatHandoverRange(1, 3)], "chat");

    Assert.isNull(Handover.build("chat", turns, Handover.bytesOf(line) - 1));
    Assert.isNotNull(Handover.build("chat", turns, Handover.bytesOf(line)));
  }

  @TestMethod
  public putsTheSessionsSummaryAfterTheFirstTurnInPlaceOfTheTurnsItSummarizes(): void {
    const turns = HandoverTests.turns(["a", "b", "c", "d", "e"], 200);
    const summary = Resources.formatHandoverSummary("sum");
    const line = Resources.formatHandoverLeftOut([Resources.formatHandoverRange(2, 3)], "chat");

    const history = Handover.build("chat", turns, 10_000, new HandoverSummary("sum", 3));

    Assert.areEqual(["a".repeat(200), summary, "d".repeat(200), "e".repeat(200), line].join(Resources.transcriptSeparator), history);
  }

  @TestMethod
  public saysTheSummaryItCarriedByItsAuthorAndTheMessagesItCoversAndLeavesThoseOutOfItsLeftOutLine(): void {
    const turns = HandoverTests.turns(["a", "b", "c", "d", "e"], 200);
    const lead = [new HandoverTurn(1, "a".repeat(1_000)), ...HandoverTests.turns(["b", "c", "d"], 10, 2)];
    const compaction = new HandoverSummary("sum", 3, "Claude", true);
    const own = new HandoverSummary("sum", 3, "Codex", false);
    const unnamed = new HandoverSummary("sum", 3);
    const leading = new HandoverSummary("sum", 2, "Claude", true);
    const line = Resources.formatHandoverLeftOut([Resources.formatHandoverRange(1, 3)], "chat");

    const histories = [compaction, own, unnamed].map(t => Handover.choose("chat", turns, 10_000, t));
    const dropped = Handover.choose("chat", turns, 202 + Handover.bytesOf(Resources.formatHandoverLeftOut([Resources.formatHandoverRange(2, 5)], "chat")) + 12,
      compaction);
    const led = Handover.choose("chat", lead, Handover.bytesOf(Resources.formatHandoverSummary("sum")) + 2 + 12 + Handover.bytesOf(line), leading);

    Assert.areEqual("1,2|1,2||", [...histories, dropped].map(t => [...t?.covered ?? []].join(",")).join("|"));
    Assert.areEqual([
      ["Ana's first message, the original request", "Claude's last compaction summary, covering messages 2 to 3", "Messages 4 to 5 whole"],
      ["Ana's first message, the original request", "Codex's handover summary, covering messages 2 to 3", "Messages 4 to 5 whole"],
      ["Ana's first message, the original request", "Messages 4 to 5 whole", "Left out: messages 2 to 3"],
      ["Ana's first message, the original request", "Left out: messages 2 to 5"]
    ].map(t => t.join("|")).join("/"), [...[compaction, own, unnamed].map((summary, index) => [histories[index] ?? null, summary] as const), [dropped, compaction] as const]
      .map(([history, summary]) => Handover.carriedOf(turns, history?.kept ?? new Set(), "Ana", summary, history?.covered).join("|")).join("/"));
    Assert.areEqual(["Claude's last compaction summary, covering messages 1 to 2", "Message 4 whole", "Left out: message 3"].join("|"),
      Handover.carriedOf(lead, led?.kept ?? new Set(), "Ana", leading, led?.covered).join("|"));
  }

  @TestMethod
  public cutsTheSummaryToItsStartAndEndWhenItDoesNotFitAndTakesItBeforeTheNewerTurns(): void {
    const turns = HandoverTests.turns(["a", "b", "c", "d", "e"], 200);
    const whole = Resources.formatHandoverSummary("x".repeat(1_000));
    const line = Resources.formatHandoverLeftOut([Resources.formatHandoverRange(2, 5)], "chat");
    const room = 300;
    const marker = Handover.bytesOf(Resources.formatHandoverSummaryCut(Handover.bytesOf(whole)));
    const half = Math.floor((room - marker - 2 * Handover.bytesOf(Resources.lineSeparator)) / 2);
    const cut = [whole.slice(0, half), Resources.formatHandoverSummaryCut(Handover.bytesOf(whole) - 2 * half), whole.slice(-half)].join(Resources.lineSeparator);

    const history = Handover.build("chat", turns, 202 + Handover.bytesOf(line) + 2 + room, new HandoverSummary("x".repeat(1_000), 3));

    Assert.areEqual(["a".repeat(200), cut, line].join(Resources.transcriptSeparator), history);
  }

  @TestMethod
  public dropsTheSummaryWhenNotEvenItsCutFits(): void {
    const turns = HandoverTests.turns(["a", "b", "c", "d", "e"], 200);
    const line = Resources.formatHandoverLeftOut([Resources.formatHandoverRange(2, 5)], "chat");

    const history = Handover.build("chat", turns, 202 + Handover.bytesOf(line) + 12, new HandoverSummary("x".repeat(1_000), 3));

    Assert.areEqual(["a".repeat(200), line].join(Resources.transcriptSeparator), history);
    Assert.areEqual(String.empty, Handover.build("chat", [], 10, new HandoverSummary("x".repeat(1_000), 0)));
  }

  @TestMethod
  public leadsWithTheSummaryWhenTheFirstTurnDoesNotFit(): void {
    const turns = [new HandoverTurn(1, "a".repeat(1_000)), ...HandoverTests.turns(["b", "c", "d"], 10, 2)];
    const summary = Resources.formatHandoverSummary("sum");
    const line = Resources.formatHandoverLeftOut([Resources.formatHandoverRange(1, 3)], "chat");

    const history = Handover.build("chat", turns, Handover.bytesOf(summary) + 2 + 12 + Handover.bytesOf(line), new HandoverSummary("sum", 2));

    Assert.areEqual([summary, "d".repeat(10), line].join(Resources.transcriptSeparator), history);
  }

  @TestMethod
  public cutsALongResultToItsStartAndEndNamingItsMessageAndWhatWasLeftOut(): void {
    const short = "x".repeat(Resources.handoverResultBytes);
    const long = "s".repeat(1_500) + "m".repeat(1_000) + "e".repeat(1_500);

    Assert.areEqual(short, Handover.cut(short, 7));
    Assert.areEqual(["s".repeat(1_000), Resources.formatHandoverCut(2_000, 7), "e".repeat(1_000)].join(Resources.lineSeparator), Handover.cut(long, 7));
  }

  @TestMethod
  public cutsAResultOnlyBetweenCharacters(): void {
    const cut = Handover.cut("€".repeat(1_000), 3);

    Assert.areEqual(["€".repeat(333), Resources.formatHandoverCut(1_002, 3), "€".repeat(333)].join(Resources.lineSeparator), cut);
    Assert.areEqual(5, Handover.bytesOf("é€"));
  }

  private static turns(letters: readonly string[], length: number, first: number = 1): HandoverTurn[] {
    return letters.map((letter, index) => new HandoverTurn(first + index, letter.repeat(length)));
  }
}
