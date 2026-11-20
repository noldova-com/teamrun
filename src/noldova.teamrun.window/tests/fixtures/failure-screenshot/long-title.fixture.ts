/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, it } from "vitest";

it(`${"fails-with-a-title-past-what-a-file-name-may-hold ".repeat(6)}and-keeps-its-screenshot`, () => {
  document.body.textContent = "The page a failure screenshot shows.";

  expect(document.body.textContent).toBe("A page the test never shows.");
});
