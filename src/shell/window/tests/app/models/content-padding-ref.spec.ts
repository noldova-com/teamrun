/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ContentPadding } from "../../../src/app/enums/content-padding";
import { ContentPaddingRef } from "../../../src/app/models/content-padding-ref";

describe("ContentPaddingRef", () => {
  it("holds no choice of its own until a page sets one, and drops it again on reset", () => {
    const padding = new ContentPaddingRef();
    const unset = padding.value();

    padding.set(ContentPadding.None);
    const set = padding.value();
    padding.reset();

    expect([unset, set, padding.value()]).toEqual([null, ContentPadding.None, null]);
  });
});
