/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import {
  ChatMemberModeParams,
  ChatMemberSettingsParams,
  type Conversation,
  ConversationCreateParams,
  ConversationMember,
  ConversationMemberParams,
  Harness,
  MethodName,
  Teammate,
  TeammateCreateParams,
  TeammateIdParams,
  TeammateUpdateParams
} from "@noldova/teamrun.protocol";

import type { FakeWindowPartContext } from "./fake-window-part-context.fixture";

export class TeammateFixture {
  public readonly alice: Teammate = new Teammate("alice", "Alice", "Review", "a1", Harness.Provider, "gpt-5", "high", "t", "t");
  public readonly bob: Teammate = new Teammate("bob", "Bob", null, "a1", Harness.Provider, null, null, "t", "t");
  public readonly unavailable: Teammate = new Teammate("offline", "Offline", null, "missing", Harness.Provider, null, null, "t", "t");
  public readonly reviewer: Teammate = new Teammate("reviewer", "Code Reviewer", null, "a1", Harness.Provider, null, null, "t", "t");
  public teammates: Teammate[] = [this.bob, this.alice, this.unavailable];
  public members: ConversationMember[] = [new ConversationMember("c1", "alice", "t", null, false)];

  public constructor(context: FakeWindowPartContext) {
    context.answer(MethodName.ApprovalList, () => [])
      .answer(MethodName.TeammateList, () => this.teammates.map(t => t.toJson()))
      .answer(MethodName.DefaultTeammateRead, () => null)
      .answer(MethodName.ConversationListMembers, () => this.members.map(t => t.toJson()))
      .answer(MethodName.TeammateCreate, t => {
        const params = TeammateCreateParams.fromJson(t);
        const teammate = new Teammate("created", params.name, params.role, params.providerId, params.harness, params.model, params.effort, "t", "t");
        this.teammates.push(teammate);
        return teammate.toJson();
      })
      .answer(MethodName.TeammateUpdate, t => {
        const params = TeammateUpdateParams.fromJson(t);
        const teammate = params.applyTo(this.teammates.find(u => u.id === params.teammateId)!, "t");
        this.teammates = this.teammates.map(u => u.id === teammate.id ? teammate : u);
        return teammate.toJson();
      })
      .answer(MethodName.TeammateDelete, t => {
        const id = TeammateIdParams.fromJson(t).teammateId;
        this.teammates = this.teammates.filter(u => u.id !== id);
        this.members = this.members.filter(u => u.teammateId !== id);
        return null;
      })
      .answer(MethodName.ConversationAddMember, t => {
        const params = ConversationMemberParams.fromJson(t);
        const member = new ConversationMember(params.conversationId, params.teammateId, "t", null, false);
        this.members.push(member);
        return member.toJson();
      })
      .answer(MethodName.ConversationRemoveMember, t => {
        const params = ConversationMemberParams.fromJson(t);
        this.members = this.members.filter(u => u.teammateId !== params.teammateId || u.conversationId !== params.conversationId);
        return null;
      })
      .answer(MethodName.ConversationSetMemberMode, t => {
        const params = ChatMemberModeParams.fromJson(t);
        this.members = this.members.map(u => u.teammateId === params.teammateId && u.conversationId === params.chatId ? u.withMode(params.mode) : u);
        return this.members.find(u => u.teammateId === params.teammateId && u.conversationId === params.chatId)!.toJson();
      })
      .answer(MethodName.ConversationSetMemberSettings, t => {
        const params = ChatMemberSettingsParams.fromJson(t);
        this.members = this.members.map(u => u.teammateId === params.teammateId && u.conversationId === params.chatId ? u.withSettings(params.settings) : u);
        return this.members.find(u => u.teammateId === params.teammateId && u.conversationId === params.chatId)!.toJson();
      });
  }

  public start(parameters: JsonValue, chat: Conversation): Conversation {
    const teammateId = ConversationCreateParams.fromJson(parameters).teammateId;
    if (teammateId !== null)
      this.members.push(new ConversationMember(chat.id, teammateId, "t", null, false));
    return chat;
  }
}
