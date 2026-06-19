/**
 * 排行榜业务逻辑：榜单类型常量、分类（从 book_categories 表动态加载）、规范化、根据用户阅读数据自动构建榜单。
 *
 * 共有 6 类榜单：
 *  - popularity: 人气榜（按 readers/download_count 降序）
 *  - new:        新书榜（按最新章节时间降序）
 *  - review:     点评榜（按 review_count 降序）
 *  - chapter:    章节榜（按 chapter_count 降序）
 *  - complete:   完本榜（仅 is_complete=1，按 readers 降序）
 *  - wordcount:  字数榜（按 word_count 降序）
 */

import { query } from '../config/database';

export interface RankTypeMeta {
  code: string;
  label: string;
  metricLabel: string;
}

export const RANK_TYPES: RankTypeMeta[] = [
  { code: 'popularity', label: '人气榜', metricLabel: '人气' },
  { code: 'new', label: '新书榜', metricLabel: '时间' },
  { code: 'review', label: '点评榜', metricLabel: '评论' },
  { code: 'chapter', label: '章节榜', metricLabel: '章节' },
  { code: 'complete', label: '完本榜', metricLabel: '人气' },
  { code: 'wordcount', label: '字数榜', metricLabel: '字数(万)' },
];

// 分类列表从 book_categories 表动态加载（后台分类管理配置）
// 缓存 30 秒，避免每次查询都走 DB
let _cachedCategories: string[] = [];
let _cachedCategoriesAt: number = 0;
const CATEGORIES_CACHE_TTL_MS = 30000;

export async function getActiveCategories(forceRefresh = false): Promise<string[]> {
  const now = Date.now();
  if (!forceRefresh && _cachedCategories.length > 0 && (now - _cachedCategoriesAt) < CATEGORIES_CACHE_TTL_MS) {
    return _cachedCategories;
  }
  try {
    const rows = await query(
      `SELECT name FROM book_categories WHERE is_active = 1 ORDER BY sort_order ASC, id ASC`
    );
    const names = Array.isArray(rows) && rows.length > 0
      ? (rows as any[]).map((r) => String(r.name).trim()).filter((n) => n.length > 0)
      : [];
    // 始终包含"全部"作为第一个分类
    _cachedCategories = ['全部', ...names];
    _cachedCategoriesAt = now;
    return _cachedCategories;
  } catch (_e) {
    // DB 读取失败：至少返回"全部"兜底
    if (_cachedCategories.length === 0) {
      _cachedCategories = ['全部'];
    }
    return _cachedCategories;
  }
}

export function getCachedCategories(): string[] {
  return _cachedCategories.length > 0 ? _cachedCategories : ['全部'];
}

export function refreshCategoriesCache(): Promise<string[]> {
  return getActiveCategories(true);
}

export function isValidRankType(code: string | undefined | null): boolean {
  if (!code) return false;
  return RANK_TYPES.some((r) => r.code === code);
}

export function isValidCategory(name: string | undefined | null): boolean {
  if (!name) return false;
  // 优先走缓存（同步），避免每次都 async；缓存不存在时用默认"全部"兜底
  return getCachedCategories().includes(name);
}

export interface RankingRecord {
  name: string;
  author: string;
  cover_url: string;
  intro: string;
  book_url: string;
  rank_type: string;
  category: string;
  download_count: number;
  rating: number;
  review_count: number;
  chapter_count: number;
  word_count: number;
  is_complete: number;
  extra: string;
  sort_order: number;
  is_active: number;
}

/**
 * 规范化外部传入的榜单写入数据：trim 名称、限制取值范围、未知字段使用默认值。
 */
export function normalizeRankingInput(input: Partial<RankingRecord> & Record<string, any>): RankingRecord {
  const name = String(input.name ?? '').trim();
  if (!name) {
    throw new Error('书名不能为空');
  }
  const rank_type = isValidRankType(input.rank_type) ? input.rank_type! : 'popularity';
  const category = isValidCategory(input.category) ? input.category! : '全部';

  const clamp = (v: any, min: number, max: number, fallback: number): number => {
    const num = Number(v);
    if (!Number.isFinite(num)) return fallback;
    if (num < min) return min;
    if (num > max) return max;
    return num;
  };

  return {
    name,
    // 写入前清洗作者字段：去"作者："前缀、去脏数据
    author: normalizeAuthor(input.author) || String(input.author ?? '').trim(),
    cover_url: String(input.cover_url ?? '').trim(),
    intro: String(input.intro ?? '').trim(),
    book_url: String(input.book_url ?? '').trim(),
    rank_type,
    category,
    download_count: clamp(input.download_count, 0, 9_999_999_999, 0),
    rating: clamp(input.rating, 0, 5, 0),
    review_count: clamp(input.review_count, 0, 9_999_999_999, 0),
    chapter_count: clamp(input.chapter_count, 0, 9_999_999_999, 0),
    word_count: clamp(input.word_count, 0, 9_999_999_999, 0),
    is_complete: input.is_complete ? 1 : 0,
    extra: String(input.extra ?? '').trim(),
    sort_order: clamp(input.sort_order, 0, 99999, 0),
    is_active: input.is_active === 0 || (input.is_active as any) === false ? 0 : 1,
  };
}

// ============================================================
// 自动榜单：根据用户阅读情况构建
// ============================================================

export interface AutoRankingBookSeed {
  name: string;
  author?: string;
  coverUrl?: string;
  intro?: string;
  kind?: string;
  bookUrl?: string;
  readers: number;
  reviews?: number;
  chapterCount?: number;
  wordCount?: number; // 单位：万字
  isComplete?: number | boolean;
  latestChapterTime?: string;
}

export interface AutoRankingResult {
  popularity: RankingRecord[];
  new: RankingRecord[];
  review: RankingRecord[];
  chapter: RankingRecord[];
  complete: RankingRecord[];
  wordcount: RankingRecord[];
}

// ============================================================
// 自动分类识别：根据 kind / 书名 / 简介 / 关键词 推断书籍所属的后台分类
// ============================================================

/**
 * 常见分类的关键词/同义词映射。
 * 后台 book_categories 表里配置的分类名称（如"玄幻"、"都市"）是一级匹配项；
 * 这里列出的是"名称不够直接但内容暗示某分类"的关键词，用于 kind 为 NULL 或
 * 没直接含分类名时作为兜底匹配。
 * 规则：只要 book 文本（name/kind/intro 任一字段）里包含左侧任一关键词，
 *       就把它归类到右侧的分类名（需要与后台分类名称对应，否则最终仍会落到"全部"）。
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '都市': ['都市', '职场', '商战', '现实', '生活', '都市传说', '都市异能', '现代都市'],
  '言情': ['言情', '爱情', '恋爱', '青春', '校园', '甜宠', '现言', '古言', '纯爱', '霸总', '豪门'],
  '玄幻': ['玄幻', '异界', '异世', '魔法', '斗气', '斗气大陆', '召唤', '东方玄幻'],
  '奇幻': ['奇幻', '魔幻', '史诗', '西方奇幻', '剑与魔法', '巫师', '龙与'],
  '仙侠': ['仙侠', '修仙', '修真', '仙道', '仙途', '炼气', '筑基', '金丹', '元婴', '仙缘', '问道'],
  '武侠': ['武侠', '江湖', '武林', '门派', '剑客', '少侠', '江湖传'],
  '科幻': ['科幻', '未来', '星际', '太空', '机甲', '赛博', '末世', '末日', '星际文明', '银河'],
  '网游': ['网游', '游戏', '电竞', '竞技', '虚拟游戏', '网游之', '游戏竞技'],
  '历史': ['历史', '三国', '唐朝', '宋朝', '明朝', '大清', '穿越', '架空', '争霸', '秦汉', '唐宋', '历史军事'],
  '军事': ['军事', '战争', '军旅', '特种兵', '谍战', '抗战'],
  '悬疑': ['悬疑', '推理', '侦探', '恐怖', '惊悚', '灵异', '诡异', '鬼怪', '灵异事件'],
  '同人': ['同人', '衍生', '二创', '综漫', '影视同人', '小说同人'],
  '其他': [], // 空数组：仅当用户后台配置了"其他"分类时作为最终兜底
};

/**
 * 根据书源返回的 kind / 书名 / 简介，智能识别出最匹配的后台分类。
 * 匹配优先级（从高到低）：
 *   1. kind 里直接包含后台分类名称（最准确，书源明确标注）
 *   2. 书名里直接包含后台分类名称（"XX玄幻之..."）
 *   3. 根据关键词映射表匹配（kind / name / intro 任一字段命中）
 *   4. 简介里包含后台分类名称（最弱，用于兜底）
 *   5. 全部失败 → 返回 "全部"
 *
 * @param info.kind    书源返回的类型标签（如 "玄幻/奇幻/连载"）
 * @param info.name    书名
 * @param info.intro   简介
 */
export function autoDetectCategory(info: {
  kind?: string | null;
  name?: string | null;
  intro?: string | null;
}): string {
  const kind = String(info.kind ?? '').trim();
  const name = String(info.name ?? '').trim();
  const intro = String(info.intro ?? '').substring(0, 300); // 只看前 300 字，避免误匹配

  const cats = getCachedCategories(); // 来自后台 book_categories 表的配置

  // —— 1. kind 里直接包含分类名（最高优先级）
  if (kind) {
    for (const cat of cats) {
      if (cat === '全部') continue;
      if (kind.includes(cat)) return cat;
    }
  }

  // —— 2. 书名里直接包含分类名（例如《都市修仙录》）
  if (name) {
    for (const cat of cats) {
      if (cat === '全部') continue;
      if (name.includes(cat)) return cat;
    }
  }

  // —— 3. 关键词映射表（覆盖常见网文分类的同义词）
  //     先把"关键词 → 目标分类"铺平，遍历字段找第一个命中的、且后台确实存在的分类
  const haystack = [kind, name, intro].filter(Boolean).join(' ');
  if (haystack) {
    for (const targetCat of cats) {
      if (targetCat === '全部') continue;
      const kws = CATEGORY_KEYWORDS[targetCat] || [];
      for (const kw of kws) {
        if (kw && haystack.includes(kw)) return targetCat;
      }
    }
  }

  // —— 4. 简介里包含分类名称兜底（最弱）
  if (intro) {
    for (const cat of cats) {
      if (cat === '全部') continue;
      if (intro.includes(cat)) return cat;
    }
  }

  // —— 5. 全部失败：返回"全部"
  return '全部';
}

/** 兼容旧签名：pickCategory(kind) 等价于只传 kind 的简化调用 */
export function pickCategory(kind: string | undefined): string {
  return autoDetectCategory({ kind });
}

function toRecord(seed: AutoRankingBookSeed, type: string, idx: number): RankingRecord {
  return {
    name: seed.name,
    author: seed.author || '',
    cover_url: seed.coverUrl || '',
    intro: seed.intro || '',
    book_url: seed.bookUrl || '',
    rank_type: type,
    category: autoDetectCategory({ kind: seed.kind, name: seed.name, intro: seed.intro }),
    download_count: seed.readers,
    rating: 0,
    review_count: seed.reviews || 0,
    chapter_count: seed.chapterCount || 0,
    word_count: seed.wordCount || 0,
    is_complete: seed.isComplete ? 1 : 0,
    extra: seed.latestChapterTime || '',
    sort_order: idx + 1,
    is_active: 1,
  };
}

/**
 * 根据用户阅读数据生成 6 类榜单。每类最多取前 20 条。
 */
export function buildAutoRankingsFromBooks(
  seeds: AutoRankingBookSeed[],
  limitPerRank: number = 20
): AutoRankingResult {
  const safe = seeds.filter((s) => s && s.name);

  const sortBy = <T>(arr: T[], cmp: (a: T, b: T) => number) => [...arr].sort(cmp);

  const popularity = sortBy(safe, (a, b) => (b.readers || 0) - (a.readers || 0))
    .slice(0, limitPerRank)
    .map((s, i) => toRecord(s, 'popularity', i));

  const newest = sortBy(safe, (a, b) => {
    const ta = a.latestChapterTime ? new Date(a.latestChapterTime).getTime() : 0;
    const tb = b.latestChapterTime ? new Date(b.latestChapterTime).getTime() : 0;
    return tb - ta;
  })
    .slice(0, limitPerRank)
    .map((s, i) => toRecord(s, 'new', i));

  const review = sortBy(safe, (a, b) => (b.reviews || 0) - (a.reviews || 0))
    .slice(0, limitPerRank)
    .map((s, i) => toRecord(s, 'review', i));

  const chapter = sortBy(safe, (a, b) => (b.chapterCount || 0) - (a.chapterCount || 0))
    .slice(0, limitPerRank)
    .map((s, i) => toRecord(s, 'chapter', i));

  const complete = sortBy(
    safe.filter((s) => !!s.isComplete),
    (a, b) => (b.readers || 0) - (a.readers || 0)
  )
    .slice(0, limitPerRank)
    .map((s, i) => toRecord(s, 'complete', i));

  const wordcount = sortBy(safe, (a, b) => (b.wordCount || 0) - (a.wordCount || 0))
    .slice(0, limitPerRank)
    .map((s, i) => toRecord(s, 'wordcount', i));

  return { popularity, new: newest, review, chapter, complete, wordcount };
}

/**
 * 规范化作者字段，用于去重比较和写入数据库前的清洗。
 * 书源返回的 author 可能是 "忘语" / "作者：忘语" / "作者: 忘语" / "作者-忘语" 等。
 * 同时过滤掉明显的脏数据（如多段内容、超过正常长度、或者包含换行的章节标题）。
 */
export function normalizeAuthor(raw: string | undefined | null): string {
  if (!raw) return '';
  let s = String(raw).trim();
  if (!s) return '';

  // 1. 截断：正常作者名不会超过 32 个字符；超过的是脏数据（intro/chapters 被误写进来）
  if (s.length > 80) return '';

  // 2. 含有明显换行或制表符的，是其他字段内容泄漏
  if (/[\n\r\t]/.test(s)) return '';

  // 3. 去除各种"作者"前缀（半角/全角冒号、空格、短横线都兼容）
  //    "作者：忘语" / "作者:忘语" / "作者-忘语" / "作者 忘语"  → "忘语"
  //    "作者： 天蚕土豆" → "天蚕土豆"
  s = s.replace(/^作\s*者\s*[:：\-=\s]+/, '');
  //    也兼容英文冒号变体 "Author: 忘语"
  s = s.replace(/^author\s*[:：\-=\s]+/i, '');

  // 4. 去除尾部的冗余符号（比如 "忘语,"、"忘语。"）
  s = s.replace(/[，。,;；\s]+$/g, '');

  // 5. 统一小写、去空白
  s = s.trim();

  return s;
}

/**
 * 规范化书名，用于去重比较。
 * - 去除全角/半角书名号、空格
 * - 去除常见"（XXX）"、"(XXX)" 的副标题（仅作为去重比对用，不改原始数据）
 */
export function normalizeBookName(raw: string | undefined | null): string {
  if (!raw) return '';
  let s = String(raw).trim();
  if (!s) return '';
  s = s.replace(/[《》<>〈〉【】\[\]「」『』]/g, '')        // 去书名号
       .replace(/[（(].*?[）)]/g, '')                    // 去括号内的副标题/标注
       .replace(/[\s\u3000]+/g, '')                      // 去所有空白（含全角空格）
       .toLowerCase();
  return s;
}

/**
 * 对榜单书籍按"书名+作者"去重，保留排序最靠前的那一条。
 * 规范化：
 *  - 书名去书名号/括号/空白，统一小写
 *  - 作者去"作者："前缀、去空白，统一小写；明显脏数据（超长/换行）视为空
 *  - 若书名相同但一条作者为空一条非空，保留有作者的那条
 */
export function dedupeRankingItems<T extends { name?: string; author?: string; [key: string]: any }>(
  items: T[]
): T[] {
  if (!items || items.length === 0) return items;
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const n = normalizeBookName(item.name);
    if (!n) {
      // 没有书名的条目也保留（但不参与去重匹配），避免完全丢失数据
      result.push(item);
      continue;
    }
    const a = normalizeAuthor(item.author);
    // 书名一致即视为同一本书；作者一致时严格去重；当一条有作者一条无作者时，优先保留有作者的
    const keyWithAuthor = `${n}|${a}`;
    const keyByNameOnly = `__byname__|${n}`;
    if (seen.has(keyWithAuthor)) continue;
    if (a && seen.has(keyByNameOnly)) {
      // 当前这条有作者，而之前已有一条"同书名无作者"的条目
      // 替换掉那条无作者的（更信任带作者信息的）
      for (let i = result.length - 1; i >= 0; i--) {
        const rn = normalizeBookName(result[i].name);
        const ra = normalizeAuthor(result[i].author);
        if (rn === n && !ra) {
          result.splice(i, 1);
          break;
        }
      }
      seen.add(keyWithAuthor);
      seen.add(keyByNameOnly);
      result.push(item);
      continue;
    }
    if (!a) {
      // 当前条目无作者——如果已有同名的有作者条目，则跳过；否则以"仅书名"的方式占位
      if (seen.has(keyByNameOnly)) continue;
      // 检查是否已有"书名+作者"组合（如果之前有一本相同书名但有作者的，就跳过这本无作者的）
      let hasNamedDup = false;
      for (const existing of result) {
        if (normalizeBookName(existing.name) === n && normalizeAuthor(existing.author)) {
          hasNamedDup = true;
          break;
        }
      }
      if (hasNamedDup) continue;
      seen.add(keyByNameOnly);
      result.push(item);
      continue;
    }
    seen.add(keyWithAuthor);
    seen.add(keyByNameOnly);
    result.push(item);
  }
  return result;
}
