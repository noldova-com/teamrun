/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TemplatePortal } from "@angular/cdk/portal";
import {
  ChangeDetectionStrategy, Component, DestroyRef, Injector, type Signal, type TemplateRef, ViewContainerRef, type WritableSignal, computed, inject, signal
} from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { AnchoredOverlay, OverlayAlignment, OverlayAnchoring, OverlayBoundsService, OverlaySide, TooltipDirective } from "@noldova/teamrun-shell-ui";

import { NotificationService } from "../../services/notification.service";
import { Resources } from "../../../resources";
import { NotificationsPopoverComponent } from "../notifications-popover/notifications-popover.component";

@Component({
  selector: "tr-notifications",
  imports: [NotificationsPopoverComponent, TooltipDirective],
  templateUrl: "./notifications.component.html",
  styleUrl: "./notifications.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationsComponent {
  private readonly injector: Injector = inject(Injector);
  private readonly viewContainer: ViewContainerRef = inject(ViewContainerRef);
  private readonly bounds: OverlayBoundsService = inject(OverlayBoundsService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private overlay: AnchoredOverlay | null = null;

  protected readonly resources: typeof Resources = Resources;
  protected readonly above: OverlaySide = OverlaySide.above;
  protected readonly isOpen: WritableSignal<boolean> = signal(false);
  protected readonly unread: Signal<number> = this.notifications.unreadCount;
  protected readonly isQuiet: Signal<boolean> = computed(() => this.notifications.state().isDoNotDisturb);
  protected readonly label: Signal<string> = computed(() => Resources.formatNotificationsLabel(this.unread(), this.isQuiet()));

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.close());
  }

  protected toggle(item: HTMLButtonElement, popover: TemplateRef<unknown>): void {
    if (this.isOpen()) {
      this.close();
      return;
    }
    const overlay = new AnchoredOverlay(this.injector, Resources.popoverPaneClass);
    overlay.outsidePointerEvents.subscribe(event => {
      if (!(event.target instanceof Node && item.contains(event.target)))
        this.close();
    });
    overlay.keydownEvents.subscribe(event => this.closeFromKeyboard(event, item));
    overlay.originScrolls.subscribe(() => this.close());
    this.overlay = overlay;
    this.isOpen.set(true);
    overlay.openTemplate(new TemplatePortal(popover, this.viewContainer), item, new OverlayAnchoring(OverlaySide.above, OverlayAlignment.End, this.bounds.gap));
    if (this.unread() > 0)
      this.notifications.markAllRead();
  }

  protected close(): void {
    this.isOpen.set(false);
    this.overlay?.dispose();
    this.overlay = null;
  }

  private closeFromKeyboard(event: KeyboardEvent, item: HTMLButtonElement): void {
    if (event.key !== Resources.escapeKey)
      return;
    event.preventDefault();
    this.close();
    item.focus();
  }
}
