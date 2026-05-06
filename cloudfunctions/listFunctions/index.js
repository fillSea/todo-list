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

  if (!openid) {
    return {
      code: -1,
      message: '未获取到用户信息'
    };
  }

  try {
    switch (action) {
      case 'getMyLists':
        return await getMyLists(openid, data);
      case 'getAvailableLists':
        return await getAvailableLists(openid, data);
      case 'getListDetail':
        return await getListDetail(openid, data);
      case 'createList':
        return await createList(openid, data);
      case 'updateList':
        return await updateList(openid, data);
      case 'deleteList':
        return await deleteList(openid, data);
      case 'getListMembers':
        return await getListMembers(openid, data);
      case 'inviteMember':
        return await inviteMember(openid, data);
      case 'removeMember':
        return await removeMember(openid, data);
      case 'joinList':
        return await joinList(openid, data);
      case 'searchLists':
        return await searchLists(openid, data);
      case 'getOperations':
        return await getOperations(openid, data);
      case 'updateMemberRole':
        return await updateMemberRole(openid, data);
      case 'getInviteList':
        return await getInviteList(openid, data);
      case 'getRecentCollaborators':
        return await getRecentCollaborators(openid, data);
      case 'generateInviteLink':
        return await generateInviteLink(openid, data);
      case 'generateMiniProgramCode':
        return await generateMiniProgramCode(openid, data);
      case 'createWechatInvite':
        return await createWechatInvite(openid, data);
      case 'searchUser':
        return await searchUser(openid, data);
      case 'getInviteInfo':
        return await getInviteInfo(openid, data);
      case 'acceptInvite':
        return await acceptInvite(openid, data);
      case 'applyJoinList':
        return await applyJoinList(openid, data);
      case 'rejectInvite':
        return await rejectInvite(openid, data);
      case 'remindInvite':
        return await remindInvite(openid, data);
      case 'cancelInvite':
        return await cancelInvite(openid, data);
      case 'approveApplication':
        return await approveApplication(openid, data);
      case 'rejectApplication':
        return await rejectApplication(openid, data);
      case 'clearInvites':
        return await clearInvites(openid, data);
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

// ==================== 辅助函数 ====================

// 根据openid获取用户ID
async function getUserId(openid) {
  const { data: users } = await db.collection('users')
    .where({ openid })
    .get();
  return users.length > 0 ? users[0]._id : null;
}

// 获取清单的任务统计信息（考虑周期任务过滤逻辑）
async function getListTaskStats(listId) {
  const { data: tasks } = await db.collection('tasks')
    .where({ listId })
    .get();

  // 应用周期任务过滤：同前端逻辑
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const processedTasks = tasks.map(task => {
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const dueDateOnly = dueDate ? new Date(dueDate) : null;
    if (dueDateOnly) dueDateOnly.setHours(0, 0, 0, 0);
    const isOverdue = dueDateOnly && dueDateOnly < today && task.status === 0;
    return { ...task, isOverdue };
  });

  // 每个周期系列只保留最近的一个未完成且未过期实例
  const nearestPeriodicByGroup = {};
  processedTasks
    .filter(t => t.repeatType > 0 && t.status === 0 && !t.isOverdue)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .forEach(t => {
      const groupId = t.parentTaskId || t._id;
      if (!nearestPeriodicByGroup[groupId]) {
        nearestPeriodicByGroup[groupId] = t._id;
      }
    });

  const filteredTasks = processedTasks.filter(task => {
    if (task.status === 1) return true;
    if (!task.repeatType || task.repeatType === 0) return true;
    if (task.isOverdue) return true;
    const groupId = task.parentTaskId || task._id;
    return task._id === nearestPeriodicByGroup[groupId];
  });

  const taskCount = filteredTasks.length;
  const pendingCount = filteredTasks.filter(t => t.status === 0).length;
  const completedCount = taskCount - pendingCount;
  const progress = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;

  return { taskCount, pendingCount, completedCount, progress };
}

// 获取清单成员摘要（头像列表 + 总数）
async function getListMemberSummary(listId) {
  const { data: members } = await db.collection('list_members')
    .where({ listId })
    .limit(5)
    .get();

  const { total: memberCount } = await db.collection('list_members')
    .where({ listId })
    .count();

  // 获取成员用户信息
  if (members.length === 0) {
    return { members: [], memberCount: 0 };
  }

  const memberUserIds = members.map(m => m.userId);
  const { data: memberUsers } = await db.collection('users')
    .where({ _id: _.in(memberUserIds) })
    .field({ avatarUrl: true, nickname: true })
    .get();

  const memberAvatars = members.slice(0, 3).map(m => {
    const user = memberUsers.find(u => u._id === m.userId);
    return {
      avatarUrl: user ? user.avatarUrl : '',
      nickname: user ? user.nickname : ''
    };
  });

  return { members: memberAvatars, memberCount };
}

// 获取用户在清单中的角色
async function getUserRole(listId, userId) {
  const { data: memberRecords } = await db.collection('list_members')
    .where({ listId, userId })
    .get();
  return memberRecords.length > 0 ? memberRecords[0].role : null;
}

// 记录操作日志
async function logOperation(type, targetId, userId, content) {
  try {
    await db.collection('operations').add({
      data: {
        type,
        targetId,
        userId,
        content,
        createdAt: db.serverDate()
      }
    });
  } catch (err) {
    console.error('记录操作日志失败:', err);
  }
}

// ==================== 清单查询 ====================

// 获取可用的清单列表（用于创建任务时选择）
async function getAvailableLists(openid, data) {
  try {
    const userId = await getUserId(openid);
    if (!userId) {
      return { code: 0, message: 'success', data: [] };
    }

    // 获取用户创建的清单
    const { data: myLists } = await db.collection('lists')
      .where({ creatorId: userId })
      .orderBy('createdAt', 'desc')
      .get();

    // 获取用户作为成员的共享清单
    const { data: memberships } = await db.collection('list_members')
      .where({ userId })
      .get();

    const sharedListIds = memberships.map(m => m.listId);

    let sharedLists = [];
    if (sharedListIds.length > 0) {
      const { data: lists } = await db.collection('lists')
        .where({ _id: _.in(sharedListIds) })
        .orderBy('createdAt', 'desc')
        .get();
      sharedLists = lists;
    }

    // 合并清单并去重
    const allLists = [...myLists];
    sharedLists.forEach(list => {
      if (!allLists.find(l => l._id === list._id)) {
        allLists.push(list);
      }
    });

    const formattedLists = allLists.map(list => ({
      _id: list._id,
      name: list.name,
      isShared: list.isShared,
      creatorId: list.creatorId
    }));

    return { code: 0, message: 'success', data: formattedLists };
  } catch (error) {
    console.error('获取可用清单列表失败:', error);
    return { code: -1, message: '获取可用清单列表失败' };
  }
}

// 获取我的清单列表（完整版，含统计和成员信息）
async function getMyLists(openid, data) {
  try {
    const { filter, type, page = 1, pageSize = 20 } = data || {};
    const filterValue = filter || type || 'all';

    const userId = await getUserId(openid);
    if (!userId) {
      return { code: 0, message: 'success', data: { list: [], hasMore: false } };
    }

    // 获取用户创建的清单ID列表
    const { data: myLists } = await db.collection('lists')
      .where({ creatorId: userId })
      .get();
    const myListIds = myLists.map(l => l._id);

    // 获取用户作为成员的清单ID列表
    const { data: memberships } = await db.collection('list_members')
      .where({ userId })
      .get();
    const memberListIds = memberships.map(m => m.listId);

    // 合并所有可访问的清单ID（去重）
    const allAccessibleIds = [...new Set([...myListIds, ...memberListIds])];

    if (allAccessibleIds.length === 0) {
      return { code: 0, message: 'success', data: { list: [], hasMore: false } };
    }

    // 根据筛选条件构建查询
    let query = {};
    switch (filterValue) {
      case 'personal':
        query = { _id: _.in(allAccessibleIds), isShared: false };
        break;
      case 'shared':
        query = { _id: _.in(allAccessibleIds), isShared: true };
        break;
      case 'created':
        query = { creatorId: userId };
        break;
      default:
        query = { _id: _.in(allAccessibleIds) };
    }

    // 查询清单（分页）
    const { data: lists } = await db.collection('lists')
      .where(query)
      .orderBy('updatedAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize + 1)
      .get();

    const hasMore = lists.length > pageSize;
    const pagedLists = lists.slice(0, pageSize);

    // 并行获取每个清单的统计信息和成员信息
    const enrichedLists = await Promise.all(
      pagedLists.map(async (list) => {
        const [stats, memberSummary] = await Promise.all([
          getListTaskStats(list._id),
          list.isShared ? getListMemberSummary(list._id) : Promise.resolve({ members: [], memberCount: 0 })
        ]);

        // 获取当前用户在该清单的角色
        const myRole = list.creatorId === userId ? 1 : await getUserRole(list._id, userId);

        return {
          ...list,
          ...stats,
          members: memberSummary.members,
          memberCount: memberSummary.memberCount,
          myRole
        };
      })
    );

    return {
      code: 0,
      message: 'success',
      data: { list: enrichedLists, hasMore }
    };
  } catch (error) {
    console.error('获取清单列表失败:', error);
    return { code: -1, message: '获取清单列表失败' };
  }
}

// 获取清单详情（含任务列表、成员信息、用户角色）
async function getListDetail(openid, data) {
  try {
    const { listId } = data || {};
    if (!listId) {
      return { code: -1, message: '清单ID不能为空' };
    }

    const userId = await getUserId(openid);

    // 获取清单信息
    const { data: lists } = await db.collection('lists')
      .where({ _id: listId })
      .get();

    if (lists.length === 0) {
      return { code: -1, message: '清单不存在' };
    }

    const list = lists[0];

    // 获取任务列表
    const { data: tasks } = await db.collection('tasks')
      .where({ listId })
      .orderBy('createdAt', 'desc')
      .get();

    // 为任务附加分类信息
    const categoryIds = [...new Set(tasks.filter(t => t.categoryId).map(t => t.categoryId))];
    let categoriesMap = {};
    if (categoryIds.length > 0) {
      const { data: categories } = await db.collection('categories')
        .where({ _id: _.in(categoryIds) })
        .get();
      categories.forEach(c => { categoriesMap[c._id] = c; });
    }

    const enrichedTasks = tasks.map(task => {
      const cat = task.categoryId ? categoriesMap[task.categoryId] : null;
      return {
        ...task,
        categoryName: cat ? cat.name : '',
        categoryColor: cat ? cat.color : ''
      };
    });

    // 获取成员列表（含用户信息）
    const { data: memberRecords } = await db.collection('list_members')
      .where({ listId })
      .get();

    let members = [];
    if (memberRecords.length > 0) {
      const memberUserIds = memberRecords.map(m => m.userId);
      const { data: memberUsers } = await db.collection('users')
        .where({ _id: _.in(memberUserIds) })
        .get();

      members = memberRecords.map(m => {
        const user = memberUsers.find(u => u._id === m.userId);
        return {
          _id: m._id,
          userId: m.userId,
          role: m.role,
          nickname: user ? user.nickname : '未知用户',
          avatarUrl: user ? user.avatarUrl : ''
        };
      });
    }

    // 获取当前用户角色
    const myRole = list.creatorId === userId ? 1 : await getUserRole(listId, userId);

    return {
      code: 0,
      message: 'success',
      data: {
        listInfo: list,
        tasks: enrichedTasks,
        members,
        myRole
      }
    };
  } catch (error) {
    console.error('获取清单详情失败:', error);
    return { code: -1, message: '获取清单详情失败' };
  }
}

// 搜索清单
async function searchLists(openid, data) {
  try {
    const { keyword } = data || {};
    if (!keyword || !keyword.trim()) {
      return { code: -1, message: '搜索关键词不能为空' };
    }

    const userId = await getUserId(openid);
    if (!userId) {
      return { code: 0, message: 'success', data: [] };
    }

    // 获取用户可访问的所有清单ID
    const { data: myLists } = await db.collection('lists')
      .where({ creatorId: userId })
      .get();
    const myListIds = myLists.map(l => l._id);

    const { data: memberships } = await db.collection('list_members')
      .where({ userId })
      .get();
    const memberListIds = memberships.map(m => m.listId);

    const allAccessibleIds = [...new Set([...myListIds, ...memberListIds])];

    if (allAccessibleIds.length === 0) {
      return { code: 0, message: 'success', data: [] };
    }

    // 搜索清单名称
    const { data: results } = await db.collection('lists')
      .where({
        _id: _.in(allAccessibleIds),
        name: db.RegExp({
          regexp: keyword.trim(),
          options: 'i'
        })
      })
      .orderBy('updatedAt', 'desc')
      .limit(20)
      .get();

    return { code: 0, message: 'success', data: results };
  } catch (error) {
    console.error('搜索清单失败:', error);
    return { code: -1, message: '搜索清单失败' };
  }
}

// ==================== 清单增删改 ====================

// 创建清单
async function createList(openid, data) {
  try {
    const { name, description = '', isShared = false, visibility = 2, color } = data || {};

    if (!name || !name.trim()) {
      return { code: -1, message: '清单名称不能为空' };
    }

    if (name.trim().length < 2 || name.trim().length > 50) {
      return { code: -1, message: '清单名称需在2-50个字符之间' };
    }

    const userId = await getUserId(openid);
    if (!userId) {
      return { code: -1, message: '用户不存在' };
    }

    const now = db.serverDate();

    const listData = {
      name: name.trim(),
      description: description.trim(),
      isShared,
      visibility,
      creatorId: userId,
      createdAt: now,
      updatedAt: now
    };

    if (color) {
      listData.color = color;
    }

    const result = await db.collection('lists').add({ data: listData });

    // 如果是共享清单，创建者自动成为成员
    if (isShared) {
      await db.collection('list_members').add({
        data: {
          listId: result._id,
          userId: userId,
          role: 1,
          joinType: 'create',
          joinedAt: now
        }
      });
    }

    // 记录操作日志
    await logOperation('list_create', result._id, userId, { listData });

    return {
      code: 0,
      message: '创建成功',
      data: { _id: result._id, ...listData }
    };
  } catch (error) {
    console.error('创建清单失败:', error);
    return { code: -1, message: '创建清单失败' };
  }
}

// 更新清单
async function updateList(openid, data) {
  try {
    const { listId, name, description, isShared, visibility, color } = data || {};

    if (!listId) {
      return { code: -1, message: '清单ID不能为空' };
    }

    const userId = await getUserId(openid);
    if (!userId) {
      return { code: -1, message: '用户不存在' };
    }

    // 检查权限（创建者或编辑者可修改）
    const { data: lists } = await db.collection('lists')
      .where({ _id: listId })
      .get();

    if (lists.length === 0) {
      return { code: -1, message: '清单不存在' };
    }

    const list = lists[0];
    const isCreator = list.creatorId === userId;
    const myRole = isCreator ? 1 : await getUserRole(listId, userId);

    if (myRole !== 1 && myRole !== 2) {
      return { code: -1, message: '无权限修改' };
    }

    const updateData = { updatedAt: db.serverDate() };

    if (name !== undefined) {
      if (name.trim().length < 2 || name.trim().length > 50) {
        return { code: -1, message: '清单名称需在2-50个字符之间' };
      }
      updateData.name = name.trim();
    }
    if (description !== undefined) updateData.description = description.trim();
    if (isShared !== undefined) updateData.isShared = isShared;
    if (visibility !== undefined) updateData.visibility = visibility;
    if (color !== undefined) updateData.color = color;

    await db.collection('lists').doc(listId).update({ data: updateData });

    // 如果从个人切换为共享，确保创建者在成员表中
    if (isShared === true && !list.isShared) {
      const existingMember = await db.collection('list_members')
        .where({ listId, userId: list.creatorId })
        .count();
      if (existingMember.total === 0) {
        await db.collection('list_members').add({
          data: {
            listId,
            userId: list.creatorId,
            role: 1,
            joinType: 'create',
            joinedAt: db.serverDate()
          }
        });
      }
    }

    // 记录操作日志
    await logOperation('list_update', listId, userId, {
      before: list,
      after: updateData
    });

    return { code: 0, message: '更新成功' };
  } catch (error) {
    console.error('更新清单失败:', error);
    return { code: -1, message: '更新清单失败' };
  }
}

// 删除清单
async function deleteList(openid, data) {
  try {
    const { listId } = data || {};

    if (!listId) {
      return { code: -1, message: '清单ID不能为空' };
    }

    const userId = await getUserId(openid);
    if (!userId) {
      return { code: -1, message: '用户不存在' };
    }

    // 检查权限（只有创建者可以删除）
    const { data: lists } = await db.collection('lists')
      .where({ _id: listId, creatorId: userId })
      .get();

    if (lists.length === 0) {
      return { code: -1, message: '清单不存在或无权限删除' };
    }

    // 删除清单下的所有任务
    const { data: tasks } = await db.collection('tasks')
      .where({ listId })
      .get();

    if (tasks.length > 0) {
      await Promise.all(
        tasks.map(task => db.collection('tasks').doc(task._id).remove())
      );
    }

    // 删除清单成员关系
    const { data: members } = await db.collection('list_members')
      .where({ listId })
      .get();

    if (members.length > 0) {
      await Promise.all(
        members.map(member => db.collection('list_members').doc(member._id).remove())
      );
    }

    // 删除相关邀请记录
    const { data: invites } = await db.collection('list_invites')
      .where({ listId })
      .get();

    if (invites.length > 0) {
      await Promise.all(
        invites.map(invite => db.collection('list_invites').doc(invite._id).remove())
      );
    }

    // 记录操作日志（在删除清单之前）
    await logOperation('list_delete', listId, userId, { deletedList: lists[0] });

    // 删除清单
    await db.collection('lists').doc(listId).remove();

    return { code: 0, message: '删除成功' };
  } catch (error) {
    console.error('删除清单失败:', error);
    return { code: -1, message: '删除清单失败' };
  }
}

// ==================== 成员管理 ====================

// 获取清单成员
async function getListMembers(openid, data) {
  try {
    const { listId } = data || {};

    if (!listId) {
      return { code: -1, message: '清单ID不能为空' };
    }

    const userId = await getUserId(openid);

    // 获取清单信息
    const { data: lists } = await db.collection('lists')
      .where({ _id: listId })
      .get();

    if (lists.length === 0) {
      return { code: -1, message: '清单不存在' };
    }

    // 获取成员列表
    const { data: members } = await db.collection('list_members')
      .where({ listId })
      .get();

    // 获取成员详细信息
    const membersWithInfo = await Promise.all(
      members.map(async (member) => {
        const { data: users } = await db.collection('users')
          .where({ _id: member.userId })
          .get();

        const user = users[0] || {};
        return {
          ...member,
          nickname: user.nickname || '未知用户',
          avatarUrl: user.avatarUrl || ''
        };
      })
    );

    // 获取当前用户角色
    const myRole = lists[0].creatorId === userId ? 1 : await getUserRole(listId, userId);

    return {
      code: 0,
      message: 'success',
      data: {
        listInfo: lists[0],
        members: membersWithInfo,
        myRole
      }
    };
  } catch (error) {
    console.error('获取成员列表失败:', error);
    return { code: -1, message: '获取成员列表失败' };
  }
}

// 邀请成员
async function inviteMember(openid, data) {
  try {
    const { listId, userId: targetUserId, role = 3 } = data || {};

    if (!listId || !targetUserId) {
      return { code: -1, message: '清单ID和用户ID不能为空' };
    }

    const userId = await getUserId(openid);

    // 检查权限（只有创建者可以邀请）
    const { data: lists } = await db.collection('lists')
      .where({ _id: listId })
      .get();

    if (lists.length === 0) {
      return { code: -1, message: '清单不存在' };
    }

    if (lists[0].creatorId !== userId) {
      return { code: -1, message: '无权限邀请成员' };
    }

    // 检查是否已是成员
    const { data: existingMembers } = await db.collection('list_members')
      .where({ listId, userId: targetUserId })
      .get();

    if (existingMembers.length > 0) {
      return { code: -1, message: '该用户已是清单成员' };
    }

    // 添加成员
    await db.collection('list_members').add({
      data: {
        listId,
        userId: targetUserId,
        role,
        joinType: 'invite',
        inviteId: '',
        joinedAt: db.serverDate()
      }
    });

    // 创建通知
    await db.collection('notifications').add({
      data: {
        type: 'list_shared',
        userId: targetUserId,
        relatedId: listId,
        content: `您已被邀请加入清单"${lists[0].name}"`,
        isRead: false,
        createdAt: db.serverDate()
      }
    });

    // 记录操作日志
    await logOperation('member_add', listId, userId, { targetUserId, role });

    return { code: 0, message: '邀请成功' };
  } catch (error) {
    console.error('邀请成员失败:', error);
    return { code: -1, message: '邀请成员失败' };
  }
}

// 移除成员
async function removeMember(openid, data) {
  try {
    const { listId, userId: targetUserId } = data || {};

    if (!listId || !targetUserId) {
      return { code: -1, message: '清单ID和用户ID不能为空' };
    }

    const userId = await getUserId(openid);

    // 检查权限（只有创建者可以移除成员）
    const { data: lists } = await db.collection('lists')
      .where({ _id: listId, creatorId: userId })
      .get();

    if (lists.length === 0) {
      return { code: -1, message: '无权限移除成员' };
    }

    // 不能移除创建者自己
    if (targetUserId === userId) {
      return { code: -1, message: '不能移除清单创建者' };
    }

    // 删除成员关系
    const { data: members } = await db.collection('list_members')
      .where({ listId, userId: targetUserId })
      .get();

    if (members.length > 0) {
      await db.collection('list_members').doc(members[0]._id).remove();
    }

    // 记录操作日志
    await logOperation('member_remove', listId, userId, { targetUserId });

    return { code: 0, message: '移除成功' };
  } catch (error) {
    console.error('移除成员失败:', error);
    return { code: -1, message: '移除成员失败' };
  }
}

// 加入清单
async function joinList(openid, data) {
  try {
    const { listId, inviteCode } = data || {};

    if (!listId) {
      return { code: -1, message: '清单ID不能为空' };
    }

    const userId = await getUserId(openid);
    if (!userId) {
      return { code: -1, message: '用户不存在' };
    }

    // 检查清单是否存在
    const { data: lists } = await db.collection('lists')
      .where({ _id: listId })
      .get();

    if (lists.length === 0) {
      return { code: -1, message: '清单不存在' };
    }

    // 检查是否已是成员
    const { data: existingMembers } = await db.collection('list_members')
      .where({ listId, userId })
      .get();

    if (existingMembers.length > 0) {
      return { code: -1, message: '您已是该清单成员' };
    }

    // 如果有邀请码，验证邀请
    let inviteRole = 3;
    if (inviteCode) {
      const { data: invites } = await db.collection('list_invites')
        .where({ inviteCode, listId, status: 0 })
        .get();

      if (invites.length > 0) {
        inviteRole = invites[0].role || 3;
        // 更新邀请状态为已接受
        await db.collection('list_invites').doc(invites[0]._id).update({
          data: {
            status: 1,
            inviteeId: userId,
            updatedAt: db.serverDate()
          }
        });
      }
    }

    // 添加成员
    await db.collection('list_members').add({
      data: {
        listId,
        userId,
        role: inviteRole,
        joinType: inviteCode ? 'link' : 'invite',
        joinedAt: db.serverDate()
      }
    });

    // 记录操作日志
    await logOperation('member_add', listId, userId, { joinType: inviteCode ? 'link' : 'invite' });

    return { code: 0, message: '加入成功' };
  } catch (error) {
    console.error('加入清单失败:', error);
    return { code: -1, message: '加入清单失败' };
  }
}

// ==================== 操作记录 ====================

// 获取操作记录
async function getOperations(openid, data) {
  try {
    const { listId, page = 1, pageSize = 20 } = data || {};

    if (!listId) {
      return { code: -1, message: '清单ID不能为空' };
    }

    const userId = await getUserId(openid);

    // 检查用户是否有权限查看（必须是清单成员）
    const { data: lists } = await db.collection('lists')
      .where({ _id: listId })
      .get();

    if (lists.length === 0) {
      return { code: -1, message: '清单不存在' };
    }

    const isCreator = lists[0].creatorId === userId;
    const myRole = isCreator ? 1 : await getUserRole(listId, userId);

    if (!myRole) {
      return { code: -1, message: '无权限查看操作记录' };
    }

    // 查询操作记录（清单自身操作 + 清单内任务操作）
    const { data: operations } = await db.collection('operations')
      .where(_.or([
        { targetId: listId },
        { listId: listId }
      ]))
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize + 1)
      .get();

    const hasMore = operations.length > pageSize;
    const pagedOps = operations.slice(0, pageSize);

    // 获取操作人信息
    const userIds = [...new Set(pagedOps.map(op => op.userId))];
    let usersMap = {};
    if (userIds.length > 0) {
      const { data: users } = await db.collection('users')
        .where({ _id: _.in(userIds) })
        .get();
      users.forEach(u => { usersMap[u._id] = u; });
    }

    // 格式化操作记录
    const formattedOps = pagedOps.map(op => {
      const user = usersMap[op.userId];
      return {
        _id: op._id,
        type: op.type,
        icon: getOperationIcon(op.type),
        text: getOperationText(op),
        userName: user ? user.nickname : '未知用户',
        createdAt: op.createdAt
      };
    });

    return {
      code: 0,
      message: 'success',
      data: { operations: formattedOps, hasMore }
    };
  } catch (error) {
    console.error('获取操作记录失败:', error);
    return { code: -1, message: '获取操作记录失败' };
  }
}

// 获取操作图标
function getOperationIcon(type) {
  const iconMap = {
    'list_create': 'plus',
    'list_update': 'edit',
    'list_delete': 'delete-o',
    'task_create': 'plus',
    'task_create_repeat': 'replay',
    'task_update': 'edit',
    'task_delete': 'delete-o',
    'task_delete_repeat': 'delete-o',
    'member_add': 'friends-o',
    'member_remove': 'cross'
  };
  return iconMap[type] || 'info-o';
}

// 获取操作描述文本
function getOperationText(op) {
  const content = op.content || {};
  const taskTitle = content.taskTitle || content.task?.title || '';
  switch (op.type) {
    case 'list_create':
      return `创建了清单"${content.listData?.name || ''}"`;
    case 'list_update':
      return '修改了清单信息';
    case 'list_delete':
      return `删除了清单"${content.deletedList?.name || ''}"`;
    case 'task_create':
      return `创建了任务"${taskTitle}"`;
    case 'task_create_repeat':
      return `生成了周期任务"${taskTitle}"`;
    case 'task_update': {
      if (content.old?.status !== undefined && content.new?.status !== undefined) {
        return content.new.status === 1
          ? `完成了任务"${taskTitle}"`
          : `恢复了任务"${taskTitle}"`;
      }
      return `更新了任务"${taskTitle}"`;
    }
    case 'task_delete':
      return `删除了任务"${taskTitle}"`;
    case 'task_delete_repeat':
      return `删除了周期任务"${taskTitle}"`;
    case 'member_add':
      return '添加了新成员';
    case 'member_remove':
      return '移除了成员';
    default:
      return '执行了操作';
  }
}

// 更新成员角色
async function updateMemberRole(openid, data) {
  try {
    const { listId, memberId, role } = data || {};

    if (!listId || !memberId) {
      return { code: -1, message: '参数不完整' };
    }

    if (![2, 3].includes(role)) {
      return { code: -1, message: '无效的角色' };
    }

    const userId = await getUserId(openid);

    // 检查权限（只有创建者可以修改角色）
    const { data: lists } = await db.collection('lists')
      .where({ _id: listId, creatorId: userId })
      .get();

    if (lists.length === 0) {
      return { code: -1, message: '无权限修改成员角色' };
    }

    // 更新角色
    await db.collection('list_members').doc(memberId).update({
      data: { role }
    });

    // 记录操作日志
    await logOperation('member_update', listId, userId, { memberId, newRole: role });

    return { code: 0, message: '修改成功' };
  } catch (error) {
    console.error('修改成员角色失败:', error);
    return { code: -1, message: '修改成员角色失败' };
  }
}

// 获取清单邀请列表
async function getInviteList(openid, data) {
  try {
    const { listId, status } = data || {};

    if (!listId) {
      return { code: -1, message: '清单ID不能为空' };
    }

    const userId = await getUserId(openid);

    // 检查用户是否为清单创建者或成员
    const { data: lists } = await db.collection('lists')
      .where({ _id: listId })
      .get();

    if (lists.length === 0) {
      return { code: -1, message: '清单不存在' };
    }

    const isCreator = lists[0].creatorId === userId;
    const userRole = isCreator ? 1 : await getUserRole(listId, userId);
    if (!userRole) {
      return { code: -1, message: '无权限查看邀请列表' };
    }

    const query = { listId };
    if (status !== undefined && status !== null) {
      query.status = status;
    }

    const { data: invites } = await db.collection('list_invites')
      .where(query)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    // 补充被邀请人信息
    const enriched = [];
    for (const invite of invites) {
      let inviteeInfo = invite.inviteeInfo || {};
      if (invite.inviteeId && !inviteeInfo.nickname) {
        const { data: users } = await db.collection('users')
          .where({ _id: invite.inviteeId })
          .get();
        if (users.length > 0) {
          inviteeInfo = {
            nickname: users[0].nickname,
            avatarUrl: users[0].avatarUrl
          };
        }
      }
      enriched.push({ ...invite, inviteeInfo });
    }

    return { success: true, invites: enriched };
  } catch (error) {
    console.error('获取邀请列表失败:', error);
    return { code: -1, message: '获取邀请列表失败' };
  }
}

// 获取最近协作成员
async function getRecentCollaborators(openid, data) {
  try {
    const userId = await getUserId(openid);

    // 查询用户参与的所有清单
    const { data: memberships } = await db.collection('list_members')
      .where({ userId })
      .get();

    const listIds = memberships.map(m => m.listId);

    if (listIds.length === 0) {
      return { success: true, members: [] };
    }

    // 查询这些清单中的其他成员
    const { data: coMembers } = await db.collection('list_members')
      .where({
        listId: _.in(listIds),
        userId: _.neq(userId)
      })
      .orderBy('joinedAt', 'desc')
      .get();

    // 去重，保留最近的记录
    const seen = new Set();
    const uniqueUserIds = [];
    for (const m of coMembers) {
      if (!seen.has(m.userId)) {
        seen.add(m.userId);
        uniqueUserIds.push(m.userId);
      }
      if (uniqueUserIds.length >= 20) break;
    }

    if (uniqueUserIds.length === 0) {
      return { success: true, members: [] };
    }

    // 查询用户信息
    const { data: users } = await db.collection('users')
      .where({ _id: _.in(uniqueUserIds) })
      .get();

    const userMap = {};
    users.forEach(u => { userMap[u._id] = u; });

    const members = uniqueUserIds
      .filter(id => userMap[id])
      .map(id => ({
        userId: id,
        nickname: userMap[id].nickname,
        avatarUrl: userMap[id].avatarUrl
      }));

    return { success: true, members };
  } catch (error) {
    console.error('获取最近协作成员失败:', error);
    return { code: -1, message: '获取最近协作成员失败' };
  }
}

// 生成邀请链接
async function generateInviteLink(openid, data) {
  try {
    const { listId, role = 3, expireDays = 7, needApproval = false } = data || {};

    if (!listId) {
      return { code: -1, message: '清单ID不能为空' };
    }

    const userId = await getUserId(openid);

    // 检查权限（只有创建者可以生成邀请链接）
    const { data: lists } = await db.collection('lists')
      .where({ _id: listId, creatorId: userId })
      .get();

    if (lists.length === 0) {
      return { code: -1, message: '无权限生成邀请链接' };
    }

    // 生成唯一邀请码
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let inviteCode = '';
    for (let i = 0; i < 16; i++) {
      inviteCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // 计算过期时间
    let expireAt = null;
    if (expireDays > 0) {
      expireAt = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000);
    }

    // 创建邀请记录
    await db.collection('list_invites').add({
      data: {
        listId,
        inviterId: userId,
        inviteeId: '',
        inviteeInfo: {},
        role,
        inviteType: 'link',
        inviteCode,
        needApproval,
        status: 0,
        expireAt,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    // 统计该清单的邀请使用情况
    const { data: allInvites } = await db.collection('list_invites')
      .where({ listId, inviteType: 'link' })
      .get();

    const stats = {
      clickCount: 0,
      joinCount: allInvites.filter(i => i.status === 1).length,
      pendingCount: allInvites.filter(i => i.status === 0).length
    };

    const inviteLink = `https://todo.app/invite/${inviteCode}`;

    return {
      success: true,
      inviteCode,
      inviteLink,
      stats
    };
  } catch (error) {
    console.error('生成邀请链接失败:', error);
    return { code: -1, message: '生成邀请链接失败' };
  }
}

// 生成小程序码
async function generateMiniProgramCode(openid, data) {
  try {
    const { scene, page, width = 280 } = data || {};

    if (!scene) {
      return { code: -1, message: '参数不完整' };
    }

    // 调用微信接口生成小程序码
    const result = await cloud.openapi.wxacode.getUnlimited({
      scene,
      page: page || undefined,
      width,
      checkPath: false,
      envVersion: 'release'
    });

    if (result.buffer) {
      // 上传到云存储
      const fileName = `qrcodes/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
      const uploadResult = await cloud.uploadFile({
        cloudPath: fileName,
        fileContent: result.buffer
      });

      return {
        success: true,
        fileID: uploadResult.fileID
      };
    } else {
      return { code: -1, message: '生成小程序码失败' };
    }
  } catch (error) {
    console.error('生成小程序码失败:', error);
    return { code: -1, message: '生成小程序码失败' };
  }
}

// 创建微信邀请
async function createWechatInvite(openid, data) {
  try {
    const { listId, role = 3 } = data || {};

    if (!listId) {
      return { code: -1, message: '清单ID不能为空' };
    }

    const userId = await getUserId(openid);

    // 检查权限
    const { data: lists } = await db.collection('lists')
      .where({ _id: listId, creatorId: userId })
      .get();

    if (lists.length === 0) {
      return { code: -1, message: '无权限邀请成员' };
    }

    // 生成邀请码
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let inviteCode = '';
    for (let i = 0; i < 16; i++) {
      inviteCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // 创建邀请记录
    await db.collection('list_invites').add({
      data: {
        listId,
        inviterId: userId,
        inviteeId: '',
        inviteeInfo: {},
        role,
        inviteType: 'wechat',
        inviteCode,
        status: 0,
        expireAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    return {
      success: true,
      inviteCode,
      scene: `invite=${inviteCode}`
    };
  } catch (error) {
    console.error('创建微信邀请失败:', error);
    return { code: -1, message: '创建微信邀请失败' };
  }
}

// 搜索用户
async function searchUser(openid, data) {
  try {
    const { keyword } = data || {};

    if (!keyword) {
      return { code: -1, message: '搜索关键词不能为空' };
    }

    // 按昵称模糊搜索
    const { data: users } = await db.collection('users')
      .where({
        nickname: db.RegExp({
          regexp: keyword,
          options: 'i'
        })
      })
      .limit(20)
      .get();

    // 过滤掉当前用户
    const userId = await getUserId(openid);
    const filtered = users
      .filter(u => u._id !== userId)
      .map(u => ({
        userId: u._id,
        nickname: u.nickname,
        avatarUrl: u.avatarUrl
      }));

    return { success: true, users: filtered };
  } catch (error) {
    console.error('搜索用户失败:', error);
    return { code: -1, message: '搜索用户失败' };
  }
}

// 获取邀请信息
async function getInviteInfo(openid, data) {
  try {
    const { inviteCode } = data || {};

    if (!inviteCode) {
      return { code: -1, message: '邀请码不能为空' };
    }

    const userId = await getUserId(openid);
    if (!userId) {
      return { code: -1, message: '用户不存在' };
    }

    // 查询邀请记录
    const { data: invites } = await db.collection('list_invites')
      .where({
        inviteCode,
        status: 0
      })
      .get();

    if (invites.length === 0) {
      return { code: -1, message: '邀请链接无效或已过期' };
    }

    const invite = invites[0];

    // 检查邀请是否过期
    if (invite.expireAt && new Date(invite.expireAt) < new Date()) {
      return { code: -1, message: '邀请链接已过期' };
    }

    // 获取清单信息
    const { data: lists } = await db.collection('lists')
      .where({ _id: invite.listId })
      .get();

    if (lists.length === 0) {
      return { code: -1, message: '清单不存在' };
    }

    const list = lists[0];

    // 获取邀请人信息
    const { data: inviters } = await db.collection('users')
      .where({ _id: invite.inviterId })
      .get();

    const inviter = inviters.length > 0 ? inviters[0] : null;

    // 检查当前用户是否已是成员
    const { data: existingMembers } = await db.collection('list_members')
      .where({
        listId: invite.listId,
        userId: userId
      })
      .get();

    const isMember = existingMembers.length > 0;

    // 检查是否已处理过该邀请
    const { data: processedInvites } = await db.collection('list_invites')
      .where({
        inviteCode,
        inviteeId: userId,
        status: _.in([1, 2])
      })
      .get();

    const isProcessed = processedInvites.length > 0;
    const processStatus = isProcessed ? processedInvites[0].status : 0;

    // 获取成员列表（用于显示头像）
    const { data: members } = await db.collection('list_members')
      .where({ listId: invite.listId })
      .limit(5)
      .get();

    const memberUserIds = members.map(m => m.userId);
    const { data: memberUsers } = await db.collection('users')
      .where({ _id: _.in(memberUserIds) })
      .field({ avatarUrl: true })
      .get();

    const inviteInfo = {
      listId: list._id,
      listName: list.name,
      listDescription: list.description || '',
      listColor: list.color || '#1976D2',
      isShared: list.isShared,
      inviterId: invite.inviterId,
      inviterName: inviter ? inviter.nickname : '未知用户',
      inviterAvatar: inviter ? inviter.avatarUrl : '',
      role: invite.role || 3,
      needApproval: invite.needApproval || false,
      memberCount: members.length,
      members: memberUsers.map(u => ({ avatarUrl: u.avatarUrl })),
      status: invite.status,
      expireAt: invite.expireAt
    };

    return {
      success: true,
      inviteInfo,
      isMember,
      isProcessed,
      processStatus
    };
  } catch (error) {
    console.error('获取邀请信息失败:', error);
    return { code: -1, message: '获取邀请信息失败' };
  }
}

// 接受邀请
async function acceptInvite(openid, data) {
  try {
    const { inviteCode } = data || {};

    if (!inviteCode) {
      return { code: -1, message: '邀请码不能为空' };
    }

    const userId = await getUserId(openid);
    if (!userId) {
      return { code: -1, message: '用户不存在' };
    }

    // 查询邀请记录
    const { data: invites } = await db.collection('list_invites')
      .where({
        inviteCode,
        status: 0
      })
      .get();

    if (invites.length === 0) {
      return { code: -1, message: '邀请链接无效或已过期' };
    }

    const invite = invites[0];

    // 检查邀请是否过期
    if (invite.expireAt && new Date(invite.expireAt) < new Date()) {
      return { code: -1, message: '邀请链接已过期' };
    }

    // 检查是否已是成员
    const { data: existingMembers } = await db.collection('list_members')
      .where({
        listId: invite.listId,
        userId: userId
      })
      .get();

    if (existingMembers.length > 0) {
      return { code: -1, message: '您已是该清单成员' };
    }

    // 检查是否需要审批
    if (invite.needApproval) {
      // 更新邀请状态为待审批 (status: 4)
      await db.collection('list_invites').doc(invite._id).update({
        data: {
          status: 4,
          inviteeId: userId,
          updatedAt: db.serverDate()
        }
      });

      // 创建通知给邀请人
      const { data: lists } = await db.collection('lists')
        .where({ _id: invite.listId })
        .get();
      const listName = lists.length > 0 ? lists[0].name : '未知清单';

      const { data: users } = await db.collection('users')
        .where({ _id: userId })
        .get();
      const userName = users.length > 0 ? users[0].nickname : '未知用户';

      await db.collection('notifications').add({
        data: {
          type: 'join_request',
          userId: invite.inviterId,
          relatedId: invite.listId,
          content: `${userName} 申请加入清单"${listName}"`,
          isRead: false,
          createdAt: db.serverDate()
        }
      });

      return { success: true, message: '申请已提交，等待审批' };
    }

    // 直接加入清单
    await db.collection('list_members').add({
      data: {
        listId: invite.listId,
        userId: userId,
        role: invite.role || 3,
        joinType: 'invite',
        joinedAt: db.serverDate()
      }
    });

    // 更新邀请状态
    await db.collection('list_invites').doc(invite._id).update({
      data: {
        status: 1,
        inviteeId: userId,
        updatedAt: db.serverDate()
      }
    });

    // 记录操作日志
    await logOperation('member_add', invite.listId, userId, { joinType: 'invite_accept' });

    return { success: true, message: '加入成功' };
  } catch (error) {
    console.error('接受邀请失败:', error);
    return { code: -1, message: '接受邀请失败' };
  }
}

// 申请加入清单
async function applyJoinList(openid, data) {
  try {
    const { inviteCode } = data || {};

    if (!inviteCode) {
      return { code: -1, message: '邀请码不能为空' };
    }

    const userId = await getUserId(openid);
    if (!userId) {
      return { code: -1, message: '用户不存在' };
    }

    // 查询邀请记录
    const { data: invites } = await db.collection('list_invites')
      .where({
        inviteCode,
        status: 0
      })
      .get();

    if (invites.length === 0) {
      return { code: -1, message: '邀请链接无效或已过期' };
    }

    const invite = invites[0];

    // 检查邀请是否过期
    if (invite.expireAt && new Date(invite.expireAt) < new Date()) {
      return { code: -1, message: '邀请链接已过期' };
    }

    // 检查是否已是成员
    const { data: existingMembers } = await db.collection('list_members')
      .where({
        listId: invite.listId,
        userId: userId
      })
      .get();

    if (existingMembers.length > 0) {
      return { code: -1, message: '您已是该清单成员' };
    }

    // 检查是否已申请过
    const { data: existingApplications } = await db.collection('list_invites')
      .where({
        inviteCode,
        inviteeId: userId,
        status: 4
      })
      .get();

    if (existingApplications.length > 0) {
      return { code: -1, message: '您已申请过，请等待审批' };
    }

    // 更新邀请状态为待审批 (status: 4)
    await db.collection('list_invites').doc(invite._id).update({
      data: {
        status: 4,
        inviteeId: userId,
        updatedAt: db.serverDate()
      }
    });

    // 创建通知给邀请人
    const { data: lists } = await db.collection('lists')
      .where({ _id: invite.listId })
      .get();
    const listName = lists.length > 0 ? lists[0].name : '未知清单';

    const { data: users } = await db.collection('users')
      .where({ _id: userId })
      .get();
    const userName = users.length > 0 ? users[0].nickname : '未知用户';

    await db.collection('notifications').add({
      data: {
        type: 'join_request',
        userId: invite.inviterId,
        relatedId: invite.listId,
        content: `${userName} 申请加入清单"${listName}"`,
        isRead: false,
        createdAt: db.serverDate()
      }
    });

    return { success: true, message: '申请已提交，等待审批' };
  } catch (error) {
    console.error('申请加入失败:', error);
    return { code: -1, message: '申请加入失败' };
  }
}

// 拒绝邀请
async function rejectInvite(openid, data) {
  try {
    const { inviteCode } = data || {};

    if (!inviteCode) {
      return { code: -1, message: '邀请码不能为空' };
    }

    const userId = await getUserId(openid);
    if (!userId) {
      return { code: -1, message: '用户不存在' };
    }

    // 查询邀请记录
    const { data: invites } = await db.collection('list_invites')
      .where({
        inviteCode,
        status: 0
      })
      .get();

    if (invites.length === 0) {
      return { code: -1, message: '邀请链接无效或已过期' };
    }

    const invite = invites[0];

    // 更新邀请状态为已拒绝
    await db.collection('list_invites').doc(invite._id).update({
      data: {
        status: 2,
        inviteeId: userId,
        updatedAt: db.serverDate()
      }
    });

    return { success: true, message: '已拒绝邀请' };
  } catch (error) {
    console.error('拒绝邀请失败:', error);
    return { code: -1, message: '拒绝邀请失败' };
  }
}

// 提醒邀请
async function remindInvite(openid, data) {
  try {
    const { inviteId } = data || {};

    if (!inviteId) {
      return { code: -1, message: '邀请ID不能为空' };
    }

    const userId = await getUserId(openid);

    // 获取邀请信息
    const { data: invites } = await db.collection('list_invites')
      .where({ _id: inviteId })
      .get();

    if (invites.length === 0) {
      return { code: -1, message: '邀请不存在' };
    }

    const invite = invites[0];

    // 检查权限（只有邀请人可以发送提醒）
    if (invite.inviterId !== userId) {
      return { code: -1, message: '无权限发送提醒' };
    }

    // 检查邀请状态
    if (invite.status !== 0) {
      return { code: -1, message: '该邀请已处理，无法发送提醒' };
    }

    // 获取清单信息
    const { data: lists } = await db.collection('lists')
      .where({ _id: invite.listId })
      .get();

    const listName = lists.length > 0 ? lists[0].name : '未知清单';

    // 获取邀请人信息
    const { data: inviters } = await db.collection('users')
      .where({ _id: userId })
      .get();

    const inviterName = inviters.length > 0 ? inviters[0].nickname : '未知用户';

    // 创建提醒通知
    if (invite.inviteeId) {
      await db.collection('notifications').add({
        data: {
          type: 'invite_remind',
          userId: invite.inviteeId,
          relatedId: invite.listId,
          content: `${inviterName} 提醒您接受清单"${listName}"的邀请`,
          isRead: false,
          createdAt: db.serverDate()
        }
      });
    }

    // 更新邀请的提醒时间
    await db.collection('list_invites').doc(inviteId).update({
      data: {
        remindedAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    return { success: true, message: '提醒已发送' };
  } catch (error) {
    console.error('发送提醒失败:', error);
    return { code: -1, message: '发送提醒失败' };
  }
}

// 取消邀请
async function cancelInvite(openid, data) {
  try {
    const { inviteId } = data || {};

    if (!inviteId) {
      return { code: -1, message: '邀请ID不能为空' };
    }

    const userId = await getUserId(openid);

    // 获取邀请信息
    const { data: invites } = await db.collection('list_invites')
      .where({ _id: inviteId })
      .get();

    if (invites.length === 0) {
      return { code: -1, message: '邀请不存在' };
    }

    const invite = invites[0];

    // 检查权限（只有邀请人可以取消）
    if (invite.inviterId !== userId) {
      return { code: -1, message: '无权限取消邀请' };
    }

    // 检查邀请状态
    if (invite.status !== 0) {
      return { code: -1, message: '该邀请已处理，无法取消' };
    }

    // 删除邀请记录
    await db.collection('list_invites').doc(inviteId).remove();

    // 记录操作日志
    await logOperation('invite_cancel', invite.listId, userId, { inviteId });

    return { success: true, message: '邀请已取消' };
  } catch (error) {
    console.error('取消邀请失败:', error);
    return { code: -1, message: '取消邀请失败' };
  }
}

// 同意加入申请
async function approveApplication(openid, data) {
  try {
    const { applicationId } = data || {};

    if (!applicationId) {
      return { code: -1, message: '申请ID不能为空' };
    }

    const userId = await getUserId(openid);

    // 获取申请信息
    const { data: invites } = await db.collection('list_invites')
      .where({ _id: applicationId })
      .get();

    if (invites.length === 0) {
      return { code: -1, message: '申请不存在' };
    }

    const invite = invites[0];

    // 检查权限（只有清单创建者可以审批）
    const { data: lists } = await db.collection('lists')
      .where({ _id: invite.listId })
      .get();

    if (lists.length === 0) {
      return { code: -1, message: '清单不存在' };
    }

    if (lists[0].creatorId !== userId) {
      return { code: -1, message: '无权限审批申请' };
    }

    // 检查申请状态 (status: 4 表示待审批)
    if (invite.status !== 4) {
      return { code: -1, message: '该申请已处理' };
    }

    // 添加成员到清单
    await db.collection('list_members').add({
      data: {
        listId: invite.listId,
        userId: invite.inviteeId,
        role: invite.role || 3,
        joinType: 'apply',
        joinedAt: db.serverDate()
      }
    });

    // 更新申请状态为已接受 (status: 1)
    await db.collection('list_invites').doc(applicationId).update({
      data: {
        status: 1,
        updatedAt: db.serverDate()
      }
    });

    // 创建通知给申请人
    await db.collection('notifications').add({
      data: {
        type: 'application_approved',
        userId: invite.inviteeId,
        relatedId: invite.listId,
        content: `您加入清单"${lists[0].name}"的申请已通过`,
        isRead: false,
        createdAt: db.serverDate()
      }
    });

    // 记录操作日志
    await logOperation('member_add', invite.listId, userId, { targetUserId: invite.inviteeId, role: invite.role });

    return { success: true, message: '已同意加入申请' };
  } catch (error) {
    console.error('同意申请失败:', error);
    return { code: -1, message: '同意申请失败' };
  }
}

// 拒绝加入申请
async function rejectApplication(openid, data) {
  try {
    const { applicationId } = data || {};

    if (!applicationId) {
      return { code: -1, message: '申请ID不能为空' };
    }

    const userId = await getUserId(openid);

    // 获取申请信息
    const { data: invites } = await db.collection('list_invites')
      .where({ _id: applicationId })
      .get();

    if (invites.length === 0) {
      return { code: -1, message: '申请不存在' };
    }

    const invite = invites[0];

    // 检查权限（只有清单创建者可以审批）
    const { data: lists } = await db.collection('lists')
      .where({ _id: invite.listId })
      .get();

    if (lists.length === 0) {
      return { code: -1, message: '清单不存在' };
    }

    if (lists[0].creatorId !== userId) {
      return { code: -1, message: '无权限审批申请' };
    }

    // 检查申请状态 (status: 4 表示待审批)
    if (invite.status !== 4) {
      return { code: -1, message: '该申请已处理' };
    }

    // 更新申请状态为已拒绝 (status: 2)
    await db.collection('list_invites').doc(applicationId).update({
      data: {
        status: 2,
        updatedAt: db.serverDate()
      }
    });

    // 创建通知给申请人
    await db.collection('notifications').add({
      data: {
        type: 'application_rejected',
        userId: invite.inviteeId,
        relatedId: invite.listId,
        content: `您加入清单"${lists[0].name}"的申请已被拒绝`,
        isRead: false,
        createdAt: db.serverDate()
      }
    });

    return { success: true, message: '已拒绝加入申请' };
  } catch (error) {
    console.error('拒绝申请失败:', error);
    return { code: -1, message: '拒绝申请失败' };
  }
}

// 清空邀请记录
async function clearInvites(openid, data) {
  try {
    const { listId, status } = data || {};

    if (!listId) {
      return { code: -1, message: '清单ID不能为空' };
    }

    const userId = await getUserId(openid);

    // 检查权限（只有清单创建者可以清空）
    const { data: lists } = await db.collection('lists')
      .where({ _id: listId, creatorId: userId })
      .get();

    if (lists.length === 0) {
      return { code: -1, message: '无权限清空邀请' };
    }

    // 查询要删除的邀请
    const query = { listId };
    if (status !== undefined) {
      query.status = status;
    }

    const { data: invites } = await db.collection('list_invites')
      .where(query)
      .get();

    // 批量删除
    const deletePromises = invites.map(invite =>
      db.collection('list_invites').doc(invite._id).remove()
    );

    await Promise.all(deletePromises);

    return { success: true, message: `已清空 ${invites.length} 条邀请记录` };
  } catch (error) {
    console.error('清空邀请失败:', error);
    return { code: -1, message: '清空邀请失败' };
  }
}
