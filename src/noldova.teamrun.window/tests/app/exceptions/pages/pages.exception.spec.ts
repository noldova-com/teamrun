/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";

import { PagePathCopyException } from "../../../../src/app/exceptions/pages/page-path-copy.exception";
import { PageSaveException } from "../../../../src/app/exceptions/pages/page-save.exception";
import { PagesException } from "../../../../src/app/exceptions/pages/pages.exception";
import { WindowException } from "../../../../src/app/exceptions/window.exception";

describe("PagesException", () => {
  it("is the base of the window part of Pages' exceptions, under WindowException, with no cause", () => {
    const exceptions = [new PagePathCopyException("pages/a.html"), new PageSaveException("pages/a.html")];

    for (const exception of exceptions) {
      expect(exception).toBeInstanceOf(PagesException);
      expect(exception).toBeInstanceOf(WindowException);
      expect(exception).toBeInstanceOf(Exception);
      expect(Object.hasOwn(exception, "cause")).toBe(false);
    }
  });
});
