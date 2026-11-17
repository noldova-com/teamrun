/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ModelCatalogUnavailableException } from "../../../src/app/exceptions/model-catalog-unavailable.exception";
import { Resources } from "../../../src/resources";

describe("ModelCatalogUnavailableException", () => {
  it("carries its name, the provider kind and id it asked for, and a message keeping the loaded choices", () => {
    const exception = new ModelCatalogUnavailableException("codex", "p1");
    const kindOnly = new ModelCatalogUnavailableException("claude", null);

    expect(exception.name).toBe("ModelCatalogUnavailableException");
    expect([exception.kind, exception.providerId, kindOnly.kind, kindOnly.providerId]).toEqual(["codex", "p1", "claude", null]);
    expect(exception.message).toBe(Resources.modelCatalogUnavailable);
  });
});
