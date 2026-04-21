---
tags:
  - xiang-river
  - collaboration
  - tech
  - leaf
---

# 前后端双 Subagent 协作模板

## 关系

- 上级 hub：[[00-协作与汇报总览]]
- 前置：[[23-分工版IA总图]]、[[24-UI接口清单]]、[[25-三个节点游戏接入规范]]
- 同层相关：[[26-UI资源需求表]]
- 技术落点：[[../03-技术实现/00-技术实现总览]]

## 文档用途

这份文档用于需要并行推进的开发任务，帮助项目负责人快速判断：

- 什么时候适合把任务拆成前端和后端两个 subagent
- 两边各自应该拥有哪些文件和职责边界
- 如何给两个 subagent 写 prompt
- 最后应当如何由主线程统一收口和验收

它不是“所有任务都适用”的万能模板，而是一份在接口边界清楚、前后端可并行时使用的执行模板。

## 一、什么时候适合这样拆

适合按前后端拆分的情况：

- 前端可以基于已有接口合同继续推进
- 后端可以在不改 UI 结构的前提下独立实现
- 两边改动文件基本不重叠
- 主线程有人负责最后联调、验收和补缝

不适合按前后端拆分的情况：

- 功能高度集中在一个文件或一个模块
- 接口 shape 还在频繁变化
- 前后端其实在共同设计同一套状态结构
- 协调成本已经高过直接实现成本

## 二、正式派工前要先冻结什么

在真正启动两个 subagent 之前，协调者至少要先明确以下 5 件事：

1. 这次任务最终要交付什么，用一段话写清楚
2. 前端和后端各自允许改哪些文件
3. 这次迭代里共享 contract 以什么为准
4. 哪些问题允许 worker 自己决定，哪些必须回报主线程
5. 最后由谁来跑测试、构建和联调

如果这 5 件事里有 2 件以上还说不清，说明现在还不适合直接并行拆。

## 三、三方职责边界

### 前端 Worker

前端 worker 通常负责：

- `src/**`
- 与任务直接相关的前端测试
- 与任务直接相关的样式文件

前端 worker 应当默认：

- 接口 shape 在本轮是固定的
- 优先补行为测试和状态测试，再改实现
- 不顺手重构与本任务无关的 UI 或状态逻辑

前端 worker 不应当：

- 修改后端路由、payload builder、接口文档
- 私自重新定义接口字段
- 回滚后端 worker 的并行改动

### 后端 Worker

后端 worker 通常负责：

- `server/**`
- `api/**`
- 明确指派给它的接口文档
- 对应的后端测试

后端 worker 应当默认：

- 除非本轮任务明确要求，否则 contract 不主动改
- 只要服务端返回变了，文档也要同步
- 改路由行为前先补测试

后端 worker 不应当：

- 修改前端页面与交互测试
- 在不通知主线程的情况下改掉前端依赖字段
- 回滚前端 worker 的并行改动

### 主线程 Coordinator

主线程负责人负责：

- 明确任务目标
- 冻结本轮 contract
- 审核两个 worker 的边界是否越界
- 决定冲突由谁改、在哪一侧改
- 统一跑最终验证

一句话说，worker 负责并行推进，coordinator 负责最终收口。

## 四、推荐 Prompt 骨架

### 给前端 Worker 的 Prompt

```md
你是 <workspace> 的前端 worker。
你不是代码库里唯一的改动者，另一个 worker 可能同时在改后端文件。
不要回滚别人的改动，如有并行变化，请在现状上继续适配。

Ownership：只允许修改 <前端文件列表>

Goal：<前端目标>

Context：
- 本轮后端 contract 已冻结为：<一句话合同摘要>
- 本轮前端风险点：<风险列表>

Your task：
1. 阅读你拥有的前端文件
2. 对行为改动使用 TDD
3. 只实现最小必要改动
4. 跑你改动相关的前端测试

Constraints：
- 不修改后端文件和接口文档
- 不做无关重构
- 不提交 commit

Return format：
- Status: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
- Summary of changes
- Tests run and results
- Files changed
```

### 给后端 Worker 的 Prompt

```md
你是 <workspace> 的后端 worker。
你不是代码库里唯一的改动者，另一个 worker 可能同时在改前端文件。
不要回滚别人的改动，如有并行变化，请在现状上继续适配。

Ownership：只允许修改 <后端文件列表>

Goal：<后端目标>

Context：
- 本轮 contract/source of truth：<一句话合同摘要>
- 本轮后端风险点：<风险列表>

Your task：
1. 阅读你拥有的后端文件
2. 对路由或 payload 行为改动使用 TDD
3. 只实现最小必要改动
4. 跑你改动相关的后端测试

Constraints：
- 不修改前端文件
- 除非明确要求，否则不主动改 contract
- 不提交 commit

Return format：
- Status: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
- Summary of changes
- Tests run and results
- Files changed
```

## 五、主线程收口顺序

两个 worker 回来后，主线程建议按这个顺序检查：

1. 两边是否都守住了自己的 ownership
2. 有没有人悄悄改了共享 contract
3. 新增测试是否真的覆盖到了目标行为
4. 是否还有残余耦合需要手动补缝

如果发现 contract 冲突，不要同时改两边。应先决定：

- 这轮到底以代码为准，还是以文档为准
- 冲突应该在前端修，还是在后端修
- 修完后重新跑哪一组验证

## 六、统一验收清单

建议总是按“小验证 -> 大验证”的顺序来：

1. 跑前端 focused tests
2. 跑后端 focused tests
3. 跑全量测试
4. 跑 production build
5. 如有必要，补一轮人工 smoke check

最后要记录下来的是：

- 实际跑了哪些命令
- 每条命令是通过还是失败
- 还有哪些残余风险没有被自动化覆盖

## 七、适用于本项目的边界示例

这次项目实践里，比较稳的拆法是：

前端 worker：

- `src/App.tsx`
- `src/App.test.tsx`
- `src/styles/tokens.scss`
- `src/features/guidance/**`

后端 worker：

- `server/app.js`
- `server/gameApi.js`
- `server/app.test.js`
- `api/**`
- `docs/game-line-apis.md`

主线程：

- 冻结三条节点游戏接口 contract
- 审核两个 worker 的输出
- 统一跑 `npm test`
- 统一跑 `npm run build`

## 八、实践里最有用的三个经验

- 如果 worker 卡住，不要重复发同一版 prompt，而要继续缩小任务面
- 如果只剩一个明确红灯，不要继续并行，主线程直接补完更快
- 如果 worker 询问“只修文档还是顺手改行为”，默认先选保守范围，除非这轮目标本来就包含行为变更

## 一句话总结

双 subagent 协作的关键不在于“同时开两个人”，而在于：
先冻结边界，再并行推进，最后由主线程统一收口。
