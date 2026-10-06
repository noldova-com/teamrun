/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable } from "@angular/core";

import { ClipboardWriter } from "../../services/clipboard-writer";

@Injectable()
export class GalleryRefusingClipboard extends ClipboardWriter {
  public writeTextAsync(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
