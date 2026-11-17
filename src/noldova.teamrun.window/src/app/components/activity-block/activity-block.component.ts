/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  afterNextRender, Component, computed, DestroyRef, effect, ElementRef, inject, Injector, input, type InputSignal, type OnInit, output,
  type OutputEmitterRef, type Signal, signal, untracked, type WritableSignal
} from "@angular/core";
import "@noldova/context.core";
import { DetailKind, type FileChangeSummary, type Message, MessageDetail, type PermissionPayload } from "@noldova/teamrun.protocol";
import {
  ButtonComponent, ButtonVariant, GraphemeText, type LinkOpenEvent, type MentionCandidate, type Plan, PlanComponent, ShellRunOutputDirective, type ShellRunState, TextReveal, type ToolCall, ToolCallComponent, ToolCallOutputDirective,
  ToolCallStatus, ToolCallViews
} from "@noldova/ui.components.angular";
import { MarkdownViewComponent } from "@noldova/ui.components.angular/markdown";

import type { IRowReveal } from "../../interfaces/i-row-reveal";
import type { IShellRunAt } from "../../interfaces/i-shell-run-at";
import { ActivityEntry } from "../../models/activity-entry";
import { ActivityRow } from "../../models/activity-row";
import type { ActivityStep } from "../../models/activity-step";
import type { ModelCatalog } from "../../models/model-catalog";
import { ReplyExpansion } from "../../models/reply-expansion";
import { ScrollReveal } from "../../models/scroll-reveal";
import { TitleReveal } from "../../models/title-reveal";
import type { ViewedImage } from "../../models/viewed-image";
import { FormatterService } from "../../services/formatter.service";
import { MotionPreferenceService } from "../../services/motion-preference.service";
import { Resources } from "../../../resources";
import { ImagePreviewComponent } from "../image-preview/image-preview.component";
import { InlineTerminalComponent } from "../inline-terminal/inline-terminal.component";

@Component({
  selector: "nol-teamrun-activity-block",
  imports: [ButtonComponent, ImagePreviewComponent, InlineTerminalComponent, MarkdownViewComponent, PlanComponent, ShellRunOutputDirective, ToolCallComponent,
    ToolCallOutputDirective],
  host: { "[class.compact]": "compact()" },
  templateUrl: "./activity-block.component.html",
  styleUrl: "./activity-block.component.css"
})
export class ActivityBlockComponent implements OnInit {
  private readonly formatter: FormatterService = inject(FormatterService);
  private readonly motion: MotionPreferenceService = inject(MotionPreferenceService);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector: Injector = inject(Injector);
  private readonly rowReveal: IRowReveal | null = inject(ScrollReveal.rows, { optional: true });
  private readonly reveals: Map<number, TextReveal> = new Map();
  private readonly texts: Map<number, GraphemeText> = new Map();
  private readonly frame: WritableSignal<number> = signal(0);
  private readonly titleReveal: TitleReveal = new TitleReveal(() => this.frame.update(t => t + 1));
  private readonly titles: Signal<ReadonlyMap<string, string>> = computed(() => new Map(this.formatter.callsOf(this.message(),
    this.entries().filter(t => t.detail.kind !== DetailKind.Text && t.detail.kind !== DetailKind.Reasoning), this.rootPath())
    .flatMap(t => ActivityBlockComponent.treeOf(t)).map(t => [t.id, t.title] as const)));
  private initial: ReadonlySet<number> = new Set();
  private initialTitles: ReadonlySet<string> = new Set();
  private sizing: ResizeObserver | null = null;

  public readonly message: InputSignal<Message> = input.required<Message>();
  public readonly entries: InputSignal<readonly ActivityEntry[]> = input.required<readonly ActivityEntry[]>();
  public readonly rootPath: InputSignal<string | null> = input<string | null>(null);
  public readonly expansion: InputSignal<ReplyExpansion> = input(new ReplyExpansion());
  public readonly changedFiles: InputSignal<readonly FileChangeSummary[] | null> = input<readonly FileChangeSummary[] | null>(null);
  public readonly compact: InputSignal<boolean> = input(false);
  public readonly beforeExpand: InputSignal<(() => Promise<boolean>) | null> = input<(() => Promise<boolean>) | null>(null);
  public readonly streaming: InputSignal<boolean> = input(false);
  public readonly entering: InputSignal<boolean> = input(false);
  public readonly growing: InputSignal<boolean> = input(false);
  public readonly asking: InputSignal<boolean> = input(false);
  public readonly askers: InputSignal<ReadonlySet<string | null> | null> = input<ReadonlySet<string | null> | null>(null);
  public readonly catalog: InputSignal<ModelCatalog | undefined> = input<ModelCatalog | undefined>(undefined);
  public readonly asked: InputSignal<readonly PermissionPayload[]> = input<readonly PermissionPayload[]>([]);
  public readonly revealStep: InputSignal<number | null> = input<number | null>(null);
  public readonly revealStart: InputSignal<Date | null> = input<Date | null>(null);
  public readonly mentions: InputSignal<readonly MentionCandidate[]> = input<readonly MentionCandidate[]>([]);
  public readonly shellRuns: InputSignal<boolean> = input<boolean>(false);
  public readonly linkOpen: OutputEmitterRef<LinkOpenEvent> = output<LinkOpenEvent>();
  public readonly fileActivate: OutputEmitterRef<string> = output<string>();
  public readonly pageActivate: OutputEmitterRef<void> = output<void>();
  public readonly runBlocks: InputSignal<ReadonlyMap<string, ReadonlySet<number>>> = input<ReadonlyMap<string, ReadonlySet<number>>>(new Map());
  public readonly runStates: InputSignal<ReadonlyMap<string, ReadonlyMap<number, ShellRunState>>> = input<ReadonlyMap<string, ReadonlyMap<number, ShellRunState>>>(new Map());
  public readonly terminalOwner: InputSignal<string | null> = input<string | null>(null);
  public readonly shellRun: OutputEmitterRef<IShellRunAt> = output<IShellRunAt>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly subAgentSteps: Signal<ReadonlySet<string>> = computed(() =>
    new Set(this.entries().filter(t => t.detail.kind === DetailKind.SubAgent).map(t => String(t.detail.sequence))));
  protected readonly summary: Signal<string> = computed(() => this.formatter.activitySummary(this.entries(), this.changedFiles()));
  protected readonly shownEntries: Signal<readonly ActivityEntry[]> = computed(() => {
    this.frame();
    return this.entries().map(t => this.shown(t));
  });
  protected readonly calls: Signal<readonly ToolCall[]> = computed(() => {
    const entries = this.shownEntries().filter(t => t.detail.kind !== DetailKind.Text);
    const isGrowing = this.growing() && !entries.some((t, index) => index === entries.length - 1 && this.expansion().activity().has(t.detail.sequence));
    return this.formatter.callsOf(this.message(), entries, this.rootPath(), isGrowing, this.asking(), this.askers(), this.catalog(), this.asked());
  });
  protected readonly shownTitles: Signal<ReadonlyMap<string, string>> = computed(() => {
    this.frame();
    return new Map([...this.titles()].map(([key, title]) => [key, this.titleReveal.shownOf(key, title)] as const));
  });
  protected readonly plans: Signal<ReadonlyMap<string, Plan>> = computed(() => new Map(this.calls().flatMap(t => {
    const plan = this.formatter.subAgentPlanOf(this.message(), Number(t.id));
    return Object.isNull(plan) ? [] : [[t.id, plan] as const];
  })));
  protected readonly screenshots: Signal<ReadonlyMap<string, ViewedImage>> = computed(() => new Map(this.calls().flatMap(t => {
    const shot = this.formatter.screenshotOf(this.message(), Number(t.id));
    return Object.isNull(shot) ? [] : [[t.id, shot] as const];
  })));
  protected readonly pages: Signal<ReadonlyMap<string, string>> = computed(() => new Map(this.calls().flatMap(t => {
    const page = this.formatter.pageOf(this.message(), Number(t.id));
    return Object.isNull(page) ? [] : [[t.id, page] as const];
  })));
  protected readonly rows: Signal<readonly ActivityRow[]> = computed(() => {
    const calls = new Map(this.calls().map(t => [t.id, t]));
    return this.shownEntries().map(t => new ActivityRow(String(t.detail.sequence), calls.get(String(t.detail.sequence)) ?? null, t.detail.text));
  });
  protected readonly steps: Signal<readonly ActivityStep[]> = computed(() => this.shownEntries().map(t => this.formatter.stepOf(t, this.rootPath())));

  public constructor() {
    effect(() => this.follow(this.entries(), this.streaming(), !this.motion.reduced()));
    effect(() => {
      this.titleReveal.follow(this.titles(), this.initialTitles, this.streaming(), !this.motion.reduced());
      this.frame.update(t => t + 1);
    });
    effect(onCleanup => {
      const step = this.revealStep();
      if (Object.isNull(step) || Object.isNull(this.revealStart()))
        return;
      const render = untracked(() => afterNextRender(() => [...this.host.querySelectorAll(Resources.formatStepSelector(step))].slice(0, 1)
        .forEach(t => this.revealSized(t)), { injector: this.injector }));
      onCleanup(() => {
        render.destroy();
        this.sizing?.disconnect();
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.reveals.forEach(t => t.dispose());
      this.titleReveal.dispose();
    });
  }

  public ngOnInit(): void {
    this.initial = this.entering() ? new Set() : new Set(this.entries().map(t => t.detail.sequence));
    this.initialTitles = new Set(this.titles().keys());
  }

  protected isOpen(step: ActivityStep): boolean {
    return this.expansion().activity().has(step.sequence);
  }

  protected async toggle(step: ActivityStep): Promise<void> {
    const load = this.beforeExpand();
    if (!this.isOpen(step) && !Object.isNull(load) && !await load())
      return;
    this.expansion().activity.update(t => ActivityBlockComponent.with(t, step.sequence, !t.has(step.sequence)));
  }

  protected showsAll(step: ActivityStep): boolean {
    return this.expansion().activityBodies().has(step.sequence);
  }

  protected toggleAll(step: ActivityStep): void {
    this.expansion().activityBodies.update(t => ActivityBlockComponent.with(t, step.sequence, !this.showsAll(step)));
  }

  protected shownBody(step: ActivityStep, body: string): string {
    return this.showsAll(step) ? body : body.split(Resources.lineSeparator).slice(0, Resources.previewLineCount).join(Resources.lineSeparator);
  }

  protected hasMore(body: string): boolean {
    return body.split(Resources.lineSeparator).length > Resources.previewLineCount;
  }

  protected viewsOf(call: ToolCall): ToolCallViews {
    const expansion = this.expansion();
    return ActivityBlockComponent.treeOf(call).reduce((views, t) => {
      const sequence = Number(t.id);
      const isOpen = expansion.activity().has(sequence);
      const expanded = isOpen || expansion.activityClosed().has(sequence) ? views.withExpanded(t, isOpen) : views;
      const shown = expansion.activityChildren().get(sequence);
      const more = Object.isUndefined(shown) ? expanded : expanded.withShownChildren(t, shown);
      return expansion.activityBodies().has(sequence) ? more.withAllLines(t) : more;
    }, ToolCallViews.empty);
  }

  protected remember(call: ToolCall, views: ToolCallViews): void {
    const tree = ActivityBlockComponent.treeOf(call);
    this.expansion().activity.update(t => tree.reduce((u, v) => ActivityBlockComponent.with(u, Number(v.id), views.isExpanded(v)), t));
    this.expansion().activityClosed.update(t => tree.reduce((u, v) => ActivityBlockComponent.with(u, Number(v.id), v.status === ToolCallStatus.Failed && !views.isExpanded(v)), t));
    this.expansion().activityBodies.update(t => tree.reduce((u, v) => ActivityBlockComponent.with(u, Number(v.id), views.showsAllLines(v)), t));
    const shown = tree.filter(t => views.shownChildrenOf(t, Resources.activityChildrenStep) > Resources.activityChildrenStep);
    if (shown.length > 0)
      this.expansion().activityChildren.update(t => new Map([...t, ...shown.map(u => [Number(u.id), views.shownChildrenOf(u, Resources.activityChildrenStep)] as const)]));
  }

  protected siteOf(key: string): string {
    return `${Resources.runStepSitePrefix}${key}`;
  }

  protected runOutputsOf(key: string): ReadonlySet<number> {
    return this.runBlocks().get(this.siteOf(key)) ?? new Set();
  }

  protected runStatesOf(key: string): ReadonlyMap<number, ShellRunState> {
    return this.runStates().get(this.siteOf(key)) ?? new Map();
  }

  private revealSized(step: Element): void {
    this.sizing = ScrollReveal.whenSized(step, () => this.rowReveal?.revealPart(this.message().sequence, step));
  }

  private shown(entry: ActivityEntry): ActivityEntry {
    const detail = entry.detail;
    const reveal = this.reveals.get(detail.sequence);
    if (Object.isUndefined(reveal))
      return entry;
    const text = this.texts.get(detail.sequence)!;
    if (reveal.count >= text.count)
      return entry;
    return new ActivityEntry(new MessageDetail(detail.sequence, detail.kind, text.prefix(reveal.count), detail.payload, detail.createdAt), entry.result);
  }

  private follow(entries: readonly ActivityEntry[], streaming: boolean, motionAllowed: boolean): void {
    const current = new Set<number>();
    for (const entry of entries) {
      const detail = entry.detail;
      if (detail.kind !== DetailKind.Reasoning)
        continue;
      current.add(detail.sequence);
      const known = this.texts.get(detail.sequence);
      const text = known?.text === detail.text ? known : new GraphemeText(detail.text);
      this.texts.set(detail.sequence, text);
      let reveal = this.reveals.get(detail.sequence);
      if (Object.isUndefined(reveal)) {
        reveal = new TextReveal(streaming && !this.initial.has(detail.sequence) ? 0 : text.count, () => this.frame.update(t => t + 1));
        this.reveals.set(detail.sequence, reveal);
      }
      reveal.follow(text.count, !streaming, motionAllowed && (streaming || reveal.count < text.count));
    }
    for (const [sequence, reveal] of this.reveals)
      if (!current.has(sequence)) {
        reveal.dispose();
        this.reveals.delete(sequence);
        this.texts.delete(sequence);
      }
    this.frame.update(t => t + 1);
  }

  private static treeOf(call: ToolCall): readonly ToolCall[] {
    return [call, ...call.children.flatMap(t => ActivityBlockComponent.treeOf(t))];
  }

  private static with(current: ReadonlySet<number>, sequence: number, isIncluded: boolean): ReadonlySet<number> {
    const next = new Set(current);
    if (isIncluded)
      next.add(sequence);
    else
      next.delete(sequence);
    return next;
  }
}
