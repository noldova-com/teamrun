/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TeammateProviderMissingException } from "../../../src/app/exceptions/teammate-provider-missing.exception";

describe("TeammateProviderMissingException", () => {
  it("carries its name, the teammate and its provider, and says the provider isn't listed", () => {
    const exception = new TeammateProviderMissingException("offline", "missing");

    expect([exception.name, exception.teammateId, exception.providerId, exception.message]).toEqual(["TeammateProviderMissingException", "offline", "missing",
      "Teammate offline answers through provider missing, which isn't listed."]);
  });
});
