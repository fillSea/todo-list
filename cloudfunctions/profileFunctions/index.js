const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const testData = require('./testData');

// 主入口函数
exports.main = async (event, context) => {
  const { action } = event;

  // 获取当前用户openid
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  // 测试数据操作不需要openid验证
  if (action === 'insertTestData' || action === 'clearTestData') {
    try {
      switch (action) {
        case 'insertTestData':
          return await testData.insertTestData();
        case 'clearTestData':
          return await testData.clearTestData();
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
        return await deleteNotification(openid, event.notificationId);
      case 'updateUserInfo':
        return await updateUserInfo(openid, event.data);
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
        signature: '',
        enableNotifications: true,
        notificationSettings: {
          taskReminder: true,
          listCollaboration: true,
          systemNotice: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
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
          myListsCount: 0,
          sharedListsCount: 0,
          completedTasksCount: 0
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

    // 3. 统计已完成任务数
    const completedTasksRes = await db.collection('tasks')
      .where({
        creatorId: userId,
        status: 1
      })
      .count();

    return {
      code: 0,
      message: 'success',
      data: {
        myListsCount: myListsRes.total,
        sharedListsCount: sharedListsRes.total,
        completedTasksCount: completedTasksRes.total
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

    // 获取所有未读通知
    const { data: notifications } = await db.collection('notifications')
      .where({
        userId: userId,
        isRead: false
      })
      .get();

    // 批量更新
    const updatePromises = notifications.map(notif => {
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
      updatedAt: new Date()
    };

    if (data.nickname !== undefined) updateData.nickname = data.nickname;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.signature !== undefined) updateData.signature = data.signature;
    if (data.enableNotifications !== undefined) updateData.enableNotifications = data.enableNotifications;
    if (data.notificationSettings !== undefined) updateData.notificationSettings = data.notificationSettings;

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
