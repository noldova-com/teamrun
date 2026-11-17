/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Directive, inject, type OutputRef } from "@angular/core";
import { outputFromObservable } from "@angular/core/rxjs-interop";

import { ContextMenuTriggerDirective } from "@noldova/ui.components.angular";

@Directive({ selector: "[nolTeamrunContextMenuState]" })
export class ContextMenuStateDirective {
  private readonly trigger: ContextMenuTriggerDirective = inject(ContextMenuTriggerDirective);

  public readonly menuOpened: OutputRef<void> = outputFromObservable(this.trigger.opened);
  public readonly menuClosed: OutputRef<void> = outputFromObservable(this.trigger.closed);
}
