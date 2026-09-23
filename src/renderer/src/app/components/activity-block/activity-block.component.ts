/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";

import "@noldova/teamrun-foundation-core";
import { DetailKind } from "@noldova/teamrun-protocol";

import type { ActivityEntry } from "../../models/activity-entry";
import { ReplyExpansion } from "../../models/reply-expansion";
import { Resources } from "../../resources";
import { Formatter } from "../../services/formatter.service";

@Component({
  selector: "tr-activity-block",
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "block py-2" },
  templateUrl: "./activity-block.component.html"
})
export class ActivityBlockComponent {
  public readonly entries = input.required<readonly ActivityEntry[]>();
  public readonly label = input.required<string>();
  public readonly rootPath = input<string | null>(null);
  public readonly expansion = input(new ReplyExpansion());
  public readonly beforeExpand = input<(() => Promise<boolean>) | null>(null);

  protected readonly resources: typeof Resources = Resources;
  protected readonly formatter: Formatter = inject(Formatter);
  protected readonly commandKind: DetailKind = DetailKind.Command;

  protected isOpen(entry: ActivityEntry): boolean {
    return this.expansion().activity().has(entry.detail.sequence);
  }

  protected async toggle(entry: ActivityEntry): Promise<void> {
    const load = this.beforeExpand();
    if (!this.isOpen(entry) && !Object.isNull(load) && !await load())
      return;
    this.expansion().activity.update(current => ActivityBlockComponent.toggled(current, entry.detail.sequence));
  }

  protected bodyOf(entry: ActivityEntry): string | null {
    const own = this.formatter.body(entry.detail);
    const result = Object.isNull(entry.result) ? null : entry.result.text;
    if (Object.isNull(own))
      return result;

    return Object.isNull(result) ? own : `${own}${Resources.lineSeparator}${result}`;
  }

  protected isError(entry: ActivityEntry): boolean {
    return entry.detail.kind === DetailKind.Error || (!Object.isNull(entry.result) && this.formatter.isErrorResult(entry.result));
  }

  protected preview(body: string): string {
    return body.split(Resources.lineSeparator).slice(0, Resources.previewLineCount).join(Resources.lineSeparator);
  }

  protected hasMore(body: string): boolean {
    return body.split(Resources.lineSeparator).length> Resources.previewLineCount;
  }

  protected isExpanded(entry: ActivityEntry): boolean {
    return this.expansion().activityBodies().has(entry.detail.sequence);
  }

  protected expand(entry: ActivityEntry): void {
    this.expansion().activityBodies.update(current => ActivityBlockComponent.toggled(current, entry.detail.sequence));
  }

  private static toggled(current: ReadonlySet<number>, sequence: number): ReadonlySet<number> {
    const next = new Set(current);
    if (!next.delete(sequence))
      next.add(sequence);
    return next;
  }
}
