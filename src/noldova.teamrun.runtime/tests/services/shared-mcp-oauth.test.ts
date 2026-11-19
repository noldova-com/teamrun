/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { connect } from "node:net";

import "@noldova/context.core";
import type { IModuleSecrets } from "@noldova/desktop.runtime";
import type { SharedMcpAccess } from "@noldova/teamrun.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Resources, SharedMcpOauth } from "@noldova/teamrun.runtime";

import { OauthTestServer } from "../fixtures/oauth-test-server.fixture.js";

@TestClass
export class SharedMcpOauthTests {
  private static readonly reference = "teamrun.mcpSignIn0123456789abcdef0123456789abcdef";
  private static readonly start = Date.parse("2026-11-02T10:00:00.000Z");
  private static readonly never = (): AbortSignal => new AbortController().signal;

  @TestMethod
  public async signsInByDiscoveryFromTheServers401AndKeepsTheClientAndTokensOnlyInTheSecretStore(): Promise<void> {
    await using server = await OauthTestServer.startAsync();
    const [secrets, saved] = SharedMcpOauthTests.secrets();
    const oauth = new SharedMcpOauth(secrets, SharedMcpOauthTests.never, () => SharedMcpOauthTests.start);
    const finished = Promise.withResolvers<SharedMcpAccess>();

    const started = new URL(await oauth.startAsync(server.url, SharedMcpOauthTests.reference, t => finished.resolve(t)) ?? String.empty);
    const redirect = started.searchParams.get("redirect_uri") ?? String.empty;
    const browser = await server.signInInTheBrowserAsync(started.toString());
    const access = await finished.promise;
    const read = await oauth.accessAsync(server.url, SharedMcpOauthTests.reference);
    const grants = [...server.grants];

    Assert.areEqual(`${new URL(server.url).origin}/authorize`, `${started.origin}${started.pathname}`);
    Assert.areEqual("S256", started.searchParams.get("code_challenge_method"));
    Assert.isTrue(/^http:\/\/127\.0\.0\.1:\d+\/callback$/.test(redirect), redirect);
    Assert.areEqual(JSON.stringify([200, Resources.sharedMcpSignedInPage]), JSON.stringify([browser.status, browser.page]));
    Assert.areEqual(JSON.stringify(["access-1", "2026-11-02T11:00:00.000Z", null]), JSON.stringify([access.token, access.expiresAt, access.needsSignIn]));
    Assert.areEqual(JSON.stringify(["access-1", "2026-11-02T11:00:00.000Z"]), JSON.stringify([read.token, read.expiresAt]));
    Assert.areEqual(JSON.stringify([`authorize client-1 docs.read ${server.url}`, "authorization_code"]), JSON.stringify(grants));
    Assert.areEqual(JSON.stringify(["POST /mcp", "GET /.well-known/oauth-protected-resource/mcp"]), JSON.stringify(server.requests.slice(0, 2)));
    Assert.isTrue(server.requests.includes("POST /register"));
    const kept = saved.get(SharedMcpOauthTests.reference) ?? String.empty;
    Assert.isTrue(kept.includes("refresh-1") && kept.includes("client-1") && kept.includes(redirect), kept);
    await Assert.throwsAsync(() => fetch(redirect), Error);
  }

  @TestMethod
  public async findsTheServersMetadataAtItsWellKnownAddressWhenTheServerAsksForNoSignInOrNamesNoMetadata(): Promise<void> {
    await using server = await OauthTestServer.startAsync();
    await using bare = await OauthTestServer.startAsync();
    server.answersWithout401 = true;
    bare.answersWithBare401 = true;
    const [secrets] = SharedMcpOauthTests.secrets();

    const access = await SharedMcpOauthTests.signInAsync(new SharedMcpOauth(secrets, SharedMcpOauthTests.never, () => SharedMcpOauthTests.start), server);
    const named = await SharedMcpOauthTests.signInAsync(new SharedMcpOauth(secrets, SharedMcpOauthTests.never, () => SharedMcpOauthTests.start), bare);

    Assert.areEqual(JSON.stringify(["access-1", "access-1"]), JSON.stringify([access.token, named.token]));
    Assert.areEqual(JSON.stringify([`authorize client-1 null ${server.url}`, "authorization_code"]), JSON.stringify(server.grants));
    Assert.areEqual(JSON.stringify([`authorize client-1 null ${bare.url}`, "authorization_code"]), JSON.stringify(bare.grants));
  }

  @TestMethod
  public async refreshesATokenThatExpiresWithinAMinuteOnceForReadsTogetherAndKeepsTheNewTokens(): Promise<void> {
    await using server = await OauthTestServer.startAsync();
    const [secrets, saved] = SharedMcpOauthTests.secrets();
    let now = SharedMcpOauthTests.start;
    const oauth = new SharedMcpOauth(secrets, SharedMcpOauthTests.never, () => now);
    await SharedMcpOauthTests.signInAsync(oauth, server);

    now = Date.parse("2026-11-02T10:58:59.000Z");
    const early = await oauth.accessAsync(server.url, SharedMcpOauthTests.reference);
    now = Date.parse("2026-11-02T10:59:30.000Z");
    const [first, second] = await Promise.all([oauth.accessAsync(server.url, SharedMcpOauthTests.reference), oauth.accessAsync(server.url, SharedMcpOauthTests.reference)]);

    Assert.areEqual("access-1", early.token);
    Assert.areEqual(JSON.stringify(["access-2", "access-2", "2026-11-02T11:59:30.000Z"]), JSON.stringify([first.token, second.token, first.expiresAt]));
    Assert.areEqual(1, server.grants.filter(t => t === "refresh_token").length);
    Assert.isTrue((saved.get(SharedMcpOauthTests.reference) ?? String.empty).includes("refresh-2"));
  }

  @TestMethod
  public async refusesAccessWithoutASignInOrWhenNoneCanRenewItAndGrantsATokenWithoutAnExpiry(): Promise<void> {
    await using server = await OauthTestServer.startAsync();
    const [secrets] = SharedMcpOauthTests.secrets();
    let now = SharedMcpOauthTests.start;
    const oauth = new SharedMcpOauth(secrets, SharedMcpOauthTests.never, () => now);

    const missing = await oauth.accessAsync(server.url, SharedMcpOauthTests.reference);
    server.givesRefreshToken = false;
    await SharedMcpOauthTests.signInAsync(oauth, server);
    now = Date.parse("2026-11-02T12:00:00.000Z");
    const expired = await oauth.accessAsync(server.url, SharedMcpOauthTests.reference);
    server.expiresIn = null;
    await SharedMcpOauthTests.signInAsync(oauth, server);
    now = Date.parse("2027-11-02T12:00:00.000Z");
    const lasting = await oauth.accessAsync(server.url, SharedMcpOauthTests.reference);
    server.revoked.add("access-2");
    const revoked = await oauth.accessAsync(server.url, SharedMcpOauthTests.reference);
    await oauth.signOutAsync(SharedMcpOauthTests.reference);
    const signedOut = await oauth.accessAsync(server.url, SharedMcpOauthTests.reference);

    Assert.areEqual(JSON.stringify(["", Resources.sharedMcpSignInMissing]), JSON.stringify([missing.token, missing.needsSignIn]));
    Assert.areEqual(Resources.sharedMcpSignInExpiredForGood, expired.needsSignIn);
    Assert.areEqual(JSON.stringify(["access-2", null, null]), JSON.stringify([lasting.token, lasting.expiresAt, lasting.needsSignIn]));
    Assert.areEqual(JSON.stringify(["", Resources.sharedMcpSignInRevoked]), JSON.stringify([revoked.token, revoked.needsSignIn]));
    Assert.areEqual(Resources.sharedMcpSignInMissing, signedOut.needsSignIn);
  }

  @TestMethod
  public async renewsATokenWithoutAnExpiryThatTheServerNoLongerTakesAndGrantsItWhenTheServerCantBeReached(): Promise<void> {
    await using server = await OauthTestServer.startAsync();
    const [secrets] = SharedMcpOauthTests.secrets();
    const oauth = new SharedMcpOauth(secrets, SharedMcpOauthTests.never, () => SharedMcpOauthTests.start);
    server.expiresIn = null;
    await SharedMcpOauthTests.signInAsync(oauth, server);

    server.revoked.add("access-1");
    const renewed = await oauth.accessAsync(server.url, SharedMcpOauthTests.reference);
    const url = server.url;
    await server[Symbol.asyncDispose]();
    const unreachable = await oauth.accessAsync(url, SharedMcpOauthTests.reference);

    Assert.areEqual(JSON.stringify(["access-2", null]), JSON.stringify([renewed.token, renewed.needsSignIn]));
    Assert.areEqual(1, server.grants.filter(t => t === "refresh_token").length);
    Assert.areEqual(JSON.stringify(["access-2", null]), JSON.stringify([unreachable.token, unreachable.needsSignIn]));
  }

  @TestMethod
  public async refusesAccessWhenTheServerRefusesTheRefreshOrItFails(): Promise<void> {
    await using server = await OauthTestServer.startAsync();
    const [secrets] = SharedMcpOauthTests.secrets();
    let now = SharedMcpOauthTests.start;
    const oauth = new SharedMcpOauth(secrets, SharedMcpOauthTests.never, () => now);
    await SharedMcpOauthTests.signInAsync(oauth, server);
    now = Date.parse("2026-11-02T12:00:00.000Z");

    const refusals: (string | null)[] = [];
    for (const refusal of ["invalid_grant", "invalid_client", "invalid_scope"]) {
      server.refreshRefusal = refusal;
      refusals.push((await oauth.accessAsync(server.url, SharedMcpOauthTests.reference)).needsSignIn);
    }

    server.refreshRefusal = null;
    Object.assign(secrets, { saveAsync: () => Promise.reject("The store is locked.") });
    const unsaved = await oauth.accessAsync(server.url, SharedMcpOauthTests.reference);

    Assert.areEqual(JSON.stringify([Resources.sharedMcpRefreshRefused, Resources.sharedMcpRefreshRefused]), JSON.stringify(refusals.slice(0, 2)));
    Assert.isTrue((refusals[2] ?? String.empty).startsWith(Resources.formatSharedMcpRefreshFailed(String.empty)), refusals[2] ?? String.empty);
    Assert.areEqual(Resources.formatSharedMcpRefreshFailed("The store is locked."), unsaved.needsSignIn);
  }

  @TestMethod
  public async endsASignInWhoseAnswerIsntItsOwnIsDeniedCantBeExchangedOrIsntFinishedInTime(): Promise<void> {
    await using server = await OauthTestServer.startAsync();
    const [secrets, saved] = SharedMcpOauthTests.secrets();
    const oauth = new SharedMcpOauth(secrets, SharedMcpOauthTests.never, () => SharedMcpOauthTests.start);
    const answerAsync = async (query: (state: string) => string, path: string = "/callback"): Promise<{ status: number; access: SharedMcpAccess | null }> => {
      const finished = Promise.withResolvers<SharedMcpAccess>();
      const started = new URL(await oauth.startAsync(server.url, SharedMcpOauthTests.reference, t => finished.resolve(t)) ?? String.empty);
      const redirect = new URL(started.searchParams.get("redirect_uri") ?? String.empty);
      const elsewhere = await fetch(`${redirect.origin}/elsewhere`);
      const answer = await fetch(`${redirect.origin}${path}?${query(started.searchParams.get("state") ?? String.empty)}`);
      return { status: elsewhere.status, access: answer.status === 200 ? await finished.promise : null };
    };

    const foreign = await answerAsync(() => "code=code-1&state=other");
    const denied = await answerAsync(t => `error=access_denied&state=${t}`);
    const unexchanged = await answerAsync(t => `code=wrong&state=${t}`);
    const codeless = await answerAsync(t => `state=${t}`);
    const timedOut = Promise.withResolvers<SharedMcpAccess>();
    const expiry = new AbortController();
    await new SharedMcpOauth(secrets, () => expiry.signal, () => SharedMcpOauthTests.start).startAsync(server.url, SharedMcpOauthTests.reference, t => timedOut.resolve(t));
    expiry.abort();
    const expired = Promise.withResolvers<SharedMcpAccess>();
    await new SharedMcpOauth(secrets, () => AbortSignal.abort(), () => SharedMcpOauthTests.start)
      .startAsync(server.url, SharedMcpOauthTests.reference, t => expired.resolve(t));

    Assert.areEqual(404, foreign.status);
    Assert.areEqual(Resources.sharedMcpSignInStateMismatch, foreign.access?.needsSignIn);
    Assert.areEqual(Resources.formatSharedMcpSignInDenied("access_denied"), denied.access?.needsSignIn);
    Assert.isTrue((unexchanged.access?.needsSignIn ?? String.empty).startsWith(Resources.formatSharedMcpSignInFailed(String.empty)));
    Assert.areEqual(Resources.sharedMcpSignInWithoutCode, codeless.access?.needsSignIn);
    Assert.areEqual(Resources.sharedMcpSignInTimedOut, (await timedOut.promise).needsSignIn);
    Assert.areEqual(Resources.sharedMcpSignInTimedOut, (await expired.promise).needsSignIn);
    Assert.isFalse(saved.has(SharedMcpOauthTests.reference));
  }

  @TestMethod
  public async endsWithNoAddressAStartSignedOutWhileItAsksTheServerOrRegistersWhetherOrNotThatRequestIsAnswered(): Promise<void> {
    await using server = await OauthTestServer.startAsync();
    await using silentProbe = await OauthTestServer.startAsync();
    await using silentRegistration = await OauthTestServer.startAsync();
    const [secrets, saved] = SharedMcpOauthTests.secrets();
    const requests: AbortController[] = [];
    const oauth = new SharedMcpOauth(secrets, SharedMcpOauthTests.never, () => SharedMcpOauthTests.start, () => {
      const request = new AbortController();
      requests.push(request);
      return request.signal;
    });
    const ends: SharedMcpAccess[] = [];
    const signOutWhileAsync = async (url: string, asked: Promise<void>, answer: () => void): Promise<string | null> => {
      const starting = oauth.startAsync(url, SharedMcpOauthTests.reference, t => ends.push(t));
      await asked;
      await oauth.signOutAsync(SharedMcpOauthTests.reference);
      answer();
      return starting;
    };
    const timeOut = (): void => requests.forEach(t => t.abort(new DOMException("The request timed out.", "TimeoutError")));
    const probe = server.holdAt("/mcp");
    const registration = server.holdAt("/register");

    const answeredProbe = await signOutWhileAsync(server.url, probe.asked, probe.release);
    const answeredRegistration = await signOutWhileAsync(server.url, registration.asked, registration.release);
    const unansweredProbe = await signOutWhileAsync(silentProbe.url, silentProbe.hangAt("/mcp"), timeOut);
    const unansweredRegistration = await signOutWhileAsync(silentRegistration.url, silentRegistration.hangAt("/register"), timeOut);

    Assert.areEqual(JSON.stringify([null, null, null, null]),
      JSON.stringify([answeredProbe, answeredRegistration, unansweredProbe, unansweredRegistration]));
    Assert.areEqual(0, ends.length);
    Assert.isFalse(saved.has(SharedMcpOauthTests.reference));
  }

  @TestMethod
  public async endsWithNoAddressAnEarlierStartWhenALaterOneStartsWhileTheEarlierRegisters(): Promise<void> {
    await using server = await OauthTestServer.startAsync();
    const [secrets] = SharedMcpOauthTests.secrets();
    const oauth = new SharedMcpOauth(secrets, SharedMcpOauthTests.never, () => SharedMcpOauthTests.start);
    const ends: string[] = [];
    const finished = Promise.withResolvers<SharedMcpAccess>();
    const registration = server.holdAt("/register");

    const earlier = oauth.startAsync(server.url, SharedMcpOauthTests.reference, t => ends.push(`earlier ${t.token}`));
    await registration.asked;
    const later = await oauth.startAsync(server.url, SharedMcpOauthTests.reference, t => finished.resolve(t));
    registration.release();
    const ended = await earlier;
    await server.signInInTheBrowserAsync(later);
    const access = await finished.promise;

    Assert.isNull(ended);
    Assert.areEqual("access-1", access.token);
    Assert.areEqual(0, ends.length);
  }

  @TestMethod
  public async failsAStartWhoseServerNeverAnswersItsFirstRequestOnceThatRequestsTimeRunsOut(): Promise<void> {
    await using server = await OauthTestServer.startAsync();
    const [secrets] = SharedMcpOauthTests.secrets();
    const probe = new AbortController();
    const oauth = new SharedMcpOauth(secrets, SharedMcpOauthTests.never, () => SharedMcpOauthTests.start, () => probe.signal);
    const asked = server.hangAt("/mcp");

    const starting = oauth.startAsync(server.url, SharedMcpOauthTests.reference, () => undefined);
    await asked;
    probe.abort(new DOMException("The request timed out.", "TimeoutError"));
    const failure = await Assert.throwsAsync(() => starting, DOMException);

    Assert.areEqual("TimeoutError", failure.name);
    Assert.isFalse(server.requests.includes("GET /.well-known/oauth-protected-resource/mcp"));
  }

  @TestMethod
  public async answersARequestWhoseTargetIsNoAddressWithNotFoundAndKeepsWaitingForTheAnswer(): Promise<void> {
    await using server = await OauthTestServer.startAsync();
    const [secrets] = SharedMcpOauthTests.secrets();
    const oauth = new SharedMcpOauth(secrets, SharedMcpOauthTests.never, () => SharedMcpOauthTests.start);
    const finished = Promise.withResolvers<SharedMcpAccess>();
    const started = await oauth.startAsync(server.url, SharedMcpOauthTests.reference, t => finished.resolve(t));
    const callback = new URL(await server.callbackOfAsync(started));

    const line = await SharedMcpOauthTests.statusLineAsync(callback, "//");
    const answer = await fetch(callback);
    const access = await finished.promise;

    Assert.areEqual("HTTP/1.1 404 Not Found", line);
    Assert.areEqual(200, answer.status);
    Assert.areEqual("access-1", access.token);
  }

  @TestMethod
  public async endsAnEarlierSignInOfTheSameServerWithoutAnAnswerWhenALaterOneStarts(): Promise<void> {
    await using server = await OauthTestServer.startAsync();
    const [secrets] = SharedMcpOauthTests.secrets();
    const oauth = new SharedMcpOauth(secrets, SharedMcpOauthTests.never, () => SharedMcpOauthTests.start);
    const ends: string[] = [];
    const finished = Promise.withResolvers<SharedMcpAccess>();

    const earlier = await oauth.startAsync(server.url, SharedMcpOauthTests.reference, t => ends.push(`earlier ${t.token}`));
    const later = await oauth.startAsync(server.url, SharedMcpOauthTests.reference, t => finished.resolve(t));
    const callback = await server.callbackOfAsync(earlier);
    await Assert.throwsAsync(() => fetch(callback), Error);
    await server.signInInTheBrowserAsync(later);
    const access = await finished.promise;

    Assert.areEqual("access-1", access.token);
    Assert.areEqual(0, ends.length);
  }

  @TestMethod
  public async settlesASignInOnlyAfterItsExchangeIgnoringAnotherAnswerAndTheTimeoutMeanwhile(): Promise<void> {
    await using server = await OauthTestServer.startAsync();
    const [secrets, saved] = SharedMcpOauthTests.secrets();
    const expiry = new AbortController();
    const oauth = new SharedMcpOauth(secrets, () => expiry.signal, () => SharedMcpOauthTests.start);
    const finished = Promise.withResolvers<SharedMcpAccess>();
    const held = server.holdTokens();

    const callback = await server.callbackOfAsync(await oauth.startAsync(server.url, SharedMcpOauthTests.reference, t => finished.resolve(t)));
    const answer = fetch(callback);
    await held.asked;
    const stray = await fetch(`${new URL(callback).origin}/callback?error=access_denied`);
    expiry.abort();
    held.release();
    const access = await finished.promise;

    Assert.areEqual(404, stray.status);
    Assert.areEqual(JSON.stringify(["access-1", null]), JSON.stringify([access.token, access.needsSignIn]));
    Assert.areEqual(200, (await answer).status);
    Assert.isTrue(saved.has(SharedMcpOauthTests.reference));
  }

  @TestMethod
  public async signOutEndsASignInWithoutAnAnswerAndRemovesItsTokensOnlyOnceItsExchangeIsSaved(): Promise<void> {
    await using server = await OauthTestServer.startAsync();
    const [secrets, saved] = SharedMcpOauthTests.secrets();
    const oauth = new SharedMcpOauth(secrets, undefined, () => SharedMcpOauthTests.start);
    const ends: SharedMcpAccess[] = [];
    const held = server.holdTokens();

    const callback = await server.callbackOfAsync(await oauth.startAsync(server.url, SharedMcpOauthTests.reference, t => ends.push(t)));
    const answer = fetch(callback).catch(() => null);
    await held.asked;
    const signedOut = oauth.signOutAsync(SharedMcpOauthTests.reference);
    held.release();
    await signedOut;
    await answer;

    Assert.isTrue(server.grants.includes("authorization_code"));
    Assert.isFalse(saved.has(SharedMcpOauthTests.reference));
    Assert.areEqual(0, ends.length);
  }

  @TestMethod
  public async removesASignInAfterARefreshInFlightAndRefusesARefreshThatComesAfterTheRemoval(): Promise<void> {
    await using server = await OauthTestServer.startAsync();
    const [secrets, saved] = SharedMcpOauthTests.secrets();
    let now = SharedMcpOauthTests.start;
    const oauth = new SharedMcpOauth(secrets, SharedMcpOauthTests.never, () => now);
    await SharedMcpOauthTests.signInAsync(oauth, server);
    now = Date.parse("2026-11-02T12:00:00.000Z");
    const held = server.holdTokens();

    const refreshing = oauth.accessAsync(server.url, SharedMcpOauthTests.reference);
    await held.asked;
    const signedOut = oauth.signOutAsync(SharedMcpOauthTests.reference);
    held.release();
    const [refreshed] = await Promise.all([refreshing, signedOut]);
    const kept = saved.has(SharedMcpOauthTests.reference);
    await SharedMcpOauthTests.signInAsync(oauth, server);
    const removed = oauth.signOutAsync(SharedMcpOauthTests.reference);
    const afterRemoval = await oauth.accessAsync(server.url, SharedMcpOauthTests.reference);
    await removed;

    Assert.areEqual("access-2", refreshed.token);
    Assert.isFalse(kept);
    Assert.areEqual(Resources.sharedMcpSignInMissing, afterRemoval.needsSignIn);
    Assert.isFalse(saved.has(SharedMcpOauthTests.reference));
  }

  @TestMethod
  public async grantsATokenWhoseServerNeverAnswersItsCheckAndRefusesARefreshItsServerNeverAnswers(): Promise<void> {
    await using checked = await OauthTestServer.startAsync();
    await using renewed = await OauthTestServer.startAsync();
    const [secrets] = SharedMcpOauthTests.secrets();
    let now = SharedMcpOauthTests.start;
    const requests: AbortController[] = [];
    const lasting = new SharedMcpOauth(secrets, SharedMcpOauthTests.never, () => now, () => {
      const request = new AbortController();
      requests.push(request);
      return request.signal;
    });
    const timeOut = (): void => requests.forEach(t => t.abort(new DOMException("The request timed out.", "TimeoutError")));
    checked.expiresIn = null;
    await SharedMcpOauthTests.signInAsync(lasting, checked);

    const checkAsked = checked.hangAt("/mcp");
    const checking = lasting.accessAsync(checked.url, SharedMcpOauthTests.reference);
    await checkAsked;
    timeOut();
    const unanswered = await checking;
    await SharedMcpOauthTests.signInAsync(lasting, renewed);
    now = Date.parse("2026-11-02T12:00:00.000Z");
    const refreshAsked = renewed.hangAt("/token");
    const renewing = lasting.accessAsync(renewed.url, SharedMcpOauthTests.reference);
    await refreshAsked;
    timeOut();
    const unrenewed = await renewing;

    Assert.areEqual(JSON.stringify(["access-1", null]), JSON.stringify([unanswered.token, unanswered.needsSignIn]));
    Assert.isTrue(checked.requests.includes("POST /mcp"));
    Assert.areEqual(JSON.stringify(["", Resources.sharedMcpRefreshRefused]), JSON.stringify([unrenewed.token, unrenewed.needsSignIn]));
    Assert.areEqual(2, renewed.requests.filter(t => t === "POST /token").length);
  }

  @TestMethod
  public async keepsReadingASignInAfterTheStoreRefusedItsRemoval(): Promise<void> {
    await using server = await OauthTestServer.startAsync();
    const [secrets] = SharedMcpOauthTests.secrets();
    const oauth = new SharedMcpOauth(secrets, SharedMcpOauthTests.never, () => SharedMcpOauthTests.start);
    await SharedMcpOauthTests.signInAsync(oauth, server);
    Object.assign(secrets, { removeAsync: () => Promise.reject(new Error("The store is locked.")) });

    const refused = await Assert.throwsAsync(() => oauth.signOutAsync(SharedMcpOauthTests.reference), Error);
    const read = await oauth.accessAsync(server.url, SharedMcpOauthTests.reference);

    Assert.areEqual("The store is locked.", refused.message);
    Assert.areEqual(JSON.stringify(["access-1", null]), JSON.stringify([read.token, read.needsSignIn]));
  }

  @TestMethod
  public async failsToStartWhenTheServerCantBeReachedOrRefusesTheRegistration(): Promise<void> {
    await using server = await OauthTestServer.startAsync();
    const [secrets] = SharedMcpOauthTests.secrets();
    const oauth = new SharedMcpOauth(secrets, SharedMcpOauthTests.never, () => SharedMcpOauthTests.start);
    const closed = await OauthTestServer.startAsync();
    const unreachable = closed.url;
    await closed[Symbol.asyncDispose]();
    server.refusesRegistration = true;

    await Assert.throwsAsync(() => oauth.startAsync(unreachable, SharedMcpOauthTests.reference, () => undefined), Error);
    const refused = await Assert.throwsAsync(() => oauth.startAsync(server.url, SharedMcpOauthTests.reference, () => undefined), Error);

    Assert.isTrue(refused.message.includes("Registration is closed."), refused.message);
    Assert.isFalse(server.requests.includes("GET /authorize"));
  }

  private static async signInAsync(oauth: SharedMcpOauth, server: OauthTestServer): Promise<SharedMcpAccess> {
    const finished = Promise.withResolvers<SharedMcpAccess>();
    await server.signInInTheBrowserAsync(await oauth.startAsync(server.url, SharedMcpOauthTests.reference, t => finished.resolve(t)));
    return finished.promise;
  }

  private static statusLineAsync(address: URL, target: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = connect(Number(address.port), address.hostname);
      let text = String.empty;
      socket.setEncoding("utf8");
      socket.on("data", (chunk: string) => text += chunk);
      socket.on("error", reject);
      socket.on("close", () => resolve(text.split("\r\n")[0] ?? String.empty));
      socket.write(`GET ${target} HTTP/1.1\r\nHost: ${address.host}\r\nConnection: close\r\n\r\n`);
    });
  }

  private static secrets(): [IModuleSecrets, Map<string, string>] {
    const saved = new Map<string, string>();
    return [{
      saveAsync: (name, value) => {
        saved.set(name, value);
        return Promise.resolve();
      },
      readAsync: name => Promise.resolve(saved.get(name) ?? null),
      removeAsync: name => {
        saved.delete(name);
        return Promise.resolve();
      },
      isSetAsync: name => Promise.resolve(saved.has(name))
    }, saved];
  }
}
