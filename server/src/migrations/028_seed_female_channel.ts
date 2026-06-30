import type mysql from 'mysql2/promise';

export const name = '028_seed_female_channel';

export async function up(db: mysql.Pool): Promise<void> {
  // 检查女生频道是否已存在
  const [rows] = await db.query('SELECT id FROM page_channels WHERE code = ? LIMIT 1', ['female']);
  if ((rows as any[]).length > 0) {
    console.log('[Migration 028] 女生频道已存在，跳过初始化');
    return;
  }

  // 插入女生频道
  await db.query(
    `INSERT INTO page_channels (code, name, path, compat_path, seo_title, seo_keywords, seo_description, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)`,
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

  // 默认区块
  const defaultSections: Array<[string, string, string, number]> = [
    ['editor_recommend', '编辑推荐', 'editor_pick', 1],
    ['hero_slider', '幻灯片', 'hero_slider', 2],
    ['chief_recommend', '主编推荐', 'feature_large', 3],
    ['ancient_romance', '古言', 'category_grid', 4],
    ['modern_romance', '现言', 'category_grid', 5],
    ['fantasy_romance', '幻情', 'category_grid', 6],
    ['xianxia', '仙侠', 'category_grid', 7],
    ['editor_force', '小编力荐', 'feature_large', 8],
    ['youth', '青春', 'category_grid', 9],
    ['game', '游戏', 'category_grid', 10],
    ['sci_fi', '科幻', 'category_grid', 11],
    ['mystery', '悬疑', 'category_grid', 12],
    ['rising_new', '晋级新书', 'feature_large', 13],
    ['new_debut', '新书首秀', 'feature_large', 14],
    ['latest_updates', '最新更新', 'update_list', 15],
    ['latest_added', '最新入库', 'update_list', 16],
    ['most_updated', '最多更新', 'update_list', 17],
  ];

  for (const [sectionCode, title, displayType, sortOrder] of defaultSections) {
    await db.query(
      `INSERT INTO page_sections (channel_code, section_code, title, display_type, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      ['female', sectionCode, title, displayType, sortOrder],
    );
  }

  // 为部分区块插入示例条目
  const [sectionRows] = await db.query(
    'SELECT id, section_code FROM page_sections WHERE channel_code = ?',
    ['female'],
  );

  const sampleItems: Record<string, Array<{ title: string; author: string; intro: string; link_url: string; sort_order: number }>> = {
    editor_recommend: [
      { title: '最佳女婿', author: '林羽江颜', intro: '搜猫阅读倾情推荐，热门女生频道精选作品。', link_url: '/book-detail?name=最佳女婿', sort_order: 1 },
      { title: '凰宫梦', author: '蓝九九', intro: '古言宫廷题材代表作品。', link_url: '/book-detail?name=凰宫梦', sort_order: 2 },
    ],
    hero_slider: [
      { title: '女生精选频道', author: '', intro: '古言、现言、幻情、仙侠等热门作品集中推荐。', link_url: '/girls', sort_order: 1 },
    ],
    chief_recommend: [
      { title: '穿越三代：让木叶再次伟大！', author: '腊肉豆角煲仔饭', intro: '频道主推作品，可在后台替换为真实女生频道书籍。', link_url: '/book-detail?name=穿越三代：让木叶再次伟大！', sort_order: 1 },
    ],
  };

  for (const section of sectionRows as any[]) {
    // 检查是否已有条目
    const [existing] = await db.query('SELECT id FROM page_section_items WHERE section_id = ? LIMIT 1', [section.id]);
    if ((existing as any[]).length > 0) continue;

    const items = sampleItems[section.section_code] || [
      {
        title: section.section_code.includes('latest') ? `${section.section_code} 示例书籍` : `${section.section_code} 推荐书籍`,
        author: '示例作者',
        intro: '后台可编辑书名、作者、简介、封面图和跳转链接。',
        link_url: '/girls',
        sort_order: 1,
      },
    ];

    for (const item of items) {
      await db.query(
        `INSERT INTO page_section_items
         (section_id, title, author, cover_url, intro, category, word_count, latest_chapter, link_url, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          section.id,
          item.title,
          item.author || '',
          '',
          item.intro || '',
          '',
          '',
          '',
          item.link_url || '/girls',
          item.sort_order || 1,
        ],
      );
    }
  }

  console.log('[Migration 028] 女生频道初始化完成');
}
