// 通知测试数据脚本
// 使用方式：在微信开发者工具中，通过云函数本地调试执行
// 或在 profileFunctions 云函数中调用 insertNotificationTestData()

const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 生成通知测试数据
 * 覆盖所有5种通知类型，包含已读和未读状态
 */
const generateNotifications = (userId) => {
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  return [
    // ===== task_assigned 任务分配 =====
    {
      type: 'task_assigned',
      userId: userId,
      relatedId: 'task_test_001',
      content: '张三 将任务「完成Q2季度报告」指派给了你',
      isRead: false,
      createdAt: new Date(now - 10 * 60 * 1000) // 10分钟前
    },
    {
      type: 'task_assigned',
      userId: userId,
      relatedId: 'task_test_002',
      content: '李四 将任务「准备周五项目评审材料」指派给了你',
      isRead: false,
      createdAt: new Date(now - 2 * HOUR) // 2小时前
    },

    // ===== task_updated 任务更新 =====
    {
      type: 'task_updated',
      userId: userId,
      relatedId: 'task_test_003',
      content: '王五 将任务「接口联调」的状态更新为已完成',
      isRead: false,
      createdAt: new Date(now - 30 * 60 * 1000) // 30分钟前
    },
    {
      type: 'task_updated',
      userId: userId,
      relatedId: 'task_test_004',
      content: '赵六 修改了任务「UI设计稿评审」的截止日期为 2026-04-15',
      isRead: true,
      createdAt: new Date(now - 1 * DAY) // 1天前
    },

    // ===== list_shared 清单共享 =====
    {
      type: 'list_shared',
      userId: userId,
      relatedId: 'list_test_001',
      content: '张三 邀请你加入共享清单「产品迭代计划」',
      isRead: false,
      createdAt: new Date(now - 1 * HOUR) // 1小时前
    },
    {
      type: 'list_shared',
      userId: userId,
      relatedId: 'list_test_002',
      content: '李四 邀请你加入共享清单「团建活动筹备」，角色为编辑者',
      isRead: true,
      createdAt: new Date(now - 3 * DAY) // 3天前
    },

    // ===== deadline_reminder 截止提醒 =====
    {
      type: 'deadline_reminder',
      userId: userId,
      relatedId: 'task_test_005',
      content: '任务「提交月度总结」将于今天 18:00 截止，请尽快完成',
      isRead: false,
      createdAt: new Date(now - 5 * 60 * 1000) // 5分钟前
    },
    {
      type: 'deadline_reminder',
      userId: userId,
      relatedId: 'task_test_006',
      content: '任务「更新项目文档」将于明天截止，还有1天',
      isRead: false,
      createdAt: new Date(now - 6 * HOUR) // 6小时前
    },
    {
      type: 'deadline_reminder',
      userId: userId,
      relatedId: 'task_test_007',
      content: '任务「代码Review」已逾期2天，请尽快处理',
      isRead: true,
      createdAt: new Date(now - 2 * DAY) // 2天前
    },

    // ===== task_reminder 任务提醒 =====
    {
      type: 'task_reminder',
      userId: userId,
      relatedId: 'task_test_008',
      content: '任务提醒：「参加下午3点产品需求评审会议」即将开始',
      isRead: false,
      createdAt: new Date(now - 15 * 60 * 1000) // 15分钟前
    },
    {
      type: 'task_reminder',
      userId: userId,
      relatedId: 'task_test_009',
      content: '任务提醒：「每周站会」将在30分钟后开始',
      isRead: true,
      createdAt: new Date(now - 5 * DAY) // 5天前
    },
    {
      type: 'task_reminder',
      userId: userId,
      relatedId: 'task_test_010',
      content: '任务提醒：「提交代码到测试分支」请在下班前完成',
      isRead: false,
      createdAt: new Date(now - 4 * HOUR) // 4小时前
    }
  ];
};

/**
 * 插入通知测试数据
 * @param {string} openid - 用户的openid，不传则使用当前云函数调用者的openid
 */
exports.insertNotificationTestData = async (openid) => {
  try {
    // 获取用户ID
    let userId;

    if (openid) {
      const { data: users } = await db.collection('users')
        .where({ openid })
        .get();

      if (users.length === 0) {
        return { code: -1, message: '用户不存在' };
      }
      userId = users[0]._id;
    } else {
      // 使用云函数调用者的openid
      const wxContext = cloud.getWXContext();
      const { data: users } = await db.collection('users')
        .where({ openid: wxContext.OPENID })
        .get();

      if (users.length === 0) {
        return { code: -1, message: '当前用户不存在，请先注册' };
      }
      userId = users[0]._id;
    }

    console.log('目标用户ID:', userId);

    // 先清空该用户的旧测试通知（relatedId 以 task_test_ 或 list_test_ 开头的）
    const { data: existingNotifs } = await db.collection('notifications')
      .where({ userId })
      .get();

    let deletedCount = 0;
    for (const notif of existingNotifs) {
      if (notif.relatedId && (notif.relatedId.startsWith('task_test_') || notif.relatedId.startsWith('list_test_'))) {
        await db.collection('notifications').doc(notif._id).remove();
        deletedCount++;
      }
    }
    console.log(`清理旧测试通知: ${deletedCount} 条`);

    // 插入新测试通知
    const notifications = generateNotifications(userId);
    let insertedCount = 0;

    for (const notification of notifications) {
      await db.collection('notifications').add({ data: notification });
      insertedCount++;
    }

    console.log(`插入测试通知: ${insertedCount} 条`);

    return {
      code: 0,
      message: '通知测试数据插入成功',
      data: {
        userId,
        deletedCount,
        insertedCount,
        types: {
          task_assigned: 2,
          task_updated: 2,
          list_shared: 2,
          deadline_reminder: 3,
          task_reminder: 3
        }
      }
    };
  } catch (error) {
    console.error('插入通知测试数据失败:', error);
    return {
      code: -1,
      message: '插入失败: ' + error.message
    };
  }
};
