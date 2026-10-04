/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { Resources } from "../../../resources";

@Component({
  selector: "button[tr-toolbar-button]",
  templateUrl: "./toolbar-button.component.html",
  styleUrl: "./toolbar-button.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-toolbar-button",
    "[class.tr-toolbar-button-icon-only]": "icon() !== null && !isShowingLabel()",
    "[attr.aria-label]": "label()",
    "[attr.aria-pressed]": "pressed() ?? null",
    "[attr.aria-haspopup]": "hasMenu() ? resources.menuPopup : null",
    "[attr.aria-disabled]": "isUnavailable() ? resources.trueValue : null"
  }
})
export class ToolbarButtonComponent {
  protected readonly resources: typeof Resources = Resources;

  public readonly label = input.required<string>();
  public readonly icon = input<string | null>(null);
  public readonly isShowingLabel = input<boolean>(false);
  public readonly pressed = input<boolean>();
  public readonly hasMenu = input<boolean>(false);
  public readonly isUnavailable = input<boolean>(false);
}
