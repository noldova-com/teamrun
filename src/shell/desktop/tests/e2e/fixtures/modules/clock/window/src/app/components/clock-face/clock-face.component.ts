/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, inject, signal, type WritableSignal } from "@angular/core";

import { JsonReader } from "@noldova/teamrun-foundation-json";
import { WindowPartTokens } from "@noldova/teamrun-shell-window";

@Component({
  selector: "tr-clock-face",
  templateUrl: "./clock-face.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClockFaceComponent {
  protected readonly answer: WritableSignal<string> = signal("");

  public constructor() {
    inject(WindowPartTokens.context).requestAsync("clock.time", null).then(
      t => this.answer.set(`The runtime's time is ${JsonReader.fromValue(t).readString("time")}`),
      (error: unknown) => this.answer.set(`The runtime did not answer: ${String(error)}`));
  }
}
