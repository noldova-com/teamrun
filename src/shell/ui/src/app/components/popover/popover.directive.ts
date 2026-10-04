/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Directive, input } from "@angular/core";

@Directive({
  selector: "[trPopover]",
  host: {
    "class": "tr-popover tr-scroll-reveal",
    "role": "dialog",
    "tabindex": "-1",
    "[attr.aria-label]": "label()"
  }
})
export class PopoverDirective {
  public readonly label = input.required<string>();
}
