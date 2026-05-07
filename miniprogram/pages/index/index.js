const app = getApp();
const {
  isTaskOverdueByDate,
  getTaskSeriesGroupId
} = require('../../utils/taskDisplay');
const {
  normalizeCheckboxValue,
  handleTaskStatusToggle
} = require('../../utils/taskToggle');

function isPersonalStandaloneTask(task) {
  return Number(task.ownershipType) === 1 || (!task.listId && task.creatorId);
}

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

  resetGuestData: function () {
    this.setData({
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
      isSearching: false,
      searchResults: [],
      searchKeyword: ''
    });
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
    const { isLoggedIn, userInfo } = app.getLoginState();

    if (!isLoggedIn) {
      this.resetGuestData();
      return;
    }

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

    // 构造 tasks 集合
    const processedTasks = tasks.map(task => {
      const isOverdue = isTaskOverdueByDate(task);

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
        isPersonalTask: isPersonalStandaloneTask(task),
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
        const groupId = getTaskSeriesGroupId(task);
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
      const groupId = getTaskSeriesGroupId(task);
      return task._id === nearestPeriodicByGroup[groupId];
    });

    // 构造不同分类的 tasks 集合: 正在进行、已过期、已完成
    // status 只持久化 0=未完成、1=已完成，逾期由 isOverdue 派生
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
    const newStatus = normalizeCheckboxValue(e.detail) ? 1 : 0;
    const task = this.data.tasks.find(t => t._id === taskId);

    await handleTaskStatusToggle({
      taskId,
      task,
      newStatus,
      refreshView: () => this.loadTasks(),
      reloadTasks: () => this.loadTasks(),
      updateLocalTaskStatus: (status) => {
        const tasks = this.data.tasks.map(item => {
          if (item._id === taskId) {
            return { ...item, status };
          }
          return item;
        });
        this.setData({ tasks });
        this.processTasks();
      },
      navigateToDate: (dateStr) => {
        wx.switchTab({
          url: '/pages/calendar/calendar'
        });
        wx.setStorageSync('jumpToDate', dateStr);
      },
      notTodayConfirmText: '去查看'
    });
  },

  // 阻止复选框点击事件冒泡
  onCheckboxTap: function (e) {
    // 阻止事件冒泡，防止触发任务项点击
  },

  // 点击任务项，跳转到任务详情
  onTaskClick: function (e) {
    if (!this.data.isLoggedIn) {
      return;
    }

    const taskId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/task-detail/task-detail?id=' + taskId
    });
  },

  // 查看周期任务统计
  onViewStats: function (e) {
    if (!this.data.isLoggedIn) {
      return;
    }

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
    if (!this.data.isLoggedIn) {
      this.setData({ isSearching: false, searchResults: [] });
      return;
    }

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
          const isOverdue = isTaskOverdueByDate(task);
          const priorityColor = this.getPriorityColor(task.priority);
          const month = String(dueDate.getMonth() + 1).padStart(2, '0');
          const day = String(dueDate.getDate()).padStart(2, '0');
          const hours = String(dueDate.getHours()).padStart(2, '0');
          const minutes = String(dueDate.getMinutes()).padStart(2, '0');
          const time = `${month}-${day} ${hours}:${minutes}`;
          const category = this.getCategoryById(task.categoryId);
          return {
            ...task,
            isPersonalTask: isPersonalStandaloneTask(task),
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
        title: '请先完善资料',
        content: '完善头像和昵称后即可创建任务。',
        confirmText: '去完善',
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
