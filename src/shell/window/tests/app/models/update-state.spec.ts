/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";

import { UpdateStateKind } from "../../../src/app/enums/update-state-kind";
import { UpdateState } from "../../../src/app/models/update-state";

describe("UpdateState", () => {
  const json = (kind: string, fields: object = {}): object => ({ kind, version: null, progress: null, checkedAt: null, reason: null, mustMove: false, ...fields });

  it("reads the desktop's state with its version, progress, last check, reason and whether TeamRun must move", () => {
    const state = UpdateState.fromJson(json("Downloading", { version: "1.3.0", progress: 42, checkedAt: 1_791_000_000_000, reason: "Slow", mustMove: false }));
    const failed = UpdateState.fromJson(json("Failed", { reason: "The release's information is invalid." }));

    expect([state.kind, state.version, state.progress, state.checkedAt, state.reason, state.mustMove]).toEqual([UpdateStateKind.Downloading, "1.3.0", 42, 1_791_000_000_000, "Slow", false]);
    expect([failed.kind, failed.version, failed.reason]).toEqual([UpdateStateKind.Failed, null, "The release's information is invalid."]);
    expect([UpdateState.off.kind, UpdateState.off.mustMove]).toEqual([UpdateStateKind.Off, false]);
  });

  it("refuses a state it does not know, a progress outside 0 to 100 and a value that is not a state", () => {
    expect(() => UpdateState.fromJson(json("Sleeping"))).toThrowError(JsonException);
    expect(() => UpdateState.fromJson(json("Downloading", { progress: 101 }))).toThrowError(JsonException);
    expect(() => UpdateState.fromJson(json("Downloading", { progress: -1 }))).toThrowError(JsonException);
    expect(() => UpdateState.fromJson({ kind: "Off" })).toThrowError(JsonException);
    expect(() => UpdateState.fromJson("Off")).toThrowError(JsonException);
    expect(UpdateState.fromJson(json("Downloading", { version: "1.3.0", progress: 0 })).progress).toBe(0);
    expect(UpdateState.fromJson(json("Downloading", { version: "1.3.0", progress: 100 })).progress).toBe(100);
  });

  it("needs a version for an update that is available, downloading or ready, and says TeamRun must move only for an available or failed one, always for an available one", () => {
    const reads = (kind: string, fields: object): boolean => {
      try {
        UpdateState.fromJson(json(kind, fields));
        return true;
      } catch (error) {
        if (!(error instanceof JsonException))
          throw error;
        return false;
      }
    };

    expect(["Available", "Downloading", "Ready"].map(t => reads(t, { mustMove: t === "Available" }))).toEqual([false, false, false]);
    expect(["Off", "UpToDate", "Checking", "Failed"].map(t => reads(t, {}))).toEqual([true, true, true, true]);
    expect(["Off", "UpToDate", "Checking", "Available", "Downloading", "Ready", "Failed"].map(t => reads(t, { version: "1.3.0", mustMove: true })))
      .toEqual([false, false, false, true, false, false, true]);
    expect(["Available", "Failed"].map(t => reads(t, { version: "1.3.0", mustMove: false }))).toEqual([false, true]);
  });

  it("knows which actions apply in each state", () => {
    const actions = (state: UpdateState): readonly boolean[] => [state.canCheck, state.canRestart];
    const of = (kind: UpdateStateKind, version: string | null = null, mustMove: boolean = false): UpdateState => new UpdateState(kind, version, null, null, null, mustMove);

    expect(actions(of(UpdateStateKind.Off))).toEqual([false, false]);
    expect(actions(of(UpdateStateKind.UpToDate))).toEqual([true, false]);
    expect(actions(of(UpdateStateKind.Checking))).toEqual([false, false]);
    expect(actions(of(UpdateStateKind.Available, "1.3.0", true))).toEqual([true, false]);
    expect(actions(of(UpdateStateKind.Downloading, "1.3.0"))).toEqual([false, false]);
    expect(actions(of(UpdateStateKind.Ready, "1.3.0"))).toEqual([false, true]);
    expect(actions(of(UpdateStateKind.Failed))).toEqual([true, false]);
    expect(actions(of(UpdateStateKind.Failed, "1.3.0"))).toEqual([true, false]);
  });

  it("shows the status bar's item only for an update that is ready or failed, or one TeamRun must move to Applications for", () => {
    const of = (kind: UpdateStateKind): UpdateState => new UpdateState(kind, "1.3.0", null, null, null, kind === UpdateStateKind.Available);

    expect([UpdateStateKind.Off, UpdateStateKind.UpToDate, UpdateStateKind.Checking, UpdateStateKind.Available, UpdateStateKind.Downloading, UpdateStateKind.Ready,
      UpdateStateKind.Failed].map(t => of(t).showsItem)).toEqual([false, false, false, true, false, true, true]);
  });
});
