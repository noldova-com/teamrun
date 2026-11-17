/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type InputSignal, type Signal, computed, input } from "@angular/core";

import "@noldova/context.core";
import { type Teammate, TeammateName } from "@noldova/teamrun.protocol";
import { AvatarComponent, AvatarSize } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";

@Component({
  selector: "nol-teamrun-teammate-avatar",
  imports: [AvatarComponent],
  templateUrl: "./teammate-avatar.component.html",
  styleUrl: "./teammate-avatar.component.css"
})
export class TeammateAvatarComponent {
  public readonly teammate: InputSignal<Teammate | null> = input.required<Teammate | null>();
  public readonly size: InputSignal<AvatarSize> = input<AvatarSize>(AvatarSize.Small);
  public readonly unavailable: InputSignal<boolean> = input<boolean>(false);
  public readonly decorative: InputSignal<boolean> = input<boolean>(false);
  public readonly label: InputSignal<string> = input<string>(String.empty);

  protected readonly name: Signal<string> = computed(() => this.teammate()?.name ?? Resources.defaultTeammateLabel);
  protected readonly initials: Signal<string | null> = computed(() => {
    const teammate = this.teammate();
    return Object.isNull(teammate) ? null : TeammateName.initials(teammate.name);
  });
  protected readonly colorKey: Signal<string | null> = computed(() => this.teammate()?.id ?? null);
}
