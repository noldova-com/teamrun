/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";

import { DraftNotSavedException } from "../../../src/app/exceptions/draft-not-saved.exception";
import { FileGrantException } from "../../../src/app/exceptions/file-grant.exception";
import { HistoryReadException } from "../../../src/app/exceptions/history-read.exception";
import { ImageCopyException } from "../../../src/app/exceptions/image-copy.exception";
import { ListNotArrayException } from "../../../src/app/exceptions/list-not-array.exception";
import { ModelCatalogUnavailableException } from "../../../src/app/exceptions/model-catalog-unavailable.exception";
import { PagePathCopyException } from "../../../src/app/exceptions/pages/page-path-copy.exception";
import { PageSaveException } from "../../../src/app/exceptions/pages/page-save.exception";
import { WindowException } from "../../../src/app/exceptions/window.exception";

describe("WindowException", () => {
  it("is the base of every window exception, Pages' among them, with no cause", () => {
    const exceptions = [
      new DraftNotSavedException(),
      new FileGrantException("notes.txt"),
      new HistoryReadException(0, 2),
      new ImageCopyException(),
      new ListNotArrayException("string"),
      new ModelCatalogUnavailableException("codex", null),
      new PagePathCopyException("pages/a.html"),
      new PageSaveException("pages/a.html")
    ];

    for (const exception of exceptions) {
      expect(exception).toBeInstanceOf(WindowException);
      expect(exception).toBeInstanceOf(Exception);
      expect(Object.hasOwn(exception, "cause")).toBe(false);
    }
  });
});
