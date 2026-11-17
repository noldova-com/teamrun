/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DraftNotSavedException } from "../../../src/app/exceptions/draft-not-saved.exception";
import { Resources } from "../../../src/resources";

describe("DraftNotSavedException", () => {
  it("carries its name and says the draft wasn't saved", () => {
    const exception = new DraftNotSavedException();

    expect(exception.name).toBe("DraftNotSavedException");
    expect(exception.message).toBe(Resources.draftNotSaved);
  });
});
