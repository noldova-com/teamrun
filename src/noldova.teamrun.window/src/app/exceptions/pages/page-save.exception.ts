/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChatPagesResources } from "../../services/pages/chat-pages-resources";
import { PagesException } from "./pages.exception";

export class PageSaveException extends PagesException {
  public override readonly name: string = "PageSaveException";
  public readonly path: string;

  public constructor(path: string) {
    super(ChatPagesResources.saveFailed);
    this.path = path;
  }
}
