import { execute, query, queryOne, transaction } from '../config/database';

export interface ChannelPayload {
  name?: string;
  path?: string;
  compat_path?: string | null;
  seo_title?: string | null;
  seo_keywords?: string | null;
  seo_description?: string | null;
  is_active?: boolean | number;
  sort_order?: number;
}

export interface SectionPayload {
  section_code?: string;
  title?: string;
  display_type?: string;
  more_link?: string | null;
  sort_order?: number;
  is_active?: boolean | number;
}

export interface ItemPayload {
  title?: string;
  author?: string | null;
  cover_url?: string | null;
  intro?: string | null;
  category?: string | null;
  word_count?: string | null;
  latest_chapter?: string | null;
  link_url?: string | null;
  sort_order?: number;
  is_active?: boolean | number;
}

const defaultSections: Array<[string, string, string]> = [
  ['editor_recommend', '编辑推荐', 'editor_pick'],
  ['hero_slider', '幻灯片', 'hero_slider'],
  ['chief_recommend', '主编推荐', 'feature_large'],
  ['ancient_romance', '古言', 'category_grid'],
  ['modern_romance', '现言', 'category_grid'],
  ['fantasy_romance', '幻情', 'category_grid'],
  ['xianxia', '仙侠', 'category_grid'],
  ['editor_force', '小编力荐', 'feature_large'],
  ['youth', '青春', 'category_grid'],
  ['game', '游戏', 'category_grid'],
  ['sci_fi', '科幻', 'category_grid'],
  ['mystery', '悬疑', 'category_grid'],
  ['rising_new', '晋级新书', 'feature_large'],
  ['new_debut', '新书首秀', 'feature_large'],
  ['latest_updates', '最新更新', 'update_list'],
  ['latest_added', '最新入库', 'update_list'],
  ['most_updated', '最多更新', 'update_list'],
];

const sampleItems: Record<string, Array<Required<Pick<ItemPayload, 'title'>> & ItemPayload>> = {
  editor_recommend: [
    { title: '最佳女婿', author: '林羽江颜', intro: '搜猫阅读倾情推荐，热门女生频道精选作品。', link_url: '/book-detail?name=最佳女婿', sort_order: 1, is_active: 1 },
    { title: '凰宫梦', author: '蓝九九', intro: '古言宫廷题材代表作品。', link_url: '/book-detail?name=凰宫梦', sort_order: 2, is_active: 1 },
  ],
  hero_slider: [
    { title: '女生精选频道', author: '', cover_url: '', intro: '古言、现言、幻情、仙侠等热门作品集中推荐。', link_url: '/girls', sort_order: 1, is_active: 1 },
  ],
  chief_recommend: [
    { title: '穿越三代：让木叶再次伟大！', author: '腊肉豆角煲仔饭', intro: '频道主推作品，可在后台替换为真实女生频道书籍。', link_url: '/book-detail?name=穿越三代：让木叶再次伟大！', sort_order: 1, is_active: 1 },
  ],
};

function boolToTiny(value: boolean | number | undefined, fallback = 1) {
  if (value === undefined) return fallback;
  return value ? 1 : 0;
}

function sanitizeCode(code: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(code)) throw new Error('频道或区块编码不合法');
  return code;
}

async function buildChannel(code: string, activeOnly: boolean) {
  sanitizeCode(code);
  const channel = await queryOne(
    `SELECT * FROM page_channels WHERE code = ? ${activeOnly ? 'AND is_active = 1' : ''}`,
    [code],
  );
  if (!channel) return null;

  const sectionRows = await query(
    `SELECT * FROM page_sections WHERE channel_code = ? ${activeOnly ? 'AND is_active = 1' : ''} ORDER BY sort_order ASC, id ASC`,
    [code],
  );
  const sections = [] as any[];
  for (const section of sectionRows) {
    const items = await query(
      `SELECT * FROM page_section_items WHERE section_id = ? ${activeOnly ? 'AND is_active = 1' : ''} ORDER BY sort_order ASC, id ASC`,
      [section.id],
    );
    sections.push({ ...section, items });
  }
  return { ...channel, sections };
}

export async function getPublicChannel(code: string) {
  return buildChannel(code, true);
}

export async function getAdminChannel(code: string) {
  return buildChannel(code, false);
}

export async function seedChannel(code: string) {
  sanitizeCode(code);
  if (code !== 'female') throw new Error('当前仅支持初始化女生频道');

  await transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO page_channels (code, name, path, compat_path, seo_title, seo_keywords, seo_description, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [
        'female',
        '女生频道',
        '/girls',
        '/home/girls.html',
        '女生小说下载_免费女生小说_好看的女生小说',
        '女生小说,古言,现言,幻情,仙侠,免费小说',
        '搜猫阅读女生频道提供古言、现言、幻情、仙侠、青春、游戏、科幻、悬疑等热门小说推荐。',
      ],
    );

    for (let i = 0; i < defaultSections.length; i += 1) {
      const [sectionCode, title, displayType] = defaultSections[i];
      await conn.execute(
        `INSERT INTO page_sections (channel_code, section_code, title, display_type, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE title = VALUES(title), display_type = VALUES(display_type), sort_order = VALUES(sort_order)`,
        ['female', sectionCode, title, displayType, i + 1],
      );
    }
  });

  const sections = await query('SELECT id, section_code FROM page_sections WHERE channel_code = ?', ['female']);
  for (const section of sections as any[]) {
    const existing = await queryOne('SELECT id FROM page_section_items WHERE section_id = ? LIMIT 1', [section.id]);
    if (existing) continue;
    const items = sampleItems[section.section_code] || [
      {
        title: section.section_code.includes('latest') ? `${section.section_code} 示例书籍` : `${section.section_code} 推荐书籍`,
        author: '示例作者',
        intro: '后台可编辑书名、作者、简介、封面图和跳转链接。',
        link_url: '/girls',
        sort_order: 1,
        is_active: 1,
      },
    ];
    for (const item of items) {
      await execute(
        `INSERT INTO page_section_items
         (section_id, title, author, cover_url, intro, category, word_count, latest_chapter, link_url, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          section.id,
          item.title,
          item.author || '',
          item.cover_url || '',
          item.intro || '',
          item.category || '',
          item.word_count || '',
          item.latest_chapter || '',
          item.link_url || '/girls',
          item.sort_order || 0,
          boolToTiny(item.is_active, 1),
        ],
      );
    }
  }
  return getAdminChannel(code);
}

export async function updateChannel(code: string, payload: ChannelPayload) {
  sanitizeCode(code);
  await execute(
    `UPDATE page_channels
     SET name = ?, path = ?, compat_path = ?, seo_title = ?, seo_keywords = ?, seo_description = ?, is_active = ?, sort_order = ?, updated_at = NOW()
     WHERE code = ?`,
    [
      payload.name || '女生频道',
      payload.path || '/girls',
      payload.compat_path || null,
      payload.seo_title || null,
      payload.seo_keywords || null,
      payload.seo_description || null,
      boolToTiny(payload.is_active, 1),
      Number(payload.sort_order || 0),
      code,
    ],
  );
  return getAdminChannel(code);
}

export async function createSection(code: string, payload: SectionPayload) {
  sanitizeCode(code);
  const sectionCode = sanitizeCode(payload.section_code || `section_${Date.now()}`);
  const result = await execute(
    `INSERT INTO page_sections (channel_code, section_code, title, display_type, more_link, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      code,
      sectionCode,
      payload.title || '新区块',
      payload.display_type || 'category_grid',
      payload.more_link || null,
      Number(payload.sort_order || 0),
      boolToTiny(payload.is_active, 1),
    ],
  );
  return queryOne('SELECT * FROM page_sections WHERE id = ?', [result.insertId]);
}

export async function updateSection(id: number, payload: SectionPayload) {
  await execute(
    `UPDATE page_sections
     SET title = ?, display_type = ?, more_link = ?, sort_order = ?, is_active = ?, updated_at = NOW()
     WHERE id = ?`,
    [
      payload.title || '区块',
      payload.display_type || 'category_grid',
      payload.more_link || null,
      Number(payload.sort_order || 0),
      boolToTiny(payload.is_active, 1),
      id,
    ],
  );
  return queryOne('SELECT * FROM page_sections WHERE id = ?', [id]);
}

export async function deleteSection(id: number) {
  await execute('DELETE FROM page_sections WHERE id = ?', [id]);
  return { id };
}

export async function createItem(sectionId: number, payload: ItemPayload) {
  const result = await execute(
    `INSERT INTO page_section_items
     (section_id, title, author, cover_url, intro, category, word_count, latest_chapter, link_url, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sectionId,
      payload.title ?? '新条目',
      payload.author ?? '',
      payload.cover_url ?? '',
      payload.intro ?? '',
      payload.category ?? '',
      payload.word_count ?? '',
      payload.latest_chapter ?? '',
      payload.link_url ?? '',
      Number(payload.sort_order || 0),
      boolToTiny(payload.is_active, 1),
    ],
  );
  return queryOne('SELECT * FROM page_section_items WHERE id = ?', [result.insertId]);
}

export async function updateItem(id: number, payload: ItemPayload) {
  await execute(
    `UPDATE page_section_items
     SET title = ?, author = ?, cover_url = ?, intro = ?, category = ?, word_count = ?, latest_chapter = ?, link_url = ?, sort_order = ?, is_active = ?, updated_at = NOW()
     WHERE id = ?`,
    [
      payload.title ?? '',
      payload.author ?? '',
      payload.cover_url ?? '',
      payload.intro ?? '',
      payload.category ?? '',
      payload.word_count ?? '',
      payload.latest_chapter ?? '',
      payload.link_url ?? '',
      Number(payload.sort_order || 0),
      boolToTiny(payload.is_active, 1),
      id,
    ],
  );
  return queryOne('SELECT * FROM page_section_items WHERE id = ?', [id]);
}

export async function deleteItem(id: number) {
  await execute('DELETE FROM page_section_items WHERE id = ?', [id]);
  return { id };
}
