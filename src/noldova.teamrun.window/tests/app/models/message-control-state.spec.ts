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
});
