# 自动生成单个书源设计

## 目标

在书源管理中增加“生成书源”能力。管理员输入一个小说站首页 URL 和测试关键词，系统尝试生成一份可导入的单个书源 JSON，并提供复制 JSON 和一键导入功能。

第一版聚焦传统静态小说站，不承诺一次性兼容所有站点。遇到搜索接口隐藏、验证码、Cloudflare、JS 解密、登录、复杂分页时，生成器应给出草稿和提示，而不是生成错误规则。

## 范围

第一版包含：

- 输入首页 URL、书源名称、测试关键词。
- 后端生成基础书源 JSON。
- 自动探测常见搜索地址候选。
- 尝试从搜索结果页推断 `ruleSearch` 的基础字段。
- 生成 `bookSourceName`、`bookSourceUrl`、`searchUrl`、`ruleSearch`、`ruleBookInfo`、`ruleToc`、`ruleContent` 等字段。
- 前端展示生成的 JSON。
- 支持复制 JSON。
- 支持一键导入生成结果。

第一版不包含：

- 批量生成书源集合。
- 自动发布成类似 `/yuedu/shuyuans/json/id/xxx.json` 的集合链接。
- 完整模拟阅读 App 的高级 JS、Cookie、登录、WebView、验证码、加密正文。
- 保证任意网站都能自动生成可用规则。

## 后端设计

新增一个书源生成接口，建议路径为 `POST /api/sources/generate`。请求参数：

- `url`：必填，网站首页。
- `name`：可选，书源名称；为空时从网页标题或域名推断。
- `keyword`：可选，默认 `诡秘之主`。

后端流程：

1. 复用现有 URL 安全检查，拒绝内网地址和危险协议。
2. 请求首页并解析标题。
3. 构造搜索 URL 候选，例如 `/search?keyword={{key}}`、`/search.php?searchkey={{key}}`、`/modules/article/search.php?searchkey={{key}}`。
4. 用测试关键词请求候选地址。
5. 从返回的 HTML 中寻找疑似书籍列表：
   - 优先选择包含多个详情页链接的列表项。
   - 选择器优先使用简单 CSS：`li`、`.book-list li`、`.result li`、`tbody tr` 等。
6. 推断搜索字段：
   - `name`：优先链接文本、标题标签。
   - `bookUrl`：优先列表项里的详情页链接。
   - `author`：从包含“作者”的文本或常见 class 推断，无法推断则留空。
   - `intro`、`coverUrl`、`lastChapter` 能推断则填，不能则留空。
7. 访问第一条详情页，尝试推断目录和正文基础规则。
8. 返回生成结果和诊断信息。

返回格式：

```json
{
  "code": 0,
  "data": {
    "source": {},
    "jsonText": "{}",
    "diagnostics": []
  }
}
```

## 前端设计

在书源管理页增加“生成书源”按钮，打开弹窗。

弹窗内容：

- 网站首页 URL。
- 书源名称。
- 测试关键词。
- “生成”按钮。
- JSON 预览区域。
- “复制 JSON”按钮。
- “一键导入”按钮。

生成后：

- 如果后端返回诊断信息，在弹窗中展示。
- 如果生成了 `source` 对象，允许复制和一键导入。
- 一键导入复用现有 `sourceApi.addSource` 或导入接口，不新增数据库格式。

## 错误处理

- URL 不合法：提示“请输入有效 http/https 地址”。
- 站点无法访问：提示网络或状态码。
- 未找到搜索结果：返回基础模板，并提示需要手动补充 `searchUrl` 和 `ruleSearch`。
- 成功生成但部分字段为空：允许导入，但诊断提示“部分规则需要手动调整”。

## 验证

实现后需要验证：

- 输入 `http://www.xqishuta.org/` 能生成单个书源 JSON。
- 生成 JSON 可以复制。
- 一键导入能写入书源列表。
- 普通 YCK 单个书源和书源集合导入仍可用。
- `rsss` 和 `legado.aoaostar.com/sources/` 仍被拦截。
