/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AbilityAnswer, AbilityCell, AbilitySource } from "@noldova/teamrun.protocol";

@TestClass
export class AbilityCellTests {
  @TestMethod
  public roundTripsEachAnswerThroughJson(): void {
    const cells = [AbilityCell.works(AbilitySource.Acp), AbilityCell.works(AbilitySource.AcpAddition, "x.ai/session/fork"),
      AbilityCell.cannot("ACP names no fork."), AbilityCell.notBuilt("TeamRun doesn't read it."), AbilityCell.notBuilt("Not checked."),
      AbilityCell.works(AbilitySource.Outside), AbilityCell.cannot("It holds its turn."), AbilityCell.notChecked("Never seen one.")];

    Assert.areEqual(JSON.stringify(cells.map(t => t.toJson())), JSON.stringify(cells.map(t => AbilityCell.fromJson(t.toJson()).toJson())));
    Assert.areEqual(JSON.stringify({ answer: "NotBuilt", source: null, detail: "TeamRun doesn't read it." }), JSON.stringify(cells[3]!.toJson()));
    Assert.areEqual("Works:Acp:null", [cells[0]!.answer, cells[0]!.source, cells[0]!.detail ?? "null"].join(":"));
    Assert.areEqual(AbilityAnswer.Cannot, cells[2]!.answer);
    Assert.areEqual("NotChecked:null:Never seen one.", [cells[7]!.answer, cells[7]!.source ?? "null", cells[7]!.detail].join(":"));
  }

  @TestMethod
  public givesItsReasonAgainstOnlyWhenItCantOrIsNotBuilt(): void {
    const cells = [AbilityCell.works(AbilitySource.Acp, "x.ai/session/fork"), AbilityCell.cannot("ACP names no fork."), AbilityCell.notBuilt("TeamRun doesn't read it."),
      AbilityCell.notChecked("Never seen one.")];

    Assert.areEqual("null|ACP names no fork.|TeamRun doesn't read it.|null", cells.map(t => t.reasonAgainst() ?? "null").join("|"));
  }

  @TestMethod
  public givesItsReasonWithoutTheWordsThatSayItIsNotBuilt(): void {
    const cells = [AbilityCell.works(AbilitySource.Acp), AbilityCell.cannot("it offers no fork"), AbilityCell.notBuilt("TeamRun doesn't support this for it yet; Cursor saves the image"),
      AbilityCell.notBuilt("TeamRun doesn't support this for it yet, since its command only asks"), AbilityCell.notBuilt("TeamRun doesn't support this for it yet until it ships"),
      AbilityCell.notBuilt("TeamRun doesn't support this for it yet"), AbilityCell.notBuilt("TeamRun doesn't support this for it yet; ")];

    Assert.areEqual("null|it offers no fork|Cursor saves the image|since its command only asks|until it ships|null|null", cells.map(t => t.reasonAlone ?? "null").join("|"));
  }

  @TestMethod
  public namesTheProviderWhereItsReasonStartsWithItOrIts(): void {
    const cells = [AbilityCell.cannot("it offers no fork"), AbilityCell.cannot("its replies carry only text"), AbilityCell.notBuilt("TeamRun doesn't support this for it yet; it saves the image"),
      AbilityCell.cannot("item lists aren't sent"), AbilityCell.notBuilt("TeamRun doesn't support this for it yet")];

    Assert.areEqual("Cursor offers no fork|Cursor's replies carry only text|Cursor saves the image|item lists aren't sent|null", cells.map(t => t.reasonFor("Cursor") ?? "null").join("|"));
  }

  @TestMethod
  public labelsEachAnswerAndWhereAWorkingOneComesFrom(): void {
    const cells = [AbilityCell.works(AbilitySource.Acp), AbilityCell.works(AbilitySource.AcpAddition, "x.ai/session/fork"), AbilityCell.works(AbilitySource.Outside),
      AbilityCell.cannot("ACP names no fork."), AbilityCell.notBuilt("TeamRun doesn't read it."), AbilityCell.notChecked("Never seen one.")];

    Assert.areEqual("Works|Works|Works|Can't|Not built yet|Not checked yet", cells.map(t => t.answerLabel).join("|"));
    Assert.areEqual("Through ACP|Through the provider's addition to ACP|Outside ACP, through the provider's own tools|null|null|null", cells.map(t => t.sourceNote ?? "null").join("|"));
    Assert.areEqual("Works, ACP|Works, ACP addition|Works, outside ACP|Can't|Not built yet|Not checked yet", cells.map(t => t.label).join("|"));
  }

  @TestMethod
  public namesASourceExactlyWhenItWorksAndSaysWhyWhenItDoesNot(): void {
    Assert.throws(() => new AbilityCell(AbilityAnswer.Works, null), ArgumentException);
    Assert.throws(() => new AbilityCell(AbilityAnswer.Cannot, AbilitySource.Acp, "ACP names none."), ArgumentException);
    Assert.throws(() => new AbilityCell(AbilityAnswer.Cannot, null), ArgumentException);
    Assert.throws(() => AbilityCell.notBuilt(" "), ArgumentException);
    Assert.throws(() => AbilityCell.works(AbilitySource.Outside, String.empty), ArgumentException);
    Assert.throws(() => AbilityCell.notChecked(" "), ArgumentException);
    Assert.throws(() => new AbilityCell(AbilityAnswer.NotChecked, AbilitySource.Acp, "Never seen one."), ArgumentException);
  }

  @TestMethod
  public rejectsUnknownValues(): void {
    Assert.throws(() => new AbilityCell("Maybe" as AbilityAnswer, null, "Unknown."), ArgumentException);
    Assert.throws(() => new AbilityCell(AbilityAnswer.Works, "Elsewhere" as AbilitySource), ArgumentException);
    Assert.areEqual("$.answer", Assert.throws(() => AbilityCell.fromJson({ answer: "Maybe", source: null, detail: null }), JsonException).path);
  }
}
