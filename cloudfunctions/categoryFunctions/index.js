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
    // 根据action执行不同操作
    switch (action) {
      case 'getCategories':
        return await getCategories(openid);
      case 'getCategoryDetail':
        return await getCategoryDetail(openid, data);
      case 'createCategory':
        return await createCategory(openid, data);
      case 'updateCategory':
        return await updateCategory(openid, data);
      case 'deleteCategory':
        return await deleteCategory(openid, data);
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

// 获取用户ID的公共方法
async function getUserId(openid) {
  const { data: users } = await db.collection('users')
    .where({ openid })
    .get();

  if (users.length === 0) {
    return null;
  }
  return users[0]._id;
}

// 获取分类列表
async function getCategories(openid) {
  try {
    const userId = await getUserId(openid);

    if (!userId) {
      return {
        code: 0,
        message: 'success',
        data: []
      };
    }

    // 查询分类列表，按创建时间降序
    const { data: categories } = await db.collection('categories')
      .where({ userId })
      .orderBy('createdAt', 'desc')
      .get();

    // 获取每个分类的任务数量（限定为当前用户创建的任务）
    const categoriesWithTaskCount = await Promise.all(
      categories.map(async (category) => {
        const { total } = await db.collection('tasks')
          .where({
            categoryId: category._id,
            creatorId: userId
          })
          .count();
        return {
          ...category,
          taskCount: total
        };
      })
    );

    return {
      code: 0,
      message: 'success',
      data: categoriesWithTaskCount
    };
  } catch (error) {
    console.error('获取分类列表失败:', error);
    return {
      code: -1,
      message: '获取分类列表失败'
    };
  }
}

// 获取分类详情
async function getCategoryDetail(openid, data) {
  try {
    const { categoryId } = data || {};

    if (!categoryId) {
      return {
        code: -1,
        message: '分类ID不能为空'
      };
    }

    const userId = await getUserId(openid);

    if (!userId) {
      return {
        code: -1,
        message: '用户不存在'
      };
    }

    // 查询分类
    const { data: categories } = await db.collection('categories')
      .where({
        _id: categoryId,
        userId
      })
      .get();

    if (categories.length === 0) {
      return {
        code: -1,
        message: '分类不存在或无权限查看'
      };
    }

    // 获取该分类下的任务
    const { data: tasks } = await db.collection('tasks')
      .where({
        categoryId,
        creatorId: userId
      })
      .orderBy('createdAt', 'desc')
      .get();

    return {
      code: 0,
      message: 'success',
      data: {
        ...categories[0],
        tasks
      }
    };
  } catch (error) {
    console.error('获取分类详情失败:', error);
    return {
      code: -1,
      message: '获取分类详情失败'
    };
  }
}

// 创建分类
async function createCategory(openid, data) {
  try {
    const { name, color = '#1989fa' } = data || {};

    if (!name || !name.trim()) {
      return {
        code: -1,
        message: '分类名称不能为空'
      };
    }

    const userId = await getUserId(openid);

    if (!userId) {
      return {
        code: -1,
        message: '用户不存在'
      };
    }

    // 检查分类名称是否已存在
    const { data: existingCategories } = await db.collection('categories')
      .where({
        userId,
        name: name.trim()
      })
      .get();

    if (existingCategories.length > 0) {
      return {
        code: -1,
        message: '分类名称已存在'
      };
    }

    const now = db.serverDate();

    // 创建分类
    const categoryData = {
      name: name.trim(),
      color,
      userId,
      createdAt: now,
      updatedAt: now
    };

    const result = await db.collection('categories').add({
      data: categoryData
    });

    return {
      code: 0,
      message: '创建成功',
      data: {
        _id: result._id,
        ...categoryData,
        taskCount: 0
      }
    };
  } catch (error) {
    console.error('创建分类失败:', error);
    return {
      code: -1,
      message: '创建分类失败'
    };
  }
}

// 更新分类
async function updateCategory(openid, data) {
  try {
    const { categoryId, name, color } = data || {};

    if (!categoryId) {
      return {
        code: -1,
        message: '分类ID不能为空'
      };
    }

    const userId = await getUserId(openid);

    if (!userId) {
      return {
        code: -1,
        message: '用户不存在'
      };
    }

    // 检查分类是否存在且属于当前用户
    const { data: categories } = await db.collection('categories')
      .where({
        _id: categoryId,
        userId
      })
      .get();

    if (categories.length === 0) {
      return {
        code: -1,
        message: '分类不存在或无权限修改'
      };
    }

    // 如果修改名称，检查名称有效性和是否与其他分类重复
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return {
          code: -1,
          message: '分类名称不能为空'
        };
      }

      const { data: existingCategories } = await db.collection('categories')
        .where({
          userId,
          name: name.trim(),
          _id: _.neq(categoryId)
        })
        .get();

      if (existingCategories.length > 0) {
        return {
          code: -1,
          message: '分类名称已存在'
        };
      }
    }

    const updateData = {
      updatedAt: db.serverDate()
    };

    if (name !== undefined) updateData.name = name.trim();
    if (color !== undefined) updateData.color = color;

    await db.collection('categories').doc(categoryId).update({
      data: updateData
    });

    return {
      code: 0,
      message: '更新成功'
    };
  } catch (error) {
    console.error('更新分类失败:', error);
    return {
      code: -1,
      message: '更新分类失败'
    };
  }
}

// 删除分类
async function deleteCategory(openid, data) {
  try {
    const { categoryId } = data || {};

    if (!categoryId) {
      return {
        code: -1,
        message: '分类ID不能为空'
      };
    }

    const userId = await getUserId(openid);

    if (!userId) {
      return {
        code: -1,
        message: '用户不存在'
      };
    }

    // 检查分类是否存在且属于当前用户
    const { data: categories } = await db.collection('categories')
      .where({
        _id: categoryId,
        userId
      })
      .get();

    if (categories.length === 0) {
      return {
        code: -1,
        message: '分类不存在或无权限删除'
      };
    }

    // 将该分类下属于当前用户的任务分类置空
    // 使用 where + update 批量更新，比逐条更新效率更高
    await db.collection('tasks')
      .where({
        categoryId,
        creatorId: userId
      })
      .update({
        data: {
          categoryId: '',
          updatedAt: db.serverDate()
        }
      });

    // 删除分类
    await db.collection('categories').doc(categoryId).remove();

    return {
      code: 0,
      message: '删除成功'
    };
  } catch (error) {
    console.error('删除分类失败:', error);
    return {
      code: -1,
      message: '删除分类失败'
    };
  }
}
