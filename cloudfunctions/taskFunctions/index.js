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
      case 'getPeriodicTaskMonthDetail':
        return await getPeriodicTaskMonthDetail(openid, data);
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

function getOwnershipTypeByListId(listId) {
  return listId ? 2 : 1;
}

function buildPersonalTaskQuery(userId) {
  return _.and([
    { creatorId: userId },
    _.or([
      { ownershipType: 1 },
      { listId: '' }
    ])
  ]);
}

async function getAccessibleListIds(userId) {
  const [membershipResult, createdListsResult] = await Promise.all([
    db.collection('list_members').where({ userId }).get(),
    db.collection('lists').where({ creatorId: userId }).field({ _id: true }).get()
  ]);

  return [...new Set([
    ...membershipResult.data.map(item => item.listId),
    ...createdListsResult.data.map(item => item._id)
  ].filter(Boolean))];
}

async function buildTaskAccessQuery(userId, listId) {
  if (listId) {
    return { listId };
  }

  const accessibleListIds = await getAccessibleListIds(userId);
  const accessRules = [buildPersonalTaskQuery(userId)];

  if (accessibleListIds.length > 0) {
    accessRules.push({ listId: _.in(accessibleListIds) });
  }

  return _.or(accessRules);
}

function normalizeAttachments(attachments) {
  if (!Array.isArray(attachments)) {
    return [];
  }

  const normalizedAttachments = [];
  const seenFileIds = new Set();

  for (const attachment of attachments) {
    if (!attachment || !attachment.fileId) {
      continue;
    }

    const fileId = String(attachment.fileId).trim();
    if (!fileId || seenFileIds.has(fileId)) {
      continue;
    }

    seenFileIds.add(fileId);
    normalizedAttachments.push({
      fileId,
      name: attachment.name ? String(attachment.name).trim() : '',
      size: Number(attachment.size) || 0,
      type: attachment.type ? String(attachment.type) : 'file'
    });
  }

  return normalizedAttachments;
}

function normalizeAttachmentFileIds(fileIds) {
  if (!Array.isArray(fileIds)) {
    return [];
  }

  return [...new Set(
    fileIds
      .map(fileId => typeof fileId === 'string' ? fileId.trim() : '')
      .filter(Boolean)
  )];
}

function getAttachmentFileIds(attachments) {
  return normalizeAttachments(attachments)
    .map(attachment => attachment.fileId)
    .filter(Boolean);
}

function getRemovedAttachmentFileIds(oldAttachments, newAttachments) {
  const oldFileIds = getAttachmentFileIds(oldAttachments);
  const newFileIds = new Set(getAttachmentFileIds(newAttachments));
  return oldFileIds.filter(fileId => !newFileIds.has(fileId));
}

function appendAndFilter(baseQuery, filter) {
  if (!filter) {
    return baseQuery;
  }

  return _.and([baseQuery, filter]);
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
    const sourceListId = data.sourceListId || '';
    const targetListId = data.listId || '';

    if (sourceListId && sourceListId !== targetListId) {
      return {
        code: -1,
        message: '清单内创建任务时不能修改所属清单'
      };
    }

    // 验证清单权限
    if (targetListId) {
      const { hasPermission } = await verifyListPermission(userId, targetListId, 2);
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

    const normalizedAttachments = normalizeAttachments(data.attachments);

    // 构建任务数据
    const taskData = {
      title: data.title.trim(),
      description: data.description ? data.description.trim() : '',
      ownershipType: getOwnershipTypeByListId(targetListId),
      dueDate: dueDate,
      priority: data.priority || 1,
      status: 0, // 0-未完成
      listId: targetListId,
      creatorId: userId,
      categoryId: data.categoryId || '',
      repeatType: data.repeatType || 0, // 0-不重复，1-每天，2-每周，3-每月
      repeatValue: data.repeatValue || '',
      reminderAt: reminderAt,
      reminderSent: false,
      attachments: normalizedAttachments,
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
    const targetStatus = data.status !== undefined ? Number(data.status) : undefined;
    const normalizedAttachments = data.attachments !== undefined
      ? normalizeAttachments(data.attachments)
      : normalizeAttachments(oldTask.attachments);
    const pendingDeleteAttachmentFileIds = normalizeAttachmentFileIds(data.pendingDeleteAttachmentFileIds);

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

    if (data.listId !== undefined && data.listId && data.listId !== oldTask.listId) {
      const { hasPermission } = await verifyListPermission(userId, data.listId, 2);
      if (!hasPermission) {
        return {
          code: -1,
          message: '无权限移动到目标清单'
        };
      }
    }

    const statusTransition = evaluateTaskStatusTransition(oldTask, targetStatus, data);
    if (statusTransition.response) {
      return statusTransition.response;
    }

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
      updateData.ownershipType = getOwnershipTypeByListId(data.listId);
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
      updateData.attachments = normalizedAttachments;
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
    if (targetStatus !== undefined) {
      updateData.status = targetStatus;
    }

    // 更新任务数据（包含所有字段，reminderAt 为 null 时会覆盖原值）
    await db.collection('tasks').doc(taskId).update({
      data: updateData
    });

    const removedAttachmentFileIds = data.attachments !== undefined
      ? getRemovedAttachmentFileIds(oldTask.attachments, normalizedAttachments)
      : [];
    let attachmentCleanupFailed = false;

    if (removedAttachmentFileIds.length > 0) {
      try {
        await cloud.deleteFile({ fileList: removedAttachmentFileIds });
      } catch (attachmentCleanupError) {
        attachmentCleanupFailed = true;
        console.error('删除旧附件文件失败:', {
          taskId,
          removedAttachmentFileIds,
          pendingDeleteAttachmentFileIds,
          error: attachmentCleanupError
        });
      }
    }

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

    const nextListId = updateData.listId !== undefined ? updateData.listId : oldTask.listId;

    // 记录操作日志
    await recordOperation('task_update', taskId, userId, {
      taskTitle: oldTask.title,
      old: oldTask,
      new: updateData,
      oldListId: oldTask.listId || '',
      newListId: nextListId || '',
      removedAttachmentFileIds,
      newAttachmentCount: normalizedAttachments.length,
      oldAttachmentCount: Array.isArray(oldTask.attachments) ? oldTask.attachments.length : 0,
      pendingDeleteAttachmentFileIds,
      attachmentCleanupFailed
    }, nextListId);

    return {
      code: 0,
      message: '更新成功',
      data: {
        _id: taskId,
        ...updateData,
        attachmentCleanupFailed,
        removedAttachmentFileIds
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
    const requestedDeleteScope = data.deleteScope || 'single';

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

    const isRepeatTask = Number(oldTask.repeatType) > 0;
    const deleteScope = isRepeatTask && requestedDeleteScope === 'series' ? 'series' : 'single';

    if (deleteScope === 'series') {
      const parentTaskId = oldTask.parentTaskId || oldTask._id;
      const seriesTasks = await getTaskSeriesTasks(parentTaskId);

      const tasksToDelete = seriesTasks.length > 0
        ? seriesTasks
        : (oldTask.parentTaskId ? [oldTask] : []);
      const taskIds = [...new Set(tasksToDelete.map(task => task._id).filter(Boolean))];
      const fileIds = collectAttachmentFileIds(tasksToDelete);

      if (fileIds.length > 0) {
        try {
          await cloud.deleteFile({ fileList: fileIds });
        } catch (fileErr) {
          console.error('删除系列附件文件失败:', fileErr);
        }
      }

      if (taskIds.length > 0) {
        await db.collection('notifications')
          .where({ relatedId: _.in(taskIds) })
          .remove();

        await db.collection('tasks')
          .where(_.or([
            { _id: _.in(taskIds) },
            { parentTaskId }
          ]))
          .remove();
      }

      await recordOperation('task_delete', parentTaskId, userId, {
        taskTitle: oldTask.title,
        deleteScope: 'series',
        parentTaskId,
        deletedTaskCount: taskIds.length,
        deletedTaskIds: taskIds,
        task: oldTask
      }, oldTask.listId);

      return {
        code: 0,
        message: '删除成功',
        data: {
          deleteScope: 'series',
          parentTaskId,
          deletedTaskCount: taskIds.length
        }
      };
    }

    await db.collection('tasks').doc(taskId).remove();

    const fileIds = collectAttachmentFileIds([oldTask]);
    if (fileIds.length > 0) {
      try {
        await cloud.deleteFile({ fileList: fileIds });
      } catch (fileErr) {
        console.error('删除附件文件失败:', fileErr);
      }
    }

    await db.collection('notifications')
      .where({ relatedId: taskId })
      .remove();

    await recordOperation('task_delete', taskId, userId, {
      taskTitle: oldTask.title,
      deleteScope: 'single',
      parentTaskId: oldTask.parentTaskId || oldTask._id,
      task: oldTask
    }, oldTask.listId);

    return {
      code: 0,
      message: '删除成功',
      data: {
        deleteScope: 'single',
        deletedTaskCount: 1
      }
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

    let query = await buildTaskAccessQuery(userId, listId);

    // 构建查询条件
    if (listId) {
      // 验证清单权限
      const { hasPermission } = await verifyListPermission(userId, listId, 3);
      if (!hasPermission) {
        return {
          code: -1,
          message: '无权限查看此清单的任务'
        };
      }
    }

    // 状态筛选
    if (status !== undefined) {
      query = appendAndFilter(query, { status });
    }

    // 分类筛选
    if (categoryId) {
      query = appendAndFilter(query, { categoryId });
    }

    // 优先级筛选
    if (priority) {
      query = appendAndFilter(query, { priority });
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
      query = appendAndFilter(query, dateFilter);
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
    const { taskId } = data;
    const status = Number(data.status);

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

    const statusTransition = evaluateTaskStatusTransition(oldTask, status, data);
    if (statusTransition.response) {
      return statusTransition.response;
    }

    const serverNow = db.serverDate();
    const isCompleting = Number(status) === 1;
    const normalizedParentTaskId = oldTask.parentTaskId || oldTask._id;
    const completedAtValue = isCompleting ? new Date() : null;

    // 更新数据库状态
    await db.collection('tasks').doc(taskId).update({
      data: {
        status: status,
        updatedAt: serverNow,
        completedAt: isCompleting ? serverNow : null,
        completedBy: isCompleting ? userId : ''
      }
    });

    // 记录操作日志
    await recordOperation('task_update', taskId, userId, {
      taskTitle: oldTask.title,
      action: 'toggle_status',
      old: { status: oldTask.status },
      new: { status },
      statusTransition: isCompleting ? 'complete' : 'uncomplete',
      dueDate: oldTask.dueDate,
      repeatType: oldTask.repeatType || 0,
      isPeriodicInstance: !!oldTask.isPeriodicInstance,
      parentTaskId: oldTask.parentTaskId || '',
      seriesTaskId: normalizedParentTaskId,
      completedAt: completedAtValue,
      completedBy: isCompleting ? userId : '',
      listId: oldTask.listId || ''
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
        completedAt: completedAtValue,
        completedBy: isCompleting ? userId : '',
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

    const query = appendAndFilter(
      await buildTaskAccessQuery(userId),
      { categoryId }
    );

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

    // 查询任务
    const query = appendAndFilter(
      await buildTaskAccessQuery(userId),
      { status }
    );

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

    // 查询任务
    const query = appendAndFilter(
      await buildTaskAccessQuery(userId),
      _.or([
        { title: db.RegExp({ regexp: searchKey, options: 'i' }) },
        { description: db.RegExp({ regexp: searchKey, options: 'i' }) }
      ])
    );

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

function getEndOfDayInUTC8(date = new Date()) {
  const dateOnly = toDateOnlyInUTC8(date);
  return new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000 - 1);
}

function formatUTC8Date(date) {
  const utc8Date = new Date(new Date(date).getTime() + 8 * 60 * 60 * 1000);
  const year = utc8Date.getUTCFullYear();
  const month = String(utc8Date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc8Date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildStatusTransitionResponse(oldTask, data) {
  return {
    code: 0,
    message: data.message,
    data: {
      _id: oldTask._id,
      status: oldTask.status,
      isOverdue: !!data.isOverdue,
      isRepeatTask: Number(oldTask.repeatType) > 0,
      ...data.extra
    }
  };
}

function evaluateTaskStatusTransition(oldTask, targetStatus, options = {}) {
  if (targetStatus === undefined || Number.isNaN(targetStatus) || targetStatus === Number(oldTask.status)) {
    return { allowed: true, response: null };
  }

  const currentStatus = Number(oldTask.status);
  const isRepeatTask = Number(oldTask.repeatType) > 0;

  if (targetStatus === 1 && currentStatus === 0) {
    const todayDate = getTodayInUTC8();
    const dueDateOnly = toDateOnlyInUTC8(oldTask.dueDate);
    const isOverdue = dueDateOnly.getTime() < todayDate.getTime();
    const isTodayTask = dueDateOnly.getTime() === todayDate.getTime();

    if (isRepeatTask) {
      if (isOverdue && !options.confirmCompleteOverdue) {
        return {
          allowed: false,
          response: buildStatusTransitionResponse(oldTask, {
            message: '任务已过期，是否确认完成？',
            isOverdue: true,
            extra: { needConfirmComplete: true }
          })
        };
      }

      if (!isOverdue && !isTodayTask) {
        const dueDate = formatUTC8Date(oldTask.dueDate);
        return {
          allowed: false,
          response: buildStatusTransitionResponse(oldTask, {
            message: '只能完成当天的周期任务',
            extra: {
              needConfirmCompleteNotToday: true,
              dueDate,
              confirmMessage: `这是${dueDate}的周期任务，只能完成当天的任务。是否切换到该日期查看？`
            }
          })
        };
      }
    } else if (isOverdue && !options.confirmCompleteOverdue) {
      return {
        allowed: false,
        response: buildStatusTransitionResponse(oldTask, {
          message: '任务已过期，是否确认完成？',
          isOverdue: true,
          extra: { needConfirmComplete: true }
        })
      };
    }
  }

  if (targetStatus === 0 && currentStatus === 1 && !options.confirmUncheck) {
    return {
      allowed: false,
      response: buildStatusTransitionResponse(oldTask, {
        message: '需要确认',
        extra: {
          needConfirmUncheck: true,
          confirmMessage: isRepeatTask
            ? '取消完成此任务不会影响后续的周期任务，是否确认？'
            : '确定要取消完成此任务吗？'
        }
      })
    };
  }

  return { allowed: true, response: null };
}

function normalizeWeeklyRepeatDays(repeatValue) {
  if (!repeatValue) {
    return [];
  }

  return [...new Set(
    String(repeatValue)
      .split(',')
      .map(v => parseInt(v, 10))
      .filter(v => !Number.isNaN(v))
      .map(v => v === 7 ? 0 : v)
      .filter(v => v >= 0 && v <= 6)
  )].sort((a, b) => a - b);
}

function collectAttachmentFileIds(tasks) {
  return [...new Set(
    (tasks || [])
      .flatMap(task => Array.isArray(task.attachments) ? task.attachments : [])
      .map(attachment => attachment && attachment.fileId)
      .filter(Boolean)
  )];
}

async function getTaskSeriesTasks(parentTaskId) {
  const tasks = [];
  const pageSize = 100;
  let offset = 0;

  while (true) {
    const { data } = await db.collection('tasks')
      .where(_.or([
        { _id: parentTaskId },
        { parentTaskId }
      ]))
      .skip(offset)
      .limit(pageSize)
      .get();

    tasks.push(...data);

    if (data.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return tasks;
}

async function getTaskSeriesTasksInRange(parentTaskId, startDate, endDate) {
  const tasks = [];
  const pageSize = 100;
  let offset = 0;

  while (true) {
    const { data } = await db.collection('tasks')
      .where(_.and([
        _.or([
          { _id: parentTaskId },
          { parentTaskId }
        ]),
        {
          dueDate: _.gte(startDate).and(_.lte(endDate))
        }
      ]))
      .orderBy('dueDate', 'asc')
      .skip(offset)
      .limit(pageSize)
      .get();

    tasks.push(...data);

    if (data.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return tasks;
}

async function getTaskById(taskId) {
  try {
    const result = await db.collection('tasks').doc(taskId).get();
    return result.data || null;
  } catch (error) {
    return null;
  }
}

async function ensureTaskViewPermission(userId, task) {
  if (!task) {
    return { hasPermission: false, message: '任务不存在' };
  }

  if (task.creatorId === userId) {
    return { hasPermission: true };
  }

  if (task.listId) {
    const { hasPermission } = await verifyListPermission(userId, task.listId, 3);
    if (hasPermission) {
      return { hasPermission: true };
    }
  }

  return { hasPermission: false, message: '无权限查看此任务统计' };
}

async function resolvePeriodicSeriesTask(taskId) {
  const task = await getTaskById(taskId);
  if (!task) {
    return null;
  }

  if (Number(task.repeatType) === 0) {
    return {
      requestedTask: task,
      parentTask: null,
      parentTaskId: null
    };
  }

  const parentTaskId = task.parentTaskId || task._id;
  const parentTask = task.parentTaskId ? await getTaskById(parentTaskId) : task;

  return {
    requestedTask: task,
    parentTask: parentTask || task,
    parentTaskId
  };
}

function parseMonthlyRepeatDays(repeatValue) {
  if (!repeatValue) {
    return [];
  }

  return [...new Set(
    String(repeatValue)
      .split(',')
      .map(v => parseInt(v, 10))
      .filter(v => !Number.isNaN(v) && v >= 1 && v <= 31)
  )].sort((a, b) => a - b);
}

function formatMonthKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-');
  return `${year}年${Number(month)}月`;
}

function getMonthRange(monthKey) {
  const [year, month] = String(monthKey).split('-').map(Number);
  if (!year || !month) {
    return null;
  }

  return {
    start: new Date(year, month - 1, 1, 0, 0, 0, 0),
    end: new Date(year, month, 0, 23, 59, 59, 999)
  };
}

function createOccurrenceFromDate(baseDueDate, year, monthIndex, day) {
  const due = new Date(baseDueDate);
  due.setFullYear(year, monthIndex, day);
  return due;
}

function generatePlannedOccurrences(task, startDate, endDate) {
  if (!task || Number(task.repeatType) === 0 || !task.dueDate || !startDate || !endDate) {
    return [];
  }

  const baseDueDate = new Date(task.dueDate);
  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(endDate);
  const occurrences = [];

  if (rangeEnd < baseDueDate) {
    return [];
  }

  if (task.repeatType === 1) {
    const cursor = new Date(baseDueDate);
    cursor.setHours(baseDueDate.getHours(), baseDueDate.getMinutes(), baseDueDate.getSeconds(), baseDueDate.getMilliseconds());
    while (cursor <= rangeEnd) {
      if (cursor >= rangeStart) {
        occurrences.push(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return occurrences;
  }

  if (task.repeatType === 2) {
    const selectedDays = normalizeWeeklyRepeatDays(task.repeatValue);
    if (selectedDays.length === 0) {
      return [];
    }

    const cursor = new Date(rangeStart);
    cursor.setHours(baseDueDate.getHours(), baseDueDate.getMinutes(), baseDueDate.getSeconds(), baseDueDate.getMilliseconds());
    while (cursor <= rangeEnd) {
      if (cursor >= baseDueDate && selectedDays.includes(cursor.getDay())) {
        occurrences.push(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return occurrences;
  }

  if (task.repeatType === 3) {
    let cursor = new Date(baseDueDate);
    const maxIterations = 1000;
    let guard = 0;

    while (cursor <= rangeEnd && guard < maxIterations) {
      if (cursor >= rangeStart) {
        occurrences.push(new Date(cursor));
      }

      const nextDueDate = calculateNextRepeatDate({
        dueDate: cursor,
        repeatType: task.repeatType,
        repeatValue: task.repeatValue
      });

      if (!nextDueDate || nextDueDate.getTime() === cursor.getTime()) {
        break;
      }

      cursor = new Date(nextDueDate);
      guard += 1;
    }

    return occurrences;
  }

  return [];
}

function buildInstanceMap(instances) {
  return (instances || []).reduce((map, instance) => {
    const key = formatUTC8Date(instance.dueDate);
    if (!map[key]) {
      map[key] = [];
    }
    map[key].push(instance);
    return map;
  }, {});
}

function mapOccurrencesWithInstances(occurrences, instances, todayDate) {
  const instanceMap = buildInstanceMap(instances);

  return occurrences.map(date => {
    const key = formatUTC8Date(date);
    const matchedInstances = instanceMap[key] || [];
    const completedInstance = matchedInstances.find(item => Number(item.status) === 1);
    const status = completedInstance ? 1 : 0;
    const dueDateOnly = toDateOnlyInUTC8(date);
    const isFuture = dueDateOnly.getTime() > todayDate.getTime();

    return {
      date: new Date(date),
      dateKey: key,
      status,
      isFuture,
      source: matchedInstances.length > 0 ? 'instance' : 'planned',
      instanceId: completedInstance ? completedInstance._id : (matchedInstances[0] && matchedInstances[0]._id) || '',
      dueDate: matchedInstances[0] ? matchedInstances[0].dueDate : date
    };
  });
}

function calculateOccurrenceStreaks(records) {
  let longestStreak = 0;
  let currentRun = 0;

  records.forEach(record => {
    if (record.status === 1) {
      currentRun += 1;
      if (currentRun > longestStreak) {
        longestStreak = currentRun;
      }
    } else {
      currentRun = 0;
    }
  });

  let currentStreak = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].status === 1) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak };
}

function buildRepeatDescription(repeatType, repeatValue) {
  if (Number(repeatType) === 1) {
    return '每天';
  }

  if (Number(repeatType) === 2) {
    const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const labels = normalizeWeeklyRepeatDays(repeatValue).map(day => weekMap[day]);
    return labels.length > 0 ? `每${labels.join('、')}` : '每周';
  }

  if (Number(repeatType) === 3) {
    const labels = parseMonthlyRepeatDays(repeatValue).map(day => `${day}日`);
    return labels.length > 0 ? `每月 ${labels.join('、')}` : '每月';
  }

  return '不重复';
}

function buildPeriodicStatsPayload(parentTask, instances) {
  const todayDate = getTodayInUTC8();
  const todayEnd = getEndOfDayInUTC8();
  const latestInstanceDueDate = instances.length > 0
    ? new Date(Math.max(...instances.map(item => new Date(item.dueDate).getTime())))
    : new Date(parentTask.dueDate);

  const occurrenceStart = new Date(parentTask.dueDate);
  const latestInstanceDateOnly = toDateOnlyInUTC8(latestInstanceDueDate);
  const occurrenceEnd = latestInstanceDateOnly.getTime() < todayDate.getTime()
    ? latestInstanceDueDate
    : todayEnd;
  const occurrences = generatePlannedOccurrences(parentTask, occurrenceStart, occurrenceEnd);
  const occurrenceRecords = mapOccurrencesWithInstances(occurrences, instances, todayDate);
  const dueRecords = occurrenceRecords.filter(item => !item.isFuture);

  const totalDueCount = dueRecords.length;
  const completedDueCount = dueRecords.filter(item => item.status === 1).length;
  const missedDueCount = dueRecords.filter(item => item.status === 0).length;
  const completionRate = totalDueCount > 0 ? Math.round((completedDueCount / totalDueCount) * 100) : 0;
  const streaks = calculateOccurrenceStreaks(dueRecords);

  const last7Records = dueRecords.slice(-7);
  const last30Records = dueRecords.slice(-30);
  const last7Rate = last7Records.length > 0
    ? Math.round((last7Records.filter(item => item.status === 1).length / last7Records.length) * 100)
    : 0;
  const last30Rate = last30Records.length > 0
    ? Math.round((last30Records.filter(item => item.status === 1).length / last30Records.length) * 100)
    : 0;

  const currentMonthKey = formatMonthKey(todayDate);
  const monthlyMap = {};
  occurrenceRecords.forEach(record => {
    const monthKey = formatMonthKey(record.date);
    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = {
        month: monthKey,
        label: formatMonthLabel(monthKey),
        planned: 0,
        completed: 0,
        missed: 0,
        future: 0,
        completionRate: 0
      };
    }

    monthlyMap[monthKey].planned += 1;
    if (record.isFuture) {
      monthlyMap[monthKey].future += 1;
    } else if (record.status === 1) {
      monthlyMap[monthKey].completed += 1;
    } else {
      monthlyMap[monthKey].missed += 1;
    }
  });

  const monthlyStats = Object.values(monthlyMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(item => ({
      ...item,
      completionRate: (item.completed + item.missed) > 0
        ? Math.round((item.completed / (item.completed + item.missed)) * 100)
        : 0
    }));

  const thisMonthStats = monthlyMap[currentMonthKey] || {
    planned: 0,
    completed: 0,
    missed: 0
  };

  const lastMissedRecord = [...dueRecords].reverse().find(item => item.status === 0) || null;

  const recentRecords = [...occurrenceRecords]
    .filter(item => !item.isFuture)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 20)
    .map(item => ({
      date: item.date,
      dateKey: item.dateKey,
      status: item.status,
      source: item.source,
      formattedDate: item.dateKey
    }));

  const allRecords = occurrenceRecords.map(item => ({
    date: item.date,
    dateKey: item.dateKey,
    status: item.status,
    isFuture: item.isFuture,
    source: item.source
  }));

  return {
    summary: {
      completionRate,
      totalDueCount,
      completedDueCount,
      missedDueCount,
      currentStreak: streaks.currentStreak,
      longestStreak: streaks.longestStreak,
      last7Rate,
      last30Rate,
      lastMissedDate: lastMissedRecord ? lastMissedRecord.date : null,
      thisMonthPlanned: thisMonthStats.planned,
      thisMonthCompleted: thisMonthStats.completed,
      thisMonthMissed: thisMonthStats.missed
    },
    monthlyStats,
    recentRecords,
    allRecords,
    legacyStats: {
      totalCount: totalDueCount,
      completedCount: completedDueCount,
      incompleteCount: missedDueCount,
      completionRate,
      currentStreak: streaks.currentStreak,
      longestStreak: streaks.longestStreak
    }
  };
}

function getPeriodicStatusTransitionType(content) {
  if (!content) {
    return '';
  }

  if (content.action === 'toggle_status' && content.statusTransition) {
    return content.statusTransition;
  }

  const oldStatus = content.old && content.old.status;
  const newStatus = content.new && content.new.status;
  if (oldStatus === undefined || newStatus === undefined) {
    return '';
  }

  if (Number(oldStatus) === 0 && Number(newStatus) === 1) {
    return 'complete';
  }

  if (Number(oldStatus) === 1 && Number(newStatus) === 0) {
    return 'uncomplete';
  }

  return '';
}

async function getUsersByIds(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (ids.length === 0) {
    return {};
  }

  const userMap = {};
  const batchSize = 100;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batchIds = ids.slice(i, i + batchSize);
    const { data } = await db.collection('users')
      .where({ _id: _.in(batchIds) })
      .field({ _id: true, nickname: true, avatarUrl: true })
      .get();

    data.forEach(user => {
      userMap[user._id] = {
        userId: user._id,
        nickname: user.nickname || '',
        avatarUrl: user.avatarUrl || ''
      };
    });
  }

  return userMap;
}

function buildTaskLookupMap(tasks) {
  return (tasks || []).reduce((map, task) => {
    if (task && task._id) {
      map[task._id] = task;
    }
    return map;
  }, {});
}

function normalizePeriodicOperationEvent(operation, taskMap, userMap) {
  if (!operation || operation.type !== 'task_update') {
    return null;
  }

  const content = operation.content || {};
  const eventType = getPeriodicStatusTransitionType(content);
  if (!eventType) {
    return null;
  }

  const task = taskMap[operation.targetId] || null;
  const dueDate = content.dueDate || (task && task.dueDate) || null;
  const dateKey = dueDate ? formatUTC8Date(dueDate) : '';
  const operatorId = operation.userId || '';
  const operatorInfo = userMap[operatorId] || { userId: operatorId, nickname: '', avatarUrl: '' };
  const completedBy = content.completedBy || (eventType === 'complete' ? operatorId : '');
  const completedByInfo = completedBy
    ? (userMap[completedBy] || { userId: completedBy, nickname: '', avatarUrl: '' })
    : null;

  return {
    eventId: operation._id,
    taskId: operation.targetId,
    seriesTaskId: content.seriesTaskId || content.parentTaskId || (task && (task.parentTaskId || task._id)) || '',
    taskTitle: content.taskTitle || (task && task.title) || '',
    dueDate,
    dateKey,
    eventType,
    operatedAt: operation.createdAt,
    operatorId,
    operatorInfo,
    completedAt: content.completedAt || operation.createdAt,
    completedBy,
    completedByInfo,
    isPeriodicInstance: content.isPeriodicInstance !== undefined
      ? !!content.isPeriodicInstance
      : !!(task && task.isPeriodicInstance)
  };
}

async function getPeriodicSeriesOperationEvents(seriesTasks) {
  const taskIds = [...new Set((seriesTasks || []).map(task => task && task._id).filter(Boolean))];
  if (taskIds.length === 0) {
    return [];
  }

  const operations = [];
  const batchSize = 50;

  for (let i = 0; i < taskIds.length; i += batchSize) {
    const batchTaskIds = taskIds.slice(i, i + batchSize);
    let offset = 0;
    const pageSize = 100;

    while (true) {
      const { data } = await db.collection('operations')
        .where({
          type: 'task_update',
          targetId: _.in(batchTaskIds)
        })
        .orderBy('createdAt', 'desc')
        .skip(offset)
        .limit(pageSize)
        .get();

      operations.push(...data);

      if (data.length < pageSize) {
        break;
      }

      offset += pageSize;
    }
  }

  const taskMap = buildTaskLookupMap(seriesTasks);
  const userIds = [...new Set(operations
    .flatMap(item => {
      const content = item.content || {};
      return [item.userId, content.completedBy].filter(Boolean);
    }))];
  const userMap = await getUsersByIds(userIds);

  return operations
    .map(operation => normalizePeriodicOperationEvent(operation, taskMap, userMap))
    .filter(Boolean)
    .sort((a, b) => new Date(b.operatedAt) - new Date(a.operatedAt));
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

function getPeriodicGenerationPolicy(repeatType) {
  switch (Number(repeatType)) {
    case 1:
      return {
        horizonDays: 14,
        maxInstances: 14
      };
    case 2:
      return {
        horizonDays: 56,
        maxInstances: 20
      };
    case 3:
      return {
        horizonDays: 180,
        maxInstances: 12
      };
    default:
      return null;
  }
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

    const generationPolicy = getPeriodicGenerationPolicy(originalTask.repeatType);
    if (!generationPolicy) {
      return [];
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + generationPolicy.horizonDays);

    let currentDueDate = new Date(originalTask.dueDate);

    // 计算提醒偏移量（复用原始任务的提醒间隔）
    let reminderOffset = 0;
    if (originalTask.reminderAt) {
      const originalReminder = new Date(originalTask.reminderAt);
      const originalDue = new Date(originalTask.dueDate);
      reminderOffset = originalDue.getTime() - originalReminder.getTime();
    }

    // 按时间窗口与实例上限双重控制生成数量
    while (true) {
      if (tasks.length >= generationPolicy.maxInstances) {
        break;
      }

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
        ownershipType: getOwnershipTypeByListId(originalTask.listId),
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

    console.log(`[generatePeriodicTasks] repeatType=${originalTask.repeatType}, horizonDays=${generationPolicy.horizonDays}, maxInstances=${generationPolicy.maxInstances}, generatedCount=${tasks.length}`);
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
        // 统一使用 0-6：0=周日, 1=周一, ..., 6=周六；兼容历史值 7=周日
        const selectedDays = normalizeWeeklyRepeatDays(task.repeatValue);
        const currentDay = currentDue.getDay();

        if (selectedDays.length === 0) {
          nextDue.setDate(currentDue.getDate() + 7);
          break;
        }

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
      ownershipType: getOwnershipTypeByListId(originalTask.listId),
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

    const generationPolicy = getPeriodicGenerationPolicy(completedTask.repeatType);
    if (!generationPolicy) {
      return [];
    }

    const parentTaskId = completedTask.parentTaskId || completedTask._id;

    // 查询该父任务下所有未来未完成实例，用于同时计算补齐上界和最晚截止日期
    const now = new Date();
    const { data: existingTasks } = await db.collection('tasks')
      .where({
        parentTaskId: parentTaskId,
        dueDate: db.command.gte(now),
        status: 0
      })
      .orderBy('dueDate', 'desc')
      .get();

    const remainingCapacity = generationPolicy.maxInstances - existingTasks.length;
    if (remainingCapacity <= 0) {
      console.log(`[ensurePeriodicTasks] repeatType=${completedTask.repeatType}, horizonDays=${generationPolicy.horizonDays}, maxInstances=${generationPolicy.maxInstances}, existingFutureCount=${existingTasks.length}, generatedCount=0`);
      return [];
    }

    let lastDueDate = existingTasks.length > 0 ? new Date(existingTasks[0].dueDate) : new Date(completedTask.dueDate);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + generationPolicy.horizonDays);

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
      if (tasksToGenerate.length >= remainingCapacity) {
        break;
      }

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
        ownershipType: getOwnershipTypeByListId(parentTask.listId),
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

    console.log(`[ensurePeriodicTasks] repeatType=${parentTask.repeatType}, horizonDays=${generationPolicy.horizonDays}, maxInstances=${generationPolicy.maxInstances}, existingFutureCount=${existingTasks.length}, generatedCount=${tasksToGenerate.length}`);
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

    const resolvedSeries = await resolvePeriodicSeriesTask(taskId);
    if (!resolvedSeries || !resolvedSeries.requestedTask) {
      return { code: -1, message: '任务不存在' };
    }

    const { requestedTask, parentTask, parentTaskId } = resolvedSeries;

    const permission = await ensureTaskViewPermission(userId, requestedTask);
    if (!permission.hasPermission) {
      return { code: -1, message: permission.message };
    }

    // 如果不是周期任务，返回错误
    if (!parentTask || Number(parentTask.repeatType) === 0) {
      return { code: -1, message: '此任务不是周期任务' };
    }

    const seriesTasks = await getTaskSeriesTasks(parentTaskId);
    const allInstances = seriesTasks
      .filter(Boolean)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const statsPayload = buildPeriodicStatsPayload(parentTask, allInstances);
    const recentEventRecords = await getPeriodicSeriesOperationEvents(allInstances);

    return {
      code: 0,
      message: '获取成功',
      data: {
        taskInfo: {
          _id: parentTask._id,
          seriesTaskId: parentTaskId,
          requestedTaskId: requestedTask._id,
          title: parentTask.title,
          repeatType: parentTask.repeatType,
          repeatValue: parentTask.repeatValue,
          priority: parentTask.priority,
          dueDate: parentTask.dueDate,
          createdAt: parentTask.createdAt,
          repeatDescription: buildRepeatDescription(parentTask.repeatType, parentTask.repeatValue)
        },
        summary: statsPayload.summary,
        monthlyStats: statsPayload.monthlyStats,
        recentRecords: statsPayload.recentRecords,
        recentEventRecords,
        stats: statsPayload.legacyStats,
        allRecords: statsPayload.allRecords
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

async function getPeriodicTaskMonthDetail(openid, data) {
  try {
    if (!data || !data.taskId || !data.month) {
      return {
        code: -1,
        message: '任务ID和月份不能为空'
      };
    }

    const userId = await getUserId(openid);
    const { taskId, month } = data;
    const resolvedSeries = await resolvePeriodicSeriesTask(taskId);

    if (!resolvedSeries || !resolvedSeries.requestedTask) {
      return { code: -1, message: '任务不存在' };
    }

    const { requestedTask, parentTask, parentTaskId } = resolvedSeries;
    const permission = await ensureTaskViewPermission(userId, requestedTask);
    if (!permission.hasPermission) {
      return { code: -1, message: permission.message };
    }

    if (!parentTask || Number(parentTask.repeatType) === 0) {
      return { code: -1, message: '此任务不是周期任务' };
    }

    const monthRange = getMonthRange(month);
    if (!monthRange) {
      return { code: -1, message: '月份格式错误' };
    }

    const allInstances = await getTaskSeriesTasksInRange(parentTaskId, monthRange.start, monthRange.end);
    const filteredInstances = allInstances.filter(Boolean);
    const todayDate = getTodayInUTC8();
    const todayEnd = getEndOfDayInUTC8();
    const effectiveMonthEnd = monthRange.end < todayEnd ? monthRange.end : todayEnd;
    const monthOccurrences = generatePlannedOccurrences(parentTask, monthRange.start, effectiveMonthEnd);
    const monthRecords = mapOccurrencesWithInstances(monthOccurrences, filteredInstances, todayDate);

    return {
      code: 0,
      message: '获取成功',
      data: {
        taskId: parentTaskId,
        month,
        label: formatMonthLabel(month),
        days: monthRecords.map(item => ({
          date: item.dateKey,
          status: item.status,
          source: item.source
        }))
      }
    };
  } catch (error) {
    console.error('获取周期任务月份明细失败:', error);
    return {
      code: -1,
      message: error.message || '获取月份明细失败'
    };
  }
}
