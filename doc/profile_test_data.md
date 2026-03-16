# "我的"页面测试数据说明

## 1. 测试数据概述

测试数据脚本位于 `cloudfunctions/profileFunctions/testData.js`，用于快速生成测试数据，方便开发和调试"我的"页面功能。

## 2. 测试数据内容

### 2.1 测试用户
- **openid**: `test_openid_001`
- **昵称**: 测试用户
- **头像**: 默认微信头像
- **签名**: 这是一个测试签名

### 2.2 测试清单（3个）
| 名称 | 类型 | 描述 |
|------|------|------|
| 工作清单 | 个人 | 工作中的待办事项 |
| 学习计划 | 个人 | 学习相关的任务 |
| 购物清单 | 共享 | 需要购买的物品 |

### 2.3 测试分类（4个）
| 名称 | 颜色 |
|------|------|
| 工作 | #FF6B6B (红) |
| 学习 | #4ECDC4 (青) |
| 生活 | #45B7D1 (蓝) |
| 购物 | #96CEB4 (绿) |

### 2.4 测试任务（28个）
| 状态 | 数量 | 说明 |
|------|------|------|
| 已完成 | 15 | 近7天内完成 |
| 未完成 | 8 | 未来7天内到期 |
| 已逾期 | 5 | 过去5天内逾期 |

### 2.5 测试通知（10个）
包含各种类型的通知，其中约50%为未读状态：
- task_assigned: 任务指派
- task_updated: 任务更新
- list_shared: 清单共享
- deadline_reminder: 截止提醒
- task_reminder: 任务提醒

## 3. 使用方法

### 3.1 在微信开发者工具中插入测试数据

#### 方法一：通过云函数控制台

1. 打开微信开发者工具
2. 点击顶部工具栏的"云开发"按钮
3. 进入"云函数"页面
4. 找到 `profileFunctions` 云函数
5. 点击"云端测试"
6. 在测试参数中输入：
```json
{
  "action": "insertTestData"
}
```
7. 点击"运行"

#### 方法二：本地调试

1. 在开发者工具中右键点击 `profileFunctions` 云函数
2. 选择"本地调试"
3. 在调试界面输入测试参数：
```json
{
  "action": "insertTestData"
}
```
4. 点击"调用"

### 3.2 清理测试数据

如果需要清理测试数据，使用以下参数：
```json
{
  "action": "clearTestData"
}
```

## 4. 更新云函数入口

需要在 `cloudfunctions/profileFunctions/index.js` 中添加测试数据相关操作：

```javascript
// 在 main 函数中添加
const testData = require('./testData');

case 'insertTestData':
  return await testData.insertTestData();
case 'clearTestData':
  return await testData.clearTestData();
```

## 5. 验证数据

插入测试数据后，可以在"我的"页面看到：

1. **用户信息卡片**: 显示"测试用户"头像和昵称
2. **快捷统计**: 
   - 我的清单: 2 (工作清单、学习计划)
   - 共享清单: 0 (需要手动加入共享清单)
   - 已完成任务: 15
3. **数据看板**:
   - 扇形图: 已完成15、未完成8、已逾期5
   - 柱状图: 近7天完成任务数量分布
4. **功能列表**:
   - 我的通知: 显示未读数量角标

## 6. 注意事项

1. 测试数据使用固定的 `openid: test_openid_001`，仅在开发环境使用
2. 每次插入测试数据前会自动清理该用户的旧数据
3. 生产环境请勿使用此测试数据
4. 测试数据中的图片URL为示例，可能需要替换为实际可访问的图片

## 7. 自定义测试数据

如需自定义测试数据，可以修改 `testData.js` 中的以下部分：

- `testUsers`: 修改用户信息
- `testLists`: 修改清单列表
- `testCategories`: 修改分类列表
- `generateTestTasks`: 修改任务生成逻辑
- `generateTestNotifications`: 修改通知生成逻辑
