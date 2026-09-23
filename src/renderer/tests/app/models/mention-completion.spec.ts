/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TeammateFixture } from "../../fixtures/teammate-fixture";
import { MentionCompletion } from "../../../src/app/models/mention-completion";

describe("MentionCompletion", () => {
  it("matches at the caret with code and escape rules, retaining supplied member-first order", () => {
    const data = new TeammateFixture();
    const list = [data.alice, data.bob];
    expect(MentionCompletion.at("Ask @a please", 6, list)?.choices.map(t => t.id)).toEqual(["alice"]);
    expect(MentionCompletion.at("@", 1, list)?.choices.map(t => t.id)).toEqual(["alice", "bob"]);
    for (const text of ["`@a", "~~~\n@a", "x@a", "\\@a", "@Alice then `@a", "@unknown", "hello"])
      expect(MentionCompletion.at(text, text.length, list)).toBeNull();
    const result = MentionCompletion.at("🙂 (@b", 6, list);
    expect(result?.start).toBe(4);
    expect(result?.end).toBe(6);
  });
});
