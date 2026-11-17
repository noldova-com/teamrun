/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AuthStatus, Provider } from "@noldova/teamrun.protocol";

import { ProviderChoice } from "../../../src/app/models/provider-choice";
import { SampleData } from "../../fixtures/sample-data.fixture";

describe("ProviderChoice", () => {
  it("offers one choice for each added provider, bound to it, and nothing else", () => {
    const kinds = [SampleData.codex, SampleData.claude];
    const home = new Provider("a2", "claude", "Home", "D:\\profiles\\claude", AuthStatus.LoggedIn, null, "1.0", SampleData.timestamp, null, SampleData.timestamp);
    const saved = ProviderChoice.saved([SampleData.provider, home], kinds);

    expect(saved.map(t => [t.kind, t.providerId, t.label, t.fullLabel])).toEqual([
      ["codex", "a1", "Work · This computer", "Codex · Work · This computer"],
      ["claude", "a2", "Home · This computer", "Claude Code · Home · This computer"]
    ]);
    expect(new Set(saved.map(t => t.key)).size).toBe(2);
    expect(ProviderChoice.saved([], kinds)).toEqual([]);
  });

  it("names a saved provider by its provider's id when the provider is not offered", () => {
    expect(ProviderChoice.saved([SampleData.provider], [])[0]?.fullLabel).toBe("codex · Work · This computer");
  });
});
