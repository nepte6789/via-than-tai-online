import test from 'node:test';
import assert from 'node:assert/strict';
import { TikTokLiveConnection, RouteConfig, ControlEvent } from 'tiktok-live-connector';
import { TIKTOK_CONNECTION_OPTIONS, buildTikTokConnectionOptions, explainTikTokConnectionError } from '../tiktok-config.mjs';

test('connect skips the Business-only gift catalogue and reaches normal WebSocket signing', async () => {
  const original = {
    fetchRoomInfo: RouteConfig.fetchRoomInfo,
    fetchRoomGifts: RouteConfig.fetchRoomGifts,
    fetchSignedWebSocketFromProvider: RouteConfig.fetchSignedWebSocketFromProvider,
  };
  const calls = [];
  const business = new Error('[fetchWebcastSignatureFromEulerRoute] This endpoint requires a Business plan.');
  const reachedWebSocket = new Error('normal WebSocket signing reached');
  RouteConfig.fetchRoomInfo = async () => ({ data: { status: 2 } });
  RouteConfig.fetchRoomGifts = async () => { calls.push('catalogue'); throw business; };
  RouteConfig.fetchSignedWebSocketFromProvider = async () => { calls.push('websocket'); throw reachedWebSocket; };
  try {
    // Demonstrate the reported failure on the previous configuration with the real connector.
    const previous = new TikTokLiveConnection('test.account', { ...TIKTOK_CONNECTION_OPTIONS, enableExtendedGiftInfo: true });
    previous.on(ControlEvent.ERROR, () => {});
    await assert.rejects(previous.connect('123456'), e => e === business);
    assert.deepEqual(calls, ['catalogue']);
    calls.length = 0;
    const fixed = new TikTokLiveConnection('test.account', { ...TIKTOK_CONNECTION_OPTIONS });
    fixed.on(ControlEvent.ERROR, () => {});
    await assert.rejects(fixed.connect('123456'), e => e === reachedWebSocket);
    assert.deepEqual(calls, ['websocket']);
    assert.equal(fixed.options.enableExtendedGiftInfo, false);
    assert.equal(fixed.options.processInitialData, false);
  } finally {
    Object.assign(RouteConfig, original);
  }
});

test('provider restrictions remain visible; unrelated errors retain their original message', () => {
  assert.match(explainTikTokConnectionError(new Error('This endpoint requires a Business plan.')), /EulerStream/);
  assert.match(explainTikTokConnectionError(new Error('This endpoint requires a Business plan.')), /Business plan/);
  assert.equal(explainTikTokConnectionError(new Error('User is offline')), 'User is offline');
});


test('EulerStream key is optional, trimmed and passed only as a connection option', () => {
  assert.deepEqual(buildTikTokConnectionOptions({}), { ...TIKTOK_CONNECTION_OPTIONS });
  assert.deepEqual(buildTikTokConnectionOptions({ EULERSTREAM_API_KEY: '  ' }), { ...TIKTOK_CONNECTION_OPTIONS });
  const options = buildTikTokConnectionOptions({ EULERSTREAM_API_KEY: ' test-key-placeholder ' });
  assert.equal(options.signApiKey, 'test-key-placeholder');
  assert.equal(options.enableExtendedGiftInfo, false);
  assert.equal('signApiKey' in TIKTOK_CONNECTION_OPTIONS, false);
});
