/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SampleData } from "../../fixtures/sample-data";
import { AccountChoice } from "../../../src/app/models/account-choice";

describe("AccountChoice", () => {
  it("keeps registered and native choices distinct and binds each to its provider", () => {
    const providers = [SampleData.codex, SampleData.claude];
    const saved = AccountChoice.saved([SampleData.account], providers)[0]!;
    const native = AccountChoice.native(providers);
    expect(saved.provider).toBe("codex");
    expect(saved.accountId).toBe("a1");
    expect(saved.label).toBe("Work · This computer");
    expect(saved.fullLabel).toBe("Codex · Work · This computer");
    expect(native[0]?.accountId).toBeNull();
    expect(native[0]?.label).toBe("Default sign-in · This computer");
    expect(native[0]?.fullLabel).toBe("Codex · Default sign-in · This computer");
    expect(native[1]?.provider).toBe("claude");
    expect(new Set([saved.key, ...native.map(t => t.key)]).size).toBe(3);
  });
});
