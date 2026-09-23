/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProviderModel } from "@noldova/teamrun-protocol";
import { ModelCatalog } from "../../../src/app/models/model-catalog";

describe("ModelCatalog", () => {
  it("retains its choices independently of the caller's array", () => {
    const models = [new ProviderModel("a", "A", "", null, false, null, null)];
    const catalog = new ModelCatalog(models, 123, true);
    models.length = 0;
    expect(catalog.models.map(t => t.id)).toEqual(["a"]);
    expect(catalog.fetchedAt).toBe(123);
    expect(catalog.failed).toBe(true);
  });
  it("resolves aliases and clears only unsupported model and effort choices", () => {
    const catalog = new ModelCatalog([
      new ProviderModel("small", "Small", "", ["low"], true, "resolved-small", true),
      new ProviderModel("plain", "Plain", "", [], false, null, true),
      new ProviderModel("unknown", "Unknown", "", null, false, null, null)
    ], 0, false);
    expect(catalog.resolveModel("resolved-small")).toBe("resolved-small");
    expect(catalog.resolveModel("missing")).toBeNull();
    expect(catalog.resolveModel(null)).toBeNull();
    expect(catalog.resolveEffort(null, "high")).toBeNull();
    expect(catalog.resolveEffort("small", "low")).toBe("low");
    expect(catalog.resolveEffort("plain", "low")).toBeNull();
    expect(catalog.resolveEffort("unknown", "high")).toBe("high");
  });
});
