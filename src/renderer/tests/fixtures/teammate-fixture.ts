/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ConversationMember, ConversationMemberParams, Harness, MethodName, Teammate, TeammateCreateParams, TeammateIdParams,
  TeammateUpdateParams } from "@noldova/teamrun-protocol";
import { SampleData } from "./sample-data";

export class TeammateFixture {
  public readonly alice = new Teammate("alice", "Alice", "Review", "a1", Harness.Provider, "gpt-5", "high", "t", "t");
  public readonly bob = new Teammate("bob", "Bob", null, "a1", Harness.Provider, null, null, "t", "t");
  public readonly unavailable = new Teammate("offline", "Offline", null, "missing", Harness.Provider, null, null, "t", "t");
  public teammates = [this.bob, this.alice, this.unavailable];
  public members = [new ConversationMember("c1", "alice", "t", null, false)];
  public readonly bridge = SampleData.createBridge();

  public constructor() {
    this.bridge.answer(MethodName.MessageList, () => []).answer(MethodName.ApprovalList, () => [])
      .answer(MethodName.TeammateList, () => this.teammates.map(t => t.toJson()))
      .answer(MethodName.ConversationListMembers, () => this.members.map(t => t.toJson()))
      .answer(MethodName.TeammateCreate, payload => {
        const params = TeammateCreateParams.fromJson(payload);
        const teammate = new Teammate("created", params.name, params.role, params.providerAccountId, params.harness, params.model, params.effort, "t", "t");
        this.teammates.push(teammate);
        return teammate.toJson();
      })
      .answer(MethodName.TeammateUpdate, payload => {
        const params = TeammateUpdateParams.fromJson(payload);
        const teammate = new Teammate(params.teammateId, params.name, params.role, params.providerAccountId, params.harness, params.model, params.effort, "t", "t");
        this.teammates = this.teammates.map(t => t.id === teammate.id ? teammate : t);
        return teammate.toJson();
      })
      .answer(MethodName.TeammateDelete, payload => {
        const id = TeammateIdParams.fromJson(payload).teammateId;
        this.teammates = this.teammates.filter(t => t.id !== id);
        this.members = this.members.filter(t => t.teammateId !== id);
        return null;
      })
      .answer(MethodName.ConversationAddMember, payload => {
        const params = ConversationMemberParams.fromJson(payload);
        const member = new ConversationMember(params.conversationId, params.teammateId, "t", null, false);
        this.members.push(member);
        return member.toJson();
      })
      .answer(MethodName.ConversationRemoveMember, payload => {
        const params = ConversationMemberParams.fromJson(payload);
        this.members = this.members.filter(t => t.teammateId !== params.teammateId || t.conversationId !== params.conversationId);
        return null;
      });
  }
}
