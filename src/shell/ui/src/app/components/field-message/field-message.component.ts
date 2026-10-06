/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "tr-field-message",
  templateUrl: "./field-message.component.html",
  styleUrl: "./field-message.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-field-message",
    "role": "alert"
  }
})
export class FieldMessageComponent {
}
