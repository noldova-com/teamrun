/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "code[tr-inline-code]",
  templateUrl: "./inline-code.component.html",
  styleUrl: "./inline-code.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InlineCodeComponent {
}
