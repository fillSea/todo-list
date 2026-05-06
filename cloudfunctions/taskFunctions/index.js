const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 主入口函数
exports.main = async (event, context) => {
  const { action, data } = event;

  // 获取当前用户openid
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  // 定时触发器不需要openid验证
  if (context && context.trigger === 'timer') {
    try {
      // 根据触发器名称执行不同的定时任务
      if (context.name === 'cleanupExpiredPeriodicTasks') {
        return await cleanupExpiredPeriodicTasks();
      }
      return await checkReminders();
    } catch (error) {
      console.error('定时任务执行错误:', error);
      return {
        code: -1,
        message: error.message || '定时任务执行失败'
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
      case 'createTask':
        return await createTask(openid, data);
      case 'updateTask':
        return await updateTask(openid, data);
      case 'deleteTask':
        return await deleteTask(openid, data);
      case 'getTaskDetail':
        return await getTaskDetail(openid, data);
      case 'getTaskList':
        return await getTaskList(openid, data);
      case 'toggleTaskStatus':
        return await toggleTaskStatus(openid, data);
      case 'getTasksByCategory':
        return await getTasksByCategory(openid, data);
      case 'getTasksByList':
        return await getTasksByList(openid, data);
      case 'getTasksByStatus':
        return await getTasksByStatus(openid, data);
      case 'searchTasks':
        return await searchTasks(openid, data);
      case 'batchUpdateTasks':
        return await batchUpdateTasks(openid, data);
      case 'batchDeleteTasks':
        return await batchDeleteTasks(openid, data);
      case 'getPeriodicTaskStats':
        return await getPeriodicTaskStats(openid, data);
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

// 获取用户ID
async function getUserId(openid) {
  const { data: users } = await db.collection('users')
    .where({ openid })
    .get();

  if (users.length === 0) {
    throw new Error('用户不存在');
  }

  return users[0]._id;
}

// 验证清单权限
async function verifyListPermission(userId, listId, requiredRole = 3) {
  // 1-创建者，2-编辑者，3-查看者
  const { data: members } = await db.collection('list_members')
    .where({
      listId,
      userId
    })
    .get();

  if (members.length === 0) {
    // 检查是否是清单创建者
    const { data: lists } = await db.collection('lists')
      .where({
        _id: listId,
        creatorId: userId
      })
      .get();

    if (lists.length === 0) {
      return { hasPermission: false, role: null };
    }
    return { hasPermission: true, role: 1 };
  }

  const role = members[0].role;
  return { hasPermission: role <= requiredRole, role };
}

// 创建任务
async function createTask(openid, data) {
  try {
    if (!data || !data.title || !data.title.trim()) {
      return {
        code: -1,
        message: '任务标题不能为空'
      };
    }

    // 截止日期必填
    if (!data.dueDate) {
      return {
        code: -1,
        message: '截止日期不能为空'
      };
    }

    const userId = await getUserId(openid);
    const now = db.serverDate();

    // 验证清单权限
    if (data.listId) {
      const { hasPermission } = await verifyListPermission(userId, data.listId, 2);
      if (!hasPermission) {
        return {
          code: -1,
          message: '无权限在此清单创建任务'
        };
      }
    }

    // 处理截止日期和提醒时间
    let dueDate = null;
    let reminderAt = null;

    if (data.dueDate) {
      if (data.dueTime) {
        // 前端传来的日期和时间是用户本地时间（UTC+8），需要正确转换为 UTC 存储
        dueDate = new Date(`${data.dueDate}T${data.dueTime}:00+08:00`);
      } else {
        dueDate = new Date(`${data.dueDate}T00:00:00+08:00`);
      }
    }

    // 处理提醒时间
    if (data.reminderValue && data.reminderValue > 0 && dueDate) {
      const reminderMinutes = getReminderMinutes(data.reminderValue);
      reminderAt = new Date(dueDate.getTime() - reminderMinutes * 60 * 1000);
    }

    // 构建任务数据
    const taskData = {
      title: data.title.trim(),
      description: data.description ? data.description.trim() : '',
      dueDate: dueDate,
      priority: data.priority || 1,
      status: 0, // 0-未完成
      listId: data.listId || '',
      creatorId: userId,
      categoryId: data.categoryId || '',
      repeatType: data.repeatType || 0, // 0-不重复，1-每天，2-每周，3-每月
      repeatValue: data.repeatValue || '',
      reminderAt: reminderAt,
      reminderSent: false,
      attachments: data.attachments || [],
      createdAt: now,
      updatedAt: now
    };

    const result = await db.collection('tasks').add({
      data: taskData
    });

    // 记录操作日志
    await recordOperation('task_create', result._id, userId, { taskTitle: taskData.title, task: taskData }, taskData.listId);

    // 如果是周期任务，预生成未来30天的周期任务实例
    let periodicTasks = [];
    if (data.repeatType > 0) {
      periodicTasks = await generatePeriodicTasks(openid, taskData, result._id);
    }

    return {
      code: 0,
      message: '创建成功',
      data: {
        _id: result._id,
        ...taskData,
        periodicTasks: periodicTasks
      }
    };
  } catch (error) {
    console.error('创建任务失败:', error);
    return {
      code: -1,
      message: error.message || '创建任务失败'
    };
  }
}

// 更新任务
async function updateTask(openid, data) {
  try {

    console.log("任务信息:", JSON.stringify(data, null, 2));
    if (!data || !data.taskId) {
      return {
        code: -1,
        message: '任务ID不能为空'
      };
    }

    if (!data.title || !data.title.trim()) {
      return {
        code: -1,
        message: '任务标题不能为空'
      };
    }

    // 截止日期不能为空（如果传了dueDate字段，则必须是非空值）
    if (data.dueDate !== undefined && !data.dueDate) {
      return {
        code: -1,
        message: '截止日期不能为空'
      };
    }

    const userId = await getUserId(openid);
    const { taskId } = data;

    // 获取原任务数据
    const { data: tasks } = await db.collection('tasks')
      .where({ _id: taskId })
      .get();

    if (tasks.length === 0) {
      return {
        code: -1,
        message: '任务不存在'
      };
    }

    const oldTask = tasks[0];

    console.log("原任务信息:", JSON.stringify(oldTask, null, 2));

    // 验证权限
    if (oldTask.creatorId !== userId) {
      // 检查是否是清单成员且有编辑权限
      if (oldTask.listId) {
        const { hasPermission } = await verifyListPermission(userId, oldTask.listId, 2);
        if (!hasPermission) {
          return {
            code: -1,
            message: '无权限编辑此任务'
          };
        }
      } else {
        return {
          code: -1,
          message: '无权限编辑此任务'
        };
      }
    }

    // 处理截止日期和提醒时间
    let dueDate = oldTask.dueDate;
    let reminderAt = oldTask.reminderAt;
    let reminderSent = oldTask.reminderSent;

    // 处理截止日期和时间
    const hasDueDateChange = data.dueDate !== undefined;
    const hasDueTimeChange = data.dueTime !== undefined;

    if (hasDueDateChange || hasDueTimeChange) {
      // 获取当前日期和时间值
      // 注意：currentDate 需要转换到 UTC+8 来提取日期/时间部分
      let currentDate = dueDate ? new Date(dueDate) : null;
      let dateStr, timeStr;

      if (data.dueDate !== undefined) {
        dateStr = data.dueDate;
      } else if (currentDate) {
        // 将已有的 UTC 时间转换为 UTC+8 再提取日期部分
        const localDate = new Date(currentDate.getTime() + 8 * 60 * 60 * 1000);
        dateStr = localDate.toISOString().slice(0, 10);
      } else {
        dateStr = '';
      }

      if (data.dueTime !== undefined) {
        timeStr = data.dueTime;
      } else if (currentDate) {
        // 将已有的 UTC 时间转换为 UTC+8 再提取时间部分
        const localDate = new Date(currentDate.getTime() + 8 * 60 * 60 * 1000);
        timeStr = localDate.toISOString().slice(11, 16);
      } else {
        timeStr = '00:00';
      }

      if (dateStr) {
        // 前端传来的日期和时间是用户本地时间（UTC+8），需要正确转换为 UTC 存储
        dueDate = new Date(`${dateStr}T${timeStr}:00+08:00`);
      } else {
        dueDate = null;
      }
      // 重置提醒发送状态
      reminderSent = false;
    }

    // 处理提醒时间
    if (data.reminderValue !== undefined) {
      if (data.reminderValue > 0 && dueDate) {
        const reminderMinutes = getReminderMinutes(data.reminderValue);
        reminderAt = new Date(dueDate.getTime() - reminderMinutes * 60 * 1000);
      } else {
        reminderAt = null;
      }
      reminderSent = false;
    }

    const now = db.serverDate();

    // 构建更新数据
    const updateData = {
      title: data.title.trim(),
      updatedAt: now
    };

    // 处理可选字段
    if (data.description !== undefined) {
      updateData.description = data.description ? data.description.trim() : '';
    }
    if (data.priority !== undefined) {
      updateData.priority = data.priority;
    }
    if (data.listId !== undefined) {
      updateData.listId = data.listId || '';
    }
    if (data.categoryId !== undefined) {
      updateData.categoryId = data.categoryId || '';
    }
    if (data.repeatType !== undefined) {
      updateData.repeatType = data.repeatType || 0;
    }
    if (data.repeatValue !== undefined) {
      updateData.repeatValue = data.repeatValue || '';
    }
    if (data.attachments !== undefined) {
      updateData.attachments = data.attachments || [];
    }

    // 处理日期字段
    if (data.dueDate !== undefined || data.dueTime !== undefined) {
      updateData.dueDate = dueDate;
    }
    if (data.reminderValue !== undefined || data.dueDate !== undefined || data.dueTime !== undefined) {
      updateData.reminderAt = reminderAt;
      updateData.reminderSent = reminderSent;
    }

    // 处理状态字段
    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    // 更新任务数据（包含所有字段，reminderAt 为 null 时会覆盖原值）
    await db.collection('tasks').doc(taskId).update({
      data: updateData
    });

    // 如果从周期任务改为非周期任务，清理已预生成的未来周期实例
    if (oldTask.repeatType > 0 && updateData.repeatType === 0) {
      const parentTaskId = oldTask.parentTaskId || taskId;
      try {
        // 删除所有未完成的周期子实例
        const { data: periodicInstances } = await db.collection('tasks')
          .where({
            parentTaskId: parentTaskId,
            status: 0
          })
          .get();

        let deletedCount = 0;
        for (const instance of periodicInstances) {
          // 不删除当前正在编辑的任务本身
          if (instance._id === taskId) continue;
          await db.collection('tasks').doc(instance._id).remove();
          deletedCount++;
        }
        console.log(`[updateTask] 周期改非周期，清理了 ${deletedCount} 个未完成的周期实例`);
      } catch (cleanupError) {
        console.error('清理周期任务实例失败:', cleanupError);
        // 清理失败不影响主流程
      }
    }

    // 记录操作日志
    await recordOperation('task_update', taskId, userId, {
      taskTitle: oldTask.title,
      old: oldTask,
      new: updateData
    }, oldTask.listId);

    return {
      code: 0,
      message: '更新成功',
      data: {
        _id: taskId,
        ...updateData
      }
    };
  } catch (error) {
    console.error('更新任务失败:', error);
    return {
      code: -1,
      message: error.message || '更新任务失败'
    };
  }
}

// 删除任务
async function deleteTask(openid, data) {
  try {
    if (!data || !data.taskId) {
      return {
        code: -1,
        message: '任务ID不能为空'
      };
    }

    const userId = await getUserId(openid);
    const { taskId } = data;

    // 获取原任务数据
    const { data: tasks } = await db.collection('tasks')
      .where({ _id: taskId })
      .get();

    if (tasks.length === 0) {
      return {
        code: -1,
        message: '任务不存在'
      };
    }

    const oldTask = tasks[0];

    // 验证权限
    if (oldTask.creatorId !== userId) {
      // 检查是否是清单成员且有编辑权限
      if (oldTask.listId) {
        const { hasPermission } = await verifyListPermission(userId, oldTask.listId, 2);
        if (!hasPermission) {
          return {
            code: -1,
            message: '无权限删除此任务'
          };
        }
      } else {
        return {
          code: -1,
          message: '无权限删除此任务'
        };
      }
    }

    // 删除任务
    await db.collection('tasks').doc(taskId).remove();

    // 删除关联的附件文件
    if (oldTask.attachments && oldTask.attachments.length > 0) {
      const fileIds = oldTask.attachments.map(a => a.fileId).filter(Boolean);
      if (fileIds.length > 0) {
        try {
          await cloud.deleteFile({ fileList: fileIds });
        } catch (fileErr) {
          console.error('删除附件文件失败:', fileErr);
        }
      }
    }

    // 删除相关通知
    await db.collection('notifications')
      .where({ relatedId: taskId })
      .remove();

    // 记录操作日志
    await recordOperation('task_delete', taskId, userId, { taskTitle: oldTask.title, task: oldTask }, oldTask.listId);

    return {
      code: 0,
      message: '删除成功'
    };
  } catch (error) {
    console.error('删除任务失败:', error);
    return {
      code: -1,
      message: error.message || '删除任务失败'
    };
  }
}

// 获取任务详情
async function getTaskDetail(openid, data) {
  try {
    if (!data || !data.taskId) {
      return {
        code: -1,
        message: '任务ID不能为空'
      };
    }

    const userId = await getUserId(openid);
    const { taskId } = data;

    // 获取任务数据
    const { data: tasks } = await db.collection('tasks')
      .where({ _id: taskId })
      .get();

    if (tasks.length === 0) {
      return {
        code: -1,
        message: '任务不存在'
      };
    }

    const task = tasks[0];

    // 验证权限
    if (task.creatorId !== userId) {
      if (task.listId) {
        const { hasPermission } = await verifyListPermission(userId, task.listId, 3);
        if (!hasPermission) {
          return {
            code: -1,
            message: '无权限查看此任务'
          };
        }
      } else {
        return {
          code: -1,
          message: '无权限查看此任务'
        };
      }
    }

    // 获取清单信息
    let listInfo = null;
    if (task.listId) {
      const { data: lists } = await db.collection('lists')
        .where({ _id: task.listId })
        .get();
      if (lists.length > 0) {
        listInfo = {
          _id: lists[0]._id,
          name: lists[0].name
        };
      }
    }

    // 获取分类信息
    let categoryInfo = null;
    if (task.categoryId) {
      const { data: categories } = await db.collection('categories')
        .where({ _id: task.categoryId })
        .get();
      if (categories.length > 0) {
        categoryInfo = {
          _id: categories[0]._id,
          name: categories[0].name,
          color: categories[0].color
        };
      }
    }

    // 获取创建者信息
    let creatorInfo = null;
    const { data: creators } = await db.collection('users')
      .where({ _id: task.creatorId })
      .get();
    if (creators.length > 0) {
      creatorInfo = {
        _id: creators[0]._id,
        nickname: creators[0].nickname,
        avatarUrl: creators[0].avatarUrl
      };
    }

    return {
      code: 0,
      message: 'success',
      data: {
        ...task,
        listInfo,
        categoryInfo,
        creatorInfo
      }
    };
  } catch (error) {
    console.error('获取任务详情失败:', error);
    return {
      code: -1,
      message: error.message || '获取任务详情失败'
    };
  }
}

// 获取任务列表
async function getTaskList(openid, data) {
  try {
    const userId = await getUserId(openid);
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      categoryId,
      listId,
      priority,
      keyword
    } = data || {};

    let query = {};

    // 构建查询条件
    if (listId) {
      // 查询指定清单的任务
      query.listId = listId;
      // 验证清单权限
      const { hasPermission } = await verifyListPermission(userId, listId, 3);
      if (!hasPermission) {
        return {
          code: -1,
          message: '无权限查看此清单的任务'
        };
      }
    } else {
      // 查询用户的所有任务（包括个人任务和共享清单中的任务）
      const { data: memberships } = await db.collection('list_members')
        .where({ userId })
        .get();

      const listIds = memberships.map(m => m.listId);

      query = _.or([
        { creatorId: userId },
        { listId: _.in(listIds) }
      ]);
    }

    // 状态筛选
    if (status !== undefined) {
      query.status = status;
    }

    // 分类筛选
    if (categoryId) {
      query.categoryId = categoryId;
    }

    // 优先级筛选
    if (priority) {
      query.priority = priority;
    }

    // 关键词搜索
    if (keyword && keyword.trim()) {
      const searchKey = keyword.trim();
      query = _.and([
        query,
        _.or([
          { title: db.RegExp({ regexp: searchKey, options: 'i' }) },
          { description: db.RegExp({ regexp: searchKey, options: 'i' }) }
        ])
      ]);
    }

    // 日期范围筛选（用于日历页按月查询）
    if (data && data.startDate && data.endDate) {
      const dateFilter = {
        dueDate: _.gte(new Date(data.startDate)).and(_.lte(new Date(data.endDate)))
      };
      query = _.and([query, dateFilter]);
    }

    // 查询总数
    const countResult = await db.collection('tasks')
      .where(query)
      .count();

    // 查询数据
    let dbQuery = db.collection('tasks')
      .where(query)
      .skip((page - 1) * pageSize)
      .limit(pageSize);

    // 排序
    if (sortOrder === 'asc') {
      dbQuery = dbQuery.orderBy(sortBy, 'asc');
    } else {
      dbQuery = dbQuery.orderBy(sortBy, 'desc');
    }

    const { data: tasks } = await dbQuery.get();

    // 获取关联数据（批量查询优化，避免 N+1 问题）
    const listIds = [...new Set(tasks.filter(t => t.listId).map(t => t.listId))];
    const categoryIds = [...new Set(tasks.filter(t => t.categoryId).map(t => t.categoryId))];

    let listsMap = {};
    if (listIds.length > 0) {
      const { data: lists } = await db.collection('lists')
        .where({ _id: _.in(listIds) })
        .get();
      lists.forEach(l => { listsMap[l._id] = l; });
    }

    let categoriesMap = {};
    if (categoryIds.length > 0) {
      const { data: categories } = await db.collection('categories')
        .where({ _id: _.in(categoryIds) })
        .get();
      categories.forEach(c => { categoriesMap[c._id] = c; });
    }

    const enrichedTasks = tasks.map(task => {
      const list = task.listId ? listsMap[task.listId] : null;
      const category = task.categoryId ? categoriesMap[task.categoryId] : null;
      return {
        ...task,
        listName: list ? list.name : '',
        categoryName: category ? category.name : '',
        categoryColor: category ? category.color : ''
      };
    });

    return {
      code: 0,
      message: 'success',
      data: {
        list: enrichedTasks,
        total: countResult.total,
        page,
        pageSize
      }
    };
  } catch (error) {
    console.error('获取任务列表失败:', error);
    return {
      code: -1,
      message: error.message || '获取任务列表失败'
    };
  }
}

// 切换任务状态
async function toggleTaskStatus(openid, data) {
  try {
    if (!data || !data.taskId) {
      return {
        code: -1,
        message: '任务ID不能为空'
      };
    }

    const userId = await getUserId(openid);
    const { taskId, status } = data;

    // 获取原任务数据
    const { data: tasks } = await db.collection('tasks')
      .where({ _id: taskId })
      .get();

    if (tasks.length === 0) {
      return {
        code: -1,
        message: '任务不存在'
      };
    }

    const oldTask = tasks[0];

    // 验证权限
    if (oldTask.creatorId !== userId) {
      if (oldTask.listId) {
        const { hasPermission } = await verifyListPermission(userId, oldTask.listId, 2);
        if (!hasPermission) {
          return {
            code: -1,
            message: '无权限修改此任务状态'
          };
        }
      } else {
        return {
          code: -1,
          message: '无权限修改此任务状态'
        };
      }
    }

    // 如果任务被标记为完成且有重复设置
    if (status === 1 && oldTask.repeatType > 0) {
      const todayDate = getTodayInUTC8();
      const dueDateOnly = toDateOnlyInUTC8(oldTask.dueDate);

      // 检查任务是否已过期（截止日期在今天之前）
      const isOverdue = dueDateOnly.getTime() < todayDate.getTime();
      const isTodayTask = dueDateOnly.getTime() === todayDate.getTime();

      if (isOverdue) {
        // 已过期的周期任务，需要确认
        if (!data.confirmCompleteOverdue) {
          return {
            code: 0,
            message: '任务已过期，是否确认完成？',
            data: {
              _id: taskId,
              status: oldTask.status,
              needConfirmComplete: true,
              isOverdue: true,
              isRepeatTask: true
            }
          };
        }
        // 用户已确认，跳过日期检查，继续执行
      } else if (!isTodayTask) {
        // 未过期且非当天的周期任务，提示只能完成当天的
        const dueDate = new Date(oldTask.dueDate);
        const utc8Due = new Date(dueDate.getTime() + 8 * 60 * 60 * 1000);
        const dueDateYear = utc8Due.getUTCFullYear();
        const dueDateMonth = utc8Due.getUTCMonth();
        const dueDateDay = utc8Due.getUTCDate();
        const dateStr = `${dueDateYear}-${String(dueDateMonth + 1).padStart(2, '0')}-${String(dueDateDay).padStart(2, '0')}`;
        return {
          code: 0,
          message: '只能完成当天的周期任务',
          data: {
            _id: taskId,
            status: oldTask.status,
            needConfirmCompleteNotToday: true,
            isRepeatTask: true,
            dueDate: dateStr,
            confirmMessage: `这是${dateStr}的周期任务，只能完成当天的任务。是否切换到该日期查看？`
          }
        };
      }
      // 当天的周期任务，正常继续执行
    }

    // 普通任务（非周期）过期完成确认
    if (status === 1 && oldTask.status === 0 && oldTask.repeatType === 0) {
      const todayDate = getTodayInUTC8();
      const dueDateOnly = toDateOnlyInUTC8(oldTask.dueDate);
      const isOverdue = dueDateOnly.getTime() < todayDate.getTime();

      if (isOverdue && !data.confirmCompleteOverdue) {
        return {
          code: 0,
          message: '任务已过期，是否确认完成？',
          data: {
            _id: taskId,
            status: oldTask.status,
            needConfirmComplete: true,
            isOverdue: true,
            isRepeatTask: false
          }
        };
      }
    }

    // 如果任务被取消完成（从已完成改为未完成），先检查是否需要确认
    // 方案A：只恢复当前任务状态，不删除后续周期任务
    if (status === 0 && oldTask.status === 1 && !data.confirmUncheck) {
      // 所有任务（普通任务和周期任务）取消完成时都需要确认
      const isRepeatTask = oldTask.repeatType > 0;
      const confirmMessage = isRepeatTask
        ? '取消完成此任务不会影响后续的周期任务，是否确认？'
        : '确定要取消完成此任务吗？';

      return {
        code: 0,
        message: '需要确认',
        data: {
          _id: taskId,
          status: oldTask.status, // 返回原状态
          needConfirmUncheck: true,
          isRepeatTask: isRepeatTask,
          confirmMessage: confirmMessage
        }
      };
    }

    const serverNow = db.serverDate();

    // 更新数据库状态
    await db.collection('tasks').doc(taskId).update({
      data: {
        status: status,
        updatedAt: serverNow
      }
    });

    // 记录操作日志
    await recordOperation('task_update', taskId, userId, {
      taskTitle: oldTask.title,
      old: { status: oldTask.status },
      new: { status }
    }, oldTask.listId);

    // 如果任务被标记为完成且有重复设置，检查是否需要补充生成新的周期任务
    let newPeriodicTasks = [];
    if (status === 1 && oldTask.repeatType > 0) {
      // 检查是否还有足够的预生成任务（保持未来30天都有任务）
      newPeriodicTasks = await ensurePeriodicTasks(openid, oldTask);
    }

    // 方案A：取消完成时只恢复当前任务状态，不删除后续周期任务
    // 后续周期任务保持原状态，用户可以独立管理每一天的任务

    return {
      code: 0,
      message: '更新成功',
      data: {
        _id: taskId,
        status,
        newPeriodicTasks: newPeriodicTasks,
        isRepeatTask: oldTask.repeatType > 0,
        nextDueDate: oldTask.repeatType > 0 ? calculateNextRepeatDate(oldTask) : null
      }
    };
  } catch (error) {
    console.error('切换任务状态失败:', error);
    return {
      code: -1,
      message: error.message || '切换任务状态失败'
    };
  }
}

// 按分类获取任务
async function getTasksByCategory(openid, data) {
  try {
    const userId = await getUserId(openid);
    const { categoryId, page = 1, pageSize = 20 } = data || {};

    if (!categoryId) {
      return {
        code: -1,
        message: '分类ID不能为空'
      };
    }

    // 验证分类是否属于当前用户
    const { data: categories } = await db.collection('categories')
      .where({
        _id: categoryId,
        userId
      })
      .get();

    if (categories.length === 0) {
      return {
        code: -1,
        message: '分类不存在或无权限'
      };
    }

    // 查询任务
    const countResult = await db.collection('tasks')
      .where({
        categoryId,
        creatorId: userId
      })
      .count();

    const { data: tasks } = await db.collection('tasks')
      .where({
        categoryId,
        creatorId: userId
      })
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    return {
      code: 0,
      message: 'success',
      data: {
        list: tasks,
        total: countResult.total,
        page,
        pageSize
      }
    };
  } catch (error) {
    console.error('按分类获取任务失败:', error);
    return {
      code: -1,
      message: error.message || '按分类获取任务失败'
    };
  }
}

// 按清单获取任务
async function getTasksByList(openid, data) {
  try {
    const userId = await getUserId(openid);
    const { listId, page = 1, pageSize = 20, status } = data || {};

    if (!listId) {
      return {
        code: -1,
        message: '清单ID不能为空'
      };
    }

    // 验证清单权限
    const { hasPermission } = await verifyListPermission(userId, listId, 3);
    if (!hasPermission) {
      return {
        code: -1,
        message: '无权限查看此清单的任务'
      };
    }

    let query = { listId };
    if (status !== undefined) {
      query.status = status;
    }

    // 查询任务
    const countResult = await db.collection('tasks')
      .where(query)
      .count();

    const { data: tasks } = await db.collection('tasks')
      .where(query)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    return {
      code: 0,
      message: 'success',
      data: {
        list: tasks,
        total: countResult.total,
        page,
        pageSize
      }
    };
  } catch (error) {
    console.error('按清单获取任务失败:', error);
    return {
      code: -1,
      message: error.message || '按清单获取任务失败'
    };
  }
}

// 按状态获取任务
async function getTasksByStatus(openid, data) {
  try {
    const userId = await getUserId(openid);
    const { status, page = 1, pageSize = 20 } = data || {};

    if (status === undefined) {
      return {
        code: -1,
        message: '状态不能为空'
      };
    }

    // 查询用户参与的所有清单
    const { data: memberships } = await db.collection('list_members')
      .where({ userId })
      .get();

    const listIds = memberships.map(m => m.listId);

    // 查询任务
    const query = _.and([
      { status },
      _.or([
        { creatorId: userId },
        { listId: _.in(listIds) }
      ])
    ]);

    const countResult = await db.collection('tasks')
      .where(query)
      .count();

    const { data: tasks } = await db.collection('tasks')
      .where(query)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    return {
      code: 0,
      message: 'success',
      data: {
        list: tasks,
        total: countResult.total,
        page,
        pageSize
      }
    };
  } catch (error) {
    console.error('按状态获取任务失败:', error);
    return {
      code: -1,
      message: error.message || '按状态获取任务失败'
    };
  }
}

// 搜索任务
async function searchTasks(openid, data) {
  try {
    const userId = await getUserId(openid);
    const { keyword, page = 1, pageSize = 20 } = data || {};

    if (!keyword || !keyword.trim()) {
      return {
        code: -1,
        message: '搜索关键词不能为空'
      };
    }

    const searchKey = keyword.trim();

    // 查询用户参与的所有清单
    const { data: memberships } = await db.collection('list_members')
      .where({ userId })
      .get();

    const listIds = memberships.map(m => m.listId);

    // 查询任务
    const query = _.and([
      _.or([
        { creatorId: userId },
        { listId: _.in(listIds) }
      ]),
      _.or([
        { title: db.RegExp({ regexp: searchKey, options: 'i' }) },
        { description: db.RegExp({ regexp: searchKey, options: 'i' }) }
      ])
    ]);

    const countResult = await db.collection('tasks')
      .where(query)
      .count();

    const { data: tasks } = await db.collection('tasks')
      .where(query)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    return {
      code: 0,
      message: 'success',
      data: {
        list: tasks,
        total: countResult.total,
        page,
        pageSize
      }
    };
  } catch (error) {
    console.error('搜索任务失败:', error);
    return {
      code: -1,
      message: error.message || '搜索任务失败'
    };
  }
}

// 批量更新任务
async function batchUpdateTasks(openid, data) {
  try {
    const userId = await getUserId(openid);
    const { taskIds, updateData } = data || {};

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return {
        code: -1,
        message: '任务ID列表不能为空'
      };
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return {
        code: -1,
        message: '更新数据不能为空'
      };
    }

    const now = db.serverDate();
    const updateFields = {
      ...updateData,
      updatedAt: now
    };

    // 批量更新
    const updatePromises = taskIds.map(async (taskId) => {
      // 获取任务信息
      const { data: tasks } = await db.collection('tasks')
        .where({ _id: taskId })
        .get();

      if (tasks.length === 0) {
        return { taskId, success: false, message: '任务不存在' };
      }

      const task = tasks[0];

      // 验证权限
      if (task.creatorId !== userId) {
        if (task.listId) {
          const { hasPermission } = await verifyListPermission(userId, task.listId, 2);
          if (!hasPermission) {
            return { taskId, success: false, message: '无权限' };
          }
        } else {
          return { taskId, success: false, message: '无权限' };
        }
      }

      await db.collection('tasks').doc(taskId).update({
        data: updateFields
      });

      return { taskId, success: true };
    });

    const results = await Promise.all(updatePromises);

    return {
      code: 0,
      message: '批量更新完成',
      data: results
    };
  } catch (error) {
    console.error('批量更新任务失败:', error);
    return {
      code: -1,
      message: error.message || '批量更新任务失败'
    };
  }
}

// 批量删除任务
async function batchDeleteTasks(openid, data) {
  try {
    const userId = await getUserId(openid);
    const { taskIds } = data || {};

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return {
        code: -1,
        message: '任务ID列表不能为空'
      };
    }

    // 批量删除
    const deletePromises = taskIds.map(async (taskId) => {
      // 获取任务信息
      const { data: tasks } = await db.collection('tasks')
        .where({ _id: taskId })
        .get();

      if (tasks.length === 0) {
        return { taskId, success: false, message: '任务不存在' };
      }

      const task = tasks[0];

      // 验证权限
      if (task.creatorId !== userId) {
        if (task.listId) {
          const { hasPermission } = await verifyListPermission(userId, task.listId, 2);
          if (!hasPermission) {
            return { taskId, success: false, message: '无权限' };
          }
        } else {
          return { taskId, success: false, message: '无权限' };
        }
      }

      await db.collection('tasks').doc(taskId).remove();

      // 删除相关通知
      await db.collection('notifications')
        .where({ relatedId: taskId })
        .remove();

      return { taskId, success: true };
    });

    const results = await Promise.all(deletePromises);

    return {
      code: 0,
      message: '批量删除完成',
      data: results
    };
  } catch (error) {
    console.error('批量删除任务失败:', error);
    return {
      code: -1,
      message: error.message || '批量删除任务失败'
    };
  }
}

// 检查并发送提醒（定时触发器调用）
async function checkReminders() {
  try {
    const now = new Date();
    const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);

    // 查询即将到达提醒时间且未发送提醒的未完成任务
    const { data: tasks } = await db.collection('tasks')
      .where({
        reminderAt: _.lte(fiveMinutesLater),
        reminderSent: false,
        status: 0
      })
      .get();

    console.log(`找到 ${tasks.length} 个需要提醒的任务`);

    for (const task of tasks) {
      try {
        // 检查用户是否开启通知
        const { data: users } = await db.collection('users')
          .where({ _id: task.creatorId })
          .get();

        if (users.length === 0 || !users[0].enableNotifications) {
          // 用户不存在或已关闭通知，标记为已发送
          await db.collection('tasks').doc(task._id).update({
            data: {
              reminderSent: true,
              updatedAt: db.serverDate()
            }
          });
          continue;
        }

        const user = users[0];

        // 创建提醒通知
        await db.collection('notifications').add({
          data: {
            type: 'task_reminder',
            userId: task.creatorId,
            relatedId: task._id,
            content: `任务提醒：${task.title} 即将到期`,
            isRead: false,
            createdAt: db.serverDate()
          }
        });

        // 发送订阅消息（如果用户有订阅）
        try {
          // 从环境变量或配置中获取模板ID
          // 需要在微信公众平台 -> 订阅消息 中申请模板
          // 模板字段：thing1=任务标题, time2=截止时间
          const TEMPLATE_ID = process.env.REMINDER_TEMPLATE_ID || '';
          if (TEMPLATE_ID) {
            await cloud.openapi.subscribeMessage.send({
              touser: user.openid,
              templateId: TEMPLATE_ID,
              page: `/pages/task-detail/task-detail?id=${task._id}`,
              data: {
                thing1: { value: task.title.substring(0, 20) },
                time2: { value: formatDateTime(task.dueDate) }
              }
            });
            console.log(`订阅消息发送成功: ${task.title}`);
          }
        } catch (msgError) {
          // 47003: 用户未订阅，属于正常情况，不需要报错
          if (msgError.errCode !== 47003) {
            console.error('发送订阅消息失败:', msgError);
          }
        }

        // 标记提醒已发送
        await db.collection('tasks').doc(task._id).update({
          data: {
            reminderSent: true,
            updatedAt: db.serverDate()
          }
        });

        console.log(`已发送任务提醒: ${task.title}`);
      } catch (taskError) {
        console.error(`处理任务提醒失败 ${task._id}:`, taskError);
      }
    }

    return {
      code: 0,
      message: '提醒检查完成',
      data: { processedCount: tasks.length }
    };
  } catch (error) {
    console.error('检查提醒失败:', error);
    return {
      code: -1,
      message: error.message || '检查提醒失败'
    };
  }
}

// 记录操作日志
async function recordOperation(type, targetId, userId, content, listId) {
  try {
    const opData = {
      type,
      targetId,
      userId,
      content,
      createdAt: db.serverDate()
    };
    if (listId) {
      opData.listId = listId;
    }
    await db.collection('operations').add({
      data: opData
    });
  } catch (error) {
    console.error('记录操作日志失败:', error);
  }
}

// 获取 UTC+8 时区的当天零点（用于日期比较）
function getTodayInUTC8() {
  const now = new Date();
  // 将 UTC 时间转换为 UTC+8
  const utc8Time = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  // 提取年月日，构造当天零点（UTC+8 的零点对应 UTC 的前一天 16:00）
  return new Date(Date.UTC(utc8Time.getUTCFullYear(), utc8Time.getUTCMonth(), utc8Time.getUTCDate()) - 8 * 60 * 60 * 1000);
}

// 将日期转换为 UTC+8 的日期零点（去除时间部分）
function toDateOnlyInUTC8(date) {
  const d = new Date(date);
  const utc8Time = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(utc8Time.getUTCFullYear(), utc8Time.getUTCMonth(), utc8Time.getUTCDate()) - 8 * 60 * 60 * 1000);
}

// 获取提醒分钟数
function getReminderMinutes(reminderValue) {
  const minutesMap = {
    1: 0,      // 准时
    2: 5,      // 提前5分钟
    3: 15,     // 提前15分钟
    4: 30,     // 提前30分钟
    5: 60,     // 提前1小时
    6: 120,    // 提前2小时
    7: 1440,   // 提前1天
    8: 2880,   // 提前2天
    9: 10080   // 提前1周
  };
  return minutesMap[reminderValue] || 0;
}

// 格式化日期时间
function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 格式化日期（YYYY-MM-DD）
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 格式化时间（HH:mm）
function formatTime(date) {
  if (!date) return '00:00';
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// 预生成周期任务实例
async function generatePeriodicTasks(openid, originalTask, parentTaskId) {
  try {
    const userId = await getUserId(openid);
    const tasks = [];

    // 根据重复类型决定预生成的时间范围
    let preGenerateDays;
    switch (originalTask.repeatType) {
      case 1: // 每天 → 预生成30天
        preGenerateDays = 30;
        break;
      case 2: // 每周 → 预生成12周（84天）
        preGenerateDays = 84;
        break;
      case 3: // 每月 → 预生成6个月（180天）
        preGenerateDays = 180;
        break;
      default:
        return [];
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + preGenerateDays);

    let currentDueDate = new Date(originalTask.dueDate);

    // 计算提醒偏移量（复用原始任务的提醒间隔）
    let reminderOffset = 0;
    if (originalTask.reminderAt) {
      const originalReminder = new Date(originalTask.reminderAt);
      const originalDue = new Date(originalTask.dueDate);
      reminderOffset = originalDue.getTime() - originalReminder.getTime();
    }

    // 按时间窗口生成，直到超出预生成范围
    while (true) {
      const nextDueDate = calculateNextRepeatDate({
        dueDate: currentDueDate,
        repeatType: originalTask.repeatType,
        repeatValue: originalTask.repeatValue
      });

      if (!nextDueDate || nextDueDate > endDate) break;

      let reminderAt = null;
      if (reminderOffset > 0) {
        reminderAt = new Date(nextDueDate.getTime() - reminderOffset);
      }

      const taskData = {
        title: originalTask.title,
        description: originalTask.description || '',
        priority: originalTask.priority || 1,
        listId: originalTask.listId || '',
        categoryId: originalTask.categoryId || '',
        creatorId: userId,
        dueDate: nextDueDate,
        repeatType: originalTask.repeatType,
        repeatValue: originalTask.repeatValue || '',
        reminderAt: reminderAt,
        reminderSent: false,
        status: 0,
        parentTaskId: parentTaskId,
        isPeriodicInstance: true,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      };

      const result = await db.collection('tasks').add({
        data: taskData
      });

      tasks.push({
        _id: result._id,
        dueDate: nextDueDate
      });

      currentDueDate = nextDueDate;
    }

    console.log(`[generatePeriodicTasks] repeatType=${originalTask.repeatType}, 预生成${preGenerateDays}天, 生成了 ${tasks.length} 个实例`);
    return tasks;
  } catch (error) {
    console.error('预生成周期任务失败:', error);
    return [];
  }
}

// 计算下次重复任务的截止时间（方案A：固定时间）
function calculateNextRepeatDate(task) {
  if (!task.dueDate || task.repeatType === 0) {
    return null;
  }

  const currentDue = new Date(task.dueDate);
  let nextDue = new Date(currentDue);

  switch (task.repeatType) {
    case 1: // 每天重复
      nextDue.setDate(currentDue.getDate() + 1);
      break;

    case 2: // 每周重复
      if (task.repeatValue) {
        // repeatValue 中 1-7 表示周一到周日（数据设计约定）
        // JS getDay() 返回 0=周日, 1=周一, ..., 6=周六
        // 需要将 getDay() 转换为 1-7 格式：周日 0 -> 7，其余不变
        const selectedDays = task.repeatValue.split(',').map(v => parseInt(v)).sort((a, b) => a - b);
        const currentDay = currentDue.getDay() || 7; // 转换为 1-7（周一=1, 周日=7）

        // 查找下一个重复的星期几
        let nextDay = selectedDays.find(day => day > currentDay);

        if (nextDay !== undefined) {
          // 本周内还有重复的日期
          const daysToAdd = nextDay - currentDay;
          nextDue.setDate(currentDue.getDate() + daysToAdd);
        } else {
          // 跳到下周的第一个重复日期
          const daysToAdd = (7 - currentDay) + selectedDays[0];
          nextDue.setDate(currentDue.getDate() + daysToAdd);
        }
      } else {
        // 如果没有选择具体星期，默认一周后
        nextDue.setDate(currentDue.getDate() + 7);
      }
      break;

    case 3: // 每月重复
      if (task.repeatValue) {
        // 解析选择的日期（1-31）
        const selectedDates = task.repeatValue.split(',').map(v => parseInt(v)).sort((a, b) => a - b);
        const currentDate = currentDue.getDate();
        const currentMonth = currentDue.getMonth();
        const currentYear = currentDue.getFullYear();

        // 查找本月内下一个重复的日期
        let nextDate = selectedDates.find(date => date > currentDate);

        if (nextDate !== undefined) {
          // 本月内还有重复的日期
          nextDue.setDate(nextDate);
        } else {
          // 跳到下个月的第一个重复日期
          nextDue.setMonth(currentMonth + 1);
          nextDue.setDate(selectedDates[0]);

          // 处理月份溢出（例如1月31日 -> 2月）
          if (nextDue.getMonth() !== (currentMonth + 1) % 12) {
            // 如果日期无效（如2月30日），取当月最后一天
            nextDue.setDate(0);
          }
        }
      } else {
        // 如果没有选择具体日期，默认一个月后
        nextDue.setMonth(currentDue.getMonth() + 1);
      }
      break;

    default:
      return null;
  }

  return nextDue;
}

// 创建重复任务
async function createRepeatTask(openid, originalTask, nextDueDate) {
  try {
    const userId = await getUserId(openid);

    // 计算新的提醒时间
    let reminderAt = null;
    if (originalTask.reminderValue && originalTask.reminderValue > 0) {
      const reminderMinutes = getReminderMinutes(originalTask.reminderValue);
      reminderAt = new Date(nextDueDate.getTime() - reminderMinutes * 60 * 1000);
    }

    // 构建新任务数据
    const newTask = {
      title: originalTask.title,
      description: originalTask.description || '',
      priority: originalTask.priority || 1,
      listId: originalTask.listId || '',
      categoryId: originalTask.categoryId || '',
      creatorId: userId,
      dueDate: nextDueDate,
      repeatType: originalTask.repeatType || 0,
      repeatValue: originalTask.repeatValue || '',
      reminderAt: reminderAt,
      reminderSent: false,
      reminderValue: originalTask.reminderValue || 0,
      attachments: originalTask.attachments || [],
      status: 0, // 新任务状态为未完成
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };

    // 创建任务
    const result = await db.collection('tasks').add({
      data: newTask
    });

    // 记录操作日志
    await recordOperation('task_create_repeat', result._id, userId, {
      taskTitle: newTask.title,
      originalTaskId: originalTask._id,
      task: newTask
    }, newTask.listId);

    console.log(`重复任务创建成功: ${result._id}, 截止时间: ${nextDueDate.toISOString()}`);

    return {
      code: 0,
      message: '重复任务创建成功',
      data: {
        _id: result._id,
        ...newTask
      }
    };
  } catch (error) {
    console.error('创建重复任务失败:', error);
    return {
      code: -1,
      message: error.message || '创建重复任务失败'
    };
  }
}

// 删除已生成的下一个重复任务（当用户取消完成任务时调用）
async function deleteNextRepeatTask(openid, originalTask) {
  try {
    const userId = await getUserId(openid);

    // 计算预期的下一个任务截止时间
    const nextDueDate = calculateNextRepeatDate(originalTask);
    if (!nextDueDate) {
      return null;
    }

    // 计算日期范围（当天开始和结束）
    const startOfDay = new Date(nextDueDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(nextDueDate);
    endOfDay.setHours(23, 59, 59, 999);

    // 查找由该任务生成的下一个重复任务
    // 匹配条件：相同标题、相同的重复设置、预期的截止日期（当天范围内）、未完成状态
    const { data: repeatTasks } = await db.collection('tasks')
      .where({
        title: originalTask.title,
        creatorId: userId,
        repeatType: originalTask.repeatType,
        repeatValue: originalTask.repeatValue || '',
        dueDate: db.command.gte(startOfDay).and(db.command.lte(endOfDay)),
        status: 0 // 未完成
      })
      .limit(1)
      .get();

    if (repeatTasks.length === 0) {
      console.log('未找到需要删除的重复任务，预期日期:', nextDueDate.toISOString());
      return null;
    }

    const repeatTaskToDelete = repeatTasks[0];

    // 删除重复任务
    await db.collection('tasks').doc(repeatTaskToDelete._id).remove();

    // 记录操作日志
    await recordOperation('task_delete_repeat', repeatTaskToDelete._id, userId, {
      taskTitle: repeatTaskToDelete.title,
      originalTaskId: originalTask._id,
      deletedTask: repeatTaskToDelete
    }, repeatTaskToDelete.listId);

    console.log(`重复任务已删除: ${repeatTaskToDelete._id}`);

    return {
      _id: repeatTaskToDelete._id,
      title: repeatTaskToDelete.title,
      dueDate: repeatTaskToDelete.dueDate
    };
  } catch (error) {
    console.error('删除重复任务失败:', error);
    return null;
  }
}

// 检查是否存在需要删除的重复任务
async function checkRepeatTaskExists(openid, originalTask, nextDueDate) {
  try {
    const userId = await getUserId(openid);

    // 查找由该任务生成的下一个重复任务
    // 匹配条件：相同标题、相同的重复设置、预期的截止时间、未完成状态
    const { data: repeatTasks } = await db.collection('tasks')
      .where({
        title: originalTask.title,
        creatorId: userId,
        repeatType: originalTask.repeatType,
        repeatValue: originalTask.repeatValue || '',
        dueDate: nextDueDate,
        status: 0 // 未完成
      })
      .limit(1)
      .get();

    return repeatTasks.length > 0;
  } catch (error) {
    console.error('检查重复任务存在失败:', error);
    return false;
  }
}

// 确保周期任务实例足够
async function ensurePeriodicTasks(openid, completedTask) {
  try {
    const userId = await getUserId(openid);

    // 根据重复类型决定预生成的时间范围
    let preGenerateDays;
    switch (completedTask.repeatType) {
      case 1: preGenerateDays = 30; break;
      case 2: preGenerateDays = 84; break;
      case 3: preGenerateDays = 180; break;
      default: return [];
    }

    const parentTaskId = completedTask.parentTaskId || completedTask._id;

    // 查询该父任务下最晚的未来周期任务实例
    const now = new Date();
    const { data: existingTasks } = await db.collection('tasks')
      .where({
        parentTaskId: parentTaskId,
        dueDate: db.command.gte(now),
        status: 0
      })
      .orderBy('dueDate', 'desc')
      .limit(1)
      .get();

    let lastDueDate = existingTasks.length > 0 ? new Date(existingTasks[0].dueDate) : new Date(completedTask.dueDate);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + preGenerateDays);

    if (lastDueDate >= targetDate) {
      return [];
    }

    // 获取父任务信息
    let parentTask;
    try {
      const result = await db.collection('tasks').doc(parentTaskId).get();
      parentTask = result.data;
    } catch (e) {
      parentTask = completedTask;
    }
    if (!parentTask) parentTask = completedTask;

    // 计算提醒偏移量
    let reminderOffset = 0;
    if (parentTask.reminderAt) {
      const originalReminder = new Date(parentTask.reminderAt);
      const originalDue = new Date(parentTask.dueDate);
      reminderOffset = originalDue.getTime() - originalReminder.getTime();
    }

    const tasksToGenerate = [];
    let currentDueDate = new Date(lastDueDate);

    while (true) {
      const nextDueDate = calculateNextRepeatDate({
        dueDate: currentDueDate,
        repeatType: parentTask.repeatType,
        repeatValue: parentTask.repeatValue
      });

      if (!nextDueDate || nextDueDate > targetDate) break;

      let reminderAt = null;
      if (reminderOffset > 0) {
        reminderAt = new Date(nextDueDate.getTime() - reminderOffset);
      }

      const taskData = {
        title: parentTask.title,
        description: parentTask.description || '',
        priority: parentTask.priority || 1,
        listId: parentTask.listId || '',
        categoryId: parentTask.categoryId || '',
        creatorId: userId,
        dueDate: nextDueDate,
        repeatType: parentTask.repeatType,
        repeatValue: parentTask.repeatValue || '',
        reminderAt: reminderAt,
        reminderSent: false,
        status: 0,
        parentTaskId: parentTaskId,
        isPeriodicInstance: true,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      };

      const result = await db.collection('tasks').add({
        data: taskData
      });

      tasksToGenerate.push({
        _id: result._id,
        dueDate: nextDueDate
      });

      currentDueDate = nextDueDate;
    }

    console.log(`[ensurePeriodicTasks] repeatType=${parentTask.repeatType}, 补充生成了 ${tasksToGenerate.length} 个实例`);
    return tasksToGenerate;
  } catch (error) {
    console.error('确保周期任务失败:', error);
    return [];
  }
}

// 删除后续生成的周期任务（当取消完成时）
async function deleteSubsequentPeriodicTasks(openid, task) {
  try {
    const userId = await getUserId(openid);
    const parentTaskId = task.parentTaskId || task._id;
    const taskDueDate = new Date(task.dueDate);

    // 查找该任务之后生成的所有周期任务实例
    const { data: subsequentTasks } = await db.collection('tasks')
      .where({
        parentTaskId: parentTaskId,
        dueDate: db.command.gt(taskDueDate),
        status: 0 // 只删除未完成的
      })
      .get();

    let deletedCount = 0;
    for (const t of subsequentTasks) {
      await db.collection('tasks').doc(t._id).remove();
      deletedCount++;
    }

    console.log(`[deleteSubsequentPeriodicTasks] 删除了 ${deletedCount} 个后续周期任务`);
    return { deletedCount };
  } catch (error) {
    console.error('删除后续周期任务失败:', error);
    return null;
  }
}

// 定时清理过期周期任务（每天凌晨3点执行）
// 方案A：所有任务实例永久保留，只清理已删除父任务的孤儿实例
async function cleanupExpiredPeriodicTasks() {
  try {
    const now = new Date();
    console.log(`[cleanupExpiredPeriodicTasks] 开始清理孤儿周期任务实例，当前时间: ${now.toISOString()}`);

    // 获取所有周期任务实例
    const { data: periodicInstances } = await db.collection('tasks')
      .where({
        isPeriodicInstance: true
      })
      .limit(500)
      .get();

    // 获取所有父任务ID
    const parentTaskIds = [...new Set(periodicInstances.map(t => t.parentTaskId).filter(id => id))];

    // 检查哪些父任务已不存在
    const deletedParentIds = [];
    for (const parentId of parentTaskIds) {
      try {
        await db.collection('tasks').doc(parentId).get();
        // 父任务存在，不做处理
      } catch (e) {
        // doc().get() 在文档不存在时会抛异常
        deletedParentIds.push(parentId);
      }
    }

    // 删除孤儿周期任务实例
    let deletedOrphanCount = 0;
    for (const task of periodicInstances) {
      if (deletedParentIds.includes(task.parentTaskId)) {
        await db.collection('tasks').doc(task._id).remove();
        deletedOrphanCount++;
      }
    }

    console.log(`[cleanupExpiredPeriodicTasks] 清理完成：删除了 ${deletedOrphanCount} 个孤儿周期任务实例`);

    return {
      code: 0,
      message: '清理完成',
      data: {
        deletedOrphanCount,
        checkedInstances: periodicInstances.length,
        deletedParentCount: deletedParentIds.length
      }
    };
  } catch (error) {
    console.error('清理过期周期任务失败:', error);
    return {
      code: -1,
      message: error.message || '清理失败'
    };
  }
}

// 查询周期任务统计信息
async function getPeriodicTaskStats(openid, data) {
  try {
    if (!data || !data.taskId) {
      return {
        code: -1,
        message: '任务ID不能为空'
      };
    }

    const userId = await getUserId(openid);
    const { taskId } = data;

    // 获取父任务信息
    let parentTask;
    try {
      const result = await db.collection('tasks').doc(taskId).get();
      parentTask = result.data;
    } catch (e) {
      return { code: -1, message: '任务不存在' };
    }

    if (!parentTask) {
      return { code: -1, message: '任务不存在' };
    }

    // 验证权限
    if (parentTask.creatorId !== userId) {
      return { code: -1, message: '无权限查看此任务统计' };
    }

    // 如果不是周期任务，返回错误
    if (parentTask.repeatType === 0) {
      return { code: -1, message: '此任务不是周期任务' };
    }

    // 查询所有周期任务实例（包括父任务本身）
    // 分批查询以突破100条限制
    let allInstances = [];
    const batchSize = 100;
    let batchIndex = 0;
    while (true) {
      const { data: batch } = await db.collection('tasks')
        .where(_.or([
          { _id: taskId },
          { parentTaskId: taskId }
        ]))
        .orderBy('dueDate', 'asc')
        .skip(batchIndex * batchSize)
        .limit(batchSize)
        .get();
      allInstances = allInstances.concat(batch);
      if (batch.length < batchSize) break;
      batchIndex++;
    }

    // 过滤出属于当前用户的
    allInstances = allInstances.filter(t => t.creatorId === userId);

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // 区分：截止日期 <= 今天的为"已到期"实例，用于统计
    const dueInstances = allInstances.filter(t => {
      const d = new Date(t.dueDate);
      d.setHours(0, 0, 0, 0);
      return d <= now;
    });
    const futureInstances = allInstances.filter(t => {
      const d = new Date(t.dueDate);
      d.setHours(0, 0, 0, 0);
      return d > now;
    });

    // 基础统计（只统计已到期的）
    const totalCount = dueInstances.length;
    const completedCount = dueInstances.filter(t => t.status === 1).length;
    const overdueCount = dueInstances.filter(t => t.status === 0).length;
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // 按日期排序（升序），用于连续天数计算
    const sortedDue = dueInstances
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    // 计算连续完成天数（考虑周期间隔）
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    for (let i = 0; i < sortedDue.length; i++) {
      if (sortedDue[i].status === 1) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    // 当前连续（从最近一天往回数）
    for (let i = sortedDue.length - 1; i >= 0; i--) {
      if (sortedDue[i].status === 1) {
        currentStreak++;
      } else {
        break;
      }
    }

    // 构建所有记录（包含未来的）
    const allRecords = allInstances.map(t => {
      const d = new Date(t.dueDate);
      d.setHours(0, 0, 0, 0);
      const isFuture = d > now;
      return {
        date: t.dueDate,
        status: t.status,
        isFuture
      };
    });

    // 按月分组统计
    const monthlyStats = {};
    dueInstances.forEach(t => {
      const d = new Date(t.dueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyStats[key]) {
        monthlyStats[key] = { completed: 0, total: 0, overdue: 0 };
      }
      monthlyStats[key].total++;
      if (t.status === 1) {
        monthlyStats[key].completed++;
      } else {
        monthlyStats[key].overdue++;
      }
    });

    return {
      code: 0,
      message: '获取成功',
      data: {
        taskInfo: {
          _id: parentTask._id,
          title: parentTask.title,
          repeatType: parentTask.repeatType,
          repeatValue: parentTask.repeatValue,
          priority: parentTask.priority,
          createdAt: parentTask.createdAt
        },
        stats: {
          totalCount,
          completedCount,
          incompleteCount: overdueCount,
          completionRate,
          currentStreak,
          longestStreak,
          futureCount: futureInstances.length
        },
        allRecords,
        monthlyStats
      }
    };
  } catch (error) {
    console.error('获取周期任务统计失败:', error);
    return {
      code: -1,
      message: error.message || '获取统计信息失败'
    };
  }
}
