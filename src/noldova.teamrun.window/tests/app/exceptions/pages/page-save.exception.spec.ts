/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageSaveException } from "../../../../src/app/exceptions/pages/page-save.exception";
import { ChatPagesResources } from "../../../../src/app/services/pages/chat-pages-resources";

describe("PageSaveException", () => {
  it("carries its name, the page's path and a message saying the page wasn't saved", () => {
    const exception = new PageSaveException("pages/a.html");

    expect(exception.name).toBe("PageSaveException");
    expect(exception.path).toBe("pages/a.html");
    expect(exception.message).toBe(ChatPagesResources.saveFailed);
  });
});
