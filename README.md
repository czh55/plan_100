# 退休后的一百件事（Plan 100）

从日常生活里产生的念头出发，持续梳理、记录「退休后想做的 100 件事」。

本仓库是一个纯静态站点，通过 **GitHub Pages** 发布。

## 本地预览

任意静态服务器即可，例如：

```bash
python3 -m http.server 8080
```

浏览器打开 `http://localhost:8080`。

## 数据怎么记

- 权威数据：`data/items.json`
- 页面上「记下一条 / 编辑 / 删除」会先写入浏览器本地草稿（localStorage）
- 点「导出 JSON」，把下载的文件覆盖回 `data/items.json`，再 commit / push，站点即更新

字段说明：

| 字段 | 含义 |
|------|------|
| `title` | 想做的事 |
| `category` | 分类 id（见 JSON 内 `categories`） |
| `status` | `idea` / `planned` / `doing` / `done` |
| `note` | 备注 |
| `source` | 念头来源（日常、聊天、旅行…） |
| `added` | 收录日期 |

## 启用 GitHub Pages

1. 把本仓库推到 GitHub（仓库名建议与本地一致，如 `plan_100`）
2. 打开仓库 **Settings → Pages**
3. **Source** 选 `Deploy from a branch`
4. Branch 选 `main`，文件夹选 `/ (root)`
5. 保存后等待一两分钟，访问：

   `https://<你的用户名>.github.io/plan_100/`

若仓库名不是 `plan_100`，把 URL 里的路径换成实际仓库名即可。资源路径均为相对路径，无需额外配置 `baseurl`。

## 建议用法

1. 日常冒出念头 → 打开站点点「记下一条」
2. 攒一批后「导出 JSON」→ 写回仓库
3. 定期看分类分布与进度环，补短板、淘汰不真心的条目
