/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, computed, inject } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { OverlaySide, PopoverTriggerDirective, TooltipDirective } from "@noldova/teamrun-shell-ui";

import { NotificationService } from "../../services/notification.service";
import { Resources } from "../../../resources";
import { NotificationsPopoverComponent } from "../notifications-popover/notifications-popover.component";

@Component({
  selector: "tr-notifications",
  imports: [NotificationsPopoverComponent, PopoverTriggerDirective, TooltipDirective],
  templateUrl: "./notifications.component.html",
  styleUrl: "./notifications.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationsComponent {
  private readonly notifications: NotificationService = inject(NotificationService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly above: OverlaySide = OverlaySide.above;
  protected readonly unread: Signal<number> = this.notifications.unreadCount;
  protected readonly isQuiet: Signal<boolean> = computed(() => this.notifications.state().isDoNotDisturb);
  protected readonly label: Signal<string> = computed(() => Resources.formatNotificationsLabel(this.unread(), this.isQuiet()));

  protected markRead(): void {
    if (this.unread() > 0)
      this.notifications.markAllRead();
  }
}
