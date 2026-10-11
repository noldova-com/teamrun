/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import PackagingException from "../../packaging/packaging.exception.ts";
import WindowsSigningAccount from "../../packaging/windows-signing-account.ts";

class WindowsSigningAccountTests {
  private static readonly ENDPOINT: string = "https://fixtureville.signing.example/";
  private static readonly ACCOUNT: string = "fixture-works-signing";
  private static readonly PROFILE: string = "Fixture-Studio";
  private static readonly CREDENTIALS: Readonly<Record<string, string>> = {
    AZURE_SIGNING_ENDPOINT: WindowsSigningAccountTests.ENDPOINT,
    AZURE_SIGNING_ACCOUNT: WindowsSigningAccountTests.ACCOUNT,
    AZURE_SIGNING_PROFILE: WindowsSigningAccountTests.PROFILE
  };

  public static register(): void {
    test("the signing account is read from the three signing secrets", () => {
      assert.deepEqual(WindowsSigningAccount.fromCredentials({ ...WindowsSigningAccountTests.CREDENTIALS, AZURE_TENANT_ID: "fixture-tenant" }),
        new WindowsSigningAccount(WindowsSigningAccountTests.ENDPOINT, WindowsSigningAccountTests.ACCOUNT, WindowsSigningAccountTests.PROFILE));
      assert.deepEqual(WindowsSigningAccount.VARIABLES, ["AZURE_SIGNING_ENDPOINT", "AZURE_SIGNING_ACCOUNT", "AZURE_SIGNING_PROFILE"]);
    });

    test("missing secrets are named, and an invalid one is refused by its name alone, never with any part of its value", () => {
      const cases: readonly [Readonly<Record<string, string>>, string, string][] = [
        ...["http://fixtureville.signing.example/", "https://fixtureville.signing.example", "https://fixtureville.signing.example/path/", "https://user@fixtureville.signing.example/",
          "https://Fixtureville.signing.example/", "https://fixtureville..example/"].map((t): [Readonly<Record<string, string>>, string, string] =>
          [{ AZURE_SIGNING_ENDPOINT: t }, t, "AZURE_SIGNING_ENDPOINT must be the HTTPS URL of the Artifact Signing endpoint, ending in /."]),
        ...["-fixture", "fixture-", "fixture signing", "fixture'signing", "fixture_signing"].flatMap((t): [Readonly<Record<string, string>>, string, string][] => [
          [{ AZURE_SIGNING_ACCOUNT: t }, t, "AZURE_SIGNING_ACCOUNT must be a name of letters, digits and hyphens that starts and ends with a letter or digit."],
          [{ AZURE_SIGNING_PROFILE: t }, t, "AZURE_SIGNING_PROFILE must be a name of letters, digits and hyphens that starts and ends with a letter or digit."]
        ])
      ];

      assert.throws(() => WindowsSigningAccount.fromCredentials({ AZURE_SIGNING_ACCOUNT: WindowsSigningAccountTests.ACCOUNT, AZURE_SIGNING_PROFILE: "" }),
        new PackagingException("Signing Windows packages needs AZURE_SIGNING_ENDPOINT, AZURE_SIGNING_PROFILE, the Artifact Signing endpoint, account and certificate profile."));
      assert.throws(() => WindowsSigningAccount.fromCredentials({}), new PackagingException(
        "Signing Windows packages needs AZURE_SIGNING_ENDPOINT, AZURE_SIGNING_ACCOUNT, AZURE_SIGNING_PROFILE, the Artifact Signing endpoint, account and certificate profile."));
      for (const [overrides, value, problem] of cases)
        assert.throws(() => WindowsSigningAccount.fromCredentials({ ...WindowsSigningAccountTests.CREDENTIALS, ...overrides }),
          (error: unknown) => error instanceof PackagingException && error.message === problem && !error.message.includes(value), JSON.stringify(overrides));
    });

    test("redaction replaces the endpoint, its host alone, the account and the profile with their secrets' names, and an endpoint that is no URL whole", () => {
      const account = new WindowsSigningAccount(WindowsSigningAccountTests.ENDPOINT, WindowsSigningAccountTests.ACCOUNT, WindowsSigningAccountTests.PROFILE);
      const unparsed = new WindowsSigningAccount("fixture endpoint", WindowsSigningAccountTests.ACCOUNT, WindowsSigningAccountTests.PROFILE);

      assert.equal(account.redact("Signing at https://fixtureville.signing.example/ (fixtureville.signing.example) with fixture-works-signing and Fixture-Studio failed."),
        "Signing at AZURE_SIGNING_ENDPOINT (AZURE_SIGNING_ENDPOINT) with AZURE_SIGNING_ACCOUNT and AZURE_SIGNING_PROFILE failed.");
      assert.equal(unparsed.redact("Signing at fixture endpoint with fixture-works-signing failed."), "Signing at AZURE_SIGNING_ENDPOINT with AZURE_SIGNING_ACCOUNT failed.");
    });
  }
}

WindowsSigningAccountTests.register();
