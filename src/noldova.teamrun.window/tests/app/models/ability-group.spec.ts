/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ProviderAbility } from "@noldova/teamrun.protocol";

import { AbilityGroup } from "../../../src/app/models/ability-group";

describe("AbilityGroup", () => {
  it("puts every ability in exactly one group, so the Settings page shows each once", () => {
    const listed = AbilityGroup.all.flatMap(t => t.abilities);

    expect(listed.toSorted()).toEqual(Object.values(ProviderAbility).toSorted());
    expect(new Set(listed).size).toBe(listed.length);
  });
});
