import test from 'node:test';
import assert from 'node:assert/strict';
import { createStreamCancellationState } from './streamCancellation';

test('流式请求取消后不再允许发送事件和继续后续处理', () => {
  const state = createStreamCancellationState();

  assert.equal(state.isCancelled(), false);
  assert.equal(state.canSend(), true);

  state.cancel();

  assert.equal(state.isCancelled(), true);
  assert.equal(state.canSend(), false);
});

test('流式请求取消函数可重复调用', () => {
  const state = createStreamCancellationState();

  state.cancel();
  state.cancel();

  assert.equal(state.isCancelled(), true);
  assert.equal(state.canSend(), false);
});
