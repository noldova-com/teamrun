/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MessageControlState } from "../../../src/app/models/message-control-state";

describe("MessageControlState", () => {
  it("has changes once an activity choice, an expansion or a wrapped line is set", () => {
    expect(new MessageControlState().hasChanges).toBe(false);
    const chosen = new MessageControlState();
    chosen.activityChoice.set(false);
    expect(chosen.hasChanges).toBe(true);
    const expanded = new MessageControlState();
    expanded.expansion.allFiles.set(true);
    expect(expanded.hasChanges).toBe(true);
    const wrapped = new MessageControlState();
    expect(wrapped.wrappingFor(2)).toBe(wrapped.wrappingFor(2));
    expect(wrapped.hasChanges).toBe(false);
    wrapped.wrappingFor(2).add(7);
    expect(wrapped.hasChanges).toBe(true);
  });

  it("keeps one question draft for each approval, which has changes once a question has a pick or typed text", () => {
    const picked = new MessageControlState();
    expect(picked.draftOf("q1")).toBeNull();
    const draft = picked.draftFor("q1");
    expect(picked.draftFor("q1")).toBe(draft);
    expect(picked.draftOf("q1")).toBe(draft);
    expect(picked.draftOf("q2")).toBeNull();
    draft.picks.set(new Map([["platform", []]]));
    draft.texts.set(new Map([["name", ""]]));
    expect(picked.hasChanges).toBe(false);
    draft.picks.set(new Map([["platform", ["Web"]]]));
    expect(picked.hasChanges).toBe(true);
    const typed = new MessageControlState();
    typed.draftFor("q1").texts.set(new Map([["name", "Atlas"]]));
    expect(typed.hasChanges).toBe(true);
  });

  it("drops one approval's draft and keeps the others, and drops nothing for an approval without one", () => {
    const state = new MessageControlState();
    state.draftFor("q1").picks.set(new Map([["platform", ["Web"]]]));
    const other = state.draftFor("q2");
    state.dropDraft("q3");
    expect([state.draftOf("q1")?.picks().get("platform"), state.draftOf("q2")]).toEqual([["Web"], other]);

    state.dropDraft("q1");
    expect([state.draftOf("q1"), state.draftOf("q2")]).toEqual([null, other]);
    expect(state.hasChanges).toBe(false);
  });
});
