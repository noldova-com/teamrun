/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AbilityCell, ProviderAbility, ProviderKind, ProviderMode } from "@noldova/teamrun.protocol";

import { RefusedMode } from "../../../src/app/models/refused-mode";
import { SampleData } from "../../fixtures/sample-data.fixture";

describe("RefusedMode", () => {
  const refusing = new ProviderKind("muse", "Muse Code", true, false, null, null, false, null, false, null, false, null,
    SampleData.abilities({ [ProviderAbility.ReadOnlyMode]: AbilityCell.cannot("its guide lists read-only mode as missing"),
      [ProviderAbility.UnrestrictedMode]: AbilityCell.notBuilt("TeamRun doesn't support this for it yet") }));
  const ask = new ProviderMode("ask", "Ask");

  it("names each mode the provider's rows refuse, with the row's reason, and whether it is the unrestricted one", () => {
    expect(RefusedMode.of(refusing, [ask]).map(t => [t.name, t.reason, t.unrestricted])).toEqual([
      ["Read-only", "Muse Code can't use a read-only mode: its guide lists read-only mode as missing.", false],
      ["Unrestricted", "Muse Code can't use an unrestricted mode: TeamRun doesn't support this for it yet.", true]
    ]);
  });

  it("leaves out a mode the provider offers, a row that doesn't refuse, a kind without a table, and no kind", () => {
    expect(RefusedMode.of(refusing, [new ProviderMode("plan", "Plan", null, false, true), new ProviderMode("yolo", "Yolo", null, true)])).toEqual([]);
    expect(RefusedMode.of(new ProviderKind("codex", "Codex", true, false, null, null, false, null, false, null, false, null, SampleData.abilities()), [ask])).toEqual([]);
    expect(RefusedMode.of(new ProviderKind("old", "Old", true), [ask])).toEqual([]);
    expect(RefusedMode.of(undefined, [ask])).toEqual([]);
  });

  it("reads a provider without a catalog as offering no mode", () => {
    expect(RefusedMode.of(refusing, undefined).map(t => t.name)).toEqual(["Read-only", "Unrestricted"]);
  });
});
