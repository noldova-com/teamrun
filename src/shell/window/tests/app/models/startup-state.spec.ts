/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";

import { StartupStateKind } from "../../../src/app/enums/startup-state-kind";
import { StartupState } from "../../../src/app/models/startup-state";

describe("StartupState", () => {
  it("reads the desktop's state and knows when it is ready", () => {
    const failed = StartupState.fromJson({ kind: "Failed", details: ["The runtime did not start in time."] });
    const ready = StartupState.fromJson({ kind: "Ready", details: [] });

    expect([failed.kind, failed.details, failed.isReady]).toEqual([StartupStateKind.Failed, ["The runtime did not start in time."], false]);
    expect(ready.isReady).toBe(true);
  });

  it("refuses a state it does not know or that is not a state", () => {
    expect(() => StartupState.fromJson({ kind: "Sleeping", details: [] })).toThrowError(JsonException);
    expect(() => StartupState.fromJson({ kind: "Ready" })).toThrowError(JsonException);
    expect(() => StartupState.fromJson("Ready")).toThrowError(JsonException);
  });

  it("keeps its own copy of the details", () => {
    const details = ["A reply"];
    const state = new StartupState(StartupStateKind.WorkInProgress, details);
    details.push("A command");

    expect(state.details).toEqual(["A reply"]);
  });
});
