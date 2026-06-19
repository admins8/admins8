import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { executeRule, executeRuleResult } from './ruleExecutor';

afterEach(() => {
  delete process.env.ENABLE_SOURCE_JS;
  delete process.env.ALLOW_SOURCE_JS_VM_FALLBACK;
});

test('默认不执行书源内联 JS 规则', () => {
  delete process.env.ENABLE_SOURCE_JS;

  const result = executeRule('js:return "unsafe"', '<html></html>');

  assert.deepEqual(result, []);
});

test('开启 ENABLE_SOURCE_JS 后执行简单 JS 规则', () => {
  process.env.ENABLE_SOURCE_JS = 'true';
  process.env.ALLOW_SOURCE_JS_VM_FALLBACK = 'true';

  const result = executeRule('js:return "safe"', '<html></html>');

  assert.deepEqual(result, ['safe']);
});

test('支持基础 CSS 文本提取规则', () => {
  const result = executeRule('.title', '<div class="title">斗破苍穹</div>');

  assert.deepEqual(result, ['斗破苍穹']);
});

test('支持 XPath 文本提取规则', () => {
  const result = executeRule('//h1', '<html><body><h1>诡秘之主</h1></body></html>');

  assert.deepEqual(result, ['诡秘之主']);
});

test('支持字段提取后的简单 @js 拼接规则', () => {
  process.env.ALLOW_SOURCE_JS_VM_FALLBACK = 'true';
  const html = '<a data-bid="12345">书名</a>';

  const result = executeRule("a[data-bid]@data-bid@js:'https://m.qidian.com/book/'+result+'/'", html);

  assert.deepEqual(result, ['https://m.qidian.com/book/12345/']);
});

test('JSON 书源字段模板替换后的路径应作为字面量返回', () => {
  const result = executeRule('/novels/api/book/12345', '{"book_id":12345}', true);

  assert.deepEqual(result, ['/novels/api/book/12345']);
});

test('executeRuleResult reports empty rules without throwing', () => {
  const result = executeRuleResult('', '<html></html>');

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'empty_rule');
  assert.deepEqual(result.values, []);
});

test('executeRuleResult returns parsed values for valid selectors', () => {
  const result = executeRuleResult('h1', '<h1>标题</h1>');

  assert.equal(result.ok, true);
  assert.deepEqual(result.values, ['标题']);
});
