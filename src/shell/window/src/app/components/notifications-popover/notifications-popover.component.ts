/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ChangeDetectionStrategy, Component, ElementRef, ErrorHandler, type OutputEmitterRef, type Signal, afterNextRender, computed, inject, output
} from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { type CommandRun, type Notification, NotificationPost, NotificationSeverity } from "@noldova/teamrun-shell-protocol";
import { ButtonComponent, ButtonVariant, CheckboxComponent, IconButtonComponent, ProgressComponent, TooltipDirective } from "@noldova/teamrun-shell-ui";

import { WindowPartTokens } from "../../models/window-part-tokens";
import type { WindowPartSource } from "../../models/window-part-source";
import { NotificationService } from "../../services/notification.service";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-notifications-popover",
  imports: [ButtonComponent, CheckboxComponent, IconButtonComponent, ProgressComponent, TooltipDirective],
  templateUrl: "./notifications-popover.component.html",
  styleUrl: "./notifications-popover.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-notifications-popover",
    "role": "dialog",
    "tabindex": "-1",
    "[attr.aria-label]": "resources.notificationsTitle"
  }
})
export class NotificationsPopoverComponent {
  private readonly service: NotificationService = inject(NotificationService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly sources: readonly WindowPartSource[] = inject(WindowPartTokens.sources);
  private readonly time: Intl.DateTimeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly notifications: Signal<readonly Notification[]> = computed(() => this.service.state().notifications);
  protected readonly isQuiet: Signal<boolean> = computed(() => this.service.state().isDoNotDisturb);
  protected readonly hasFinished: Signal<boolean> = computed(() => this.notifications().some(t => !NotificationsPopoverComponent.isInProgress(t)));

  public readonly closed: OutputEmitterRef<void> = output<void>();

  public constructor() {
    const host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => host.focus());
  }

  protected glyph(severity: NotificationSeverity): string {
    return Resources.severityGlyphs[severity];
  }

  protected severityName(severity: NotificationSeverity): string {
    return Resources.severityNames[severity];
  }

  protected moduleName(notification: Notification): string {
    const owner = notification.post.kind.owner;
    return this.sources.find(t => t.moduleId === owner)?.displayName ?? owner;
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
    return this.service.isAvailable(command);
  }

  protected run(command: CommandRun): void {
    this.service.runAsync(command).catch((error: unknown) => this.errors.handleError(error));
    this.closed.emit();
  }

  protected dismiss(notification: Notification): void {
    this.service.dismiss(notification.id);
  }

  protected clear(): void {
    this.service.clear();
  }

  protected setQuiet(isOn: boolean): void {
    this.service.setDoNotDisturb(isOn);
  }

  private static isInProgress(notification: Notification): boolean {
    const progress = notification.post.progress;
    return progress === NotificationPost.indeterminate || (Object.isNumber(progress) && progress < 1);
  }
}
