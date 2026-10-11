/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import SigningCredentials from "../../packaging/signing-credentials.ts";

class SigningCredentialsTests {
  public static register(): void {
    test("every Windows and macOS signing credential is taken out of the environment, also an empty one, and the rest stays", () => {
      const environment: NodeJS.ProcessEnv = {
        AZURE_TENANT_ID: "fixture-tenant",
        AZURE_CLIENT_SECRET: "",
        AZURE_SIGNING_ACCOUNT: "fixture-works-signing",
        MAC_CERTIFICATE: "fixture-certificate",
        APPLE_API_KEY_P8: "fixture-key",
        AZURE_EXTENSION_DIR: "fixture-extensions",
        PATH: "fixture-path"
      };

      const credentials = SigningCredentials.take(environment);

      assert.deepEqual(SigningCredentials.NAMES,
        ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_SIGNING_ENDPOINT", "AZURE_SIGNING_ACCOUNT", "AZURE_SIGNING_PROFILE",
          "MAC_CERTIFICATE", "MAC_CERTIFICATE_PASSWORD", "APPLE_API_KEY_P8", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"]);
      assert.deepEqual(credentials,
        { AZURE_TENANT_ID: "fixture-tenant", AZURE_CLIENT_SECRET: "", AZURE_SIGNING_ACCOUNT: "fixture-works-signing", MAC_CERTIFICATE: "fixture-certificate", APPLE_API_KEY_P8: "fixture-key" });
      assert.deepEqual(environment, { AZURE_EXTENSION_DIR: "fixture-extensions", PATH: "fixture-path" });
    });
  }
}

SigningCredentialsTests.register();
