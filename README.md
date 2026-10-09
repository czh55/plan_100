# 退休后的一百件事（Plan 100）

从日常生活里产生的念头出发，持续梳理、记录「退休后想做的 100 件事」。

本仓库是一个纯静态站点，通过 **GitHub Pages** 发布。增质规则在**浏览器里执行**，权威状态仍写回 `data/items.json`。

## 本地预览

```bash
python3 -m http.server 8080
```

打开 `http://localhost:8080`。

## 静态站如何做「增质」而不是只增量

没有后端也能治理，靠三层：

| 层 | 放哪 | 做什么 |
|----|------|--------|
| 配置 | `meta.governance` | 活跃槽上限、TTL、休眠转归档天数 |
| 规则引擎 | `js/app.js` | 保存时校验、过期沉降、抽检 |
| 持久化 | 导出的 JSON + 少量 localStorage | JSON 是真相；质检日期可先记在本地 |

### 生命周期 `lane`

- `draft` 草稿：随便记，不占槽
- `active` 活跃：最多 `activeSlots`（默认 20）条，必须写出生证明
- `dormant` 休眠：过期沉降或质检降级
- `archived` 归档：休眠过久自动沉下去，默认不占注意力

### 出生证明（升活跃必填）

- `whyLose`：若丢掉它，我会失去什么
- `signal`：怎样才算它真的有价值（轨道 B）

### 新建税

新建时建议填 `mergeOf`（为何不能并入已有条目）。空着会二次确认。

### TTL 与沉降

- 活跃条目自 `renewed` 起 `ttlDays`（默认 90）天后过期
- 「执行过期沉降」：过期 → 休眠；休眠过久 → 归档
- 「续命」刷新 `renewed`

### 本周质检

随机抽最多 3 条活跃项做杀伤测试；结果写入条目与本地 `plan100.review.v1`。

## 数据字段

| 字段 | 含义 |
|------|------|
| `title` | 想做的事 |
| `category` | 分类 id |
| `status` | `idea` / `planned` / `doing` / `done`（执行进度） |
| `lane` | `draft` / `active` / `dormant` / `archived`（治理生命周期） |
| `whyLose` / `signal` | 出生证明 |
| `mergeOf` | 新建税说明 |
| `renewed` | TTL 起点 |
| `lastReviewed` | 最近质检日 |
| `note` / `source` / `added` | 备注、来源、收录日 |

调参：改 `data/items.json` 里 `meta.governance`。

## 建议用法

1. 念头先落 **草稿**
2. 写得出出生证明再升 **活跃**（槽满就先挤掉别的）
3. 每周点一次 **本周质检**
4. 过期就 **沉降** 或 **续命**
5. 「导出 JSON」覆盖 `data/items.json` 后提交

## GitHub Pages

站点：`https://czh55.github.io/plan_100/` 或自定义域下的 `/plan_100/`。  
Source：`main` + `/ (root)`。
