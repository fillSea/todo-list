const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const testData = require('./testData');
const notificationTestData = require('./notificationTestData');

// 主入口函数
exports.main = async (event, context) => {
  const { action } = event;

  // 获取当前用户openid
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  // 测试数据操作不需要openid验证
  if (action === 'insertTestData' || action === 'clearTestData' || action === 'insertNotificationTestData') {
    try {
      switch (action) {
        case 'insertTestData':
          return await testData.insertTestData();
        case 'clearTestData':
          return await testData.clearTestData();
        case 'insertNotificationTestData':
          return await notificationTestData.insertNotificationTestData();
      }
    } catch (error) {
      console.error('云函数执行错误:', error);
      return {
        code: -1,
        message: error.message || '服务器错误'
      };
    }
  }

  if (!openid) {
    return {
      code: -1,
      message: '未获取到用户信息'
    };
  }

  try {
    // 根据action执行不同操作
    switch (action) {
      case 'getUserInfo':
        return await getUserInfo(openid);
      case 'getUserStatistics':
        return await getUserStatistics(openid);
      case 'getDashboardData':
        return await getDashboardData(openid);
      case 'getUnreadNotificationCount':
        return await getUnreadNotificationCount(openid);
      case 'markAllNotificationsAsRead':
        return await markAllNotificationsAsRead(openid);
      case 'deleteNotification':
        return await deleteNotification(openid, event.data && event.data.notificationId || event.notificationId);
      case 'updateUserInfo':
        return await updateUserInfo(openid, event.data);
      case 'registerOrUpdateUser':
        return await registerOrUpdateUser(openid, event.data);
      case 'getUserTasks':
        return await getUserTasks(openid);
      case 'getNotifications':
        return await getNotifications(openid, event.data);
      case 'markNotificationAsRead':
        return await markNotificationAsRead(openid, event.data);
      case 'getNotificationSettings':
        return await getNotificationSettings(openid);
      case 'updateNotificationSettings':
        return await updateNotificationSettings(openid, event.data);
      default:
        return {
          code: -1,
          message: '未知操作'
        };
    }
  } catch (error) {
    console.error('云函数执行错误:', error);
    return {
      code: -1,
      message: error.message || '服务器错误'
    };
  }
};

// 获取用户信息
async function getUserInfo(openid) {
  try {
    const { data } = await db.collection('users')
      .where({ openid })
      .get();

    if (data.length === 0) {
      // 用户不存在，创建新用户
      const newUser = {
        openid,
        nickname: '微信用户',
        avatarUrl: '',
        enableNotifications: true,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      };

      const result = await db.collection('users').add({
        data: newUser
      });

      return {
        code: 0,
        message: 'success',
        data: { ...newUser, _id: result._id }
      };
    }

    return {
      code: 0,
      message: 'success',
      data: data[0]
    };
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return {
      code: -1,
      message: '获取用户信息失败'
    };
  }
}

// 获取用户统计数据
async function getUserStatistics(openid) {
  try {
    // 先获取用户ID
    const { data: users } = await db.collection('users')
      .where({ openid })
      .get();

    if (users.length === 0) {
      return {
        code: 0,
        data: {
          myLists: 0,
          sharedLists: 0,
          completedTasks: 0
        }
      };
    }

    const userId = users[0]._id;

    // 1. 统计个人清单数
    const myListsRes = await db.collection('lists')
      .where({
        creatorId: userId,
        isShared: false
      })
      .count();

    // 2. 统计参与的共享清单数
    const sharedListsRes = await db.collection('list_members')
      .where({
        userId: userId
      })
      .count();

    // 3. 统计已完成任务数（周期任务智能过滤）
    // 非周期任务：repeatType不大于0的已完成任务
    const normalCompletedRes = await db.collection('tasks')
      .where({
        creatorId: userId,
        status: 1,
        repeatType: _.not(_.gt(0)),
        isPeriodicInstance: _.neq(true)
      })
      .count();

    // 周期任务：需要智能过滤，只统计当前及之前日期的实例
    const completedTasks = await filterPeriodicTasksForStats(userId, { status: 1 });

    return {
      code: 0,
      message: 'success',
      data: {
        myLists: myListsRes.total,
        sharedLists: sharedListsRes.total,
        completedTasks: normalCompletedRes.total + completedTasks.length
      }
    };
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return {
      code: -1,
      message: '获取统计数据失败'
    };
  }
}

// 获取数据看板数据
async function getDashboardData(openid) {
  try {
    // 先获取用户ID
    const { data: users } = await db.collection('users')
      .where({ openid })
      .get();

    if (users.length === 0) {
      return {
        code: 0,
        data: {
          pieChart: { completed: 0, uncompleted: 0, overdue: 0, total: 0 },
          barChart: []
        }
      };
    }

    const userId = users[0]._id;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    // ===== 扇形图数据：任务完成情况（周期任务智能过滤） =====

    // 非周期任务：直接用数据库查询（排除周期任务）
    const normalTaskCondition = {
      creatorId: userId,
      repeatType: _.not(_.gt(0)),
      isPeriodicInstance: _.neq(true)
    };

    const [normalCompleted, normalUncompleted, normalOverdue] = await Promise.all([
      db.collection('tasks').where({
        ...normalTaskCondition,
        status: 1
      }).count(),
      // 未完成（未逾期）：dueDate >= 今天开始
      db.collection('tasks').where({
        ...normalTaskCondition,
        status: 0,
        dueDate: _.gte(todayStart)
      }).count(),
      // 已逾期：dueDate < 今天开始
      db.collection('tasks').where({
        ...normalTaskCondition,
        status: 0,
        dueDate: _.lt(todayStart)
      }).count()
    ]);

    // 周期任务：智能过滤后分类统计
    const [periodicCompleted, periodicUncompleted, periodicOverdue] = await Promise.all([
      filterPeriodicTasksForStats(userId, { status: 1 }),
      filterPeriodicTasksForStats(userId, { status: 0, overdueType: 'not_overdue' }),
      filterPeriodicTasksForStats(userId, { status: 0, overdueType: 'overdue' })
    ]);

    const pieChart = {
      completed: normalCompleted.total + periodicCompleted.length,
      uncompleted: normalUncompleted.total + periodicUncompleted.length,
      overdue: normalOverdue.total + periodicOverdue.length,
      total: normalCompleted.total + normalUncompleted.total + normalOverdue.total
        + periodicCompleted.length + periodicUncompleted.length + periodicOverdue.length
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
      code: 0,
      message: 'success',
      data: {
        pieChart,
        barChart
      }
    };
  } catch (error) {
    console.error('获取数据看板失败:', error);
    return {
      code: -1,
      message: '获取数据看板失败'
    };
  }
}

// 获取未读通知数量
async function getUnreadNotificationCount(openid) {
  try {
    // 先获取用户ID
    const { data: users } = await db.collection('users')
      .where({ openid })
      .get();

    if (users.length === 0) {
      return {
        code: 0,
        data: { count: 0 }
      };
    }

    const userId = users[0]._id;

    const result = await db.collection('notifications').where({
      userId: userId,
      isRead: false
    }).count();

    return {
      code: 0,
      message: 'success',
      data: { count: result.total }
    };
  } catch (error) {
    console.error('获取未读通知数量失败:', error);
    return {
      code: -1,
      message: '获取未读通知数量失败'
    };
  }
}

// 标记所有通知为已读
async function markAllNotificationsAsRead(openid) {
  try {
    // 先获取用户ID
    const { data: users } = await db.collection('users')
      .where({ openid })
      .get();

    if (users.length === 0) {
      return {
        code: 0,
        message: 'success'
      };
    }

    const userId = users[0]._id;

    // 分批获取所有未读通知（突破默认 20 条限制）
    let allUnread = [];
    const batchSize = 100;
    let batchIndex = 0;

    while (true) {
      const { data: batch } = await db.collection('notifications')
        .where({
          userId: userId,
          isRead: false
        })
        .skip(batchIndex * batchSize)
        .limit(batchSize)
        .get();

      allUnread = allUnread.concat(batch);
      if (batch.length < batchSize) break;
      batchIndex++;
    }

    // 批量更新
    const updatePromises = allUnread.map(notif => {
      return db.collection('notifications').doc(notif._id).update({
        data: {
          isRead: true,
          updatedAt: new Date()
        }
      });
    });

    await Promise.all(updatePromises);

    return {
      code: 0,
      message: 'success'
    };
  } catch (error) {
    console.error('标记通知已读失败:', error);
    return {
      code: -1,
      message: '标记通知已读失败'
    };
  }
}

// 删除单条通知
async function deleteNotification(openid, notificationId) {
  try {
    if (!notificationId) {
      return {
        code: -1,
        message: '通知ID不能为空'
      };
    }

    // 先获取用户ID
    const { data: users } = await db.collection('users')
      .where({ openid })
      .get();

    if (users.length === 0) {
      return {
        code: -1,
        message: '用户不存在'
      };
    }

    const userId = users[0]._id;

    // 验证通知是否属于当前用户
    const { data: notifications } = await db.collection('notifications')
      .where({
        _id: notificationId,
        userId: userId
      })
      .get();

    if (notifications.length === 0) {
      return {
        code: -1,
        message: '通知不存在或无权限删除'
      };
    }

    await db.collection('notifications').doc(notificationId).remove();

    return {
      code: 0,
      message: 'success'
    };
  } catch (error) {
    console.error('删除通知失败:', error);
    return {
      code: -1,
      message: '删除通知失败'
    };
  }
}

// 更新用户信息
async function updateUserInfo(openid, data) {
  try {
    if (!data) {
      return {
        code: -1,
        message: '更新数据不能为空'
      };
    }

    const { data: users } = await db.collection('users')
      .where({ openid })
      .get();

    if (users.length === 0) {
      return {
        code: -1,
        message: '用户不存在'
      };
    }

    const userId = users[0]._id;

    const updateData = {
      updatedAt: db.serverDate()
    };

    if (data.nickname !== undefined) updateData.nickname = data.nickname;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.enableNotifications !== undefined) updateData.enableNotifications = data.enableNotifications;

    await db.collection('users').doc(userId).update({
      data: updateData
    });

    return {
      code: 0,
      message: 'success'
    };
  } catch (error) {
    console.error('更新用户信息失败:', error);
    return {
      code: -1,
      message: '更新用户信息失败'
    };
  }
}

// 注册或更新用户信息
async function registerOrUpdateUser(openid, data) {
  try {
    if (!data || !data.nickname) {
      return {
        code: -1,
        message: '昵称不能为空'
      };
    }

    const { data: users } = await db.collection('users')
      .where({ openid })
      .get();

    const now = db.serverDate();

    if (users.length === 0) {
      // 新用户注册
      const newUser = {
        openid,
        nickname: data.nickname,
        avatarUrl: data.avatarUrl || '',
        enableNotifications: data.enableNotifications !== false,
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('users').add({
        data: newUser
      });

      return {
        code: 0,
        message: '注册成功',
        data: {
          _id: result._id,
          ...newUser
        }
      };
    } else {
      // 更新现有用户信息
      const userId = users[0]._id;

      const updateData = {
        updatedAt: now
      };

      if (data.nickname !== undefined) updateData.nickname = data.nickname;
      if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
      if (data.enableNotifications !== undefined) updateData.enableNotifications = data.enableNotifications;

      await db.collection('users').doc(userId).update({
        data: updateData
      });

      return {
        code: 0,
        message: '更新成功',
        data: {
          _id: userId,
          ...users[0],
          ...updateData
        }
      };
    }
  } catch (error) {
    console.error('注册/更新用户信息失败:', error);
    return {
      code: -1,
      message: '注册/更新用户信息失败'
    };
  }
}

// 获取用户任务列表
async function getUserTasks(openid) {
  try {
    // 先获取用户ID
    const { data: users } = await db.collection('users')
      .where({ openid })
      .get();

    if (users.length === 0) {
      return {
        code: 0,
        message: 'success',
        data: []
      };
    }

    const userId = users[0]._id;

    // 查询用户的所有任务
    const { data: tasks } = await db.collection('tasks')
      .where({
        creatorId: userId
      })
      .orderBy('createdAt', 'desc')
      .get();

    return {
      code: 0,
      message: 'success',
      data: tasks
    };
  } catch (error) {
    console.error('获取用户任务失败:', error);
    return {
      code: -1,
      message: '获取用户任务失败'
    };
  }
}

// 获取通知列表
async function getNotifications(openid, data) {
  try {
    const { type = 'all', page = 1, pageSize = 10 } = data || {};

    // 获取用户ID
    const { data: users } = await db.collection('users')
      .where({ openid })
      .get();

    if (users.length === 0) {
      return {
        code: 0,
        message: 'success',
        data: { list: [], total: 0 }
      };
    }

    const userId = users[0]._id;

    let query = { userId };

    if (type !== 'all') {
      query.type = type;
    }

    // 查询总数
    const countResult = await db.collection('notifications')
      .where(query)
      .count();

    // 查询通知
    const { data: notifications } = await db.collection('notifications')
      .where(query)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    // 格式化时间
    const formattedNotifications = notifications.map(item => ({
      ...item,
      createdAt: formatTime(item.createdAt)
    }));

    return {
      code: 0,
      message: 'success',
      data: formattedNotifications,
      total: countResult.total
    };
  } catch (error) {
    console.error('获取通知列表失败:', error);
    return {
      code: -1,
      message: '获取通知列表失败'
    };
  }
}

// 标记单条通知为已读
async function markNotificationAsRead(openid, data) {
  try {
    const { notificationId } = data || {};

    if (!notificationId) {
      return {
        code: -1,
        message: '通知ID不能为空'
      };
    }

    // 获取用户ID
    const { data: users } = await db.collection('users')
      .where({ openid })
      .get();

    if (users.length === 0) {
      return {
        code: -1,
        message: '用户不存在'
      };
    }

    const userId = users[0]._id;

    // 验证通知是否属于当前用户
    const { data: notifications } = await db.collection('notifications')
      .where({
        _id: notificationId,
        userId
      })
      .get();

    if (notifications.length === 0) {
      return {
        code: -1,
        message: '通知不存在或无权限'
      };
    }

    await db.collection('notifications').doc(notificationId).update({
      data: {
        isRead: true,
        updatedAt: db.serverDate()
      }
    });

    return {
      code: 0,
      message: 'success'
    };
  } catch (error) {
    console.error('标记通知已读失败:', error);
    return {
      code: -1,
      message: '标记通知已读失败'
    };
  }
}

// 获取通知设置
async function getNotificationSettings(openid) {
  try {
    const { data: users } = await db.collection('users')
      .where({ openid })
      .get();

    if (users.length === 0) {
      return {
        code: -1,
        message: '用户不存在'
      };
    }

    const user = users[0];

    // 返回通知设置，使用默认值
    return {
      code: 0,
      message: 'success',
      data: {
        enableNotifications: user.enableNotifications !== false,
        taskReminder: true,
        listCollaboration: true,
        systemNotice: true
      }
    };
  } catch (error) {
    console.error('获取通知设置失败:', error);
    return {
      code: -1,
      message: '获取通知设置失败'
    };
  }
}

// 更新通知设置
async function updateNotificationSettings(openid, data) {
  try {
    if (!data) {
      return {
        code: -1,
        message: '设置数据不能为空'
      };
    }

    const { data: users } = await db.collection('users')
      .where({ openid })
      .get();

    if (users.length === 0) {
      return {
        code: -1,
        message: '用户不存在'
      };
    }

    const userId = users[0]._id;

    const updateData = {
      updatedAt: db.serverDate()
    };

    if (data.enableNotifications !== undefined) {
      updateData.enableNotifications = data.enableNotifications;
    }

    await db.collection('users').doc(userId).update({
      data: updateData
    });

    return {
      code: 0,
      message: '更新成功'
    };
  } catch (error) {
    console.error('更新通知设置失败:', error);
    return {
      code: -1,
      message: '更新通知设置失败'
    };
  }
}

/**
 * 周期任务智能过滤统计
 * 规则：
 * 1. 只统计 dueDate <= 今天的周期任务实例
 * 2. 如果当前（最近到期的）周期任务已完成，则额外计入下一个未来的周期任务实例
 * 
 * @param {string} userId - 用户ID
 * @param {object} filter - 过滤条件
 *   - status: 0 或 1
 *   - overdueType: 'overdue' | 'not_overdue' (仅 status=0 时有效)
 * @returns {Array} 符合条件的周期任务列表
 */
async function filterPeriodicTasksForStats(userId, filter) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  // 分批获取所有周期任务（repeatType > 0 的原始任务 + isPeriodicInstance 的实例）
  let allPeriodicTasks = [];
  const batchSize = 100;
  let batchIndex = 0;

  while (true) {
    const { data: batch } = await db.collection('tasks')
      .where({
        creatorId: userId,
        repeatType: _.gt(0)
      })
      .orderBy('dueDate', 'asc')
      .skip(batchIndex * batchSize)
      .limit(batchSize)
      .get();
    allPeriodicTasks = allPeriodicTasks.concat(batch);
    if (batch.length < batchSize) break;
    batchIndex++;
  }

  // 同时获取 isPeriodicInstance 的实例（它们的 repeatType 可能也 > 0，但以防万一也查一下）
  batchIndex = 0;
  let periodicInstances = [];
  while (true) {
    const { data: batch } = await db.collection('tasks')
      .where({
        creatorId: userId,
        isPeriodicInstance: true
      })
      .orderBy('dueDate', 'asc')
      .skip(batchIndex * batchSize)
      .limit(batchSize)
      .get();
    periodicInstances = periodicInstances.concat(batch);
    if (batch.length < batchSize) break;
    batchIndex++;
  }

  // 合并去重
  const taskMap = new Map();
  allPeriodicTasks.forEach(t => taskMap.set(t._id, t));
  periodicInstances.forEach(t => taskMap.set(t._id, t));
  const allTasks = Array.from(taskMap.values());

  // 按 parentTaskId 分组（原始任务用自身 _id 作为 groupKey）
  const groups = {};
  allTasks.forEach(t => {
    const groupKey = t.parentTaskId || t._id;
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(t);
  });

  // 对每组周期任务进行智能过滤
  let result = [];

  for (const groupKey of Object.keys(groups)) {
    const instances = groups[groupKey].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    // 分为已到期（dueDate <= 今天结束）和未来的
    const dueInstances = instances.filter(t => new Date(t.dueDate) <= todayEnd);
    const futureInstances = instances.filter(t => new Date(t.dueDate) > todayEnd);

    // 基础：纳入所有已到期的实例
    let eligible = [...dueInstances];

    // 如果最近到期的实例已完成，额外纳入下一个未来实例
    if (dueInstances.length > 0) {
      const latestDue = dueInstances[dueInstances.length - 1];
      if (latestDue.status === 1 && futureInstances.length > 0) {
        eligible.push(futureInstances[0]);
      }
    }

    // 根据 filter 条件筛选
    eligible.forEach(t => {
      if (filter.status !== undefined && t.status !== filter.status) return;

      // 逾期判断：dueDate 在今天之前（不含今天）才算逾期
      const taskDueDate = new Date(t.dueDate);
      if (filter.overdueType === 'overdue' && taskDueDate >= todayStart) return;
      if (filter.overdueType === 'not_overdue' && taskDueDate < todayStart) return;

      result.push(t);
    });
  }

  return result;
}

// 格式化时间
function formatTime(date) {
  if (!date) return '';

  const now = new Date();
  const target = new Date(date);
  const diff = now - target;

  // 小于1分钟
  if (diff < 60000) {
    return '刚刚';
  }

  // 小于1小时
  if (diff < 3600000) {
    return Math.floor(diff / 60000) + '分钟前';
  }

  // 小于24小时
  if (diff < 86400000) {
    return Math.floor(diff / 3600000) + '小时前';
  }

  // 小于7天
  if (diff < 604800000) {
    return Math.floor(diff / 86400000) + '天前';
  }

  // 大于7天，显示日期
  const year = target.getFullYear();
  const month = target.getMonth() + 1;
  const day = target.getDate();
  return `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;
}
