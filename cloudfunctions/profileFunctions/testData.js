// 测试数据脚本 - 用于在本地开发环境快速添加测试数据
// 在微信开发者工具中，可以通过云函数本地调试执行此脚本

const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 测试用户数据
const testUsers = [
  {
    openid: 'test_openid_001',
    nickname: '测试用户',
    avatarUrl: 'https://thirdwx.qlogo.cn/mmopen/vi_32/POgEwh4mIHO4nibH0KlMECNjjGxQUq24ZEaGT4poC6icRiccVGKSyXwibcPq4BWmiaIGuG1icwxaQX6grC9VemZoJNbrg/132',
    signature: '这是一个测试签名',
    enableNotifications: true,
    notificationSettings: {
      taskReminder: true,
      listCollaboration: true,
      systemNotice: true
    }
  }
];

// 测试清单数据
const testLists = [
  {
    name: '工作清单',
    description: '工作中的待办事项',
    isShared: false,
    visibility: 2
  },
  {
    name: '学习计划',
    description: '学习相关的任务',
    isShared: false,
    visibility: 2
  },
  {
    name: '购物清单',
    description: '需要购买的物品',
    isShared: true,
    visibility: 1
  }
];

// 测试分类数据
const testCategories = [
  { name: '工作', color: '#FF6B6B', sortOrder: 1 },
  { name: '学习', color: '#4ECDC4', sortOrder: 2 },
  { name: '生活', color: '#45B7D1', sortOrder: 3 },
  { name: '购物', color: '#96CEB4', sortOrder: 4 }
];

// 测试任务数据
const generateTestTasks = (userId, categoryIds, listIds) => {
  const now = new Date();
  const tasks = [];
  
  // 已完成任务
  for (let i = 0; i < 15; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - Math.floor(Math.random() * 7));
    
    tasks.push({
      title: `已完成任务 ${i + 1}`,
      description: '这是一个已完成的任务',
      dueDate: new Date(date.getTime() + 24 * 60 * 60 * 1000),
      priority: Math.floor(Math.random() * 4) + 1,
      status: 1,
      listId: listIds[Math.floor(Math.random() * listIds.length)],
      creatorId: userId,
      categoryId: categoryIds[Math.floor(Math.random() * categoryIds.length)],
      repeatType: 0,
      repeatValue: '',
      reminderAt: null,
      reminderSent: false,
      attachments: [],
      createdAt: new Date(date.getTime() - 24 * 60 * 60 * 1000),
      updatedAt: date
    });
  }
  
  // 未完成任务（未逾期）
  for (let i = 0; i < 8; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + Math.floor(Math.random() * 7) + 1);
    
    tasks.push({
      title: `未完成任务 ${i + 1}`,
      description: '这是一个未完成的任务',
      dueDate: date,
      priority: Math.floor(Math.random() * 4) + 1,
      status: 0,
      listId: listIds[Math.floor(Math.random() * listIds.length)],
      creatorId: userId,
      categoryId: categoryIds[Math.floor(Math.random() * categoryIds.length)],
      repeatType: 0,
      repeatValue: '',
      reminderAt: null,
      reminderSent: false,
      attachments: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  
  // 已逾期任务
  for (let i = 0; i < 5; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - Math.floor(Math.random() * 5) - 1);
    
    tasks.push({
      title: `已逾期任务 ${i + 1}`,
      description: '这是一个已逾期的任务',
      dueDate: date,
      priority: Math.floor(Math.random() * 4) + 1,
      status: 0,
      listId: listIds[Math.floor(Math.random() * listIds.length)],
      creatorId: userId,
      categoryId: categoryIds[Math.floor(Math.random() * categoryIds.length)],
      repeatType: 0,
      repeatValue: '',
      reminderAt: null,
      reminderSent: false,
      attachments: [],
      createdAt: new Date(date.getTime() - 48 * 60 * 60 * 1000),
      updatedAt: new Date(date.getTime() - 48 * 60 * 60 * 1000)
    });
  }
  
  return tasks;
};

// 测试通知数据
const generateTestNotifications = (userId, taskIds) => {
  const notifications = [];
  const types = ['task_assigned', 'task_updated', 'list_shared', 'deadline_reminder', 'task_reminder'];
  const titles = {
    'task_assigned': '新任务指派',
    'task_updated': '任务更新',
    'list_shared': '清单共享',
    'deadline_reminder': '截止提醒',
    'task_reminder': '任务提醒'
  };
  
  for (let i = 0; i < 10; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const isRead = Math.random() > 0.5;
    
    notifications.push({
      type,
      userId,
      relatedId: taskIds[Math.floor(Math.random() * taskIds.length)],
      title: titles[type],
      content: `这是${titles[type]}的测试内容`,
      isRead,
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000))
    });
  }
  
  return notifications;
};

// 插入测试数据
exports.insertTestData = async () => {
  try {
    console.log('开始插入测试数据...');
    
    // 1. 插入用户
    console.log('插入用户数据...');
    const userResults = [];
    for (const user of testUsers) {
      const { data: existing } = await db.collection('users')
        .where({ openid: user.openid })
        .get();
      
      if (existing.length === 0) {
        const result = await db.collection('users').add({
          data: {
            ...user,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        userResults.push(result._id);
        console.log(`用户插入成功: ${result._id}`);
      } else {
        userResults.push(existing[0]._id);
        console.log(`用户已存在: ${existing[0]._id}`);
      }
    }
    
    const userId = userResults[0];
    
    // 2. 插入分类
    console.log('插入分类数据...');
    const categoryResults = [];
    for (const category of testCategories) {
      const { data: existing } = await db.collection('categories')
        .where({ userId, name: category.name })
        .get();
      
      if (existing.length === 0) {
        const result = await db.collection('categories').add({
          data: {
            ...category,
            userId,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        categoryResults.push(result._id);
        console.log(`分类插入成功: ${result._id}`);
      } else {
        categoryResults.push(existing[0]._id);
        console.log(`分类已存在: ${existing[0]._id}`);
      }
    }
    
    // 3. 插入清单
    console.log('插入清单数据...');
    const listResults = [];
    for (const list of testLists) {
      const { data: existing } = await db.collection('lists')
        .where({ creatorId: userId, name: list.name })
        .get();
      
      if (existing.length === 0) {
        const result = await db.collection('lists').add({
          data: {
            ...list,
            creatorId: userId,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        listResults.push(result._id);
        console.log(`清单插入成功: ${result._id}`);
      } else {
        listResults.push(existing[0]._id);
        console.log(`清单已存在: ${existing[0]._id}`);
      }
    }
    
    // 4. 插入任务
    console.log('插入任务数据...');
    const tasks = generateTestTasks(userId, categoryResults, listResults);
    const taskResults = [];
    
    // 先清空现有测试任务
    const { data: existingTasks } = await db.collection('tasks')
      .where({ creatorId: userId })
      .get();
    
    for (const task of existingTasks) {
      await db.collection('tasks').doc(task._id).remove();
    }
    
    for (const task of tasks) {
      const result = await db.collection('tasks').add({ data: task });
      taskResults.push(result._id);
    }
    console.log(`任务插入成功: ${taskResults.length} 条`);
    
    // 5. 插入通知
    console.log('插入通知数据...');
    const notifications = generateTestNotifications(userId, taskResults);
    
    // 先清空现有测试通知
    const { data: existingNotifs } = await db.collection('notifications')
      .where({ userId })
      .get();
    
    for (const notif of existingNotifs) {
      await db.collection('notifications').doc(notif._id).remove();
    }
    
    for (const notification of notifications) {
      await db.collection('notifications').add({ data: notification });
    }
    console.log(`通知插入成功: ${notifications.length} 条`);
    
    console.log('测试数据插入完成！');
    return {
      code: 0,
      message: '测试数据插入成功',
      data: {
        userId,
        categoryCount: categoryResults.length,
        listCount: listResults.length,
        taskCount: taskResults.length,
        notificationCount: notifications.length
      }
    };
  } catch (error) {
    console.error('插入测试数据失败:', error);
    return {
      code: -1,
      message: '插入测试数据失败',
      error: error.message
    };
  }
};

// 清理测试数据
exports.clearTestData = async () => {
  try {
    console.log('开始清理测试数据...');
    
    const openid = 'test_openid_001';
    const { data: users } = await db.collection('users')
      .where({ openid })
      .get();
    
    if (users.length === 0) {
      console.log('测试用户不存在');
      return { code: 0, message: '测试用户不存在' };
    }
    
    const userId = users[0]._id;
    
    // 删除任务
    const { data: tasks } = await db.collection('tasks')
      .where({ creatorId: userId })
      .get();
    for (const task of tasks) {
      await db.collection('tasks').doc(task._id).remove();
    }
    console.log(`删除任务: ${tasks.length} 条`);
    
    // 删除通知
    const { data: notifications } = await db.collection('notifications')
      .where({ userId })
      .get();
    for (const notif of notifications) {
      await db.collection('notifications').doc(notif._id).remove();
    }
    console.log(`删除通知: ${notifications.length} 条`);
    
    // 删除清单
    const { data: lists } = await db.collection('lists')
      .where({ creatorId: userId })
      .get();
    for (const list of lists) {
      await db.collection('lists').doc(list._id).remove();
    }
    console.log(`删除清单: ${lists.length} 条`);
    
    // 删除分类
    const { data: categories } = await db.collection('categories')
      .where({ userId })
      .get();
    for (const category of categories) {
      await db.collection('categories').doc(category._id).remove();
    }
    console.log(`删除分类: ${categories.length} 条`);
    
    // 删除用户
    await db.collection('users').doc(userId).remove();
    console.log('删除用户');
    
    console.log('测试数据清理完成！');
    return {
      code: 0,
      message: '测试数据清理成功'
    };
  } catch (error) {
    console.error('清理测试数据失败:', error);
    return {
      code: -1,
      message: '清理测试数据失败',
      error: error.message
    };
  }
};

// 如果是直接运行此文件
if (require.main === module) {
  exports.insertTestData().then(result => {
    console.log('执行结果:', result);
    process.exit(0);
  }).catch(error => {
    console.error('执行错误:', error);
    process.exit(1);
  });
}
