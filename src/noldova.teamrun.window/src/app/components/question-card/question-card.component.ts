/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type InputSignal, type OutputEmitterRef, type Signal, type WritableSignal, computed, effect, inject, input, output, signal,
  untracked } from "@angular/core";

import "@noldova/context.core";
import { type Approval, type ApprovalQuestion, ApprovalStatus, QuestionAnswer } from "@noldova/teamrun.protocol";
import { AnnouncementPoliteness, Announcer, ButtonComponent, ButtonVariant, ChipComponent, ChipKind, ChoiceRowComponent, ChoiceRowType, PermissionStatus,
  RadioGroupComponent, TextFieldComponent, ToolbarDirective, ToolbarItemDirective } from "@noldova/ui.components.angular";

import type { ApprovalAnswer } from "../../models/approval-answer";
import { ApprovalPermission } from "../../models/approval-permission";
import { QuestionSummary } from "../../models/question-summary";
import { Resources } from "../../../resources";

@Component({
  selector: "nol-teamrun-question-card",
  imports: [ButtonComponent, ChipComponent, ChoiceRowComponent, RadioGroupComponent, TextFieldComponent, ToolbarDirective, ToolbarItemDirective],
  templateUrl: "./question-card.component.html",
  styleUrl: "./question-card.component.css",
  host: {
    "class": "nol-teamrun-question-card",
    "role": "group",
    "[attr.aria-labelledby]": "id + '-heading'",
    "[attr.aria-describedby]": "asker() ? id + '-asker' : null"
  }
})
export class QuestionCardComponent {
  private static count: number = 0;

  private readonly announcer: Announcer = inject(Announcer);
  private readonly picks: WritableSignal<ReadonlyMap<string, readonly string[]>> = signal(new Map());
  private readonly texts: WritableSignal<ReadonlyMap<string, string>> = signal(new Map());

  public readonly approval: InputSignal<Approval> = input.required<Approval>();
  public readonly requester: InputSignal<string> = input.required<string>();
  public readonly answer: InputSignal<ApprovalAnswer | null> = input<ApprovalAnswer | null>(null);
  public readonly answered: OutputEmitterRef<readonly QuestionAnswer[]> = output<readonly QuestionAnswer[]>();
  public readonly skipped: OutputEmitterRef<void> = output<void>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly statuses: typeof ApprovalStatus = ApprovalStatus;
  protected readonly primary: ButtonVariant = ButtonVariant.Primary;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly tagKind: ChipKind = ChipKind.Status;
  protected readonly checkbox: ChoiceRowType = ChoiceRowType.Checkbox;
  protected readonly id: string = `${Resources.questionIdPrefix}${QuestionCardComponent.count++}`;
  protected readonly asker: Signal<string | null> = computed(() => ApprovalPermission.subAgentOf(this.approval()));
  protected readonly isOpen: Signal<boolean> = computed(() => this.approval().status === ApprovalStatus.Pending);
  protected readonly isSending: Signal<boolean> = computed(() => this.answer()?.isSending === true);
  protected readonly isFailed: Signal<boolean> = computed(() => this.answer()?.status === PermissionStatus.SendFailed);
  protected readonly answers: Signal<readonly QuestionAnswer[] | null> = computed(() => {
    const answers = this.approval().questions.map(t => this.answerTo(t));
    return answers.every(t => !Object.isNull(t)) ? answers : null;
  });
  protected readonly heading: Signal<string> = computed(() => {
    switch (this.approval().status) {
      case ApprovalStatus.Approved:
        return Resources.formatQuestionsAnswered(this.requester());
      case ApprovalStatus.Denied:
        return Resources.formatQuestionsSkipped(this.requester());
      case ApprovalStatus.Cancelled:
        return Resources.formatQuestionsWithdrawn(this.requester());
      default:
        return Resources.formatQuestionsAsked(this.requester());
    }
  });
  protected readonly summaries: Signal<readonly QuestionSummary[]> = computed(() => QuestionSummary.of(this.approval()));

  public constructor() {
    effect(() => {
      if (!this.isOpen())
        this.texts.set(new Map());
    });
    effect(() => {
      const answer = this.answer();
      if (answer?.isSending !== true)
        return;
      const id = untracked(() => this.approval().id);
      this.announcer.announce(Resources.questionSending, AnnouncementPoliteness.Polite,
        { key: `${Resources.questionSendingKeyPrefix}${id}-${answer.answeredAt.getTime()}` });
    });
  }

  protected isSendingOf(optionId: string): boolean {
    return this.isSending() && this.answer()?.optionId === optionId;
  }

  protected isPicked(question: ApprovalQuestion, label: string): boolean {
    return this.picks().get(question.id)?.includes(label) === true;
  }

  protected pickOf(question: ApprovalQuestion): string | null {
    return this.picks().get(question.id)?.[0] ?? null;
  }

  protected textOf(question: ApprovalQuestion): string {
    return this.texts().get(question.id) ?? String.empty;
  }

  protected pick(question: ApprovalQuestion, label: string, checked: boolean): void {
    const picked = (this.picks().get(question.id) ?? []).filter(t => question.multiple && t !== label);
    const next = checked ? [...picked, label] : picked;
    this.picks.update(t => new Map(t).set(question.id, question.options.map(u => u.label).filter(u => next.includes(u))));
    if (!question.multiple && checked)
      this.texts.update(t => new Map(t).set(question.id, String.empty));
  }

  protected type(question: ApprovalQuestion, event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.texts.update(t => new Map(t).set(question.id, text));
    if (!question.multiple && !String.isNullOrWhitespace(text))
      this.picks.update(t => new Map(t).set(question.id, []));
  }

  protected submit(): void {
    const answers = this.answers();
    if (!this.isSending() && !Object.isNull(answers))
      this.answered.emit(answers);
  }

  protected skip(): void {
    if (!this.isSending())
      this.skipped.emit();
  }

  private answerTo(question: ApprovalQuestion): QuestionAnswer | null {
    const choices = this.picks().get(question.id) ?? [];
    const text = question.other ? this.texts().get(question.id) ?? null : null;
    return choices.length === 0 && String.isNullOrWhitespace(text) ? null : new QuestionAnswer(question.id, choices, text);
  }
}
