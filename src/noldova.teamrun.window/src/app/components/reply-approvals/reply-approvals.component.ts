/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type InputSignal, type OutputEmitterRef, type Signal, computed, inject, input, output } from "@angular/core";

import "@noldova/context.core";
import { ApprovalKind, ApprovalStatus, type Message, type QuestionAnswer } from "@noldova/teamrun.protocol";
import { PermissionCardComponent } from "@noldova/ui.components.angular";

import { ApprovalPermission } from "../../models/approval-permission";
import { MessageControlState } from "../../models/message-control-state";
import { ReplyApproval } from "../../models/reply-approval";
import { Resources } from "../../../resources";
import { ChatStoreService } from "../../services/chat-store.service";
import { FormatterService } from "../../services/formatter.service";
import { QuestionCardComponent } from "../question-card/question-card.component";

@Component({
  selector: "nol-teamrun-reply-approvals",
  imports: [PermissionCardComponent, QuestionCardComponent],
  providers: [ChatStoreService.provider],
  templateUrl: "./reply-approvals.component.html",
  styleUrl: "./reply-approvals.component.css"
})
export class ReplyApprovalsComponent {
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly formatter: FormatterService = inject(FormatterService);

  protected readonly requester: Signal<string> = computed(() => this.formatter.authorLabel(this.reply(), this.store.kinds(), this.store.providers()));
  protected readonly providerName: Signal<string | null> = computed(() => {
    const provenance = this.reply().provenance;
    const kind = Object.isNull(provenance) ? null : provenance.observed.kind ?? provenance.requested.kind;
    return this.store.kinds().find(t => t.id === kind)?.displayName ?? null;
  });
  protected readonly approvals: Signal<readonly ReplyApproval[]> = computed(() => {
    const requester = this.requester();
    const providerName = this.providerName();
    const ids = this.ids();
    return this.store.approvalsOf(this.reply().id).filter(t => (t.kind === ApprovalKind.Question || t.status === ApprovalStatus.Pending)
      && (Object.isNull(ids) || ids.includes(t.id))).map(t => {
      const answer = this.store.answerOf(t.id);
      return new ReplyApproval(t, answer, t.kind === ApprovalKind.Question ? null : ApprovalPermission.toRequest(t, requester, answer, providerName));
    });
  });

  protected readonly lowRiskApprovalId: Signal<string | null> = computed(() =>
    this.store.approvalsOf(this.reply().id).find(t => t.kind !== ApprovalKind.Question && t.status === ApprovalStatus.Pending)?.id ?? null);
  protected readonly lowRiskLine: Signal<string | null> = computed(() => {
    const steps = this.formatter.allowedWithoutAsking(this.reply());
    return steps.length === 0 ? null : Resources.formatLowRiskLine(this.requester(), steps);
  });
  protected readonly resources: typeof Resources = Resources;

  public readonly reply: InputSignal<Message> = input.required<Message>();
  public readonly ids: InputSignal<readonly string[] | null> = input<readonly string[] | null>(null);
  public readonly controls: InputSignal<MessageControlState> = input<MessageControlState>(new MessageControlState());
  public readonly focused: OutputEmitterRef<string> = output<string>();

  protected decide(approvalId: string, optionId: string): void {
    void this.store.decide(approvalId, optionId);
  }

  protected answer(approvalId: string, answers: readonly QuestionAnswer[]): void {
    void this.store.decide(approvalId, Resources.answerOptionId, answers);
  }

  protected skip(approvalId: string): void {
    void this.store.decide(approvalId, Resources.skipOptionId);
  }
}
