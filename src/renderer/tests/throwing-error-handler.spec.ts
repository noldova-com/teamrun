/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterNextRender } from "@angular/core";
import { TestBed } from "@angular/core/testing";

describe("ThrowingErrorHandler", () => {
  it("propagates after-render errors through the configured test environment", () => {
    const failure = new Error("Fixture after-render failure");
    TestBed.runInInjectionContext(() => afterNextRender(() => { throw failure; }));

    expect(() => TestBed.tick()).toThrow(failure);
  });
});
