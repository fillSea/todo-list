# 简易协同待办清单小程序 - 数据库设计

## 1. 数据库结构概览

根据系统功能需求，设计以下云数据库集合：

| 集合名称          | 描述     | 主要功能          |
| ------------- | ------ | ------------- |
| users         | 用户信息   | 存储用户基本信息      |
| tasks         | 任务信息   | 存储个人和共享任务     |
| lists         | 清单信息   | 存储个人和共享清单     |
| categories    | 分类标签   | 存储用户自定义分类标签   |
| list\_members | 清单成员   | 存储清单与成员的关系及权限 |
| list\_invites | 清单邀请记录 | 存储清单邀请信息      |
| operations    | 操作记录   | 存储任务和清单的操作历史  |
| notifications | 通知信息   | 存储系统通知和提醒     |

## 2. 集合详细设计

### 2.1 users 集合

| 字段名                 | 数据类型      | 描述         | 索引   |
| ------------------- | --------- | ---------- | ---- |
| \_id                | String    | 用户唯一标识（默认） | 主键   |
| openid              | String    | 微信用户openid | 唯一索引 |
| nickname            | String    | 用户昵称       | 普通索引 |
| avatarUrl           | String    | 用户头像       | 无    |
| enableNotifications | Boolean   | 是否接收通知     | 无    |
| createdAt           | Timestamp | 创建时间       | 无    |
| updatedAt           | Timestamp | 更新时间       | 无    |

### 2.2 categories 集合

| 字段名       | 数据类型      | 描述         | 索引   |
| --------- | --------- | ---------- | ---- |
| \_id      | String    | 分类唯一标识（默认） | 主键   |
| name      | String    | 分类名称       | 普通索引 |
| color     | String    | 分类颜色（十六进制） | 无    |
| userId    | String    | 创建者ID      | 普通索引 |
| createdAt | Timestamp | 创建时间       | 无    |
| updatedAt | Timestamp | 更新时间       | 无    |

### 2.3 tasks 集合

| 字段名          | 数据类型      | 描述                                                       | 索引   |
| ------------ | --------- | -------------------------------------------------------- | ---- |
| \_id         | String    | 任务唯一标识（默认）                                               | 主键   |
| title        | String    | 任务标题                                                     | 普通索引 |
| description  | String    | 任务描述                                                     | 无    |
| dueDate      | Timestamp | 截止日期                                                     | 普通索引 |
| priority     | Number    | 优先级（1-不重要不紧急，2-紧急不重要，3-重要不紧急，4-重要且紧急）                    | 普通索引 |
| status       | Number    | 状态（0-未完成，1-已完成，2-逾期）                                     | 普通索引 |
| listId       | String    | 所属清单ID                                                   | 普通索引 |
| creatorId    | String    | 创建者ID                                                    | 普通索引 |
| categoryId   | String    | 分类ID（关联 categories 集合）                                   | 普通索引 |
| repeatType   | Number    | 重复类型（0-不重复，1-周重复，2-月重复）                                  | 普通索引 |
| repeatValue  | String    | 重复值（周重复：1-7表示周一到周日，多个用逗号分隔；月重复：1-31表示在每个的哪个日期重复，多个用逗号分隔） | 普通索引 |
| reminderAt   | Timestamp | 提醒时间                                                     | 普通索引 |
| reminderSent | Boolean   | 提醒是否已发送                                                  | 普通索引 |
| attachments  | Array     | 附件列表                                                     | 无    |
| createdAt    | Timestamp | 创建时间                                                     | 无    |
| updatedAt    | Timestamp | 更新时间                                                     | 无    |

### 2.4 lists 集合

| 字段名         | 数据类型      | 描述             | 索引   |
| ----------- | --------- | -------------- | ---- |
| \_id        | String    | 清单唯一标识（默认）     | 主键   |
| name        | String    | 清单名称           | 普通索引 |
| description | String    | 清单描述           | 无    |
| isShared    | Boolean   | 是否为共享清单        | 普通索引 |
| visibility  | Number    | 可见性（1-公开，2-私密） | 普通索引 |
| creatorId   | String    | 创建者ID          | 普通索引 |
| createdAt   | Timestamp | 创建时间           | 无    |
| updatedAt   | Timestamp | 更新时间           | 无    |

### 2.5 list\_members 集合

| 字段名      | 数据类型      | 描述                                    | 索引                   |
| -------- | --------- | ------------------------------------- | -------------------- |
| \_id     | String    | 记录唯一标识（默认）                            | 主键                   |
| listId   | String    | 清单ID                                  | 复合索引(listId, userId) |
| userId   | String    | 用户ID                                  | 复合索引(listId, userId) |
| role     | Number    | 角色（1-创建者，2-编辑者，3-查看者）                 | 无                    |
| joinType | String    | 加入方式（invite-被邀请，link-链接加入，create-创建者） | <br />               |
| inviteId | String    | 关联的邀请记录ID                             | <br />               |
| joinedAt | Timestamp | 加入时间                                  | 无                    |

### 3.1 list\_invites 集合

| 字段名         | 数据类型      | 描述                            | 索引   |
| ----------- | --------- | ----------------------------- | ---- |
| \_id        | String    | 邀请记录唯一标识                      | 主键   |
| listId      | String    | 清单ID                          | 普通索引 |
| inviterId   | String    | 邀请人ID                         | 普通索引 |
| inviteeId   | String    | 被邀请人ID（可选，链接邀请时为空）            | 普通索引 |
| inviteeInfo | Object    | 被邀请人信息（微信邀请时存储）               | 无    |
| role        | Number    | 邀请角色（2-编辑者，3-查看者）             | 无    |
| inviteType  | String    | 邀请类型（wechat/link/search）      | 无    |
| inviteCode  | String    | 邀请码（链接邀请时生成）                  | 唯一索引 |
| status      | Number    | 邀请状态（0-待接受，1-已接受，2-已拒绝，3-已过期） | 普通索引 |
| expireAt    | Timestamp | 过期时间                          | 普通索引 |
| createdAt   | Timestamp | 创建时间                          | 无    |
| updatedAt   | Timestamp | 更新时间                          | 无    |

### 2.6 operations 集合

| 字段名       | 数据类型      | 描述                                                                                       | 索引   |
| --------- | --------- | ---------------------------------------------------------------------------------------- | ---- |
| \_id      | String    | 操作唯一标识（默认）                                                                               | 主键   |
| type      | String    | 操作类型（task\_create, task\_update, task\_delete, list\_create, list\_update, list\_delete） | 普通索引 |
| targetId  | String    | 操作目标ID（任务ID或清单ID）                                                                        | 普通索引 |
| userId    | String    | 操作用户ID                                                                                   | 普通索引 |
| content   | Object    | 操作内容（变更前后的数据）                                                                            | 无    |
| createdAt | Timestamp | 操作时间                                                                                     | 普通索引 |

### 2.7 notifications 集合

| 字段名       | 数据类型      | 描述                                                                                    | 索引   |
| --------- | --------- | ------------------------------------------------------------------------------------- | ---- |
| \_id      | String    | 通知唯一标识（默认）                                                                            | 主键   |
| type      | String    | 通知类型（task\_assigned, task\_updated, list\_shared, deadline\_reminder, task\_reminder） | 普通索引 |
| userId    | String    | 接收用户ID                                                                                | 普通索引 |
| relatedId | String    | 相关对象ID（任务ID或清单ID）                                                                     | 普通索引 |
| content   | String    | 通知内容                                                                                  | 无    |
| isRead    | Boolean   | 是否已读                                                                                  | 普通索引 |
| createdAt | Timestamp | 创建时间                                                                                  | 无    |

## 3. 权限设计

### 3.1 users 集合

- 仅创建者可读写自己的文档
- 其他用户不可访问

### 3.2 categories 集合

- 仅创建者可读写自己的分类
- 其他用户不可访问

### 3.3 tasks 集合

- 个人任务：仅创建者和负责人可读写
- 共享任务：清单成员根据权限读写

### 3.4 lists 集合

- 个人清单：仅创建者可读写
- 共享清单：创建者可读写，编辑者可读写，查看者仅可读

### 3.4 list\_members 集合

- 仅清单创建者可管理成员
- 成员可查看自己的成员信息

### 3.5 operations 集合

- 仅清单成员可查看操作记录

### 3.6 notifications 集合

- 仅接收用户可读写自己的通知

## 4. 索引优化

1. **tasks 集合**：建立复合索引 (listId, status) 用于快速查询清单内任务状态
2. **tasks 集合**：建立复合索引 (assigneeId, dueDate) 用于快速查询用户待办任务
3. **tasks 集合**：建立复合索引 (creatorId, categoryId) 用于快速查询用户按分类筛选的任务
4. **tasks 集合**：建立复合索引 (repeatType, repeatStartDate) 用于快速查找重复任务
5. **tasks 集合**：建立复合索引 (reminderAt, reminderSent, status) 用于快速查询待发送的提醒任务
6. **categories 集合**：建立复合索引 (userId, sortOrder) 用于快速查询用户分类并排序
7. **lists 集合**：建立复合索引 (creatorId, isShared) 用于快速查询用户的个人和共享清单
8. **list\_members 集合**：建立复合索引 (listId, role) 用于快速查询清单成员及权限
9. **notifications 集合**：建立复合索引 (userId, isRead) 用于快速查询未读通知

## 5. 数据安全

1. **敏感数据**：用户个人信息加密存储
2. **权限控制**：严格按照权限设计进行数据访问控制
3. **数据验证**：前端和云函数双重验证数据格式和完整性
4. **操作日志**：记录所有关键操作，便于追溯和审计
5. **备份策略**：定期备份数据库，确保数据安全

## 6. 性能优化

1. **分页加载**：任务和清单采用分页加载，避免一次性加载大量数据
2. **数据缓存**：本地缓存常用数据，减少网络请求
3. **索引设计**：合理设计索引，提高查询效率
4. **云函数优化**：优化云函数逻辑，减少执行时间
5. **批量操作**：使用批量操作减少数据库请求次数

## 7. 新增功能说明

### 7.1 分类标签功能

**categories 集合结构：**

```javascript
{
  "_id": "cat_001",
  "name": "工作",
  "color": "#FF0000",
  "sortOrder": 1,
  "userId": "user_001",
  "createdAt": "2024-03-10T10:00:00Z",
  "updatedAt": "2024-03-10T10:00:00Z"
}
```

**tasks.categoryId 字段：**

- 存储分类ID，关联 categories 集合
- 一个任务只能有一个分类
- 分类必须来自用户自定义的分类列表

**使用场景：**

- 按分类筛选任务：查询所有"工作"分类的任务
- 统计分类任务：统计各分类下的任务数量
- 分类颜色区分：不同分类使用不同颜色显示

**查询示例：**

```javascript
// 查询用户的所有分类
db.collection('categories').where({
  userId: 'user_001'
}).orderBy('sortOrder', 'asc').get()

// 查询用户的所有"工作"分类任务
db.collection('tasks').where({
  creatorId: 'user_001',
  categoryId: 'cat_001'
}).get()

// 统计各分类的任务数量
db.collection('tasks').where({
  creatorId: 'user_001'
}).get().then(res => {
  const categoryStats = {}
  res.data.forEach(task => {
    if (task.categoryId) {
      categoryStats[task.categoryId] = (categoryStats[task.categoryId] || 0) + 1
    }
  })
  console.log(categoryStats)
})
```

### 7.2 任务重复周期功能

**重复类型说明：**

- `repeatType = 0`：不重复
- `repeatType = 1`：每天重复
- `repeatType = 2`：每周重复
- `repeatType = 3`：每月重复

**重复值说明：**

- 周重复：`repeatValue` 为 "1,3,5" 表示周一、周三、周五（1-7代表周一到周日）
- 月重复：`repeatValue` 为 "1,15" 表示每月1号和15号

**数据结构示例：**

```javascript
// 不重复
{
  repeatType: 0,
  repeatValue: "",
  repeatStartDate: null,
  repeatEndDate: null
}

// 每天重复
{
  repeatType: 1,
  repeatValue: "",
  repeatStartDate: new Date("2024-03-10"),
  repeatEndDate: null
}

// 每周一、三、五重复
{
  repeatType: 2,
  repeatValue: "1,3,5",
  repeatStartDate: new Date("2024-03-10"),
  repeatEndDate: null
}

// 每月1号和15号重复
{
  repeatType: 3,
  repeatValue: "1,15",
  repeatStartDate: new Date("2024-03-10"),
  repeatEndDate: new Date("2024-12-31")
}
```

**快速查询实现：**

```javascript
// 查询所有重复任务
db.collection('tasks').where({
  creatorId: 'user_001',
  repeatType: db.command.gt(0)
}).get()

// 查询所有每周重复的任务
db.collection('tasks').where({
  creatorId: 'user_001',
  repeatType: 2
}).get()

// 查询指定日期范围内的重复任务
db.collection('tasks').where({
  creatorId: 'user_001',
  repeatType: db.command.gt(0),
  repeatStartDate: db.command.lte(new Date("2024-03-15")),
  repeatEndDate: db.command.or(
    db.command.eq(null),
    db.command.gte(new Date("2024-03-10"))
  )
}).get()
```

**使用场景：**

- 每周一、三、五开会的任务：`repeatType=2, repeatValue="1,3,5"`
- 工作日每天的任务：`repeatType=2, repeatValue="1,2,3,4,5"`
- 周末的任务：`repeatType=2, repeatValue="6,7"`
- 每月1号的任务：`repeatType=3, repeatValue="1"`

### 7.3 用户通知设置功能

**enableNotifications 字段：**

- `true`：接收通知
- `false`：不接收通知

**实现逻辑：**

```javascript
// 创建通知前检查用户设置
const user = await db.collection('users').doc(userId).get()

if (!user.data.enableNotifications) {
  return // 用户已关闭所有通知
}

// 创建通知
await db.collection('notifications').add({
  type: notificationType,
  userId: userId,
  relatedId: relatedId,
  content: content,
  isRead: false,
  createdAt: new Date()
})
```

### 7.4 任务提醒功能

**reminderAt 字段：**

- 存储任务的提醒时间
- 当到达提醒时间时，系统会向任务创建者发送通知
- 提醒时间必须早于或等于截止日期

**reminderSent 字段：**

- `false`：提醒未发送（默认）
- `true`：提醒已发送
- 用于避免重复发送提醒

**数据结构示例：**

```javascript
// 设置了提醒的任务
{
  _id: "task_001",
  title: "提交项目报告",
  description: "需要提交季度项目报告",
  dueDate: new Date("2024-03-15T18:00:00"),
  reminderAt: new Date("2024-03-15T09:00:00"),  // 当天上午9点提醒
  reminderSent: false,
  status: 0,
  creatorId: "user_001",
  // ... 其他字段
}

// 提醒已发送的任务
{
  _id: "task_002",
  title: "参加会议",
  dueDate: new Date("2024-03-10T14:00:00"),
  reminderAt: new Date("2024-03-10T13:30:00"),
  reminderSent: true,  // 提醒已发送
  status: 0,
  creatorId: "user_001",
  // ... 其他字段
}
```

**提醒检查逻辑（云函数定时触发器）：**

```javascript
// 每分钟执行一次，检查待发送的提醒
exports.checkReminders = async function() {
  const now = new Date()
  const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000)
  
  // 查询即将到达提醒时间且未发送提醒的未完成任务
  const tasks = await db.collection('tasks').where({
    reminderAt: db.command.lte(fiveMinutesLater),
    reminderSent: false,
    status: 0  // 仅未完成的任务需要提醒
  }).get()
  
  for (const task of tasks.data) {
    // 检查用户是否开启通知
    const user = await db.collection('users').doc(task.creatorId).get()
    
    if (user.data.enableNotifications) {
      // 创建提醒通知
      await db.collection('notifications').add({
        type: 'task_reminder',
        userId: task.creatorId,
        relatedId: task._id,
        content: `任务提醒：${task.title} 即将到期`,
        isRead: false,
        createdAt: new Date()
      })
      
      // 发送订阅消息（微信小程序）
      await sendSubscribeMessage(task.creatorId, {
        taskTitle: task.title,
        dueDate: formatDate(task.dueDate),
        reminderTime: formatDate(task.reminderAt)
      })
    }
    
    // 标记提醒已发送
    await db.collection('tasks').doc(task._id).update({
      reminderSent: true,
      updatedAt: new Date()
    })
  }
}
```

**查询示例：**

```javascript
// 查询设置了提醒的任务
await db.collection('tasks').where({
  creatorId: 'user_001',
  reminderAt: db.command.neq(null)
}).get()

// 查询即将到达提醒时间的任务
const now = new Date()
const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)

await db.collection('tasks').where({
  reminderAt: db.command.gte(now).and(db.command.lte(oneHourLater)),
  reminderSent: false,
  status: 0
}).get()

// 查询已发送提醒的任务
await db.collection('tasks').where({
  creatorId: 'user_001',
  reminderSent: true
}).get()
```

**使用场景：**

- 重要会议前30分钟提醒
- 截止日期当天上午提醒
- 周期性任务的重复提醒

**注意事项：**

1. 提醒时间修改时，需要将 `reminderSent` 重置为 `false`
2. 任务完成后，不再发送提醒
3. 重复任务的每次实例都需要单独设置提醒
4. 建议提醒时间设置范围：截止前5分钟到截止前7天

## 8. 扩展考虑

1. **评论系统**：可添加评论集合，支持任务和清单评论
2. **统计分析**：可添加统计集合，存储用户和清单的统计数据
3. **多端同步**：支持小程序、Web端等多端数据同步
4. **第三方集成**：支持与日历、邮件等第三方服务集成

