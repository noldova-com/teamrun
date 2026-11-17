/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Component, computed, effect, ElementRef, inject, input, type InputSignal, output, type OutputEmitterRef, type Signal, untracked }
  from "@angular/core";
import type { ReplyPlan } from "@noldova/teamrun.protocol";
import { AvatarComponent, AvatarSize, ButtonComponent, ButtonVariant, type LinkOpenEvent, type MentionCandidate, type MessageAuthor, type Plan, PlanComponent, type ShellRun,
  ShellRunOutputDirective, type ShellRunState } from "@noldova/ui.components.angular";
import { MarkdownViewComponent } from "@noldova/ui.components.angular/markdown";

import type { IRowReveal } from "../../interfaces/i-row-reveal";
import { ScrollReveal } from "../../models/scroll-reveal";
import { FormatterService } from "../../services/formatter.service";
import { Resources } from "../../../resources";
import { InlineTerminalComponent } from "../inline-terminal/inline-terminal.component";

@Component({
  selector: "nol-teamrun-plan-card",
  imports: [AvatarComponent, ButtonComponent, InlineTerminalComponent, MarkdownViewComponent, PlanComponent, ShellRunOutputDirective],
  host: { "[class.open]": "isOpen()", "[class.selected]": "selected()", "[class.authored]": "author() !== null" },
  templateUrl: "./plan-card.component.html",
  styleUrl: "./plan-card.component.css"
})
export class PlanCardComponent {
  private readonly formatter: FormatterService = inject(FormatterService);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly rowReveal: IRowReveal | null = inject(ScrollReveal.rows, { optional: true });

  public readonly plan: InputSignal<ReplyPlan> = input.required<ReplyPlan>();
  public readonly open: InputSignal<boolean> = input<boolean>(false);
  public readonly collapsible: InputSignal<boolean> = input<boolean>(true);
  public readonly selected: InputSignal<boolean> = input<boolean>(false);
  public readonly revealStart: InputSignal<Date | null> = input<Date | null>(null);
  public readonly revealRow: InputSignal<number | null> = input<number | null>(null);
  public readonly mentions: InputSignal<readonly MentionCandidate[]> = input<readonly MentionCandidate[]>([]);
  public readonly fileLinks: InputSignal<boolean> = input<boolean>(false);
  public readonly shellRuns: InputSignal<boolean> = input<boolean>(false);
  public readonly shellRunOutputs: InputSignal<ReadonlySet<number>> = input<ReadonlySet<number>>(new Set());
  public readonly shellRunStates: InputSignal<ReadonlyMap<number, ShellRunState>> = input<ReadonlyMap<number, ShellRunState>>(new Map());
  public readonly terminalOwner: InputSignal<string | null> = input<string | null>(null);
  public readonly messageId: InputSignal<string> = input<string>("");
  public readonly approvable: InputSignal<boolean> = input<boolean>(false);
  public readonly approving: InputSignal<boolean> = input<boolean>(false);
  public readonly author: InputSignal<MessageAuthor | null> = input<MessageAuthor | null>(null);
  public readonly time: InputSignal<string | null> = input<string | null>(null);
  public readonly toggled: OutputEmitterRef<void> = output<void>();
  public readonly linkOpen: OutputEmitterRef<LinkOpenEvent> = output<LinkOpenEvent>();
  public readonly fileActivate: OutputEmitterRef<string> = output<string>();
  public readonly shellRun: OutputEmitterRef<ShellRun> = output<ShellRun>();
  public readonly approve: OutputEmitterRef<void> = output<void>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly primary: ButtonVariant = ButtonVariant.Primary;
  protected readonly small: AvatarSize = AvatarSize.Small;
  protected readonly title: Signal<string> = computed(() => this.formatter.planTitle(this.plan()));
  protected readonly progress: Signal<string | null> = computed(() => this.formatter.planProgress(this.plan()));
  protected readonly checklist: Signal<Plan | null> = computed(() => this.formatter.checklistOf(this.plan()));
  protected readonly isOpen: Signal<boolean> = computed(() => !this.collapsible() || this.open());

  public constructor() {
    effect(onCleanup => {
      const row = this.revealRow();
      if (Object.isNull(this.revealStart()) || Object.isNull(row))
        return;
      const sizing = untracked(() => ScrollReveal.whenSized(this.host, () => this.rowReveal?.revealPart(row, this.host)));
      onCleanup(() => sizing.disconnect());
    });
  }

  protected approveClicked(): void {
    if (!this.approving())
      this.approve.emit();
  }
}
