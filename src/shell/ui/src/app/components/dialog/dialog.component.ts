/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, computed, inject, input, output, type Signal, signal, type WritableSignal } from "@angular/core";

import { Resources } from "../../../resources";
import { DialogSize } from "../../enums/dialog-size";
import { DialogTokens } from "../../models/dialog-tokens";
import { IconButtonComponent } from "../icon-button/icon-button.component";
import { TooltipDirective } from "../tooltip/tooltip.directive";

@Component({
  selector: "tr-dialog",
  templateUrl: "./dialog.component.html",
  styleUrl: "./dialog.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, TooltipDirective],
  host: {
    "[class.tr-dialog-large]": "isLarge()",
    "[class.tr-dialog-maximized]": "isLarge() && isMaximized()",
    "(keydown.escape)": "dismiss($event)"
  }
})
export class DialogComponent {
  protected readonly titleId: string = inject(DialogTokens.titleId);
  protected readonly resources: typeof Resources = Resources;

  public readonly title = input.required<string>();
  public readonly size = input<DialogSize>(DialogSize.Normal);
  public readonly dismissed = output<void>();

  protected readonly isLarge: Signal<boolean> = computed(() => this.size() === DialogSize.Large);
  protected readonly isMaximized: WritableSignal<boolean> = signal(false);
  protected readonly maximizeLabel: Signal<string> = computed(() => this.isMaximized() ? Resources.dialogRestoreLabel : Resources.dialogMaximizeLabel);

  protected toggleMaximized(): void {
    this.isMaximized.update(t => !t);
  }

  protected dismiss(event: Event): void {
    if (event.defaultPrevented)
      return;
    event.preventDefault();
    this.dismissed.emit();
  }
}
