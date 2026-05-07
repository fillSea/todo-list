# 项目设计文档

## 1. 项目概述

本项目是一个基于微信小程序云开发的任务管理系统，支持个人任务、共享清单、分类标签、周期任务、通知提醒与协作邀请。

从配置上看，项目不是常规 Web 前后端分离应用，而是由两部分直接组成：

- 小程序前端：`miniprogram/`
- 腾讯云函数：`cloudfunctions/`

根目录 `README.md` 仍是云开发 quickstart 模板，不能代表当前真实业务结构。真实入口和运行方式以 `project.config.json`、`miniprogram/app.js`、`miniprogram/app.json` 和各云函数入口为准。

## 2. 技术栈与运行方式

### 2.1 技术栈

- 前端框架：微信小程序原生 Page/App 架构
- UI 组件：`@vant/weapp`
- 后端能力：微信云开发 + 云函数
- 数据存储：云开发数据库
- 文件存储：云存储，用于头像、小程序码等文件

### 2.2 开发运行方式

本项目主要依赖微信开发者工具运行与验证，不依赖命令行脚本。

已验证的配置事实：

- `project.config.json` 指定 `miniprogramRoot: "miniprogram/"`
- `project.config.json` 指定 `cloudfunctionRoot: "cloudfunctions/"`
- `project.config.json` 启用 `packNpmManually: true`
- 根 `package.json` 没有可用的构建、测试、lint 命令，`npm test` 只是失败占位脚本

因此实际开发流程通常是：

1. 在微信开发者工具中打开仓库。
2. 修改 `miniprogram/` 或 `cloudfunctions/` 源码。
3. 如有根 npm 依赖变更，在微信开发者工具中重新“构建 npm”。
4. 在开发者工具中预览页面、调试云函数与数据库交互。

### 2.3 云环境

小程序启动时在 `miniprogram/app.js` 中执行：

```js
wx.cloud.init({
  env: "cloud1-0g144inb6530ffb6",
  traceUser: true,
});
```

这意味着当前前端请求会固定落到该云环境。若出现“代码已改但数据不对”或“连到了错误后端”的现象，应先检查此环境 ID 是否与当前调试环境一致。

## 3. 目录与模块划分

### 3.1 根目录关键文件

- `project.config.json`：微信开发者工具项目配置，是真实运行入口配置
- `project.private.config.json`：本地私有开发配置
- `package.json`：仅包含 Vant 依赖与占位测试脚本
- `AGENTS.md`：为自动化代理准备的高信号仓库说明

### 3.2 小程序端目录

- `miniprogram/app.js`：应用启动、云环境初始化、登录态检查与用户信息同步
- `miniprogram/app.json`：页面注册、tabBar、全局组件注册
- `miniprogram/pages/`：业务页面
- `miniprogram/miniprogram_npm/`：微信开发者工具构建的 npm 产物，不是主要源码

### 3.3 云函数目录

- `cloudfunctions/taskFunctions/`：任务相关云函数
- `cloudfunctions/listFunctions/`：清单协作与邀请相关云函数
- `cloudfunctions/profileFunctions/`：用户、统计、通知相关云函数
- `cloudfunctions/categoryFunctions/`：分类相关云函数
- `cloudfunctions/quickstartFunctions/`：模板遗留代码，非当前主业务链路

## 4. 小程序端页面架构

### 4.1 页面注册

`miniprogram/app.json` 中注册的页面包含：

- `pages/index/index`
- `pages/calendar/calendar`
- `pages/checklist/checklist`
- `pages/profile/profile`
- `pages/register/register`
- `pages/task-detail/task-detail`
- `pages/list-detail/list-detail`
- `pages/task-edit/task-edit`
- `pages/list-members/list-members`
- `pages/operations/operations`
- `pages/list-edit/list-edit`
- `pages/list-invite/list-invite`
- `pages/list-invite-link/list-invite-link`
- `pages/list-invite-accept/list-invite-accept`
- `pages/list-invite-manage/list-invite-manage`
- `pages/profile/my-lists/my-lists`
- `pages/profile/categories/categories`
- `pages/profile/notifications/notifications`
- `pages/profile/notification-settings/notification-settings`
- `pages/profile/help/help`
- `pages/profile/about/about`
- `pages/periodic-stats/periodic-stats`

其中 tabBar 四个主入口页面是：

- 任务首页：`pages/index/index`
- 日历页：`pages/calendar/calendar`
- 清单页：`pages/checklist/checklist`
- 我的页：`pages/profile/profile`

### 4.2 应用启动与登录态

`miniprogram/app.js` 承担以下职责：

- 初始化 `wx.cloud`
- 从本地存储读取 `userInfo`、`isLoggedIn`、`loginTime`
- 判断登录是否超过 30 天
- 若已登录，调用 `profileFunctions.getUserInfo` 同步最新用户信息

当前登录态设计是“本地存储驱动 + 云端补同步”，而不是每次都依赖即时云鉴权回填页面状态。

### 4.3 任务首页 `pages/index/index`

该页负责：

- 加载分类列表
- 加载任务列表
- 按状态拆分任务
- 搜索任务
- 按分类过滤任务
- 对周期任务执行前端显示过滤

该页具有明显缓存策略：

- 分类缓存：`cachedCategories`
- 任务缓存：`cachedTasks`
- 任务缓存时间：`cachedTasksTime`

页面会先展示缓存，再异步刷新云端最新结果。这意味着：

- 后端字段变化时，除了云函数返回值，还要检查缓存读写逻辑
- 页面渲染问题不一定来自云端，可能来自旧缓存结构

### 4.4 日历页 `pages/calendar/calendar`

日历页围绕当前月范围加载任务，并且做了“按月缓存”：

- 缓存键：`calendarTasks_${year}_${month}`

它还会在月份边界前后额外扩展查询范围，以支持跨月日期显示，因此不要简单把它理解成“只查当月 1 号到月底”。

### 4.5 清单与协作页面

- `pages/checklist/checklist`：清单列表页
- `pages/list-detail/list-detail`：单个清单详情页
- `pages/list-members/list-members`：成员管理
- `pages/list-invite/*`：邀请、链接、审批、接受邀请等协作流程页面
- `pages/operations/operations`：操作记录页

这些页面大量依赖 `listFunctions`，并且多处保留 `DEBUG_MODE` / `MOCK_DATA` 分支用于假数据调试。修改真实协作流程时，不能只检查 mock 逻辑或只检查云函数逻辑。

### 4.6 我的页面与注册页

- `pages/profile/profile`：用户主页、统计数据、通知数量、看板
- `pages/register/register`：注册或更新用户资料

注册页会先将头像上传到云存储，再调用 `profileFunctions.registerOrUpdateUser` 保存用户信息；若网络失败，还会执行本地降级保存。因此“用户信息已显示但数据库无记录”在当前实现中是可能发生的，需要按该设计理解问题。

## 5. 云函数架构

### 5.1 统一入口模式

四个业务云函数均采用单入口 `exports.main` + `action` 分发模式。小程序端统一通过：

```js
wx.cloud.callFunction({
  name: 'xxxFunctions',
  data: {
    action: 'someAction',
    data: { ... }
  }
})
```

因此排查接口问题时，重点不是 REST 路由，而是：

- 调用的云函数名是否正确
- `action` 字段是否正确
- `data` 结构是否符合对应分支预期

### 5.2 `taskFunctions`

职责边界：

- 创建、更新、删除任务
- 获取任务详情、任务列表、分类任务、清单任务、状态任务
- 搜索任务
- 批量更新、批量删除
- 周期任务统计
- 提醒检查与定时清理

该云函数还支持 timer trigger：

- `cleanupExpiredPeriodicTasks`
- 默认提醒检查逻辑

定时触发分支不要求 openid，这与普通前端调用路径不同。

### 5.3 `listFunctions`

职责边界：

- 清单创建、更新、删除、查询
- 可用清单与我的清单查询
- 成员增删与角色更新
- 直接邀请成员
- 邀请链接、小程序码、微信邀请
- 接受邀请、申请加入、拒绝邀请
- 邀请提醒、取消邀请、审批申请
- 操作记录

该模块是协作能力的核心。

### 5.4 `profileFunctions`

职责边界：

- 获取/创建用户信息
- 注册或更新用户资料
- 统计数据与数据看板
- 通知列表、未读数、标记已读、删除通知
- 通知设置

此外，该函数还暴露测试数据入口：

- `insertTestData`
- `clearTestData`
- `insertNotificationTestData`

这些 action 在入口处被显式豁免 openid 校验，因此是高风险开发能力，不应误当成普通生产接口。

### 5.5 `categoryFunctions`

职责边界较单一：

- 获取分类列表
- 获取分类详情
- 创建分类
- 更新分类
- 删除分类

## 6. 数据模型与主要集合

从云函数源码可以直接验证当前核心集合包括：

- `users`
- `tasks`
- `lists`
- `list_members`
- `categories`
- `notifications`
- `operations`
- `list_invites`

### 6.1 `users`

主要存储：

- `openid`
- `nickname`
- `avatarUrl`
- `enableNotifications`
- `createdAt`
- `updatedAt`

它既承担登录后的本地资料同步来源，也被协作、通知、统计多处依赖。

### 6.2 `tasks`

已在 `taskFunctions.createTask` 中验证的关键字段：

- `title`
- `description`
- `dueDate`
- `priority`
- `status`
- `listId`
- `creatorId`
- `categoryId`
- `repeatType`
- `repeatValue`
- `reminderAt`
- `reminderSent`
- `attachments`
- `createdAt`
- `updatedAt`

其中：

- `status`：当前主要使用 `0` 未完成、`1` 已完成
- `repeatType`：`0` 不重复，`1` 每天，`2` 每周，`3` 每月

周期任务还会引入父子实例关系，例如 `parentTaskId`、实例标识等衍生字段，前后端过滤逻辑均依赖这些关系。

### 6.3 `lists`

列表数据主要存储：

- 清单名称、描述、颜色
- `creatorId`
- `isShared`
- `visibility`
- 创建与更新时间

### 6.4 `list_members`

成员关系数据用于表示用户与共享清单的关系，核心字段包括：

- `listId`
- `userId`
- `role`
- `joinType`
- `joinedAt`

角色值是整个协作权限体系的关键约定：

- `1`：创建者
- `2`：编辑者
- `3`：查看者

### 6.5 `categories`

分类以用户维度隔离，至少包含：

- `name`
- `color`
- `userId`
- `createdAt`
- `updatedAt`

### 6.6 `notifications`

通知集合承载：

- 任务提醒
- 截止提醒
- 清单共享通知
- 申请审批通知
- 邀请提醒等

代码中可见的通知类型至少包括：

- `list_shared`
- `join_request`
- `application_approved`
- `application_rejected`
- `invite_remind`
- 以及任务相关通知类型

### 6.7 `operations`

操作记录集合记录清单与任务的行为轨迹。`listFunctions.getOperations` 会把：

- 直接作用于清单的记录
- 作用于清单内任务的记录

一起返回给前端做操作流水展示。

### 6.8 `list_invites`

这是协作邀请流的核心集合，字段模式从代码可验证包括：

- `listId`
- `inviterId`
- `inviteeId`
- `inviteeInfo`
- `role`
- `inviteType`
- `inviteCode`
- `needApproval`
- `status`
- `expireAt`
- `createdAt`
- `updatedAt`

其中：

- `inviteType` 可见值有 `link`、`wechat`
- `status` 使用如下状态码：
  - `0` 待处理
  - `1` 已接受
  - `2` 已拒绝
  - `3` 已过期
  - `4` 待审批

## 7. 核心业务流程

### 7.1 登录与用户初始化流程

1. 小程序启动时读取本地 `userInfo`、`isLoggedIn`、`loginTime`。
2. 若登录未过期，则更新 `app.globalData`。
3. 再调用 `profileFunctions.getUserInfo` 获取云端最新资料。
4. 若云端用户不存在，`profileFunctions.getUserInfo` 会自动创建默认用户记录。

这意味着系统的“用户首次创建”不是发生在显式注册页，而可能在首次获取用户信息时被动创建。

### 7.2 任务加载与分类展示流程

以首页为例：

1. 先读取本地缓存分类与任务。
2. 立即渲染缓存结果。
3. 后台调用 `categoryFunctions.getCategories` 与 `taskFunctions.getTaskList`。
4. 前端按“进行中 / 已逾期 / 已完成”重新拆分。
5. 再基于当前分类筛选显示。

该流程的关键不在于单次查询，而在于“本地缓存 + 云端回刷 + 前端二次过滤”的组合。

### 7.3 周期任务流程

周期任务是本项目中最容易误改的设计之一。

后端设计：

- `taskFunctions.createTask` 在创建周期任务后会预生成未来实例
- 定时器会参与过期实例清理与提醒处理

前端设计：

- 首页、清单统计等不会直接把所有周期实例平铺展示
- 每个周期系列通常只展示“最近的一个未完成且未过期实例”
- 已过期实例与已完成实例仍会按各自区域展示

因此，对周期规则的任何修改，通常都要同时检查：

- 云函数生成逻辑
- 云函数统计逻辑
- 首页展示逻辑
- 清单统计逻辑
- 日历或详情页展示逻辑

### 7.4 截止时间与时区处理

任务创建/更新时，截止时间不是直接存原始字符串，而是按照 `+08:00` 本地时区解释后转为 `Date`：

```js
new Date(`${data.dueDate}T${data.dueTime}:00+08:00`)
```

这说明当前项目将任务日期语义固定在东八区。若后续修改日期比较、日历筛选、提醒时间计算，必须保持这一前提，否则容易出现：

- 日期跨天偏移
- 逾期判断错误
- 日历页任务落在错误日期

### 7.5 清单协作与邀请流程

协作能力有三类主要入口：

1. 直接加成员：`inviteMember`
2. 邀请链接：`generateInviteLink`
3. 微信邀请：`createWechatInvite`

它们并不完全等价。

#### 直接加成员

- 仅创建者可操作
- 直接写入 `list_members`
- 给目标用户发送 `list_shared` 通知
- 不经过 `list_invites`

#### 邀请链接

- 仅创建者可生成
- 在 `list_invites` 中生成 `inviteType: 'link'` 记录
- 可配置 `role`、`expireDays`、`needApproval`

#### 微信邀请

- 仅创建者可生成
- 在 `list_invites` 中生成 `inviteType: 'wechat'` 记录
- 当前实现默认 7 天过期
- 用于分享页与小程序码/路径跳转配合

### 7.6 邀请接受与申请审批流程

`list_invites` 的状态流转不是单一路径，而是分支式：

#### 无审批邀请

1. `status = 0` 待处理
2. 用户接受邀请
3. 写入 `list_members`
4. 邀请更新为 `status = 1`

#### 需要审批的邀请

1. `status = 0` 待处理
2. 用户点击接受
3. 邀请不会直接加成员，而是被更新为 `status = 4`
4. 给邀请人发送 `join_request` 通知
5. 创建者审批后：
   - 通过：写入 `list_members`，状态变 `1`
   - 拒绝：状态变 `2`

这意味着“接受邀请”在某些场景下的真实效果其实是“提交申请”，不是立即入组。

### 7.7 通知流程

通知主要来自以下场景：

- 直接邀请成员
- 申请加入共享清单
- 审批通过或拒绝
- 邀请提醒
- 任务提醒与截止提醒

我的页面会通过 `profileFunctions.getUnreadNotificationCount` 拉取未读数量，并把数量映射到“我的通知”菜单角标上。

## 8. 缓存、降级与调试设计

### 8.1 缓存设计

项目使用本地缓存提升页面首屏体验，但这也使得“页面问题”可能来自缓存陈旧而非实时接口。

当前已验证缓存键：

- `cachedCategories`
- `cachedTasks`
- `cachedTasksTime`
- `calendarTasks_${year}_${month}`

### 8.2 降级逻辑

注册页在网络失败时会先把资料存到本地；多个页面在云函数失败后也会保留本地已显示数据。这种设计提升了容错，但会引入“本地状态与云端状态不完全一致”的短期窗口。

### 8.3 DEBUG_MODE / MOCK_DATA

以下页面明确存在 `DEBUG_MODE` 或 `MOCK_DATA` 路径：

- `pages/checklist/checklist`
- `pages/list-detail/list-detail`
- `pages/list-invite-accept/list-invite-accept`
- 以及部分邀请管理相关页面

这些分支说明页面既支持假数据演示，也支持真实云函数调用。维护时需要确认修改是否影响两条路径。

## 9. 工程约束与维护注意事项

### 9.1 自动化能力较弱

当前仓库没有完善的命令行验证体系，因此变更质量主要依赖：

- 阅读代码确认调用链
- 在微信开发者工具中手工验证页面与云函数
- 保持前后端字段契约一致

### 9.2 模板遗留代码仍存在

根 README 和 `quickstartFunctions` 都属于模板遗留内容。维护时应优先信任业务源码，不要把模板结构误认为当前架构的一部分。

### 9.3 协作、周期与缓存是三大高风险区

从当前实现看，最容易引发连锁回归的区域有三类：

- 周期任务：前后端双重过滤与实例生成
- 协作邀请：`list_invites` 状态流转与审批分支
- 本地缓存：旧字段结构导致的页面渲染偏差

后续若继续演进，建议优先围绕这三部分补充更细的专项设计或测试策略。
