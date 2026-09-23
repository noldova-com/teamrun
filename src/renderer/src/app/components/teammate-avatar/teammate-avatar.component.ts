/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { MatTooltipModule } from "@angular/material/tooltip";
import { AvatarColor } from "../../enums/avatar-color";
import { Resources } from "../../resources";

@Component({
  selector: "tr-teammate-avatar",
  imports: [MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "inline-flex shrink-0" },
  templateUrl: "./teammate-avatar.component.html"
})
export class TeammateAvatarComponent {
  public readonly teammateId = input<string | null>(null);
  public readonly name = input(Resources.defaultTeammateLabel);
  public readonly description = input("");
  public readonly unavailable = input(false);
  protected readonly initial = computed(() => Array.from(this.name())[0]?.toLocaleUpperCase() ?? Resources.mentionPrefix);
  protected readonly color = computed(() => this.selectColor(this.teammateId()));

  private selectColor(id: string | null): AvatarColor {
    if (id === null)
      return AvatarColor.Default;
    let hash = Resources.avatarHashOffset;
    for (let index = 0; index < id.length; index++)
      hash = Math.imul(hash ^ id.charCodeAt(index), Resources.avatarHashPrime) >>> 0;
    return Resources.avatarColors[hash % Resources.avatarColors.length] ?? AvatarColor.Default;
  }
}
