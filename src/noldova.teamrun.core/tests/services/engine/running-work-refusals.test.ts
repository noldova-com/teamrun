/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Resources, TaskEnd, TaskStart, type TurnRequest } from "@noldova/teamrun.core";
import {
  BackgroundTaskStatus,
  ChatFolderAttachParams,
  CommandStartParams,
  ConversationCreateParams,
  ConversationIdParams,
  ConversationMoveParams,
  ErrorCode,
  MessageSendParams,
  MethodName,
  Request,
  RequestedSettings,
  SenderEnvironment,
  SubAgentStartParams
} from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class RunningWorkRefusalsTests {
  @TestMethod
  public async refusesAMoveAndAnAttachWhileABackgroundCommandRunsAndMovesOnceItEnds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const site = RunningWorkRefusalsTests.folder(host, "site");
    host.adapter.holdTurn = async (request: TurnRequest): Promise<void> => {
      const token = SenderEnvironment.read(request.environment);
      if (host.commands.started.length === 0 && !Object.isNull(token))
        await host.engine.startCommandAsync(new CommandStartParams(token, "npm test", "Run the tests"));
    };
    await RunningWorkRefusalsTests.sendAsync(host, chat.id);
    await host.engine.waitForIdle();
    const [command] = host.commands.started;
    Assert.isDefined(command);

    const refused = [
      await RunningWorkRefusalsTests.refusalAsync(host, MethodName.ConversationMove, new ConversationMoveParams(chat.id, project.id).toJson()),
      await RunningWorkRefusalsTests.refusalAsync(host, MethodName.ChatFolderAttach, new ChatFolderAttachParams(chat.id, site).toJson())
    ];
    command.end(0);
    await host.engine.waitForIdle();
    const moved = await RunningWorkRefusalsTests.dispatchAsync(host, MethodName.ConversationMove, new ConversationMoveParams(chat.id, project.id).toJson());

    const running = [Resources.formatRunningCommand("npm test")];
    Assert.areEqual(JSON.stringify([
      [ErrorCode.Conflict, Resources.formatChatWorkRunning(Resources.chatMoveChange, running), chat.id],
      [ErrorCode.Conflict, Resources.formatChatWorkRunning(Resources.chatAttachChange, running), chat.id]
    ]), JSON.stringify(refused));
    Assert.isFalse(moved.hasErrors);
    Assert.areEqual(project.id, (await host.conversations.findAsync(chat.id))?.projectId);
  }

  @TestMethod
  public async refusesADetachWhileAHelperRunsNamingItAndDetachesOnceItEnds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const site = RunningWorkRefusalsTests.folder(host, "site");
    Assert.isFalse((await RunningWorkRefusalsTests.dispatchAsync(host, MethodName.ChatFolderAttach, new ChatFolderAttachParams(chat.id, site).toJson())).hasErrors);
    let release = (): void => undefined;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    let started = false;
    host.adapter.holdTurn = async (request: TurnRequest): Promise<void> => {
      const token = SenderEnvironment.read(request.environment);
      if (Object.isNull(token)) {
        await held;
        return;
      }
      if (!started) {
        started = true;
        await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Check the tests", "Run the tests."));
      }
    };
    await RunningWorkRefusalsTests.sendAsync(host, chat.id);
    await host.until("the running helper", async () => (await host.tasks.listAsync(new ConversationIdParams(chat.id)))
      .some(t => !Object.isNull(t.subAgentId) && t.status === BackgroundTaskStatus.Running));

    const refused = await RunningWorkRefusalsTests.refusalAsync(host, MethodName.ChatFolderDetach, new ConversationIdParams(chat.id).toJson());
    release();
    await host.engine.waitForIdle();
    const detached = await RunningWorkRefusalsTests.dispatchAsync(host, MethodName.ChatFolderDetach, new ConversationIdParams(chat.id).toJson());

    Assert.areEqual(JSON.stringify([ErrorCode.Conflict,
      Resources.formatChatWorkRunning(Resources.chatDetachChange, [Resources.formatRunningHelper("Check the tests")]), chat.id]), JSON.stringify(refused));
    Assert.isFalse(detached.hasErrors);
    Assert.isNull((await host.conversations.findAsync(chat.id))?.attachedFolder);
  }

  @TestMethod
  public async refusesOnlyTheChatWhoseEndedReplyStaysOpenForItsProvidersWork(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const other = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const site = RunningWorkRefusalsTests.folder(host, "site");
    host.adapter.afterDetails = () => host.adapter.lastListener?.onTaskStartedAsync(new TaskStart("watch", "npm run watch", () => Promise.resolve(), null, false));
    await RunningWorkRefusalsTests.sendAsync(host, chat.id);
    await host.engine.waitForIdle();
    const listener = host.adapter.lastListener;
    Assert.isNotNull(listener);

    const attachedOther = await RunningWorkRefusalsTests.dispatchAsync(host, MethodName.ChatFolderAttach, new ChatFolderAttachParams(other.id, site).toJson());
    const refused = await RunningWorkRefusalsTests.refusalAsync(host, MethodName.ChatFolderAttach, new ChatFolderAttachParams(chat.id, site).toJson());
    await listener.onTaskEndedAsync(new TaskEnd("watch", BackgroundTaskStatus.Completed, 0));
    await host.engine.waitForIdle();
    const attached = await RunningWorkRefusalsTests.dispatchAsync(host, MethodName.ChatFolderAttach, new ChatFolderAttachParams(chat.id, site).toJson());

    Assert.isFalse(attachedOther.hasErrors);
    Assert.areEqual(JSON.stringify([ErrorCode.Conflict, Resources.formatChatWorkRunning(Resources.chatAttachChange, [Resources.runningReplyWork]), chat.id]),
      JSON.stringify(refused));
    Assert.isFalse(attached.hasErrors);
    Assert.areEqual(site, (await host.conversations.findAsync(chat.id))?.attachedFolder);
  }

  private static folder(host: CoreHost, name: string): string {
    const path = join(host.directory.path, name);
    mkdirSync(path, { recursive: true });
    return path;
  }

  private static async sendAsync(host: CoreHost, chatId: string): Promise<void> {
    await host.engine.sendAsync(new MessageSendParams(chatId, "Go", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
  }

  private static dispatchAsync(host: CoreHost, method: MethodName, payload: unknown): ReturnType<CoreHost["dispatcher"]["dispatch"]> {
    return host.dispatcher.dispatch(new Request("r", method, JsonReader.toJsonValue(payload)));
  }

  private static async refusalAsync(host: CoreHost, method: MethodName, payload: unknown): Promise<readonly string[]> {
    const response = await RunningWorkRefusalsTests.dispatchAsync(host, method, payload);
    return [response.info?.name ?? "none", response.info?.message ?? "none", response.info?.arguments.join() ?? "none"];
  }
}
