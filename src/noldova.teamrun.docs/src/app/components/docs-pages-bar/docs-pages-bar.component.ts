/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ElementRef, type Signal, input, model, viewChild } from "@angular/core";
import { ButtonComponent, ButtonVariant } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";

@Component({
  selector: "nol-docs-pages-bar",
  host: {
    class: "nol-docs-pages-bar"
  },
  imports: [ButtonComponent],
  templateUrl: "./docs-pages-bar.component.html",
  styleUrl: "./docs-pages-bar.component.css"
})
export class DocsPagesBarComponent {
  private readonly button: Signal<ElementRef<HTMLButtonElement>> = viewChild.required("button", { read: ElementRef });

  protected readonly resources: typeof Resources = Resources;
  protected readonly variants: typeof ButtonVariant = ButtonVariant;

  public readonly controls = input.required<string>();
  public readonly label = input<string>(Resources.menuLabel);
  public readonly open = model<boolean>(false);

  public focus(): void {
    this.button().nativeElement.focus();
  }

  protected toggle(): void {
    this.open.update(t => !t);
  }
}
