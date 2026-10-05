/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, ErrorHandler, type Signal, inject } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { type CommandRun, type Notification, NotificationPost, type NotificationSeverity } from "@noldova/teamrun-shell-protocol";
import { ButtonComponent, ButtonVariant, IconButtonComponent, ProgressComponent, TooltipDirective } from "@noldova/teamrun-shell-ui";

import { ModuleStatusService } from "../../services/module-status.service";
import { NotificationService } from "../../services/notification.service";
import { ToastService } from "../../services/toast.service";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-toasts",
  imports: [ButtonComponent, IconButtonComponent, ProgressComponent, TooltipDirective],
  templateUrl: "./toasts.component.html",
  styleUrl: "./toasts.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToastsComponent {
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly service: ToastService = inject(ToastService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly statuses: ModuleStatusService = inject(ModuleStatusService);
  private readonly time: Intl.DateTimeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly toasts: Signal<readonly Notification[]> = this.service.toasts;

  protected glyph(severity: NotificationSeverity): string {
    return Resources.severityGlyphs[severity];
  }

  protected severityName(severity: NotificationSeverity): string {
    return Resources.severityNames[severity];
  }

  protected moduleName(notification: Notification): string {
    return this.statuses.nameOf(notification.post.kind.owner);
  }

  protected timeOf(notification: Notification): string {
    return this.time.format(new Date(notification.postedAt));
  }

  protected progressOf(notification: Notification): number | null {
    return Object.isNumber(notification.post.progress) ? notification.post.progress : null;
  }

  protected isIndeterminate(notification: Notification): boolean {
    return notification.post.progress === NotificationPost.indeterminate;
  }

  protected isAvailable(command: CommandRun): boolean {
    return this.notifications.isAvailable(command);
  }

  protected run(notification: Notification, command: CommandRun): void {
    this.notifications.runAsync(command).catch((error: unknown) => this.errors.handleError(error));
    this.service.close(notification.id);
  }

  protected close(notification: Notification): void {
    this.service.close(notification.id);
  }

  protected pause(notification: Notification): void {
    this.service.pause(notification.id);
  }

  protected resume(notification: Notification, event: Event): void {
    const toast = event.currentTarget as HTMLElement;
    if (!toast.matches(Resources.hoverSelector) && !toast.contains(toast.ownerDocument.activeElement))
      this.service.resume(notification.id);
  }
}
