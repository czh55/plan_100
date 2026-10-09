# 退休后的一百件事（Plan 100）

从日常生活里产生的念头出发，持续梳理、记录「退休后想做的 100 件事」，并沉淀可复用的 Pipelines。

**山顶（最终想达到的生活状态）**：我有信心能够处理好生活中的各种事情。

本仓库是一个纯静态站点，通过 **GitHub Pages** 发布。增质规则在**浏览器里执行**，权威状态仍写回 JSON。

## 三层原则

定义在 `data/charter.json`，两页首页都会展示。

| 层 | 含义 |
|----|------|
| **底层原则** | 当前状态不开心遇到了新的问题，就一定有新的pipeline需要总结。 |
| **山底原则** | 每条 pipeline 自己的可执行原则（写在该条的 principles / playbook 里）。 |
| **山顶原则** | 我有信心能够处理好生活中的各种事情。 |

关系：不开心 + 新问题 → 触发底层 → 总结/并入一条山底 pipeline → 长期服务于山顶状态。

两类内容：

| 内容 | 数据 | 页面 |
|------|------|------|
| 项目宪章 | `data/charter.json` | 各页原则条 |
| 退休后的一百件事 | `data/items.json` | `index.html` |
| 可复用 Pipelines | `data/pipelines.json` + `pipelines/*.md` | `pipelines.html` |

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

## Pipelines

登记：`data/pipelines.json`（活跃槽默认 8，规则同增质治理）。  
说明：`pipelines/<id>.md`。

当前活跃：

1. **数据分析型汇报材料组织**（`data-report-org`）
   - 通俗但不删数据
   - 没有新定义词汇，写给第一次阅读的人
   - 顺着读者的疑问组织结构，而不是按照资料本身的结构
   - 说明：[pipelines/data-report-org.md](pipelines/data-report-org.md)

2. **如何减少对工作的消极态度**（`work-attitude`）
   - 中性的事情调整心态：不要把自己的事情和工作的事情对立，他们的工作内容不同，但是对人训练的能力是共通的。比如果汇报能力就是沟通能力，团队能力就是就是你出去玩的组织能力
   - 恶性的事情调整心态：不要下意识恶化别人和事情，所谓的妖魔化。否则很容易沉溺在消极的情绪中，让本身不一定坏的事情变成必然的坏
   - 说明：[pipelines/work-attitude.md](pipelines/work-attitude.md)

新 pipeline：先写原则 + 出生证明，再占活跃槽；能并入旧的就不要新建。

## GitHub Pages

站点：`https://czh55.github.io/plan_100/` 或自定义域下的 `/plan_100/`。  
Source：`main` + `/ (root)`。
