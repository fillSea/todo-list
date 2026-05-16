const app = getApp();
const {
  isTaskOverdueByDate,
  getTaskSeriesGroupId
} = require('../../utils/taskDisplay');
const {
  normalizeCheckboxValue,
  handleTaskStatusToggle
} = require('../../utils/taskToggle');
const { createListVersionWatcher } = require('../../utils/realtimeWatcher');

const TASK_CACHE_TTL = 60 * 1000;
const CATEGORY_CACHE_TTL = 10 * 60 * 1000;

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
    searchTimer: null,
    searchHint: ''
  },

  onLoad: function (options) {
    this.listVersionWatcher = null;
    this._loadedOnce = false;
    this._isLoadingTasks = false;
    this._isLoadingCategories = false;
    this._rawTasks = [];
    this._processedTasks = [];
    this.checkLoginStatus();
  },

  onShow: function () {
    this.checkLoginStatus();
    if (this.data.isLoggedIn && this._loadedOnce) {
      this.loadCategories();
    }
    if (this.data.isLoggedIn) {
      this.refreshListVersionWatcher();
    }
  },

  onHide() {
    this.stopListVersionWatcher();
  },

  onUnload() {
    this.stopListVersionWatcher();
  },

  resetGuestData: function () {
    this.setData({
      isLoggedIn: false,
      userInfo: null,
      currentCategory: 'all',
      categories: [
        { _id: 'all', name: '全部', color: '#1989fa' }
      ],
      inProgressTasks: [],
      overdueTasks: [],
      completedTasks: [],
      categoryTasks: [],
      categoryInProgressTasks: [],
      categoryOverdueTasks: [],
      categoryCompletedTasks: [],
      isSearching: false,
      searchResults: [],
      searchKeyword: '',
      searchHint: ''
    });
    this._loadedOnce = false;
    this._isLoadingTasks = false;
    this._rawTasks = [];
    this._processedTasks = [];
    this.stopListVersionWatcher();
  },

  async refreshListVersionWatcher() {
    if (!this.data.isLoggedIn) return;

    try {
      const result = await wx.cloud.callFunction({
        name: 'listFunctions',
        data: {
          action: 'getMyLists',
          data: {
            filter: 'all',
            page: 1,
            pageSize: 100
          }
        }
      });

      if (!result.result || result.result.code !== 0) {
        return;
      }

      const lists = result.result.data?.list || [];
      const listIds = lists.map(list => list && list._id).filter(Boolean);

      if (!this.listVersionWatcher) {
        this.listVersionWatcher = createListVersionWatcher({
          listIds,
          onChange: events => this.handleRealtimeListChange(events),
          onError: err => console.error('首页任务实时监听失败:', err)
        });
      }

      this.listVersionWatcher.restart(listIds);
    } catch (error) {
      console.error('启动首页任务实时监听失败:', error);
    }
  },

  stopListVersionWatcher() {
    if (this.listVersionWatcher) {
      this.listVersionWatcher.stop();
    }
  },

  handleRealtimeListChange(events = []) {
    const shouldRefresh = events.some(event => {
      const type = event.eventType || '';
      return type.indexOf('task_') === 0 ||
        type.indexOf('member_') === 0 ||
        type === 'list_delete';
    });

    if (!shouldRefresh) return;

    app.clearTaskCaches();
    this.loadTasks({ forceRefresh: true });
    this.refreshListVersionWatcher();
  },

  // 加载用户自定义分类
  loadCategories: function () {
    if (this._isLoadingCategories) {
      return;
    }

    const userId = app.getCurrentUserId();
    const cacheKey = app.getUserScopedCacheKey(app.categoryCachePrefix, userId);
    const cacheTimeKey = app.getUserScopedCacheKey(app.categoryCacheTimePrefix, userId);
    // 先展示缓存
    const cachedCategories = app.getTimedCache(cacheKey, cacheTimeKey, CATEGORY_CACHE_TTL)
      || app.getTimedCache('cachedCategories', 'cachedCategoriesTime', CATEGORY_CACHE_TTL);
    if (cachedCategories && cachedCategories.length > 0) {
      this.setData({
        categories: [
          { _id: 'all', name: '全部', color: '#1989fa' },
          ...cachedCategories
        ]
      });
    }

    if (cachedCategories) {
      return;
    }

    this._isLoadingCategories = true;

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
        if ((this._rawTasks || []).length > 0) {
          this.processTasks();
        }
        app.setTimedCache(cacheKey, cacheTimeKey, userCategories);
        app.setTimedCache('cachedCategories', 'cachedCategoriesTime', userCategories);
      }
    }).catch(err => {
      console.error('加载分类失败:', err);
    }).finally(() => {
      this._isLoadingCategories = false;
    });
  },

  // 检查登录状态
  checkLoginStatus: function () {
    const { isLoggedIn, userInfo } = app.getLoginState();

    if (!isLoggedIn) {
      this.resetGuestData();
      return;
    }

    if (this.data.isLoggedIn !== isLoggedIn || this.data.userInfo !== userInfo) {
      this.setData({
        isLoggedIn,
        userInfo
      });
    }

    // 如果已登录，加载任务数据
    if (isLoggedIn) {
      this.loadCategories();
      this.loadTasks();
    }
  },

  // 从云端加载任务数据（缓存优先策略）
  loadTasks: function (options = {}) {
    if (this._isLoadingTasks) {
      return;
    }

    const forceRefresh = Boolean(options.forceRefresh);
    const userId = app.getCurrentUserId();
    const cacheKey = app.getUserScopedCacheKey(app.taskCachePrefix, userId);
    const cacheTimeKey = app.getUserScopedCacheKey(app.taskCacheTimePrefix, userId);

    // 先展示缓存数据
    const cachedTasks = !forceRefresh
      ? (app.getTimedCache(cacheKey, cacheTimeKey, TASK_CACHE_TTL)
        || app.getTimedCache('cachedTasks', 'cachedTasksTime', TASK_CACHE_TTL))
      : null;
    if (Array.isArray(cachedTasks)) {
      this._rawTasks = cachedTasks;
      this.processTasks(cachedTasks);
      this._loadedOnce = true;
      return;
    }

    this._isLoadingTasks = true;

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
        this._rawTasks = tasks;
        this.processTasks(tasks);
        this._loadedOnce = true;
        // 更新缓存
        app.setTimedCache(cacheKey, cacheTimeKey, tasks);
        app.setTimedCache('cachedTasks', 'cachedTasksTime', tasks);
      }
    }).catch(err => {
      console.error('加载任务失败:', err);
      this.processTasks(this._rawTasks || []);
    }).finally(() => {
      this._isLoadingTasks = false;
    });
  },

  processTasks: function (tasks = this._rawTasks || []) {

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

    this._processedTasks = processedTasks;

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
    if (!categoryId) {
      return null;
    }
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
    const task = (this._processedTasks || []).find(t => t._id === taskId)
      || (this._rawTasks || []).find(t => t._id === taskId)
      || this.data.searchResults.find(t => t._id === taskId);

    await handleTaskStatusToggle({
      taskId,
      task,
      newStatus,
      refreshView: () => this.loadTasks(),
      reloadTasks: () => this.loadTasks(),
      updateLocalTaskStatus: (status) => {
        const tasks = (this._rawTasks || []).map(item => {
          if (item._id === taskId) {
            return { ...item, status };
          }
          return item;
        });
        this._rawTasks = tasks;
        this.processTasks(tasks);
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
      this.setData({ isSearching: false, searchResults: [], searchHint: '' });
      return;
    }

    if (keyword.trim().length < 2) {
      this.setData({ isSearching: true, searchResults: [], searchHint: '请输入至少 2 个字符' });
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
    if (keyword.length < 2) {
      this.setData({ isSearching: true, searchResults: [], searchHint: '请输入至少 2 个字符' });
      return;
    }
    this.doSearch(keyword);
  },

  // 清除搜索
  onClearSearch: function () {
    this._searchToken = null;
    this.setData({ searchKeyword: '', isSearching: false, searchResults: [], searchHint: '' });
  },

  // 执行搜索
  doSearch: function (keyword) {
    if (!this.data.isLoggedIn) {
      this.setData({ isSearching: false, searchResults: [], searchHint: '' });
      return;
    }

    const searchToken = Date.now() + '_' + keyword;
    this._searchToken = searchToken;
    this.setData({ isSearching: true, searchHint: '' });

    wx.cloud.callFunction({
      name: 'taskFunctions',
      data: {
        action: 'searchTasks',
        data: { keyword, page: 1, pageSize: 50 }
      }
    }).then(res => {
      if (this._searchToken !== searchToken) {
        return;
      }

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
            categoryId: category ? task.categoryId : '',
            categoryName: category ? category.name : '未分类',
            categoryColor: category ? category.color : '#999'
          };
        });
        this.setData({ searchResults: tasks, searchHint: '' });
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
