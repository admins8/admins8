// 直接运行以刷新排行榜数据（绕开 HTTP 鉴权）
// 用法：node dist/scripts/refreshRankingsDirect.js  （先 tsc 编译后放到 dist/scripts/，或直接复制到 dist）
require('../controllers/homeController')
  .refreshRankingsFromUserData(
    {},
    {
      json(payload) {
        console.log('RESPONSE:', JSON.stringify(payload, null, 2));
        process.exit(payload.code === 0 ? 0 : 1);
      },
    }
  )
  .catch((e) => {
    console.error('ERROR:', e);
    process.exit(1);
  });
