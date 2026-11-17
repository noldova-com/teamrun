/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChatPagesResources } from "../../services/pages/chat-pages-resources";
import { PagesException } from "./pages.exception";

export class PagePathCopyException extends PagesException {
  public override readonly name: string = "PagePathCopyException";
  public readonly path: string;

  public constructor(path: string) {
    super(ChatPagesResources.copyFailed);
    this.path = path;
  }
}
