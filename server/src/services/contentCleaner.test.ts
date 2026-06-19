import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanContent,
  normalizeContentCleanerRules,
  type ContentCleanerRules,
} from './contentCleaner';

test('净化 HTML 换行、空格实体和残留标签', () => {
  const input = '&nbsp;&nbsp;&nbsp;&nbsp;人体奥妙无穷，<br><br><span>第19章 修士</span>';

  const output = cleanContent(input);

  assert.equal(output, '人体奥妙无穷，\n\n第19章 修士');
});

test('净化常见 HTML 实体和数字实体', () => {
  const input = '少年&amp;少女&lt;修行&gt;&#12290;';

  const output = cleanContent(input);

  assert.equal(output, '少年&少女<修行>。');
});

test('支持自定义移除标签、符号、内容和正则替换', () => {
  const rules: ContentCleanerRules = {
    removeTags: ['script'],
    removeTexts: ['请收藏本站', '★'],
    removePatterns: ['第\\d+/\\d+页'],
    replacements: [{ pattern: '广告内容', replacement: '' }],
  };
  const input = '<script>alert(1)</script>正文★请收藏本站 第1/3页 广告内容';

  const output = cleanContent(input, rules);

  assert.equal(output, '正文');
});

test('默认净化会移除常见英文广告提示行但保留正文英文', () => {
  const input = [
    '他低声说：“Mission complete.”',
    'Please visit www.example.com to read the latest chapter.',
    'If you find any errors, please report them to us.',
    '真正的正文还在继续。',
  ].join('\n');

  const output = cleanContent(input);

  assert.equal(output, '他低声说：“Mission complete.”\n\n真正的正文还在继续。');
});

test('默认净化会移除 window 变量形式的脚本残留', () => {
  const input = [
    '正文第一段。',
    'window.fkp =',
    '"d2luZG93Lm9ua2V5Zm9jdXM9b2JqLmZvY3VzOw0Kd2luZG93Lm9uYmx1cj1mdW5jdGlvbigpew0KcmV0dXJuIGZhbHNlOw0KfQ==";',
    '正文第二段。',
  ].join('\n');

  const output = cleanContent(input);

  assert.equal(output, '正文第一段。\n\n正文第二段。');
});

test('非法规则会被归一化为空规则，避免净化时报错', () => {
  const rules = normalizeContentCleanerRules('{bad json');

  const output = cleanContent('正文', rules);

  assert.equal(output, '正文');
});

test('默认净化会移除网址广告和发布页提示', () => {
  const input = [
    '这是第一段正文。',
    '请记住本书首发域名：www.example.com。',
    '最新网址：https://example.com/book/1.html',
    '手机用户请下载APP阅读，搜索公众号继续阅读。',
    '这是第二段正文。',
  ].join('\n');

  const output = cleanContent(input);

  assert.equal(output, '这是第一段正文。\n\n这是第二段正文。');
});

test('默认净化会移除书源站点推广和阅读模式提示', () => {
  const input = [
    '忘语提示您：看后求收藏（bl小说www.bldian.com），接着再看更方便。',
    '二愣子睁大着双眼，直直望着茅草和烂泥糊成的黑屋顶。',
    '更多内容加载中...请稍候...',
    '本站只支持手机浏览器访问，若您看到此段落，代表章节内容加载失败，请关闭浏览器的阅读模式、畅读模式、小说模式，以及关闭广告屏蔽功能，或复制网址到其他浏览器阅读！',
    '忘语提示您：看后求收藏（bl小说www.bldian.com），接着再看更方便。',
    '真正的正文第二段。',
  ].join('\n');

  const output = cleanContent(input);

  assert.equal(output, '二愣子睁大着双眼，直直望着茅草和烂泥糊成的黑屋顶。\n\n真正的正文第二段。');
});
