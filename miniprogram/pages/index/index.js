const app = getApp();

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    currentCategory: 'all',
    categories: [
      { _id: 'all', name: '全部', color: '#1989fa' }
    ],
    tasks: [],
    inProgressTasks: [],
    overdueTasks: [],
    completedTasks: [],
    categoryTasks: [],
    categoryInProgressTasks: [],
    categoryOverdueTasks: [],
    categoryCompletedTasks: [],
    // 搜索相关
    searchKeyword: '',
    isSearching: false,
    searchResults: [],
    searchTimer: null
  },

  onLoad: function (options) {
    this.checkLoginStatus();
  },

  onShow: function () {
    this.checkLoginStatus();
    if (this.data.isLoggedIn) {
      this.loadCategories();
      // loadTasks 已在 checkLoginStatus 中调用，无需重复调用
    }
  },

  // 加载用户自定义分类
  loadCategories: function () {
    // 先展示缓存
    const cachedCategories = wx.getStorageSync('cachedCategories');
    if (cachedCategories && cachedCategories.length > 0) {
      this.setData({
        categories: [
          { _id: 'all', name: '全部', color: '#1989fa' },
          ...cachedCategories
        ]
      });
    }

    wx.cloud.callFunction({
      name: 'categoryFunctions',
      data: {
        action: 'getCategories'
      }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        const userCategories = res.result.data || [];
        this.setData({
          categories: [
            { _id: 'all', name: '全部', color: '#1989fa' },
            ...userCategories
          ]
        });
        wx.setStorageSync('cachedCategories', userCategories);
      }
    }).catch(err => {
      console.error('加载分类失败:', err);
    });
  },

  // 检查登录状态
  checkLoginStatus: function () {
    const isLoggedIn = wx.getStorageSync('isLoggedIn') || false;
    const userInfo = wx.getStorageSync('userInfo') || null;

    this.setData({
      isLoggedIn,
      userInfo
    });

    // 如果已登录，加载任务数据
    if (isLoggedIn) {
      this.loadTasks();
    }
  },

  // 从云端加载任务数据（缓存优先策略）
  loadTasks: function () {
    // 先展示缓存数据
    const cachedTasks = wx.getStorageSync('cachedTasks');
    if (cachedTasks && cachedTasks.length > 0) {
      this.setData({ tasks: cachedTasks });
      this.processTasks();
    }

    // 后台请求最新数据
    wx.cloud.callFunction({
      name: 'taskFunctions',
      data: {
        action: 'getTaskList',
        data: {
          page: 1,
          pageSize: 100
        }
      }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        const tasks = res.result.data.list || [];
        this.setData({ tasks });
        this.processTasks();
        // 更新缓存
        wx.setStorageSync('cachedTasks', tasks);
        wx.setStorageSync('cachedTasksTime', Date.now());
      }
    }).catch(err => {
      console.error('加载任务失败:', err);
      this.processTasks();
    });
  },

  processTasks: function () {
    const tasks = this.data.tasks;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 构造 tasks 集合
    const processedTasks = tasks.map(task => {
      const dueDate = new Date(task.dueDate);
      const dueDateOnly = new Date(task.dueDate);
      dueDateOnly.setHours(0, 0, 0, 0);

      // 过期判断逻辑
      let isOverdue = false;
      const taskStatus = Number(task.status);
      const isPeriodic = task.repeatType > 0;

      if (isPeriodic) {
        // 周期任务：预生成的实例根据dueDate判断是否过期
        // 如果截止日期在今天之前，则视为已过期
        isOverdue = dueDateOnly < today && taskStatus === 0;
      } else {
        // 非周期任务：原来的逻辑
        isOverdue = dueDateOnly < today && taskStatus === 0;
      }

      const priorityColor = this.getPriorityColor(task.priority);
      // 格式化时间显示：MM-DD HH:mm
      const dateObj = new Date(task.dueDate);
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      const time = `${month}-${day} ${hours}:${minutes}`;
      const category = this.getCategoryById(task.categoryId);
      return {
        ...task,
        isOverdue,
        priorityColor,
        time,
        categoryName: category ? category.name : '未分类',
        categoryColor: category ? category.color : '#999'
      };
    });

    // 周期任务过滤：每个周期系列只显示最近的一个未完成实例
    // 1. 按 parentTaskId 分组，每组只保留最近的未过期未完成实例
    // 2. 已过期的周期任务都显示在"已过期"区域
    // 3. 已完成的周期任务都显示在"已完成"区域

    // 按周期系列分组，找到每个系列最近的未完成未过期实例
    const nearestPeriodicByGroup = {};
    processedTasks
      .filter(task => task.repeatType > 0 && task.status === 0 && !task.isOverdue)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .forEach(task => {
        const groupId = task.parentTaskId || task._id;
        if (!nearestPeriodicByGroup[groupId]) {
          nearestPeriodicByGroup[groupId] = task._id;
        }
      });

    // 过滤任务
    const filteredTasks = processedTasks.filter(task => {
      // 已完成的任务都显示
      if (task.status === 1) return true;

      // 非周期任务都显示
      if (task.repeatType === 0) return true;

      // 周期任务：
      // - 已过期的都显示
      // - 未过期的每个系列只显示最近的一个
      if (task.isOverdue) {
        return true;
      }
      const groupId = task.parentTaskId || task._id;
      return task._id === nearestPeriodicByGroup[groupId];
    });

    // 构造不同分类的 tasks 集合: 正在进行、已过期、已完成
    // status: 0-未完成，1-已完成，2-逾期
    const inProgressTasks = filteredTasks.filter(task => task.status === 0 && !task.isOverdue);
    const overdueTasks = filteredTasks.filter(task => task.status === 0 && task.isOverdue);
    const completedTasks = filteredTasks.filter(task => task.status === 1);

    // 分类任务的三个分组
    let categoryInProgressTasks = [];
    let categoryOverdueTasks = [];
    let categoryCompletedTasks = [];

    if (this.data.currentCategory !== 'all') {
      const categoryTasks = filteredTasks.filter(task => task.categoryId === this.data.currentCategory);
      categoryInProgressTasks = categoryTasks.filter(task => task.status === 0 && !task.isOverdue);
      categoryOverdueTasks = categoryTasks.filter(task => task.status === 0 && task.isOverdue);
      categoryCompletedTasks = categoryTasks.filter(task => task.status === 1);
    }

    this.setData({
      tasks: processedTasks,
      inProgressTasks: inProgressTasks,
      overdueTasks: overdueTasks,
      completedTasks: completedTasks,
      categoryInProgressTasks: categoryInProgressTasks,
      categoryOverdueTasks: categoryOverdueTasks,
      categoryCompletedTasks: categoryCompletedTasks
    });
  },

  // 根据ID获取分类
  getCategoryById: function (categoryId) {
    return this.data.categories.find(cat => cat._id === categoryId);
  },

  getPriorityColor: function (priority) {
    // priority: 1-不重要不紧急，2-紧急不重要，3-重要不紧急，4-重要且紧急
    const colors = {
      4: '#ee0a24', // 重要且紧急 - 红色
      3: '#ff976a', // 重要不紧急 - 橙色
      2: '#ffd01e', // 紧急不重要 - 黄色
      1: '#07c160'  // 不重要不紧急 - 绿色
    };
    return colors[priority] || '#999';
  },

  onCategoryChange: function (e) {
    const categoryId = e.currentTarget.dataset.id;
    this.setData({ currentCategory: categoryId });
    this.processTasks();
  },

  onTaskComplete: async function (e) {
    const taskId = e.currentTarget.dataset.id;
    const newStatus = e.detail ? 1 : 0;

    // 如果是将已过期任务标记为完成，先弹出确认框
    let confirmedOverdue = false;
    if (newStatus === 1) {
      const task = this.data.tasks.find(t => t._id === taskId);
      if (task && task.isOverdue) {
        const res = await new Promise(resolve => {
          wx.showModal({
            title: '提示',
            content: '该任务已过期，确认要标记为已完成吗？',
            confirmText: '确认完成',
            cancelText: '取消',
            success: resolve
          });
        });
        if (!res.confirm) return;
        confirmedOverdue = true;
      }
    }

    // 调用云函数更新状态
    try {
      const result = await wx.cloud.callFunction({
        name: 'taskFunctions',
        data: {
          action: 'toggleTaskStatus',
          data: {
            taskId,
            status: newStatus,
            confirmCompleteOverdue: confirmedOverdue || undefined
          }
        }
      });

      // 检查云函数返回结果
      if (result.result && result.result.code !== 0) {
        // 云函数返回错误，显示错误提示
        wx.showToast({
          title: result.result.message || '操作失败',
          icon: 'none'
        });
        // 恢复任务状态（强制刷新 checkbox）
        const tasks = this.data.tasks.map(task => {
          if (task._id === taskId) {
            // 恢复原状态（与 newStatus 相反）
            return { ...task, status: newStatus === 1 ? 0 : 1 };
          }
          return task;
        });
        this.setData({ tasks });
        return;
      }

      const resultData = result.result && result.result.data;

      // 规则：进行中的周期任务只能完成当天的任务
      if (resultData && resultData.needConfirmCompleteNotToday) {
        // 非当天的周期任务，提示用户只能完成当天的任务
        wx.showModal({
          title: '提示',
          content: resultData.confirmMessage || '只能完成当天的周期任务',
          confirmText: '去查看',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              // 跳转到日历页面并切换到该日期
              const dueDate = resultData.dueDate;
              if (dueDate) {
                wx.switchTab({
                  url: '/pages/calendar/calendar'
                });
                // 将日期信息存储到全局，日历页面读取后自动切换
                wx.setStorageSync('jumpToDate', dueDate);
              }
            }
            // 如果用户选择取消，不做任何操作，保持原状态
          }
        });
        return;
      }

      // 方案A：如果需要确认取消完成（周期任务），显示确认对话框
      if (resultData && resultData.needConfirmUncheck) {
        // 只针对周期任务显示确认提示
        const confirmMessage = resultData.confirmMessage || '取消完成此任务不会影响后续的周期任务，是否确认？';

        wx.showModal({
          title: '提示',
          content: confirmMessage,
          confirmText: '确认',
          cancelText: '取消',
          success: async (res) => {
            if (res.confirm) {
              // 用户确认，再次调用云函数并传入确认参数
              try {
                const confirmResult = await wx.cloud.callFunction({
                  name: 'taskFunctions',
                  data: {
                    action: 'toggleTaskStatus',
                    data: {
                      taskId,
                      status: newStatus,
                      confirmUncheck: true // 方案A：只恢复当前任务，不删除后续任务
                    }
                  }
                });

                // 检查云函数返回结果
                if (confirmResult.result && confirmResult.result.code === 0) {
                  // 方案A：只更新当前任务状态，不删除任何后续任务
                  const tasks = this.data.tasks.map(task => {
                    if (task._id === taskId) {
                      return { ...task, status: newStatus };
                    }
                    return task;
                  });
                  this.setData({ tasks });
                  this.processTasks();

                  wx.showToast({
                    title: '已取消完成',
                    icon: 'success'
                  });
                }
              } catch (error) {
                console.error('操作失败:', error);
              }
            }
            // 如果用户选择取消，不做任何操作，保持原状态
          }
        });
        return;
      }

      // 更新本地状态（云函数调用成功后且不需要确认）
      const tasks = this.data.tasks.map(task => {
        if (task._id === taskId) {
          return { ...task, status: newStatus };
        }
        return task;
      });
      this.setData({ tasks });
      this.processTasks();

      // 如果生成了新的周期任务，或者完成的是周期任务，刷新列表以显示下一个周期任务
      if (resultData && (resultData.newPeriodicTasks || resultData.isRepeatTask)) {
        this.loadTasks();
      }
    } catch (error) {
      console.error('更新任务状态失败:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
      // 刷新列表恢复正确状态
      this.loadTasks();
    }
  },

  // 阻止复选框点击事件冒泡
  onCheckboxTap: function (e) {
    // 阻止事件冒泡，防止触发任务项点击
  },

  // 点击任务项，跳转到任务详情
  onTaskClick: function (e) {
    const taskId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/task-detail/task-detail?id=' + taskId
    });
  },

  // 查看周期任务统计
  onViewStats: function (e) {
    const taskId = e.currentTarget.dataset.id;
    const title = e.currentTarget.dataset.title;
    wx.navigateTo({
      url: `/pages/periodic-stats/periodic-stats?taskId=${taskId}`
    });
  },

  // 搜索输入
  onSearchInput: function (e) {
    const keyword = e.detail.value;
    this.setData({ searchKeyword: keyword });

    if (this._searchTimer) clearTimeout(this._searchTimer);

    if (!keyword.trim()) {
      this.setData({ isSearching: false, searchResults: [] });
      return;
    }

    // 防抖 300ms
    this._searchTimer = setTimeout(() => {
      this.doSearch(keyword.trim());
    }, 300);
  },

  // 搜索确认
  onSearchConfirm: function () {
    const keyword = this.data.searchKeyword.trim();
    if (!keyword) return;
    this.doSearch(keyword);
  },

  // 清除搜索
  onClearSearch: function () {
    this.setData({ searchKeyword: '', isSearching: false, searchResults: [] });
  },

  // 执行搜索
  doSearch: function (keyword) {
    this.setData({ isSearching: true });

    wx.cloud.callFunction({
      name: 'taskFunctions',
      data: {
        action: 'searchTasks',
        data: { keyword, page: 1, pageSize: 50 }
      }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        const tasks = (res.result.data.list || []).map(task => {
          const dueDate = new Date(task.dueDate);
          const dueDateOnly = new Date(task.dueDate);
          dueDateOnly.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const isOverdue = dueDateOnly < today && Number(task.status) === 0;
          const priorityColor = this.getPriorityColor(task.priority);
          const month = String(dueDate.getMonth() + 1).padStart(2, '0');
          const day = String(dueDate.getDate()).padStart(2, '0');
          const hours = String(dueDate.getHours()).padStart(2, '0');
          const minutes = String(dueDate.getMinutes()).padStart(2, '0');
          const time = `${month}-${day} ${hours}:${minutes}`;
          const category = this.getCategoryById(task.categoryId);
          return {
            ...task,
            isOverdue,
            priorityColor,
            time,
            categoryName: category ? category.name : (task.categoryName || ''),
            categoryColor: category ? category.color : (task.categoryColor || '#999')
          };
        });
        this.setData({ searchResults: tasks });
      }
    }).catch(err => {
      console.error('搜索失败:', err);
    });
  },

  onCreateTask: function () {
    if (!this.data.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '您需要先登录才能创建任务',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/register/register'
            });
          }
        }
      });
    } else {
      wx.navigateTo({
        url: '/pages/task-edit/task-edit'
      });
    }
  }
});
