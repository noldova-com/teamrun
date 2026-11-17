/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Guid } from "@noldova/teamrun.core";
import {
  DetailKind,
  Message,
  type MessageAttachment,
  MessageAuthor,
  MessageDetail,
  MessageStatus,
  ObservedSettings,
  Provenance,
  RequestedSettings,
  TeammateMention
} from "@noldova/teamrun.protocol";

import { StressChatScenario } from "../../models/stress-chat/stress-chat-scenario.js";
import { StressChatResources } from "./stress-chat-resources.js";

export class StressChatComposer {
  private readonly conversationId: string;
  private readonly root: string;
  private readonly attachments: readonly MessageAttachment[];
  private readonly mentions: readonly TeammateMention[] = [
    new TeammateMention(StressChatResources.atlasId, StressChatResources.atlasName),
    new TeammateMention(StressChatResources.novaId, StressChatResources.novaName)
  ];
  private readonly provenance: Provenance = new Provenance(null,
    new RequestedSettings(StressChatResources.kind, StressChatResources.model, null),
    new ObservedSettings(StressChatResources.kind, StressChatResources.model, null, null), null, false);

  public constructor(conversationId: string, root: string, attachments: readonly MessageAttachment[]) {
    this.conversationId = conversationId;
    this.root = root;
    this.attachments = attachments;
  }

  public *compose(pairs: number, end: Date): Generator<Message> {
    const start = end.getTime() - pairs * StressChatResources.pairIntervalMilliseconds;
    const scenarios = StressChatScenario.all;
    for (let pair = 0; pair < pairs; pair += scenarios.length) {
      for (const [index, scenario] of scenarios.slice(0, pairs - pair).entries())
        yield* this.composePair(pair + index, pairs, scenario, start + (pair + index) * StressChatResources.pairIntervalMilliseconds);
    }
  }

  private *composePair(pair: number, pairs: number, scenario: StressChatScenario, moment: number): Generator<Message> {
    const turn = pair + 1;
    const asked = new Date(moment).toISOString();
    const text = pair === 0 ? StressChatResources.formatIntroduction(pairs, StressChatScenario.all.length) : StressChatComposer.requestOf(turn, scenario);
    const request = new Message(Guid.createVersion7(moment).toString(), this.conversationId, pair * 2, MessageAuthor.User, null, MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.Text, text, null, asked)], null, asked, null, asked,
      scenario.hasAttachments ? this.attachments : [], null, null, scenario.hasMentions ? this.mentions : []);
    yield request;

    const started = moment + StressChatResources.replyDelayMilliseconds;
    const startedAt = new Date(started).toISOString();
    const work = scenario.workSeconds * StressChatResources.millisecondsPerSecond;
    const steps = scenario.detailsOf(turn, this.root);
    const details = [
      new MessageDetail(0, DetailKind.Text, StressChatResources.formatHeading(scenario.name), null, startedAt),
      ...steps.map((t, index) => new MessageDetail(index + 1, t.kind, t.text, t.payload, new Date(started + Math.floor(work * (index + 1) / steps.length)).toISOString()))
    ];
    yield new Message(Guid.createVersion7(started).toString(), this.conversationId, pair * 2 + 1, MessageAuthor.Provider, request.id, scenario.status,
      details, this.provenance, startedAt, startedAt, new Date(started + work).toISOString());
  }

  private static requestOf(turn: number, scenario: StressChatScenario): string {
    return scenario.hasMentions ? StressChatResources.formatMentionRequest(turn, scenario.name) : StressChatResources.formatRequest(turn, scenario.name);
  }
}
