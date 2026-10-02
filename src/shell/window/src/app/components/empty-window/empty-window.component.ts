/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component } from "@angular/core";

import { Resources } from "../../../resources";

@Component({
  selector: "tr-empty-window",
  templateUrl: "./empty-window.component.html",
  styleUrl: "./empty-window.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyWindowComponent {
  protected readonly resources: typeof Resources = Resources;
}
