/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Harness, Teammate } from "@noldova/teamrun.protocol";
import { MentionCandidate } from "@noldova/ui.components.angular";

import { TeammateCandidates } from "../../../src/app/services/teammate-candidates";

describe("TeammateCandidates", () => {
  const teammate = (id: string, name: string): Teammate => new Teammate(id, name, null, "a1", Harness.Provider, null, null, "t", "t");

  it("leaves out a teammate whose candidate is refused, and keeps the others in order with their options", () => {
    const teammates = [teammate("alice", "Alice"), teammate("chat", "Chat GPT"), teammate("zoe", "Zoë"), teammate("bob", "Bob")];
    const refused = new TeammateCandidates((t, u) => {
      if (t.id === "chat")
        throw new ArgumentException("Refused.", "name");
      return new MentionCandidate(t.id, t.name, u);
    });

    const candidates = refused.of(teammates, t => ({ section: "Members", unavailable: t.id === "bob" }));

    expect(candidates.map(t => [t.id, t.name, t.section, t.unavailable])).toEqual([
      ["alice", "Alice", "Members", false],
      ["zoe", "Zoë", "Members", false],
      ["bob", "Bob", "Members", true]
    ]);
  });

  it("passes on any failure other than a refused argument", () => {
    const failure = new TypeError("broken");
    const candidates = new TeammateCandidates(() => {
      throw failure;
    });

    expect(() => candidates.of([teammate("alice", "Alice")], () => ({}))).toThrow(failure);
  });
});
