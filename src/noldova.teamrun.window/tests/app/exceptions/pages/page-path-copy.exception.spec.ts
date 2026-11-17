/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PagePathCopyException } from "../../../../src/app/exceptions/pages/page-path-copy.exception";
import { ChatPagesResources } from "../../../../src/app/services/pages/chat-pages-resources";

describe("PagePathCopyException", () => {
  it("carries its name, the page's path and a message saying the path wasn't copied", () => {
    const exception = new PagePathCopyException("pages/a.html");

    expect(exception.name).toBe("PagePathCopyException");
    expect(exception.path).toBe("pages/a.html");
    expect(exception.message).toBe(ChatPagesResources.copyFailed);
  });
});
