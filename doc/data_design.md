# 简易协同待办清单小程序 - 数据库设计

## 1. 数据库结构概览

当前系统使用单表混存的任务模型：个人独立任务、个人清单任务、共享清单任务都存放在 `tasks` 集合中，再通过 `ownershipType`、`listId`、`creatorId` 与清单权限共同区分。

| 集合名称 | 描述 | 主要功能 |
| --- | --- | --- |
| users | 用户信息 | 存储用户基本信息 |
| tasks | 任务信息 | 存储个人独立任务和清单任务 |
| lists | 清单信息 | 存储个人清单和共享清单 |
| categories | 分类标签 | 存储用户自定义分类标签 |
| list_members | 清单成员 | 存储共享清单成员关系及角色 |
| list_invites | 清单邀请记录 | 存储清单邀请、申请与审批状态 |
| operations | 操作记录 | 存储任务和清单的操作历史 |
| notifications | 通知信息 | 存储系统通知和任务提醒 |

## 2. 集合详细设计

### 2.1 users 集合

| 字段名 | 数据类型 | 描述 | 索引 |
| --- | --- | --- | --- |
| `_id` | String | 用户唯一标识（默认） | 主键 |
| `openid` | String | 微信用户 openid | 唯一索引 |
| `nickname` | String | 用户昵称 | 普通索引 |
| `avatarUrl` | String | 用户头像 | 无 |
| `enableNotifications` | Boolean | 是否接收通知 | 无 |
| `createdAt` | Timestamp | 创建时间 | 无 |
| `updatedAt` | Timestamp | 更新时间 | 无 |

### 2.2 categories 集合

| 字段名 | 数据类型 | 描述 | 索引 |
| --- | --- | --- | --- |
| `_id` | String | 分类唯一标识（默认） | 主键 |
| `name` | String | 分类名称 | 普通索引 |
| `color` | String | 分类颜色（十六进制） | 无 |
| `userId` | String | 创建者 ID | 普通索引 |
| `createdAt` | Timestamp | 创建时间 | 无 |
| `updatedAt` | Timestamp | 更新时间 | 无 |

说明：当前实现未稳定使用 `sortOrder` 字段，不应将其视为现行主路径字段。

### 2.3 tasks 集合

| 字段名 | 数据类型 | 描述 | 索引 |
| --- | --- | --- | --- |
| `_id` | String | 任务唯一标识（默认） | 主键 |
| `title` | String | 任务标题 | 普通索引 |
| `description` | String | 任务描述 | 无 |
| `ownershipType` | Number | 任务归属类型，`1=个人独立任务`，`2=清单任务` | 普通索引 |
| `listId` | String | 所属清单 ID；`ownershipType=1` 时为空字符串，`ownershipType=2` 时必填 | 普通索引 |
| `creatorId` | String | 创建者 ID | 普通索引 |
| `categoryId` | String | 分类 ID，关联 `categories` 集合 | 普通索引 |
| `dueDate` | Timestamp | 截止时间，按 UTC 时间存储，业务比较以 `Asia/Shanghai` 为准 | 普通索引 |
| `priority` | Number | 优先级：`1=不重要不紧急`，`2=紧急不重要`，`3=重要不紧急`，`4=重要且紧急` | 普通索引 |
| `status` | Number | 持久状态：`0=待办`，`1=已完成` | 普通索引 |
| `repeatType` | Number | 重复类型：`0=不重复`，`1=每天`，`2=每周`，`3=每月` | 普通索引 |
| `repeatValue` | String | 重复值；周重复使用 `1-7` 表示周一到周日，月重复使用 `1-31` 表示每月日期，多个值逗号分隔 | 普通索引 |
| `repeatStartDate` | Timestamp \| null | 周期规则起始日期；建议与模板任务的首个 `dueDate` 语义保持一致 | 普通索引 |
| `repeatEndDate` | Timestamp \| null | 周期规则结束日期；为空表示未设置结束时间 | 普通索引 |
| `parentTaskId` | String \| null | 周期系列父任务 ID；非周期实例为空 | 普通索引 |
| `isPeriodicInstance` | Boolean | 是否为预生成的周期实例 | 普通索引 |
| `reminderAt` | Timestamp \| null | 提醒时间 | 普通索引 |
| `reminderSent` | Boolean | 提醒是否已发送 | 普通索引 |
| `attachments` | Array | 附件列表，每项包含 `{fileId, name, size, type}`，最多 9 个 | 无 |
| `completedAt` | Timestamp \| null | 任务完成时间，当前实现未稳定写入，作为后续统计预留 | 无 |
| `createdAt` | Timestamp | 创建时间 | 无 |
| `updatedAt` | Timestamp | 更新时间 | 无 |

说明：

1. 当前真实系统允许个人任务不挂清单，使用 `listId: ''` 表达。
2. 逾期不是稳定入库字段，`isOverdue` 应视为派生展示态，不写入数据库。
3. 当前前端没有稳定持久化 `hasDueTime` 字段，但业务上已区分“仅日期”和“日期+时间”的输入形态，后续若扩展精细时间语义可单独增加该字段。

### 2.4 lists 集合

| 字段名 | 数据类型 | 描述 | 索引 |
| --- | --- | --- | --- |
| `_id` | String | 清单唯一标识（默认） | 主键 |
| `name` | String | 清单名称 | 普通索引 |
| `description` | String | 清单描述 | 无 |
| `isShared` | Boolean | 是否为共享清单；`false` 表示个人清单，`true` 表示共享清单 | 普通索引 |
| `visibility` | Number | 可见性：`1=公开`，`2=私密` | 普通索引 |
| `creatorId` | String | 创建者 ID | 普通索引 |
| `createdAt` | Timestamp | 创建时间 | 无 |
| `updatedAt` | Timestamp | 更新时间 | 无 |

说明：

1. 个人清单与共享清单的稳定区分字段是 `isShared`。
2. 只有共享清单会稳定维护 `list_members` 创建者成员记录；个人清单不能依赖成员表判断归属。

### 2.5 list_members 集合

| 字段名 | 数据类型 | 描述 | 索引 |
| --- | --- | --- | --- |
| `_id` | String | 记录唯一标识（默认） | 主键 |
| `listId` | String | 清单 ID | 复合索引 `(listId, userId)` |
| `userId` | String | 用户 ID | 复合索引 `(listId, userId)` |
| `role` | Number | 角色：`1=创建者`，`2=编辑者`，`3=查看者` | 复合索引 `(listId, role)` |
| `joinType` | String | 加入方式：`invite`、`link`、`create` | 无 |
| `inviteId` | String | 关联邀请记录 ID | 无 |
| `joinedAt` | Timestamp | 加入时间 | 无 |

说明：权限判断使用 `role <= requiredRole`，不是“数字越大权限越高”的模型。

### 2.6 list_invites 集合

| 字段名 | 数据类型 | 描述 | 索引 |
| --- | --- | --- | --- |
| `_id` | String | 邀请记录唯一标识 | 主键 |
| `listId` | String | 清单 ID | 普通索引 |
| `inviterId` | String | 邀请人 ID | 普通索引 |
| `inviteeId` | String | 被邀请人 ID，可为空 | 普通索引 |
| `inviteeInfo` | Object | 被邀请人信息（微信邀请时存储） | 无 |
| `role` | Number | 邀请角色，通常为 `2=编辑者`、`3=查看者` | 无 |
| `inviteType` | String | 邀请类型：`wechat`、`link`、`search` | 无 |
| `inviteCode` | String | 邀请码 | 唯一索引 |
| `needApproval` | Boolean | 是否需要审批 | 普通索引 |
| `status` | Number | 邀请状态：`0=待处理`，`1=已接受`，`2=已拒绝`，`3=已过期`，`4=待审批` | 普通索引 |
| `expireAt` | Timestamp | 过期时间 | 普通索引 |
| `createdAt` | Timestamp | 创建时间 | 无 |
| `updatedAt` | Timestamp | 更新时间 | 无 |

### 2.7 operations 集合

| 字段名 | 数据类型 | 描述 | 索引 |
| --- | --- | --- | --- |
| `_id` | String | 操作唯一标识（默认） | 主键 |
| `type` | String | 操作类型，如 `task_create`、`task_update`、`task_delete`、`list_create` 等 | 普通索引 |
| `targetId` | String | 操作目标 ID（任务 ID 或清单 ID） | 普通索引 |
| `userId` | String | 操作用户 ID | 普通索引 |
| `listId` | String | 关联清单 ID，可为空 | 普通索引 |
| `content` | Object | 操作内容（变更前后数据等） | 无 |
| `createdAt` | Timestamp | 操作时间 | 普通索引 |

### 2.8 notifications 集合

| 字段名 | 数据类型 | 描述 | 索引 |
| --- | --- | --- | --- |
| `_id` | String | 通知唯一标识（默认） | 主键 |
| `type` | String | 通知类型，如 `task_reminder`、`list_shared`、`join_request` | 普通索引 |
| `userId` | String | 接收用户 ID | 普通索引 |
| `relatedId` | String | 相关对象 ID（任务 ID 或清单 ID） | 普通索引 |
| `content` | String | 通知内容 | 无 |
| `isRead` | Boolean | 是否已读 | 普通索引 |
| `createdAt` | Timestamp | 创建时间 | 无 |

## 3. 任务归属与权限语义

### 3.1 个人独立任务

- 使用 `ownershipType=1` 表示。
- `listId` 固定为空字符串。
- 仅 `creatorId` 可读写。

### 3.2 清单任务

- 使用 `ownershipType=2` 表示。
- `listId` 必须指向一个存在的清单。
- 创建者可读写。
- 若任务挂在共享清单下，清单成员按 `list_members.role` 读写。
- 若任务挂在个人清单下，最终访问权仍由清单创建者控制。

### 3.3 清单权限

- `lists.isShared=false` 的个人清单：仅创建者可管理。
- `lists.isShared=true` 的共享清单：
- `role=1` 创建者。
- `role=2` 编辑者。
- `role=3` 查看者。
- 权限校验规则为 `role <= requiredRole`。

## 4. 任务状态与时间语义

### 4.1 持久状态

- `status=0`：待办。
- `status=1`：已完成。

### 4.2 派生状态

- `isOverdue` 不入库。
- 逾期通过 `dueDate` 与业务时区 `Asia/Shanghai` 下的当前日期比较推导。
- 当前首页与日历页都以 `status===0` 且已过截止日期/截止日作为逾期展示条件。

### 4.3 时间处理

- 云函数创建和更新任务时，前端传入的日期/时间按 `UTC+8` 解释，再转换为 UTC 存储。
- 日历页按“上月 24 日到下月 7 日”的范围查询，以覆盖月视图前后补位。
- 周期任务生成、逾期判断、当日可完成校验都必须遵循相同业务时区语义。

## 5. 周期任务模型

当前实现不是单条规则即时展开，而是“模板任务 + 预生成实例”模型。

### 5.1 字段规则

- 周期模板任务保存 `repeatType`、`repeatValue` 等规则字段。
- 预生成实例保存 `parentTaskId`、`isPeriodicInstance=true`、实例自己的 `dueDate` 和 `status`。
- `parentTaskId` 指向周期系列父任务。

### 5.2 运行规则

1. 创建周期任务后，会按重复类型预生成未来时间窗口内的实例。
2. 完成周期实例后，会继续补齐未来实例，保持预生成窗口。
3. 首页默认对每个周期系列只展示最近的一个未完成且未逾期实例。
4. 已过期实例和已完成实例仍可单独展示与统计。
5. 非当天的未过期周期任务不能直接完成；已过期周期任务需要确认后完成。

## 6. 索引建议

索引应围绕当前真实查询路径设计，而不是围绕未落地字段设计。

### 6.1 tasks 集合

1. 复合索引 `(creatorId, ownershipType, status, dueDate)`
2. 复合索引 `(listId, status, dueDate)`
3. 复合索引 `(creatorId, categoryId, status, dueDate)`
4. 复合索引 `(parentTaskId, dueDate)`
5. 复合索引 `(reminderAt, reminderSent, status)`
6. 复合索引 `(creatorId, updatedAt)`

若历史数据尚未补齐 `ownershipType`，可在迁移期至少保留：

1. `(creatorId, status, dueDate)`
2. `(listId, status, dueDate)`
3. `(parentTaskId, dueDate)`

### 6.2 lists 集合

1. 复合索引 `(creatorId, isShared)`
2. 复合索引 `(updatedAt, isShared)`

### 6.3 list_members 集合

1. 复合索引 `(listId, userId)`
2. 复合索引 `(listId, role)`
3. 复合索引 `(userId, listId)`

### 6.4 notifications 集合

1. 复合索引 `(userId, isRead)`
2. 复合索引 `(userId, createdAt)`

## 7. 缓存设计

当前前端真实依赖以下缓存键：

1. 首页任务缓存：`cachedTasks`
2. 首页任务缓存时间：`cachedTasksTime`
3. 分类缓存：`cachedCategories`
4. 日历月缓存：`calendarTasks_${year}_${month}`

建议遵循以下规则：

1. 任务新增、编辑、删除、状态切换后，至少失效 `cachedTasks` 与相关 `calendarTasks_*`。
2. 若任务日期变更，需同时清理旧日期和新日期所在月份缓存；实现上也可直接清理全部月缓存。
3. 分类变更后，至少失效 `cachedCategories` 和依赖其展示的任务列表缓存。
4. 日历缓存应记录其查询范围，避免误认为是自然月全量缓存。

## 8. 典型查询路径

### 8.1 首页/全局任务列表

- 个人独立任务：`creatorId=当前用户` 且 `ownershipType=1`
- 清单任务：`listId in 当前用户可访问的清单集合`
- 允许再叠加 `status`、`categoryId`、`priority`、`keyword` 过滤

### 8.2 日历页

- 复用任务列表接口
- 查询范围为“上月 24 日 ~ 下月 7 日”
- 前端根据 `dueDate`、`repeatType`、`parentTaskId` 做月视图展示与周期系列筛选

### 8.3 清单详情页

- `listId=指定清单`
- 再叠加 `status` 或排序条件

### 8.4 周期统计页

- 先按父任务 `taskId` 获取系列
- 再查询 `_id=父任务` 或 `parentTaskId=父任务ID` 的全部实例

## 9. 数据安全与性能

1. 用户与清单访问必须通过云函数做权限校验。
2. 周期任务与提醒逻辑都应避免仅依赖前端判断。
3. 避免在文档中声明当前未稳定落地的权限字段，如 `assigneeId`。
4. 任务和清单采用分页加载，但首页与日历仍有前端聚合成本，后续可增加专门聚合接口。
5. `profileFunctions` 中的测试数据接口属于特殊能力，不应纳入生产业务主路径假设。

## 10. 后续演进建议

1. 继续补齐历史任务的 `ownershipType`，减少通过 `listId=''` 推断归属的兼容分支。
2. 若需要统计“逾期后完成”行为，新增 `completedAt`、`completedAfterDue` 等独立字段，而不是复用 `status`。
3. 若任务规模继续增长，可新增首页聚合接口或异步维护轻量统计字段。
4. 若后续确实需要负责人能力，再单独引入 `assigneeId`、`assignedBy`、`assignedAt`，并同步改造通知、权限与索引。
