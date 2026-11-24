/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT, Injectable, inject } from "@angular/core";
import { ClipboardWriter } from "@noldova/ui.components.angular";

import "@noldova/context.core";

@Injectable()
export class BrowserClipboardWriter extends ClipboardWriter {
  private readonly document: Document = inject(DOCUMENT);

  public override async writeTextAsync(text: string): Promise<boolean> {
    const clipboard = this.document.defaultView?.navigator.clipboard;
    if (Object.isNullOrUndefined(clipboard))
      return false;
    try {
      await clipboard.writeText(text);
      return true;
    }
    catch (error) {
      if (!(error instanceof DOMException))
        throw error;
      return false;
    }
  }
}
