/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Directive } from "@angular/core";

import { ClipboardWriter } from "../../services/clipboard-writer";
import { GalleryRefusingClipboard } from "./gallery-refusing-clipboard";

@Directive({
  selector: "[trGalleryRefusingClipboard]",
  providers: [{ provide: ClipboardWriter, useClass: GalleryRefusingClipboard }]
})
export class GalleryRefusingClipboardDirective {
}
