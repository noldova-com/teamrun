/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProviderRegistry } from "@noldova/teamrun-core";
import { ErrorCode, ProviderListModelsParams } from "@noldova/teamrun-protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { FakeProviderAdapter } from "../../fixtures/fake-provider-adapter.fixture.js";

@TestClass
export class ProvidersServiceTests {
  @TestMethod
  public listsTheRegisteredProviders(): void {
    using host = new CoreHost();
    host.registry.register(new FakeProviderAdapter("other"));

    Assert.areEqual("fake,other", host.providers.list().map(t => t.id).join(","));
    Assert.areEqual("Fake provider", host.providers.list()[0]?.displayName);
  }

  @TestMethod
  public async listsModelsDirectlyOrThroughAnAccount(): Promise<void> {
    using host = new CoreHost();
    host.registry.register(new FakeProviderAdapter("other"));
    const account = host.createAccount();
    const otherAccount = host.createAccount("other", "Other");

    Assert.areEqual("fake-small,fake-large", (await host.providers.listModels(new ProviderListModelsParams("fake", null))).join(","));
    Assert.areEqual("fake-small,fake-large", (await host.providers.listModels(new ProviderListModelsParams("fake", account.id))).join(","));
    Assert.areEqual(ErrorCode.NotFound, Assert.throws(() => host.providers.listModels(new ProviderListModelsParams("nope", null)), ServiceException).info.name);
    Assert.areEqual(ErrorCode.NotFound, Assert.throws(() => host.providers.listModels(new ProviderListModelsParams("fake", "acc-nope")), ServiceException).info.name);
    Assert.areEqual(ErrorCode.InvalidParams, Assert.throws(() => host.providers.listModels(new ProviderListModelsParams("fake", otherAccount.id)), ServiceException).info.name);
  }

  @TestMethod
  public registryRejectsDuplicatesAndUnknownProviders(): void {
    const registry = new ProviderRegistry();
    const adapter = new FakeProviderAdapter();
    registry.register(adapter);

    Assert.isTrue(registry.has("fake"));
    Assert.isFalse(registry.has("nope"));
    Assert.areEqual(adapter, registry.get("fake"));
    Assert.areEqual(1, registry.all().length);
    Assert.areEqual("adapter", Assert.throws(() => registry.register(new FakeProviderAdapter()), ArgumentException).parameterName);
    Assert.areEqual(ErrorCode.NotFound, Assert.throws(() => registry.get("nope"), ServiceException).info.name);
  }
}
