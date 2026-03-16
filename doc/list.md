# 清单界面设计文档

## 1. 界面概述

清单界面是待办清单小程序的核心功能模块，用于展示和管理用户的所有清单（lists）及其关联的任务（tasks）。根据数据设计文档，清单界面需要支持个人清单和共享清单的展示、创建、编辑、删除等功能。

***

## 2. 界面样式设计

### 2.1 整体布局

```
┌─────────────────────────────────────────┐
│  状态栏 (电量、信号、时间)                  │
├─────────────────────────────────────────┤
│  标题栏                                  │
│  ┌─────────────────────────────────┐   │
│  │  我的清单              [+] [搜索] │   │
│  └─────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  筛选标签栏                               │
│  ┌─────────────────────────────────┐   │
│  │  [全部] [个人] [共享] [我创建的]   │   │
│  └─────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  清单列表区域                             │
│  ┌─────────────────────────────────┐   │
│  │  📁 工作清单                       │   │
│  │     8个任务 • 3个待完成 • 共享      │   │
│  │     ─────────────────────────    │   │
│  │     [进度条 62%]                  │   │
│  │     [成员头像1][成员头像2]...      │   │
│  ├─────────────────────────────────┤   │
│  │  📁 个人生活                       │   │
│  │     5个任务 • 1个待完成 • 个人      │   │
│  │     ─────────────────────────    │   │
│  │     [进度条 80%]                  │   │
│  └─────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  底部导航栏                               │
│  ┌──────────┬──────────┬──────────┐   │
│  │   清单    │   任务    │   我的   │   │
│  └──────────┴──────────┴──────────┘   │
└─────────────────────────────────────────┘
```

### 2.2 清单卡片样式

#### 2.2.1 个人清单卡片

```
┌─────────────────────────────────────────┐
│  ┌──────┐                               │
│  │ 图标  │  清单名称                      │
│  │ 📁   │  ─────────────────────────    │
│  └──────┘  12个任务 • 5个待完成           │
│                                         │
│  ████████████████████░░░░░░░░░░  75%    │
│                                         │
│  最后更新: 2024-03-14 10:30              │
└─────────────────────────────────────────┘
```

**样式规范：**

- 卡片背景：`#FFFFFF`
- 卡片圆角：`12px`
- 卡片阴影：`0 2px 8px rgba(0, 0, 0, 0.08)`
- 图标尺寸：`48px × 48px`
- 图标背景：根据清单颜色或默认 `#E3F2FD`
- 标题字体：`16px`，颜色 `#333333`，字重 `600`
- 任务统计字体：`12px`，颜色 `#666666`
- 进度条高度：`6px`，圆角：`3px`
- 进度条背景：`#E0E0E0`
- 进度条填充色：根据清单颜色或默认 `#4CAF50`

#### 2.2.2 共享清单卡片

```
┌─────────────────────────────────────────┐
│  ┌──────┐                               │
│  │ 图标  │  团队项目                      │
│  │ 👥   │  ─────────────────────────    │
│  └──────┘  20个任务 • 8个待完成 • 共享    │
│                                         │
│  ████████████████░░░░░░░░░░░░░░  60%    │
│                                         │
│  ┌──┐ ┌──┐ ┌──┐ +3                      │
│  │头│ │头│ │头│                          │
│  │像1│ │像2│ │像3│  创建者: 张三           │
│  └──┘ └──┘ └──┘                          │
└─────────────────────────────────────────┘
```

**共享标识样式：**

- 共享标签背景：`#E8F5E9`
- 共享标签文字颜色：`#2E7D32`
- 成员头像尺寸：`24px × 24px`
- 成员头像圆角：`50%`
- 成员头像重叠：`-8px` 间距

### 2.3 颜色规范

| 用途   | 颜色值       | 说明        |
| ---- | --------- | --------- |
| 主色调  | `#1976D2` | 用于按钮、选中状态 |
| 成功色  | `#4CAF50` | 完成状态、进度条  |
| 警告色  | `#FF9800` | 待处理、提醒    |
| 错误色  | `#F44336` | 删除、逾期     |
| 个人清单 | `#E3F2FD` | 个人清单图标背景  |
| 共享清单 | `#E8F5E9` | 共享清单图标背景  |
| 背景色  | `#F5F5F5` | 页面背景      |
| 卡片背景 | `#FFFFFF` | 清单卡片背景    |
| 文字主色 | `#333333` | 标题文字      |
| 文字次色 | `#666666` | 描述文字      |
| 文字辅助 | `#999999` | 时间、提示文字   |

### 2.4 字体规范

| 元素   | 字号     | 字重    | 颜色        |
| ---- | ------ | ----- | --------- |
| 页面标题 | `20px` | `600` | `#333333` |
| 清单名称 | `16px` | `600` | `#333333` |
| 任务统计 | `12px` | `400` | `#666666` |
| 时间信息 | `11px` | `400` | `#999999` |
| 按钮文字 | `14px` | `500` | `#FFFFFF` |
| 标签文字 | `12px` | `500` | `#1976D2` |

***

## 3. 功能设计

### 3.1 清单列表展示

#### 3.1.1 数据关联

- 关联集合：`lists` + `list_members` + `tasks`
- 查询条件：
  - 个人清单：`creatorId = 当前用户ID`
  - 共享清单：`list_members.userId = 当前用户ID`
  - 创建的清单：`lists.creatorId = 当前用户ID`

#### 3.1.2 列表排序

1. **默认排序**：按 `updatedAt` 降序（最近更新的在前）
2. **按名称排序**：按 `name` 升序
3. **按任务数排序**：按关联任务数量降序
4. **按进度排序**：按完成进度升序/降序

#### 3.1.3 统计信息展示

- **任务总数**：关联 `tasks` 集合统计 `listId` 匹配的记录数
- **待完成任务数**：统计 `status = 0` 的任务数
- **完成进度**：`已完成任务数 / 总任务数 × 100%`
- **成员数量**（共享清单）：统计 `list_members` 中 `listId` 匹配的成员数

### 3.2 清单筛选功能

| 筛选条件 | 说明                           | 对应数据字段      |
| ---- | ---------------------------- | ----------- |
| 全部   | 显示所有可访问的清单                   | 无过滤         |
| 个人   | 仅显示 `isShared = false` 的清单   | `isShared`  |
| 共享   | 仅显示 `isShared = true` 的清单    | `isShared`  |
| 我创建的 | 仅显示 `creatorId = 当前用户ID` 的清单 | `creatorId` |

### 3.3 清单创建功能

#### 3.3.1 创建表单字段

| 字段名  | 类型      | 必填 | 说明         | 对应数据字段        |
| ---- | ------- | -- | ---------- | ------------- |
| 清单名称 | String  | 是  | 2-50个字符    | `name`        |
| 清单描述 | String  | 否  | 最多200个字符   | `description` |
| 清单类型 | Boolean | 是  | 个人/共享      | `isShared`    |
| 可见性  | Number  | 是  | 1-公开, 2-私密 | `visibility`  |
| 清单颜色 | String  | 否  | 十六进制颜色值    | 前端展示用         |
| 清单图标 | String  | 否  | 图标名称/URL   | 前端展示用         |

#### 3.3.2 创建流程

```
用户点击[+]按钮
    ↓
弹出创建清单弹窗/跳转创建页面
    ↓
用户填写表单信息
    ↓
前端验证表单数据
    ↓
调用云函数创建清单
    ↓
如果是共享清单，创建者为管理员
    ↓
创建成功，刷新列表
```

#### 3.3.3 数据写入

```javascript
// 创建个人清单
{
  "name": "个人生活",
  "description": "记录日常生活事项",
  "isShared": false,
  "visibility": 2,  // 私密
  "creatorId": "当前用户openid",
  "createdAt": "服务端生成时间戳",
  "updatedAt": "服务端生成时间戳"
}

// 创建共享清单
{
  "name": "团队项目",
  "description": "团队协作任务清单",
  "isShared": true,
  "visibility": 1,  // 公开
  "creatorId": "当前用户openid",
  "createdAt": "服务端生成时间戳",
  "updatedAt": "服务端生成时间戳"
}

// 同时创建 list_members 记录
{
  "listId": "新创建清单的_id",
  "userId": "当前用户openid",
  "role": 1,  // 创建者
  "joinedAt": "服务端生成时间戳"
}
```

### 3.4 清单编辑功能

#### 3.4.1 可编辑字段

- 清单名称 (`name`)
- 清单描述 (`description`)
- 可见性 (`visibility`)
- 清单颜色/图标 (前端展示)

#### 3.4.2 权限控制

| 角色           | 权限   | 说明                    |
| ------------ | ---- | --------------------- |
| 创建者 (role=1) | 全部权限 | 可编辑所有字段、删除清单、管理成员     |
| 编辑者 (role=2) | 部分权限 | 可编辑清单信息，不可删除清单、不可管理成员 |
| 查看者 (role=3) | 只读权限 | 仅可查看清单信息              |

#### 3.4.3 编辑流程

```
用户长按清单卡片或点击编辑按钮
    ↓
判断用户权限
    ↓
有权限：弹出编辑弹窗/跳转编辑页面
无权限：提示"您没有编辑权限"
    ↓
用户修改信息
    ↓
前端验证
    ↓
调用云函数更新数据
    ↓
更新成功，刷新列表
```

### 3.5 清单删除功能

#### 3.5.1 删除权限

- 仅清单创建者可删除清单
- 删除前需要二次确认

#### 3.5.2 删除流程

```
用户点击删除按钮
    ↓
弹出确认对话框
    ↓
用户确认删除
    ↓
调用云函数删除清单
    ↓
级联删除关联数据：
  - 删除 list_members 中 listId 匹配的记录
  - 删除 tasks 中 listId 匹配的记录（可选：软删除）
    ↓
删除成功，刷新列表
```

### 3.6 清单详情入口

点击清单卡片进入清单详情页，展示：

- 清单基本信息
- 任务列表
- 成员列表（共享清单）
- 操作记录

### 3.7 搜索功能

#### 3.7.1 搜索范围

- 清单名称 (`name`)
- 清单描述 (`description`)

#### 3.7.2 搜索实现

```javascript
// 云函数搜索
const keyword = event.keyword;
const result = await db.collection('lists').where({
  name: db.RegExp({
    regexp: keyword,
    options: 'i'  // 忽略大小写
  })
}).get();
```

### 3.8 下拉刷新与上拉加载

#### 3.8.1 下拉刷新

- 触发动作：用户下拉列表
- 执行操作：重新查询清单数据
- 刷新动画：显示加载指示器

#### 3.8.2 上拉加载

- 触发动作：用户上拉列表底部
- 执行操作：分页加载更多数据
- 分页参数：`limit = 20`，`skip = 当前已加载数量`

***

## 4. 具体逻辑设计

### 4.1 数据查询逻辑

#### 4.1.1 获取清单列表

```javascript
// 查询当前用户可访问的所有清单
async function getListData(userId) {
  // 1. 查询用户创建的清单
  const createdLists = await db.collection('lists').where({
    creatorId: userId
  }).get();
  
  // 2. 查询用户作为成员的共享清单
  const memberListIds = await db.collection('list_members').where({
    userId: userId
  }).get();
  
  const sharedListIds = memberListIds.data.map(m => m.listId);
  
  const sharedLists = await db.collection('lists').where({
    _id: db.command.in(sharedListIds),
    creatorId: db.command.neq(userId)  // 排除已查询的创建清单
  }).get();
  
  // 3. 合并列表
  const allLists = [...createdLists.data, ...sharedLists.data];
  
  // 4. 获取每个清单的统计信息
  for (let list of allLists) {
    // 统计任务数
    const taskStats = await db.collection('tasks').where({
      listId: list._id
    }).count();
    
    const pendingTasks = await db.collection('tasks').where({
      listId: list._id,
      status: 0
    }).count();
    
    list.taskCount = taskStats.total;
    list.pendingCount = pendingTasks.total;
    list.progress = taskStats.total > 0 
      ? Math.round((taskStats.total - pendingTasks.total) / taskStats.total * 100)
      : 0;
    
    // 如果是共享清单，获取成员信息
    if (list.isShared) {
      const members = await db.collection('list_members').where({
        listId: list._id
      }).limit(5).get();
      
      // 获取成员用户信息
      const memberUserIds = members.data.map(m => m.userId);
      const memberUsers = await db.collection('users').where({
        openid: db.command.in(memberUserIds)
      }).get();
      
      list.members = memberUsers.data;
      list.memberCount = members.data.length;
      
      // 获取当前用户在该清单的角色
      const myMemberInfo = members.data.find(m => m.userId === userId);
      list.myRole = myMemberInfo ? myMemberInfo.role : null;
    }
  }
  
  // 5. 按更新时间降序排序
  allLists.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  
  return allLists;
}
```

#### 4.1.2 筛选逻辑

```javascript
// 根据筛选条件过滤清单
function filterLists(lists, filterType) {
  switch (filterType) {
    case 'personal':
      return lists.filter(list => !list.isShared);
    case 'shared':
      return lists.filter(list => list.isShared);
    case 'created':
      return lists.filter(list => list.creatorId === currentUserId);
    default:
      return lists;
  }
}
```

### 4.2 权限验证逻辑

```javascript
// 检查用户对清单的操作权限
async function checkPermission(listId, userId, action) {
  // 获取清单信息
  const list = await db.collection('lists').doc(listId).get();
  
  // 创建者拥有所有权限
  if (list.data.creatorId === userId) {
    return { allowed: true, role: 1 };
  }
  
  // 获取成员信息
  const member = await db.collection('list_members').where({
    listId: listId,
    userId: userId
  }).get();
  
  if (member.data.length === 0) {
    return { allowed: false, reason: '您不是该清单的成员' };
  }
  
  const role = member.data[0].role;
  
  // 根据操作类型判断权限
  switch (action) {
    case 'view':
      return { allowed: true, role };
    case 'edit':
      return { allowed: role <= 2, role };  // 创建者和编辑者可编辑
    case 'delete':
      return { allowed: role === 1, role };  // 仅创建者可删除
    case 'manage_members':
      return { allowed: role === 1, role };  // 仅创建者可管理成员
    default:
      return { allowed: false, reason: '未知操作' };
  }
}
```

### 4.3 清单创建逻辑

```javascript
// 创建清单
async function createList(listData, userId) {
  // 1. 数据验证
  if (!listData.name || listData.name.length < 2 || listData.name.length > 50) {
    return { success: false, error: '清单名称需在2-50个字符之间' };
  }
  
  // 2. 构建清单数据
  const newList = {
    name: listData.name,
    description: listData.description || '',
    isShared: listData.isShared || false,
    visibility: listData.visibility || 2,
    creatorId: userId,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  // 3. 创建清单
  const result = await db.collection('lists').add(newList);
  
  // 4. 如果是共享清单，创建成员记录
  if (newList.isShared) {
    await db.collection('list_members').add({
      listId: result._id,
      userId: userId,
      role: 1,  // 创建者
      joinedAt: new Date()
    });
  }
  
  // 5. 记录操作日志
  await db.collection('operations').add({
    type: 'list_create',
    targetId: result._id,
    userId: userId,
    content: { listData: newList },
    createdAt: new Date()
  });
  
  return { success: true, listId: result._id };
}
```

### 4.4 清单更新逻辑

```javascript
// 更新清单
async function updateList(listId, updateData, userId) {
  // 1. 权限检查
  const permission = await checkPermission(listId, userId, 'edit');
  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }
  
  // 2. 获取原数据
  const originalList = await db.collection('lists').doc(listId).get();
  
  // 3. 构建更新数据
  const updateFields = {
    updatedAt: new Date()
  };
  
  if (updateData.name) updateFields.name = updateData.name;
  if (updateData.description !== undefined) updateFields.description = updateData.description;
  if (updateData.visibility) updateFields.visibility = updateData.visibility;
  
  // 4. 更新数据
  await db.collection('lists').doc(listId).update(updateFields);
  
  // 5. 记录操作日志
  await db.collection('operations').add({
    type: 'list_update',
    targetId: listId,
    userId: userId,
    content: {
      before: originalList.data,
      after: { ...originalList.data, ...updateFields }
    },
    createdAt: new Date()
  });
  
  return { success: true };
}
```

### 4.5 清单删除逻辑

```javascript
// 删除清单
async function deleteList(listId, userId) {
  // 1. 权限检查
  const permission = await checkPermission(listId, userId, 'delete');
  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }
  
  // 2. 获取清单信息（用于日志）
  const list = await db.collection('lists').doc(listId).get();
  
  // 3. 删除清单成员
  const members = await db.collection('list_members').where({
    listId: listId
  }).get();
  
  for (let member of members.data) {
    await db.collection('list_members').doc(member._id).remove();
  }
  
  // 4. 软删除关联任务（可选）
  // 或删除任务 await db.collection('tasks').where({ listId }).remove();
  await db.collection('tasks').where({
    listId: listId
  }).update({
    status: 3,  // 已删除状态
    updatedAt: new Date()
  });
  
  // 5. 删除清单
  await db.collection('lists').doc(listId).remove();
  
  // 6. 记录操作日志
  await db.collection('operations').add({
    type: 'list_delete',
    targetId: listId,
    userId: userId,
    content: { deletedList: list.data },
    createdAt: new Date()
  });
  
  return { success: true };
}
```

### 4.6 实时更新逻辑

```javascript
// 监听清单数据变化
function watchListChanges(userId, callback) {
  const watcher = db.collection('lists').where({
    $or: [
      { creatorId: userId },
      { 
        _id: db.command.in(
          db.collection('list_members').where({
            userId: userId
          }).get().then(res => res.data.map(m => m.listId))
        )
      }
    ]
  }).watch({
    onChange: (snapshot) => {
      // 处理数据变化
      callback(snapshot);
    },
    onError: (err) => {
      console.error('监听失败', err);
    }
  });
  
  return watcher;
}
```

### 4.7 缓存策略

```javascript
// 清单数据缓存管理
const ListCache = {
  key: 'list_data_cache',
  expireTime: 5 * 60 * 1000,  // 5分钟
  
  // 获取缓存
  get() {
    const cache = wx.getStorageSync(this.key);
    if (!cache) return null;
    
    if (Date.now() - cache.timestamp > this.expireTime) {
      wx.removeStorageSync(this.key);
      return null;
    }
    
    return cache.data;
  },
  
  // 设置缓存
  set(data) {
    wx.setStorageSync(this.key, {
      data,
      timestamp: Date.now()
    });
  },
  
  // 清除缓存
  clear() {
    wx.removeStorageSync(this.key);
  }
};
```

***

## 5. 交互设计

### 5.1 手势操作

| 手势 | 操作对象 | 功能               |
| -- | ---- | ---------------- |
| 点击 | 清单卡片 | 进入清单详情           |
| 长按 | 清单卡片 | 弹出操作菜单（编辑/删除/分享） |
| 左滑 | 清单卡片 | 显示快捷操作按钮         |
| 下拉 | 列表   | 刷新数据             |
| 上拉 | 列表底部 | 加载更多             |

### 5.2 操作菜单

```
┌─────────────────┐
│     工作清单     │
├─────────────────┤
│  ✏️ 编辑清单     │
│  👥 管理成员     │
│  📤 分享清单     │
│  🗑️ 删除清单     │
│  📋 复制清单     │
└─────────────────┘
```

### 5.3 空状态设计

#### 5.3.1 无清单状态

```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│              📋                         │
│                                         │
│           暂无清单                      │
│                                         │
│      点击右上角 + 创建您的第一个清单      │
│                                         │
│         [创建清单]                      │
│                                         │
└─────────────────────────────────────────┘
```

#### 5.3.2 搜索无结果状态

```
┌─────────────────────────────────────────┐
│                                         │
│              🔍                         │
│                                         │
│        未找到匹配的清单                  │
│                                         │
│      请尝试其他关键词                   │
│                                         │
└─────────────────────────────────────────┘
```

***

## 6. 性能优化

### 6.1 数据加载优化

1. **分页加载**：每次加载20条数据
2. **骨架屏**：数据加载时显示骨架屏
3. **图片懒加载**：成员头像懒加载
4. **本地缓存**：清单列表缓存5分钟

### 6.2 查询优化

1. **复合索引**：使用 `(creatorId, updatedAt)` 索引
2. **聚合查询**：使用聚合管道统计任务数
3. **字段筛选**：只查询需要的字段

### 6.3 渲染优化

1. **虚拟列表**：长列表使用虚拟滚动
2. **组件复用**：复用清单卡片组件
3. **避免重复渲染**：使用 `shouldComponentUpdate` 或 `React.memo`

***

## 7. 异常处理

### 7.1 网络异常

- 显示网络错误提示
- 提供重试按钮
- 使用本地缓存数据展示

### 7.2 权限异常

- 提示用户无权限
- 引导用户申请权限或联系管理员

### 7.3 数据异常

- 数据格式错误时显示默认值
- 记录错误日志
- 提示用户刷新页面

***

## 8. 相关接口

### 8.1 云函数接口

| 接口名             | 功能     | 参数                                  | 返回值    |
| --------------- | ------ | ----------------------------------- | ------ |
| `getLists`      | 获取清单列表 | `userId`, `filter`, `page`, `limit` | 清单列表数据 |
| `createList`    | 创建清单   | `listData`, `userId`                | 新清单ID  |
| `updateList`    | 更新清单   | `listId`, `updateData`, `userId`    | 成功/失败  |
| `deleteList`    | 删除清单   | `listId`, `userId`                  | 成功/失败  |
| `getListDetail` | 获取清单详情 | `listId`, `userId`                  | 清单详细信息 |
| `searchLists`   | 搜索清单   | `keyword`, `userId`                 | 搜索结果   |

### 8.2 数据库权限配置

```json
{
  "lists": {
    "read": "doc.creatorId == auth.openid || get('list_members').where({listId: doc._id, userId: auth.openid}).count() > 0",
    "write": "doc.creatorId == auth.openid"
  }
}
```

***

