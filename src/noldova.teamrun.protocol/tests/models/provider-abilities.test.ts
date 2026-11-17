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
import { AbilityAnswer, AbilityCell, AbilitySource, ProviderAbilities, ProviderAbility } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderAbilitiesTests {
  private static readonly cells: Readonly<Record<ProviderAbility, AbilityCell>> =
    Object.fromEntries(Object.values(ProviderAbility).map(t => [t, AbilityCell.works(AbilitySource.Acp)])) as Record<ProviderAbility, AbilityCell>;

  @TestMethod
  public namesEachAbilityOnce(): void {
    Assert.areEqual(JSON.stringify(Object.values(ProviderAbility)), JSON.stringify(Object.keys(ProviderAbilities.names)));
    Assert.areEqual(Object.values(ProviderAbility).length, new Set(Object.values(ProviderAbilities.names)).size);
  }

  @TestMethod
  public listsTheSlashCommandsLastInTheirOwnOrder(): void {
    Assert.areEqual(JSON.stringify(["/compact", "Commands the provider lists", "Other built-in commands", "Custom commands, prompts and skills", "/logout"]),
      JSON.stringify(ProviderAbilities.commands.map(t => ProviderAbilities.names[t])));
    Assert.areEqual(JSON.stringify(ProviderAbilities.commands), JSON.stringify(Object.values(ProviderAbility).slice(-ProviderAbilities.commands.length)));
  }

  @TestMethod
  public answersEveryAbilityAndRoundTripsThroughJson(): void {
    const value = new ProviderAbilities({ ...ProviderAbilitiesTests.cells, [ProviderAbility.Compact]: AbilityCell.cannot("ACP names no compact.") });
    const read = ProviderAbilities.fromJson(value.toJson());

    Assert.areEqual(JSON.stringify(value.toJson()), JSON.stringify(read.toJson()));
    Assert.areEqual(JSON.stringify(Object.values(ProviderAbility)), JSON.stringify(Object.keys(value.toJson()["cells"] as object)));
    Assert.areEqual(AbilityAnswer.Cannot, read.cellOf(ProviderAbility.Compact).answer);
    Assert.areEqual(AbilityAnswer.Works, read.cellOf(ProviderAbility.Fork).answer);
  }

  @TestMethod
  public rejectsAMissingOrUnknownAbility(): void {
    const missing = Object.fromEntries(Object.entries(ProviderAbilitiesTests.cells).filter(([t]) => t !== ProviderAbility.Install));

    const exception = Assert.throws(() => new ProviderAbilities(missing as Record<ProviderAbility, AbilityCell>), ArgumentException);
    Assert.isTrue(exception.message.includes("Install"));
    Assert.throws(() => new ProviderAbilities({ ...ProviderAbilitiesTests.cells, Teleport: AbilityCell.works(AbilitySource.Acp) } as Record<ProviderAbility, AbilityCell>), ArgumentException);
    Assert.throws(() => new ProviderAbilities({ ...ProviderAbilitiesTests.cells, [ProviderAbility.Fork]: { answer: AbilityAnswer.Works } as AbilityCell }), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const json = new ProviderAbilities(ProviderAbilitiesTests.cells).toJson();

    Assert.areEqual("$.cells.Resume.source", Assert.throws(() => ProviderAbilities.fromJson({ cells: { ...json["cells"] as object, Resume: { answer: "Works", source: 1, detail: null } } }), JsonException).path);
    Assert.areEqual("$.cells", Assert.throws(() => ProviderAbilities.fromJson({ cells: [] }), JsonException).path);
  }
}
