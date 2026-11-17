/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AbilityAnswer, type ProviderAbilities, ProviderAbility, Resources as ProtocolResources } from "@noldova/teamrun.protocol";
import { ProviderAbilityTable, Resources } from "@noldova/teamrun.providers";

@TestClass
export class ProviderAbilityTableTests {
  private static readonly rows: Readonly<Record<string, ProviderAbilities>> = {
    claude: ProviderAbilityTable.claude, codex: ProviderAbilityTable.codex, copilot: ProviderAbilityTable.copilot, grok: ProviderAbilityTable.grok,
    opencode: ProviderAbilityTable.opencode, cursor: ProviderAbilityTable.cursor, antigravity: ProviderAbilityTable.antigravity, pi: ProviderAbilityTable.pi,
    fx: ProviderAbilityTable.fx, muse: ProviderAbilityTable.muse, acpAgent: ProviderAbilityTable.acpAgent
  };

  @TestMethod
  public answersCursorsSeveralAccountsAsWorkingWithOnePerMacInItsNoteSinceOnlyMacOSRefusesASecond(): void {
    const cell = ProviderAbilityTable.cursor.cellOf(ProviderAbility.SeveralAccounts);

    Assert.areEqual(`${AbilityAnswer.Works}|a profile each; one per Mac on macOS|null`, [cell.answer, cell.detail, cell.reasonAgainst()].map(String).join("|"));
  }

  @TestMethod
  public answersReadOnlyModeAsOneFxAndAnAddedAcpAgentCantGiveWithWhy(): void {
    const cells = [ProviderAbilityTable.fx, ProviderAbilityTable.acpAgent].map(t => t.cellOf(ProviderAbility.ReadOnlyMode));

    Assert.areEqual(`${AbilityAnswer.Cannot},${AbilityAnswer.Cannot}`, cells.map(t => t.answer).join(","));
    Assert.areEqual(`${Resources.fxReadOnlyModeAbility}|${Resources.acpAgentReadOnlyModeAbility}`, cells.map(t => t.reasonAgainst()).join("|"));
  }

  @TestMethod
  public refusesClaudeCodeASteerWithWhySoTheMessageWaitsForTheTurnsEnd(): void {
    Assert.areEqual(Resources.claudeSteerTurnAbility, ProviderAbilityTable.claude.cellOf(ProviderAbility.SteerTurn).reasonAgainst());
  }

  @TestMethod
  public answersTheAccountAsOneMuseCodeCantShowWithWhy(): void {
    const cell = ProviderAbilityTable.muse.cellOf(ProviderAbility.Account);

    Assert.areEqual(`${AbilityAnswer.Cannot}|${Resources.museAccountAbility}`, [cell.answer, cell.reasonAgainst()].join("|"));
  }

  @TestMethod
  public answersChooseSpeedAsOneCursorAndMuseCodeCantGiveWithWhy(): void {
    const cells = [ProviderAbilityTable.cursor, ProviderAbilityTable.muse].map(t => t.cellOf(ProviderAbility.ChooseSpeed));

    Assert.areEqual(`${AbilityAnswer.Cannot},${AbilityAnswer.Cannot}`, cells.map(t => t.answer).join(","));
    Assert.areEqual(`${Resources.cursorChooseSpeedAbility}|${Resources.museChooseSpeedAbility}`, cells.map(t => t.reasonAgainst()).join("|"));
  }

  @TestMethod
  public answersPlanChecklistAndGeneratedImagesAsOnesFxCantGiveWithWhy(): void {
    const cells = [ProviderAbility.PlanChecklist, ProviderAbility.GeneratedImages].map(t => ProviderAbilityTable.fx.cellOf(t));

    Assert.areEqual(`${AbilityAnswer.Cannot},${AbilityAnswer.Cannot}`, cells.map(t => t.answer).join(","));
    Assert.areEqual(`${Resources.fxPlanChecklistAbility}|${Resources.fxGeneratedImagesAbility}`, cells.map(t => t.reasonAgainst()).join("|"));
  }

  @TestMethod
  public answersThatOpencodesAndAnAddedAgentsBackgroundSubAgentsCantOutliveTheirTurnWithWhyAndCursorsAreNotBuiltYet(): void {
    const answers = [ProviderAbilityTable.opencode, ProviderAbilityTable.acpAgent, ProviderAbilityTable.cursor].map(t => t.cellOf(ProviderAbility.BackgroundSubAgents))
      .map(t => `${t.answer}|${t.reasonAgainst() ?? "null"}`);

    Assert.areEqual([`${AbilityAnswer.Cannot}|${Resources.opencodeBackgroundSubAgentsAbility}`, `${AbilityAnswer.Cannot}|${Resources.acpAgentBackgroundSubAgentsAbility}`,
      `${AbilityAnswer.NotBuilt}|${Resources.cursorBackgroundSubAgentsAbility}`].join(","), answers.join(","));
  }

  @TestMethod
  public answersQuestionsAsOneFxCantGiveWithWhy(): void {
    const cell = ProviderAbilityTable.fx.cellOf(ProviderAbility.Questions);

    Assert.areEqual(`${AbilityAnswer.Cannot}|${Resources.fxQuestionsAbility}`, [cell.answer, cell.reasonAgainst()].join("|"));
  }

  @TestMethod
  public answersAReplysTokensAsWorkingForCopilotAndAnAddedAgentAndAsOneMuseCodeCantGiveWithWhy(): void {
    const cells = [ProviderAbilityTable.copilot, ProviderAbilityTable.acpAgent, ProviderAbilityTable.muse].map(t => t.cellOf(ProviderAbility.ReplyUsage));

    Assert.areEqual(`${AbilityAnswer.Works} ${Resources.copilotReplyUsageAbility},${AbilityAnswer.Works} ${Resources.acpAgentReplyUsageAbility},` +
      `${AbilityAnswer.Cannot} ${Resources.museReplyUsageAbility}`, cells.map(t => `${t.answer} ${t.detail ?? t.reasonAgainst()}`).join(","));
  }

  @TestMethod
  public answersPlanModeAsOneAntigravityAndAnAddedAgentCantGiveWithWhy(): void {
    const cells = [ProviderAbilityTable.antigravity, ProviderAbilityTable.acpAgent].map(t => t.cellOf(ProviderAbility.PlanMode));

    Assert.areEqual(`${AbilityAnswer.Cannot} ${Resources.antigravityPlanModeAbility},${AbilityAnswer.Cannot} ${Resources.acpAgentPlanModeAbility}`,
      cells.map(t => `${t.answer} ${t.reasonAgainst()}`).join(","));
  }

  @TestMethod
  public answersAContextSizeAsOneCursorAndMuseCodeCantGiveWithWhyAndCopilotsAsNotBuiltYet(): void {
    const cells = [ProviderAbilityTable.cursor, ProviderAbilityTable.muse, ProviderAbilityTable.copilot].map(t => t.cellOf(ProviderAbility.ChooseContext));

    Assert.areEqual([`${AbilityAnswer.Cannot} ${Resources.cursorChooseContextAbility}`, `${AbilityAnswer.Cannot} ${Resources.museChooseContextAbility}`,
      `${AbilityAnswer.NotBuilt} ${Resources.copilotChooseContextAbility}`].join(","), cells.map(t => `${t.answer} ${t.reasonAgainst()}`).join(","));
  }

  @TestMethod
  public saysTeamRunHasNotBuiltItInTheCellOfEveryAbilityTeamRunHasNotBuilt(): void {
    const notBuilt = Object.entries(ProviderAbilityTableTests.rows).flatMap(([provider, row]) => Object.values(ProviderAbility)
      .filter(t => row.cellOf(t).answer === AbilityAnswer.NotBuilt).map(t => ({ name: `${provider}.${t}`, cell: row.cellOf(t) })));
    const unsaid = notBuilt.filter(t => t.cell.detail?.startsWith(ProtocolResources.abilityNotBuiltLead) !== true).map(t => t.name);

    Assert.isTrue(notBuilt.length > 0);
    Assert.areEqual(String.empty, unsaid.join(","));
  }

  @TestMethod
  public givesEveryNotBuiltReasonAsAClauseThatStandsOnItsOwnAfterItsLead(): void {
    const lead = ProtocolResources.abilityNotBuiltLead;
    const joined = Object.entries(ProviderAbilityTableTests.rows).flatMap(([provider, row]) => Object.values(ProviderAbility)
      .filter(t => row.cellOf(t).detail?.startsWith(lead) === true && row.cellOf(t).detail !== lead && row.cellOf(t).detail?.startsWith(`${lead}; `) !== true)
      .map(t => `${provider}.${t}`));

    Assert.areEqual(String.empty, joined.join(","));
  }

  @TestMethod
  public startsNoReasonWithACapitalItSoThePageCanNameTheProvider(): void {
    const capitals = [ProtocolResources.abilityItSubject, ProtocolResources.abilityItsSubject].map(t => `${t.charAt(0).toUpperCase()}${t.slice(1)}`);
    const capitalized = Object.entries(ProviderAbilityTableTests.rows).flatMap(([provider, row]) => Object.values(ProviderAbility)
      .filter(t => capitals.some(u => row.cellOf(t).reasonAlone?.startsWith(u) === true)).map(t => `${provider}.${t}`));

    Assert.areEqual(String.empty, capitalized.join(","));
  }

  @TestMethod
  public namesNoProtocolFieldOrMethodInAReasonThePageShows(): void {
    const technical = /[/_`"[\]{}]|\b(?!macOS\b)[a-z]+[A-Z][A-Za-z]*\b|-\d{3,}|\b(?:ACP|MCP|SDK|JSON|HTTP|stdio)\b/u;
    const named = Object.entries(ProviderAbilityTableTests.rows).flatMap(([provider, row]) => Object.values(ProviderAbility)
      .filter(t => row.cellOf(t).answer !== AbilityAnswer.Works && technical.test(row.cellOf(t).reasonAlone ?? String.empty)).map(t => `${provider}.${t}`));

    Assert.areEqual(String.empty, named.join(","));
  }

  @TestMethod
  public answersSeveralAccountsAsOneAnAddedAcpAgentCantGiveWithWhy(): void {
    const cell = ProviderAbilityTable.acpAgent.cellOf(ProviderAbility.SeveralAccounts);

    Assert.areEqual(`${AbilityAnswer.Cannot}|${Resources.acpAgentSeveralAccountsAbility}`, `${cell.answer}|${cell.reasonAgainst()}`);
  }
}
