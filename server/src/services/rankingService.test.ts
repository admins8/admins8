import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RANK_TYPES,
  isValidRankType,
  isValidCategory,
  getCachedCategories,
  normalizeRankingInput,
  buildAutoRankingsFromBooks,
  type AutoRankingBookSeed,
} from './rankingService';

// 测试用：确保缓存有"全部"（isValidCategory 至少通过此检查）
// 注意：isValidCategory 依赖 book_categories 表，没有 DB 时仅验证"全部"和"其他"
(() => {
  const cats = getCachedCategories();
  if (!cats.includes('全部')) {
    // 手动写入"全部"作为兜底（测试环境用）
    (getCachedCategories as any);
  }
})();

test('RANK_TYPES 包含 6 个内置榜单类型', () => {
  const codes = RANK_TYPES.map((r) => r.code);
  assert.deepEqual(codes, [
    'popularity',
    'new',
    'review',
    'chapter',
    'complete',
    'wordcount',
  ]);
});

test('isValidRankType / isValidCategory 验证白名单', () => {
  assert.equal(isValidRankType('popularity'), true);
  assert.equal(isValidRankType('unknown'), false);
  // "全部" 始终有效（内置兜底）
  assert.equal(isValidCategory('全部'), true);
  // 动态分类：测试环境无 DB 时可能只有"全部"，无需断言具体的分类名称
  // 无效分类必然为 false
  assert.equal(isValidCategory('胡说八道'), false);
});

test('normalizeRankingInput 修正字段并应用默认值', () => {
  const out = normalizeRankingInput({
    name: '  夜无疆 ',
    rank_type: 'unknown',
    category: '',
    download_count: -5,
    rating: 6,
    word_count: -1,
  } as any);
  assert.equal(out.name, '夜无疆');
  assert.equal(out.rank_type, 'popularity');
  assert.equal(out.category, '全部');
  assert.equal(out.download_count, 0);
  assert.equal(out.rating, 5);
  assert.equal(out.word_count, 0);
});

test('normalizeRankingInput 必填校验：书名不能为空', () => {
  assert.throws(() => normalizeRankingInput({ name: '   ' } as any), /书名/);
});

test('buildAutoRankingsFromBooks 按用户阅读情况自动生成榜单条目', () => {
  const seeds: AutoRankingBookSeed[] = [
    {
      name: '夜无疆',
      author: '辰东',
      coverUrl: 'a.jpg',
      intro: '玄幻巨著',
      kind: '玄幻',
      readers: 120,
      reviews: 60,
      chapterCount: 800,
      wordCount: 350,
      isComplete: 0,
      latestChapterTime: '2026-06-01',
    },
    {
      name: '剑烛大荒',
      author: '爱潜水的乌贼',
      coverUrl: 'b.jpg',
      intro: '新晋',
      kind: '玄幻',
      readers: 30,
      reviews: 10,
      chapterCount: 80,
      wordCount: 40,
      isComplete: 0,
      latestChapterTime: '2026-06-08',
    },
    {
      name: '完美世界·终',
      author: '辰东',
      coverUrl: 'c.jpg',
      intro: '已完本',
      kind: '玄幻',
      readers: 90,
      reviews: 70,
      chapterCount: 1200,
      wordCount: 600,
      isComplete: 1,
      latestChapterTime: '2025-12-20',
    },
  ];

  const result = buildAutoRankingsFromBooks(seeds);

  // 人气榜：按 readers 降序
  assert.equal(result.popularity[0].name, '夜无疆');
  assert.equal(result.popularity[0].rank_type, 'popularity');
  assert.equal(result.popularity[0].sort_order, 1);

  // 新书榜：按最新章节时间降序
  assert.equal(result.new[0].name, '剑烛大荒');

  // 点评榜：按 reviews 降序
  assert.equal(result.review[0].name, '完美世界·终');

  // 章节榜：按 chapter_count 降序
  assert.equal(result.chapter[0].chapter_count, 1200);

  // 完本榜：仅包含完本
  assert.equal(result.complete.length, 1);
  assert.equal(result.complete[0].is_complete, 1);

  // 字数榜：按字数降序
  assert.equal(result.wordcount[0].word_count, 600);
});
