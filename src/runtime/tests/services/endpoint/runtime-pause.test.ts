/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Conversation, ErrorCode, MessageSendResult, MethodName, Project, ProviderModel } from "@noldova/teamrun-protocol";
import { EndpointKind, RuntimeClient, RuntimeServer } from "@noldova/teamrun-runtime";

import { RuntimeTestHost } from "../../fixtures/runtime-test-host.fixture.js";
import { RecordingClientListener } from "../../fixtures/recording-client-listener.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class RuntimePauseTests {
  @TestMethod
  public async finishesAnInflightRequestAfterItsClientDisconnects(): Promise<void> {
    await using host = new RuntimeTestHost();
    const entered = Promise.withResolvers<void>();
    const released = Promise.withResolvers<readonly ProviderModel[]>();
    host.adapter.listModels = () => { entered.resolve(); return released.promise; };
    const service = host.createService();
    await service.start();
    const client = await host.connect(service);
    const response = client.call(MethodName.ProviderListModels, { provider: "fake", providerAccountId: null }).catch(() => null);
    await entered.promise;
    client.close();
    await Wait.until(() => service.clientCount === 0);
    released.resolve([]);
    Assert.isNull(await response);
    const next = await host.connect(service);
    Assert.isFalse((await next.call(MethodName.ProviderList, null)).hasErrors);
  }

  @TestMethod
  public async refusesInstallationWhenProviderShutdownNeverFinishes(): Promise<void> {
    await using host = new RuntimeTestHost();
    const released = Promise.withResolvers<void>();
    host.adapter.shutdown = () => released.promise;
    const service = host.createService();
    await service.start();
    const owner = await host.connect(service, "updater");
    try {
      await owner.call(MethodName.RuntimePause, null);
      const result = await owner.call(MethodName.RuntimeStopForUpdate, null).catch(() => null);
      Assert.isNull(result);
      Assert.areEqual("update", await service.waitForStop());
      Assert.isFalse(service.isRunning);
    }
    finally { released.resolve(); }
  }

  @TestMethod
  public async acknowledgesResourceShutdownAndReportsProviderFailureWithoutReopeningAdmission(): Promise<void> {
    await using host = new RuntimeTestHost();
    const service = host.createService();
    await service.start();
    const owner = await host.connect(service, "updater");
    Assert.areEqual(ErrorCode.Conflict, (await owner.call(MethodName.RuntimeStopForUpdate, null)).info?.name);
    await owner.call(MethodName.RuntimePause, null);
    Assert.areEqual(ErrorCode.Conflict, (await owner.call(MethodName.RuntimeStopForUpdate, {})).info?.name);
    host.adapter.shutdown = () => Promise.reject(new Error("fixture shutdown failure"));
    const result = await owner.call(MethodName.RuntimeStopForUpdate, null);
    Assert.areEqual(ErrorCode.Unavailable, result.info?.name);
    Assert.areEqual("update", await service.waitForStop());
    Assert.isFalse(service.isRunning);
  }

  @TestMethod
  public async keepsAdmissionClosedWhenTheOwnerDisconnectsDuringShutdown(): Promise<void> {
    await using host = new RuntimeTestHost();
    const entered = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    host.adapter.shutdown = () => { entered.resolve(); return released.promise; };
    const service = host.createService();
    await service.start();
    const owner = await host.connect(service, "updater");
    const other = await host.connect(service, "cli");
    await owner.call(MethodName.RuntimePause, null);
    const stopped = owner.call(MethodName.RuntimeStopForUpdate, null).catch(() => null);
    await entered.promise;
    owner.close();
    Assert.areEqual(ErrorCode.Unavailable, (await other.call(MethodName.ProjectList, null)).info?.name);
    released.resolve();
    await stopped;
    await service.waitForStop();
    Assert.isFalse(service.isRunning);
  }
  @TestMethod
  public async refusesNewRequestsUntilTheOwnerResumesOrDisconnects(): Promise<void> {
    await using host = new RuntimeTestHost();
    const service = host.createService();
    await service.start();
    const owner = await host.connect(service, "updater");
    const cli = await host.connect(service, "cli");
    Assert.areEqual(ErrorCode.InvalidParams, (await owner.call(MethodName.RuntimePause, {})).info?.name);
    Assert.isFalse((await owner.call(MethodName.RuntimePause, null)).hasErrors);
    Assert.isFalse((await owner.call(MethodName.RuntimePause, null)).hasErrors);
    Assert.areEqual(ErrorCode.Unavailable, (await cli.call(MethodName.ProjectOpen, { rootPath: host.directory.resolve("blocked") })).info?.name);
    Assert.areEqual(ErrorCode.Unavailable, (await owner.call(MethodName.ProviderList, null)).info?.name);
    Assert.areEqual(ErrorCode.Conflict, (await cli.call(MethodName.RuntimePause, null)).info?.name);
    Assert.areEqual(ErrorCode.Conflict, (await cli.call(MethodName.RuntimeResume, null)).info?.name);
    Assert.isFalse((await owner.call(MethodName.RuntimeResume, null)).hasErrors);
    Assert.isFalse((await owner.call(MethodName.RuntimeResume, null)).hasErrors);
    Assert.areEqual("[]", JSON.stringify((await cli.call(MethodName.ProjectList, null)).payload));
    await owner.call(MethodName.RuntimePause, null);
    owner.close();
    await Wait.until(() => service.clientCount === 1);
    Assert.isFalse((await cli.call(MethodName.ProviderList, null)).hasErrors);
  }

  @TestMethod
  public async refusesPausingAnActiveReplyAndDoesNotCancelIt(): Promise<void> {
    await using host = new RuntimeTestHost();
    host.adapter.holdUntilAbort = true;
    const service = host.createService();
    await service.start();
    const cli = await host.connect(service);
    const project = Project.fromJson((await cli.call(MethodName.ProjectOpen, { rootPath: host.directory.resolve("repo") })).payload);
    const conversation = Conversation.fromJson((await cli.call(MethodName.ConversationCreate, { projectId: project.id, title: null })).payload);
    const sent = MessageSendResult.fromJson((await cli.call(MethodName.MessageSend, { conversationId: conversation.id, text: "Hold",
      requested: { provider: "fake", model: null, effort: null }, providerAccountId: null })).payload);
    Assert.areEqual(ErrorCode.Conflict, (await cli.call(MethodName.RuntimePause, null)).info?.name);
    Assert.areEqual(0, host.adapter.shutdowns);
    await cli.call(MethodName.MessageCancel, { messageId: sent.replies[0]!.id });
    Assert.isFalse((await cli.call(MethodName.RuntimePause, null)).hasErrors);
  }

  @TestMethod
  public async refusesAnInflightRequestAndAutomaticallyExpiresAnAbandonedLease(): Promise<void> {
    await using host = new RuntimeTestHost();
    const started = Promise.withResolvers<void>();
    const models = Promise.withResolvers<readonly ProviderModel[]>();
    host.adapter.listModels = () => { started.resolve(); return models.promise; };
    const settings = host.createSettings();
    const server = new RuntimeServer(EndpointKind.Tcp, settings.socketPath, "test-token", host.createDispatcher(),
      { onSessionCountChanged: () => undefined }, undefined, 50);
    const endpoint = await server.start();
    const owner = await RuntimeClient.connect(endpoint, "test-token", "updater", new RecordingClientListener(), host.timings);
    const cli = await RuntimeClient.connect(endpoint, "test-token", "cli", new RecordingClientListener(), host.timings);
    try {
      const work = cli.call(MethodName.ProviderListModels, { provider: "fake", providerAccountId: null });
      await started.promise;
      Assert.areEqual(ErrorCode.Conflict, (await owner.call(MethodName.RuntimePause, null)).info?.name);
      models.resolve([]);
      Assert.isFalse((await work).hasErrors);
      Assert.isFalse((await owner.call(MethodName.RuntimePause, null)).hasErrors);
      await Wait.delay(100);
      Assert.isFalse((await cli.call(MethodName.ProviderList, null)).hasErrors);
      await owner.call(MethodName.RuntimePause, null);
    }
    finally {
      models.resolve([]);
      owner.close();
      cli.close();
      await server.stop();
    }
  }
}
