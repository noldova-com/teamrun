/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AbilityCell, ProviderAbility, ProviderKind } from "@noldova/teamrun.protocol";

import { AbilityRefusal } from "../../../src/app/models/ability-refusal";
import { SampleData } from "../../fixtures/sample-data.fixture";

describe("AbilityRefusal", () => {
  it("says why a kind can't, from its cell, only when the cell says can't or not built", () => {
    const kind = new ProviderKind("pi", "Pi", true, false, null, null, false, null, false, null, false, null,
      SampleData.abilities({ [ProviderAbility.ChooseSpeed]: AbilityCell.notBuilt("TeamRun doesn't support this for it yet"),
        [ProviderAbility.PlanMode]: AbilityCell.cannot("its own guide says it leaves out plan mode"),
        [ProviderAbility.ChooseContext]: AbilityCell.notChecked("whether it takes one hasn't been checked") }));

    expect([AbilityRefusal.of(kind, ProviderAbility.ChooseSpeed, "change speed"), AbilityRefusal.of(kind, ProviderAbility.PlanMode, "plan first"),
      AbilityRefusal.of(kind, ProviderAbility.ChooseContext, "change the context window"), AbilityRefusal.of(kind, ProviderAbility.ChooseEffort, "change effort"),
      AbilityRefusal.of(undefined, ProviderAbility.PlanMode, "plan first"), AbilityRefusal.of(new ProviderKind("pi", "Pi", true), ProviderAbility.PlanMode, "plan first")])
      .toEqual(["Pi can't change speed: TeamRun doesn't support this for it yet.", "Pi can't plan first: its own guide says it leaves out plan mode.", null, null, null, null]);
  });
});
