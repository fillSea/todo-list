# "我的"页面设计文档

## 1. 页面概述

**页面名称**: 我的 (Profile)
**页面路径**: `pages/profile/profile`
**页面类型**: 底部导航栏页面
**功能定位**: 个人中心，集中管理用户信息、清单、分类标签、通知消息及数据看板

## 2. 界面样式设计

### 2.1 整体布局

```
┌─────────────────────────────────────┐
│  状态栏                              │
├─────────────────────────────────────┤
│  用户信息卡片                         │  ← 顶部区域
│  ┌─────────────────────────────────┐│
│  │  [头像]  用户昵称                 ││
│  │          个性签名                 ││
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  快捷统计区域                         │  ← 快捷数据
│  ┌────────┬────────┬────────┐      │
│  │  我的   │  共享   │  已完成 │      │
│  │  清单   │  清单   │  任务   │      │
│  │   12   │   3    │   156  │      │
│  └────────┴────────┴────────┘      │
├─────────────────────────────────────┤
│  数据看板区域                         │  ← 新增：图表统计
│  ┌─────────────────────────────────┐│
│  │  📊 任务完成情况                  ││
│  │     [扇形图：已完成/未完成/逾期]   ││
│  ├─────────────────────────────────┤│
│  │  📈 任务趋势分析                  ││
│  │     [柱状图：近7天任务完成量]      ││
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  功能列表区域                         │  ← 核心功能区
│  ┌─────────────────────────────────┐│
│  │  📋 我的清单          >         ││
│  ├─────────────────────────────────┤│
│  │  🏷️ 分类标签          >         ││
│  ├─────────────────────────────────┤│
│  │  🔔 我的通知      🔴99+    >    ││  ← 新增：通知入口
│  ├─────────────────────────────────┤│
│  │  ⚙️ 通知设置          >         ││
│  ├─────────────────────────────────┤│
│  │  ❓ 帮助中心          >         ││
│  ├─────────────────────────────────┤│
│  │  ℹ️ 关于我们          >         ││
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  底部导航栏                          │
│  [待办]    [清单]    [我的🔴]        │  ← 有未读通知时显示红点
└─────────────────────────────────────┘
```

### 2.2 样式规范

#### 颜色规范
| 元素 | 颜色值 | 说明 |
|------|--------|------|
| 主背景色 | `#F5F5F5` | 页面背景 |
| 卡片背景 | `#FFFFFF` | 内容卡片 |
| 主色调 | `#07C160` | 微信绿，用于按钮、图标 |
| 文字主色 | `#333333` | 标题、重要文字 |
| 文字次色 | `#666666` | 描述文字 |
| 文字辅助 | `#999999` | 提示文字 |
| 分割线 | `#E5E5E5` | 列表分隔线 |
| 警告色 | `#FF4D4F` | 未读通知红点 |
| 图表颜色1 | `#07C160` | 已完成/正常状态 |
| 图表颜色2 | `#FAAD14` | 未完成/警告状态 |
| 图表颜色3 | `#FF4D4F` | 逾期/错误状态 |
| 图表颜色4 | `#1890FF` | 柱状图主色 |

#### 字体规范
| 元素 | 字号 | 字重 |
|------|------|------|
| 用户昵称 | 18px | 600 |
| 个性签名 | 14px | 400 |
| 统计数字 | 24px | 600 |
| 统计标签 | 12px | 400 |
| 功能项文字 | 16px | 400 |
| 图表标题 | 16px | 600 |
| 图表标签 | 12px | 400 |

#### 间距规范
| 元素 | 数值 |
|------|------|
| 页面边距 | 16px |
| 卡片内边距 | 16px |
| 列表项高度 | 56px |
| 列表项间距 | 1px (分割线) |
| 分组间距 | 12px |
| 图表区域高度 | 200px |

### 2.3 组件样式

#### 用户信息卡片
- 背景: 渐变 `#07C160` → `#05A050`
- 圆角: 12px
- 内边距: 20px
- 头像: 64px × 64px, 圆形, 白色边框 2px
- 阴影: `0 4px 12px rgba(7, 193, 96, 0.3)`

#### 统计卡片
- 背景: `#FFFFFF`
- 圆角: 12px
- 内边距: 16px
- 阴影: `0 2px 8px rgba(0, 0, 0, 0.05)`

#### 数据看板卡片
- 背景: `#FFFFFF`
- 圆角: 12px
- 内边距: 16px
- 图表高度: 180px
- 阴影: `0 2px 8px rgba(0, 0, 0, 0.05)`

#### 功能列表项
- 背景: `#FFFFFF`
- 高度: 56px
- 内边距: 16px 水平
- 图标: 24px × 24px, 主色调
- 箭头: 16px × 16px, `#CCCCCC`

#### 未读消息红点
- 背景: `#FF4D4F`
- 圆角: 50%
- 最小宽度: 18px
- 高度: 18px
- 字体: 12px, 白色
- 位置: 功能项右侧

## 3. 功能模块设计

### 3.1 功能列表

| 功能模块 | 图标 | 入口 | 说明 |
|----------|------|------|------|
| 个人信息管理 | 👤 | 点击头像卡片 | 编辑昵称、头像、签名 |
| 我的清单 | 📋 | 功能列表第1项 | 查看所有个人清单 |
| 分类标签 | 🏷️ | 功能列表第2项 | 管理任务分类标签 |
| 我的通知 | 🔔 | 功能列表第3项 | 查看所有通知消息，显示未读数量 |
| 通知设置 | ⚙️ | 功能列表第4项 | 开关各类通知 |
| 帮助中心 | ❓ | 功能列表第5项 | 使用指南、常见问题 |
| 关于我们 | ℹ️ | 功能列表第6项 | 版本信息、隐私政策 |

### 3.2 数据统计展示

| 统计项 | 数据来源 | 计算逻辑 |
|--------|----------|----------|
| 我的清单 | lists 集合 | `creatorId = 当前用户ID AND isShared = false` 的数量 |
| 共享清单 | list_members 集合 | `userId = 当前用户ID` 的清单数量 |
| 已完成任务 | tasks 集合 | `creatorId = 当前用户ID AND status = 1` 的数量 |

### 3.3 数据看板

#### 3.3.1 扇形图 - 任务完成情况统计

**图表类型**: 环形图/饼图

**数据维度**:
| 维度 | 颜色 | 说明 |
|------|------|------|
| 已完成 | `#07C160` | status = 1 的任务 |
| 未完成 | `#FAAD14` | status = 0 且未逾期的任务 |
| 已逾期 | `#FF4D4F` | status = 0 且 dueDate < 当前时间的任务 |

**展示内容**:
- 图表中央显示总任务数
- 图例显示各状态数量和占比
- 点击扇形可查看对应任务列表

**数据查询**:
```javascript
// 云函数 getTaskStatusStats
const now = new Date();

// 已完成
const completed = await db.collection('tasks').where({
  creatorId: userId,
  status: 1
}).count();

// 未完成（未逾期）
const uncompleted = await db.collection('tasks').where({
  creatorId: userId,
  status: 0,
  dueDate: db.command.gt(now)
}).count();

// 已逾期
const overdue = await db.collection('tasks').where({
  creatorId: userId,
  status: 0,
  dueDate: db.command.lt(now)
}).count();
```

#### 3.3.2 柱状图 - 近7天任务完成趋势

**图表类型**: 柱状图

**数据维度**:
- X轴: 日期（近7天，格式 MM-DD）
- Y轴: 完成任务数量
- 柱子颜色: `#07C160`

**数据计算**:
```javascript
// 云函数 getTaskTrendStats
const days = 7;
const stats = [];

for (let i = days - 1; i >= 0; i--) {
  const date = new Date();
  date.setDate(date.getDate() - i);
  const startOfDay = new Date(date.setHours(0, 0, 0, 0));
  const endOfDay = new Date(date.setHours(23, 59, 59, 999));
  
  const count = await db.collection('tasks').where({
    creatorId: userId,
    status: 1,
    updatedAt: db.command.gte(startOfDay).and(db.command.lte(endOfDay))
  }).count();
  
  stats.push({
    date: formatDate(date, 'MM-DD'),
    count: count.total
  });
}
```

**交互功能**:
- 点击柱子查看当天完成的任务列表
- 支持左右滑动查看更多历史数据

## 4. 业务逻辑设计

### 4.1 页面生命周期

```javascript
Page({
  data: {
    userInfo: null,        // 用户信息
    statistics: {          // 快捷统计数据
      myLists: 0,
      sharedLists: 0,
      completedTasks: 0
    },
    dashboardData: {       // 数据看板
      pieChart: {          // 扇形图数据
        completed: 0,
        uncompleted: 0,
        overdue: 0
      },
      barChart: []         // 柱状图数据（近7天）
    },
    unreadCount: 0,        // 未读通知数量
    isLogin: false         // 登录状态
  },

  onLoad() {
    // 1. 检查登录状态
    // 2. 获取用户信息
    // 3. 加载统计数据
    // 4. 加载数据看板
    // 5. 加载未读通知数
  },

  onShow() {
    // 刷新统计数据和未读通知数
    this.loadStatistics();
    this.loadUnreadCount();
  },

  onPullDownRefresh() {
    // 下拉刷新：重新加载所有数据
    Promise.all([
      this.loadUserInfo(),
      this.loadStatistics(),
      this.loadDashboardData(),
      this.loadUnreadCount()
    ]).finally(() => {
      wx.stopPullDownRefresh();
    });
  }
});
```

### 4.2 功能逻辑详解

#### 4.2.1 个人信息管理

**入口**: 点击顶部用户信息卡片

**功能逻辑**:
1. 跳转至 `pages/profile/edit/edit` 编辑页面
2. 可编辑字段:
   - 昵称 (nickname): 2-20字符
   - 头像 (avatarUrl): 从相册选择或拍照
   - 个性签名: 0-50字符，可选

**数据更新**:
```javascript
// 更新 users 集合
wx.cloud.callFunction({
  name: 'updateUserInfo',
  data: {
    nickname: '新昵称',
    avatarUrl: '新头像URL',
    signature: '新签名'
  }
});
```

#### 4.2.2 我的清单

**入口**: 功能列表第1项

**功能逻辑**:
1. 跳转至 `pages/profile/my-lists/my-lists`
2. 展示当前用户创建的所有个人清单 (`isShared = false`)
3. 支持操作:
   - 查看清单详情
   - 编辑清单名称/描述
   - 删除清单
   - 搜索清单

**数据查询**:
```javascript
// 查询个人清单
db.collection('lists').where({
  creatorId: currentUserId,
  isShared: false
}).orderBy('updatedAt', 'desc').get();
```

#### 4.2.3 分类标签

**入口**: 功能列表第2项

**功能逻辑**:
1. 跳转至 `pages/profile/categories/categories`
2. 展示用户自定义的分类标签列表
3. 支持操作:
   - 新增分类: 名称(必填) + 颜色选择
   - 编辑分类: 修改名称/颜色
   - 删除分类: 删除前检查是否有关联任务
   - 排序: 拖拽调整分类顺序

**数据结构** (categories 集合):
```javascript
{
  _id: "cat_001",
  name: "工作",
  color: "#FF0000",
  sortOrder: 1,
  userId: "user_001",
  createdAt: Date,
  updatedAt: Date
}
```

**颜色预设选项**:
- 工作: `#FF6B6B` (红)
- 学习: `#4ECDC4` (青)
- 生活: `#45B7D1` (蓝)
- 购物: `#96CEB4` (绿)
- 健康: `#FFEAA7` (黄)
- 娱乐: `#DDA0DD` (紫)
- 其他: `#95A5A6` (灰)

#### 4.2.4 我的通知（新增）

**入口**: 功能列表第3项，带未读数量红点

**功能逻辑**:
1. 跳转至 `pages/profile/notifications/notifications`
2. 通知列表展示:
   - 按时间倒序排列
   - 未读通知高亮显示
   - 支持左滑删除单条通知
   - 支持一键标记全部已读
   - 支持清空所有通知

3. 通知类型:
| 类型 | 图标 | 说明 |
|------|------|------|
| task_assigned | 📋 | 任务被指派 |
| task_updated | ✏️ | 任务被更新 |
| list_shared | 🤝 | 清单被共享 |
| deadline_reminder | ⏰ | 截止日期提醒 |
| task_reminder | 🔔 | 任务提醒 |
| invite_accepted | ✅ | 邀请被接受 |
| invite_rejected | ❌ | 邀请被拒绝 |

4. 通知数据结构 (notifications 集合):
```javascript
{
  _id: "notif_001",
  type: "task_assigned",
  userId: "user_001",
  relatedId: "task_001",
  title: "新任务指派",
  content: "张三将"完成报告"任务指派给你",
  isRead: false,
  createdAt: Date
}
```

**未读数量获取**:
```javascript
// 获取未读通知数量
async loadUnreadCount() {
  const { result } = await wx.cloud.callFunction({
    name: 'getUnreadNotificationCount',
    data: { userId: this.data.userInfo._id }
  });
  
  this.setData({
    unreadCount: result.count
  });
  
  // 设置TabBar红点
  if (result.count > 0) {
    wx.setTabBarBadge({
      index: 2,  // "我的"页面索引
      text: result.count > 99 ? '99+' : String(result.count)
    });
  } else {
    wx.removeTabBarBadge({ index: 2 });
  }
}
```

**标记已读**:
```javascript
// 单条标记已读
async markAsRead(notificationId) {
  await db.collection('notifications').doc(notificationId).update({
    isRead: true
  });
  this.loadUnreadCount();
}

// 全部标记已读
async markAllAsRead() {
  await wx.cloud.callFunction({
    name: 'markAllNotificationsAsRead',
    data: { userId: this.data.userInfo._id }
  });
  this.loadUnreadCount();
}
```

#### 4.2.5 通知设置

**入口**: 功能列表第4项

**功能逻辑**:
1. 跳转至 `pages/profile/notification-settings/notification-settings`
2. 设置项:
   - 总开关: 是否接收通知 (`enableNotifications`)
   - 任务提醒: 任务到期提醒
   - 清单协作: 共享清单相关通知
   - 系统通知: 版本更新、活动通知

**数据更新**:
```javascript
// 更新 users 集合中的 enableNotifications
db.collection('users').doc(userId).update({
  enableNotifications: true/false,
  notificationSettings: {
    taskReminder: true,
    listCollaboration: true,
    systemNotice: true
  }
});
```

#### 4.2.6 帮助中心

**入口**: 功能列表第5项

**功能逻辑**:
1. 跳转至 `pages/profile/help/help`
2. 内容模块:
   - 操作指南: 图文教程
   - 常见问题: FAQ列表
   - 反馈建议: 提交表单
   - 联系客服: 客服入口

#### 4.2.7 关于我们

**入口**: 功能列表第6项

**功能逻辑**:
1. 跳转至 `pages/profile/about/about`
2. 展示内容:
   - 应用名称和Logo
   - 版本号
   - 隐私政策
   - 用户协议
   - 开源许可

### 4.3 数据统计逻辑

```javascript
// 加载统计数据
async loadStatistics() {
  const { result } = await wx.cloud.callFunction({
    name: 'getUserStatistics',
    data: { userId: this.data.userInfo._id }
  });
  
  this.setData({
    statistics: {
      myLists: result.myListsCount,
      sharedLists: result.sharedListsCount,
      completedTasks: result.completedTasksCount
    }
  });
}
```

**云函数实现**:
```javascript
// getUserStatistics 云函数
exports.main = async (event, context) => {
  const { userId } = event;
  const db = cloud.database();
  
  // 1. 统计个人清单数
  const myListsRes = await db.collection('lists').where({
    creatorId: userId,
    isShared: false
  }).count();
  
  // 2. 统计参与的共享清单数
  const sharedListsRes = await db.collection('list_members').where({
    userId: userId
  }).count();
  
  // 3. 统计已完成任务数
  const completedTasksRes = await db.collection('tasks').where({
    creatorId: userId,
    status: 1  // 已完成
  }).count();
  
  return {
    myListsCount: myListsRes.total,
    sharedListsCount: sharedListsRes.total,
    completedTasksCount: completedTasksRes.total
  };
};
```

### 4.4 数据看板逻辑（新增）

```javascript
// 加载数据看板
async loadDashboardData() {
  const { result } = await wx.cloud.callFunction({
    name: 'getDashboardData',
    data: { userId: this.data.userInfo._id }
  });
  
  this.setData({
    dashboardData: {
      pieChart: result.pieChart,
      barChart: result.barChart
    }
  });
}
```

**云函数实现**:
```javascript
// getDashboardData 云函数
exports.main = async (event, context) => {
  const { userId } = event;
  const db = cloud.database();
  const _ = db.command;
  const now = new Date();
  
  // ===== 扇形图数据：任务完成情况 =====
  const [completedRes, uncompletedRes, overdueRes] = await Promise.all([
    // 已完成
    db.collection('tasks').where({
      creatorId: userId,
      status: 1
    }).count(),
    // 未完成（未逾期）
    db.collection('tasks').where({
      creatorId: userId,
      status: 0,
      dueDate: _.gt(now)
    }).count(),
    // 已逾期
    db.collection('tasks').where({
      creatorId: userId,
      status: 0,
      dueDate: _.lt(now)
    }).count()
  ]);
  
  const pieChart = {
    completed: completedRes.total,
    uncompleted: uncompletedRes.total,
    overdue: overdueRes.total,
    total: completedRes.total + uncompletedRes.total + overdueRes.total
  };
  
  // ===== 柱状图数据：近7天任务完成趋势 =====
  const barChart = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
    
    const countRes = await db.collection('tasks').where({
      creatorId: userId,
      status: 1,
      updatedAt: _.gte(startOfDay).and(_.lte(endOfDay))
    }).count();
    
    barChart.push({
      date: `${date.getMonth() + 1}-${date.getDate()}`,
      count: countRes.total,
      fullDate: date.toISOString()
    });
  }
  
  return {
    pieChart,
    barChart
  };
};
```

## 5. 页面跳转关系

```
pages/profile/profile (我的)
    │
    ├── 点击头像 ──> pages/profile/edit/edit (编辑资料)
    │
    ├── 我的清单 ──> pages/profile/my-lists/my-lists (我的清单列表)
    │                    └── 点击清单 ──> pages/list/detail/detail (清单详情)
    │
    ├── 分类标签 ──> pages/profile/categories/categories (分类管理)
    │                    ├── 新增/编辑 ──> pages/profile/categories/edit/edit
    │
    ├── 我的通知 ──> pages/profile/notifications/notifications (通知列表)  [新增]
    │                    └── 点击通知 ──> 跳转对应任务/清单详情
    │
    ├── 通知设置 ──> pages/profile/notification-settings/notification-settings
    │
    ├── 帮助中心 ──> pages/profile/help/help
    │                    ├── 操作指南 ──> pages/profile/help/guide/guide
    │                    ├── 常见问题 ──> pages/profile/help/faq/faq
    │                    └── 反馈建议 ──> pages/profile/help/feedback/feedback
    │
    └── 关于我们 ──> pages/profile/about/about
```

## 6. 权限设计

| 功能 | 权限要求 | 说明 |
|------|----------|------|
| 查看个人信息 | 登录用户 | 仅展示当前登录用户的信息 |
| 编辑个人信息 | 登录用户 | 只能编辑自己的信息 |
| 查看我的清单 | 登录用户 | 仅展示自己创建的清单 |
| 管理分类标签 | 登录用户 | 仅管理自己的分类 |
| 查看通知 | 登录用户 | 仅查看自己的通知 |
| 通知设置 | 登录用户 | 仅修改自己的设置 |
| 查看数据看板 | 登录用户 | 仅展示自己的数据统计 |

## 7. 异常处理

| 异常场景 | 处理方式 |
|----------|----------|
| 未登录 | 显示登录按钮，点击触发微信登录 |
| 网络错误 | 显示重试按钮，提示检查网络 |
| 数据加载失败 | 显示默认数据，提供刷新按钮 |
| 权限不足 | 提示无权限，返回上一页 |
| 图表数据为空 | 显示空状态提示"暂无数据" |

## 8. 性能优化

1. **数据缓存**: 用户信息和统计数据本地缓存，减少请求
2. **懒加载**: 统计数据按需加载，进入页面时并行请求
3. **分页加载**: 清单、分类、通知列表分页展示
4. **图片优化**: 头像使用压缩图，支持懒加载
5. **图表优化**: 使用微信小程序图表库（如 echarts-for-weixin），按需渲染
6. **数据预加载**: 预估用户可能查看的数据，提前加载

## 9. 技术实现建议

### 9.1 图表库选择
推荐使用 **echarts-for-weixin** 或 **wx-charts**：
- 支持扇形图、柱状图等多种图表类型
- 兼容微信小程序
- 支持交互事件

### 9.2 实时通知更新
使用微信云数据库的 **watch** 功能监听通知集合：
```javascript
db.collection('notifications')
  .where({ userId: currentUserId, isRead: false })
  .watch({
    onChange: (snapshot) => {
      // 更新未读数量
      this.loadUnreadCount();
    }
  });
```

### 9.3 新增加云函数列表
| 云函数名 | 功能 |
|----------|------|
| getDashboardData | 获取数据看板数据（扇形图+柱状图） |
| getUnreadNotificationCount | 获取未读通知数量 |
| markAllNotificationsAsRead | 标记所有通知为已读 |
| deleteNotification | 删除单条通知 |
