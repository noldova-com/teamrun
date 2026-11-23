/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, input } from "@angular/core";

import { DocsBrand } from "../../enums/docs-brand";

@Component({
  selector: "nol-docs-brand-mark",
  templateUrl: "./docs-brand-mark.component.html",
  styleUrl: "./docs-brand-mark.component.css",
  host: { "aria-hidden": "true" }
})
export class DocsBrandMarkComponent {
  protected readonly brands: typeof DocsBrand = DocsBrand;

  public readonly brand = input.required<DocsBrand>();
}
