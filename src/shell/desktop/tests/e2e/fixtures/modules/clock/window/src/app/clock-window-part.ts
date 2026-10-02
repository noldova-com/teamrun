/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide, type IWindowPart, type IWindowPartContext, ViewContribution } from "@noldova/teamrun-shell-window";

export class ClockWindowPart implements IWindowPart {
  public readonly moduleId: string = "clock";

  public async activateAsync(context: IWindowPartContext): Promise<void> {
    context.registerView(new ViewContribution("clock.face", "Clock", "schedule", DockSide.Right, true,
      () => import("./components/clock-face/clock-face.component").then(t => t.ClockFaceComponent)));
  }

  public async deactivateAsync(): Promise<void> {
  }
}
