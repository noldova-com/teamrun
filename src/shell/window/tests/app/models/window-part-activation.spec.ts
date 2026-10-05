/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WindowPartActivation } from "../../../src/app/models/window-part-activation";
import { WindowPartContext } from "../../../src/app/models/window-part-context";
import { WindowPartSource } from "../../../src/app/models/window-part-source";
import { WindowPartContextHostFixture } from "../../fixtures/window-part-context-host.fixture";
import { WindowPartFixture } from "../../fixtures/window-part.fixture";

describe("WindowPartActivation", () => {
  it("holds an active window part with its source and context", () => {
    const part = new WindowPartFixture("notes", []);
    const source = new WindowPartSource("notes", [], [], [], [], [], [], [], () => Promise.resolve(part));
    const context = new WindowPartContext(source, new WindowPartContextHostFixture());

    const activation = new WindowPartActivation(source, context, part);

    expect(activation.source).toBe(source);
    expect(activation.context).toBe(context);
    expect(activation.part).toBe(part);
  });
});
