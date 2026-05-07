const app = getApp();
const {
  toUTC8DateOnly,
  getTaskSeriesGroupId,
  getUTC8DateString,
  compareUTC8DateStrings,
  getSelectedDateMode
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
    isRegistered: false,
    userId: null,
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    selectedDate: null,
    calendarDays: [],
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    // 任务数据 - 从云数据库加载
    tasks: [],
    // 分类数据 - 从云数据库加载
    categories: [
      { _id: 'all', name: '全部', color: '#999' }
    ],
    currentCategory: 'all',
    selectedDateMode: 'today',
    selectedDateTasks: [],
    inProgressTasks: [],
    overdueTasks: [],
    completedTasks: []
  },

  onLoad: function (options) {
    const { isLoggedIn, userInfo } = app.getLoginState();
    const userId = userInfo ? userInfo._id : null;

    // 检查是否有跳转日期（从首页跳转过来）
    const jumpToDate = wx.getStorageSync('jumpToDate');
    if (jumpToDate) {
      const [jy, jm] = jumpToDate.split('-').map(Number);
      // 清除存储的日期
      wx.removeStorageSync('jumpToDate');
      // 使用跳转日期
      this.setData({
        isRegistered: isLoggedIn,
        userId,
        selectedDate: jumpToDate,
        currentYear: jy,
        currentMonth: jm
      });
    } else {
      const today = new Date();
      const selectedDate = this.formatDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
      this.setData({
        isRegistered: isLoggedIn,
        userId,
        selectedDate
      });
    }

    this.loadCategories();
    this.loadTasks();
    this.generateCalendar();
    this.loadTasksForSelectedDate();
  },

  onShow: function () {
    const { isLoggedIn, userInfo } = app.getLoginState();
    const userId = userInfo ? userInfo._id : null;
    this.setData({ isRegistered: isLoggedIn, userId });

    // 检查是否有跳转日期（从首页跳转过来，tabBar 页面 onLoad 可能不再执行）
    const jumpToDate = wx.getStorageSync('jumpToDate');
    if (jumpToDate) {
      wx.removeStorageSync('jumpToDate');
      const [jy, jm] = jumpToDate.split('-').map(Number);
      this.setData({
        selectedDate: jumpToDate,
        currentYear: jy,
        currentMonth: jm
      });
    }

    // 重新加载数据
    if (!isLoggedIn) {
      this.resetGuestData();
      return;
    }

    this.loadCategories();
    this.loadTasks();
  },

  resetGuestData: function () {
    this.setData({
      isRegistered: false,
      userId: null,
      categories: [
        { _id: 'all', name: '全部', color: '#999' }
      ],
      currentCategory: 'all',
      selectedDateMode: getSelectedDateMode(this.data.selectedDate || getUTC8DateString(new Date())),
      tasks: [],
      selectedDateTasks: [],
      inProgressTasks: [],
      overdueTasks: [],
      completedTasks: []
    });

    this.generateCalendar();
  },

  // 从数据库加载分类数据
  loadCategories: async function () {
    if (!this.data.isRegistered) {
      return;
    }

    // 先展示缓存
    const cachedCategories = wx.getStorageSync('cachedCategories');
    if (cachedCategories && cachedCategories.length > 0) {
      this.setData({
        categories: [
          { _id: 'all', name: '全部', color: '#999' },
          ...cachedCategories
        ]
      });
    }

    try {
      const result = await wx.cloud.callFunction({
        name: 'categoryFunctions',
        data: {
          action: 'getCategories'
        }
      });

      if (result.result && result.result.code === 0) {
        const categoryList = result.result.data || [];
        // 添加"全部"选项到开头
        const categories = [
          { _id: 'all', name: '全部', color: '#999' },
          ...categoryList
        ];
        this.setData({ categories });
        wx.setStorageSync('cachedCategories', categoryList);
      } else {
        console.error('加载分类失败:', result.result?.message);
      }
    } catch (error) {
      console.error('调用云函数失败:', error);
    }
  },

  // 从数据库加载任务数据
  loadTasks: async function () {
    if (!this.data.isRegistered) {
      this.generateCalendar();
      this.loadTasksForSelectedDate();
      return;
    }

    try {
      // 按当前月份范围查询，前后各扩展7天覆盖跨月显示
      const { currentYear, currentMonth } = this.data;

      // 先展示缓存数据
      const cacheKey = `calendarTasks_${currentYear}_${currentMonth}`;
      const cachedTasks = wx.getStorageSync(cacheKey);
      if (cachedTasks && cachedTasks.length > 0) {
        this.setData({ tasks: cachedTasks });
        this.generateCalendar();
        this.loadTasksForSelectedDate();
      }

      const startDate = new Date(currentYear, currentMonth - 2, 24); // 上月末
      const endDate = new Date(currentYear, currentMonth, 7); // 下月初

      const result = await wx.cloud.callFunction({
        name: 'taskFunctions',
        data: {
          action: 'getTaskList',
          data: {
            page: 1,
            pageSize: 100,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          }
        }
      });

      if (result.result && result.result.code === 0) {
        // 云函数返回的数据结构: { list: [...], total, page, pageSize }
        const tasks = result.result.data?.list || [];
        this.setData({ tasks });
        this.generateCalendar();
        this.loadTasksForSelectedDate();
        // 更新缓存
        const cacheKey = `calendarTasks_${currentYear}_${currentMonth}`;
        wx.setStorageSync(cacheKey, tasks);
      } else {
        console.error('加载任务失败:', result.result?.message);
        // 使用本地数据
        this.generateCalendar();
        this.loadTasksForSelectedDate();
      }
    } catch (error) {
      console.error('调用云函数失败:', error);
      // 使用本地数据
      this.generateCalendar();
      this.loadTasksForSelectedDate();
    }
  },

  // 格式化日期为 YYYY-MM-DD
  formatDate: function (year, month, day) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  },

  // 格式化日期时间
  formatDateTime: function (date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  // 生成日历数据
  generateCalendar: function () {
    const { currentYear, currentMonth } = this.data;
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const daysInMonth = lastDay.getDate();
    const firstDayOfWeek = firstDay.getDay();

    const calendarDays = [];
    const today = new Date();
    const todayStr = this.formatDate(today.getFullYear(), today.getMonth() + 1, today.getDate());

    // 上个月的日期
    const prevMonth = new Date(currentYear, currentMonth - 1, 0);
    const daysInPrevMonth = prevMonth.getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      calendarDays.push({
        day: day,
        date: this.formatDate(prevMonth.getFullYear(), prevMonth.getMonth() + 1, day),
        isCurrentMonth: false,
        isToday: false,
        periodicCount: 0
      });
    }

    // 当前月的日期
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = this.formatDate(currentYear, currentMonth, i);
      const periodicCount = this.calculatePeriodicCount(dateStr);
      calendarDays.push({
        day: i,
        date: dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        periodicCount: periodicCount
      });
    }

    // 下个月的日期
    const remainingDays = 42 - calendarDays.length;
    const nextMonth = new Date(currentYear, currentMonth, 1);
    for (let i = 1; i <= remainingDays; i++) {
      calendarDays.push({
        day: i,
        date: this.formatDate(nextMonth.getFullYear(), nextMonth.getMonth() + 1, i),
        isCurrentMonth: false,
        isToday: false,
        periodicCount: 0
      });
    }

    this.setData({ calendarDays });
  },

  // 检查任务是否在指定日期有重复实例
  // 根据云函数定义: repeatType 0-不重复, 1-每天, 2-每周, 3-每月
  // repeatValue 格式: "1,3,5"-每周一三五, "1,15"-每月1号和15号
  isTaskRepeatingOnDate: function (task, dateStr) {
    const repeatType = Number(task.repeatType);
    const taskDate = getUTC8DateString(task.dueDate);

    if (taskDate === dateStr) {
      return true;
    }

    if (repeatType === 0) {
      return false;
    }

    if (task.isPeriodicInstance) {
      return false;
    }

    if (compareUTC8DateStrings(dateStr, taskDate) < 0) {
      return false;
    }

    const targetDate = toUTC8DateOnly(`${dateStr}T00:00:00+08:00`);
    const utc8TargetDate = new Date(targetDate.getTime() + 8 * 60 * 60 * 1000);
    const targetDayOfWeek = utc8TargetDate.getUTCDay() || 7; // 1-7 (周一到周日)
    const targetDayOfMonth = utc8TargetDate.getUTCDate();

    if (repeatType === 1) {
      return true;
    }

    if (repeatType === 2) {
      if (!task.repeatValue) return false;
      const repeatDays = task.repeatValue.split(',').map(v => parseInt(v.trim()));
      return repeatDays.includes(targetDayOfWeek);
    }

    if (repeatType === 3) {
      if (!task.repeatValue) return false;
      const repeatDays = task.repeatValue.split(',').map(v => parseInt(v.trim()));
      return repeatDays.includes(targetDayOfMonth);
    }

    return false;
  },

  // 计算周期性任务数量
  // 选中日期显示当天的进行中周期任务数量
  // 选中日期之后的日期显示：选中日期的进行中周期任务系列在该日期的未完成实例数
  calculatePeriodicCount: function (dateStr) {
    const { tasks, selectedDate, currentCategory } = this.data;
    if (!selectedDate || !tasks || tasks.length === 0) return 0;

    if (compareUTC8DateStrings(dateStr, selectedDate) < 0) {
      return 0;
    }

    const seriesIds = this.getSelectedDateDisplayPeriodicSeriesIds(selectedDate, tasks, currentCategory);

    if (seriesIds.size === 0) return 0;

    let count = 0;
    seriesIds.forEach(seriesId => {
      const hasSeriesTask = tasks.some(task => {
        const belongsToSeries = (task.parentTaskId === seriesId || task._id === seriesId);
        if (!belongsToSeries) return false;
        return this.isTaskRepeatingOnDate(task, dateStr);
      });
      if (hasSeriesTask) count++;
    });

    return count;
  },

  getSelectedDateTaskCandidates: function (selectedDate, tasks) {
    return tasks.filter(task => this.isTaskRepeatingOnDate(task, selectedDate));
  },

  choosePreferredSelectedDateTask: function (tasks, selectedDate) {
    if (!tasks || tasks.length === 0) {
      return null;
    }

    return tasks
      .slice()
      .sort((taskA, taskB) => {
        const isExactDateA = getUTC8DateString(taskA.dueDate) === selectedDate;
        const isExactDateB = getUTC8DateString(taskB.dueDate) === selectedDate;
        if (isExactDateA !== isExactDateB) {
          return isExactDateA ? -1 : 1;
        }

        const isInstanceA = Boolean(taskA.isPeriodicInstance);
        const isInstanceB = Boolean(taskB.isPeriodicInstance);
        if (isInstanceA !== isInstanceB) {
          return isInstanceA ? -1 : 1;
        }

        const statusA = Number(taskA.status);
        const statusB = Number(taskB.status);
        if (statusA !== statusB) {
          return statusA - statusB;
        }

        const updatedAtA = new Date(taskA.updatedAt || taskA.createdAt || 0).getTime();
        const updatedAtB = new Date(taskB.updatedAt || taskB.createdAt || 0).getTime();
        if (updatedAtA !== updatedAtB) {
          return updatedAtB - updatedAtA;
        }

        return 0;
      })[0];
  },

  dedupeSelectedDatePeriodicTasks: function (taskCandidates, selectedDate) {
    const nonPeriodicTasks = [];
    const periodicTaskGroups = {};

    taskCandidates.forEach(task => {
      if (Number(task.repeatType) === 0) {
        nonPeriodicTasks.push(task);
        return;
      }

      const seriesId = getTaskSeriesGroupId(task);
      if (!periodicTaskGroups[seriesId]) {
        periodicTaskGroups[seriesId] = [];
      }
      periodicTaskGroups[seriesId].push(task);
    });

    const dedupedPeriodicTasks = Object.values(periodicTaskGroups)
      .map(seriesTasks => {
        const exactDateTasks = seriesTasks.filter(task => getUTC8DateString(task.dueDate) === selectedDate);
        if (exactDateTasks.length > 0) {
          return this.choosePreferredSelectedDateTask(exactDateTasks, selectedDate);
        }

        const projectionTasks = seriesTasks.filter(task => !task.isPeriodicInstance);
        return this.choosePreferredSelectedDateTask(projectionTasks, selectedDate)
          || this.choosePreferredSelectedDateTask(seriesTasks, selectedDate);
      })
      .filter(Boolean);

    return [...nonPeriodicTasks, ...dedupedPeriodicTasks];
  },

  getDisplayTasksForSelectedDate: function (selectedDate, tasks) {
    const taskCandidates = this.getSelectedDateTaskCandidates(selectedDate, tasks);
    return this.dedupeSelectedDatePeriodicTasks(taskCandidates, selectedDate);
  },

  getSelectedDateDisplayTasks: function (selectedDate, tasks, currentCategory) {
    let displayTasks = this.getDisplayTasksForSelectedDate(selectedDate, tasks);
    const selectedDateMode = getSelectedDateMode(selectedDate);

    if (selectedDateMode === 'future') {
      displayTasks = displayTasks.filter(task => Number(task.status) === 0);
    }

    if (currentCategory !== 'all') {
      displayTasks = displayTasks.filter(task => task.categoryId === currentCategory);
    }

    return displayTasks;
  },

  getSelectedDateDisplayPeriodicSeriesIds: function (selectedDate, tasks, currentCategory) {
    const displayTasks = this.getSelectedDateDisplayTasks(selectedDate, tasks, currentCategory);
    const seriesIds = new Set();

    displayTasks.forEach(task => {
      if (Number(task.repeatType) > 0) {
        seriesIds.add(getTaskSeriesGroupId(task));
      }
    });

    return seriesIds;
  },

  splitSelectedDateTasksByMode: function (tasks, selectedDateMode) {
    if (selectedDateMode === 'past') {
      return {
        inProgressTasks: [],
        overdueTasks: tasks.filter(task => task.status === 0),
        completedTasks: tasks.filter(task => task.status === 1)
      };
    }

    if (selectedDateMode === 'future') {
      return {
        inProgressTasks: tasks.filter(task => task.status === 0),
        overdueTasks: [],
        completedTasks: []
      };
    }

    return {
      inProgressTasks: tasks.filter(task => task.status === 0),
      overdueTasks: [],
      completedTasks: tasks.filter(task => task.status === 1)
    };
  },

  updateLocalTaskStatus: function (taskId, newStatus) {
    const tasks = this.data.tasks.map(task => {
      if (task._id === taskId) {
        return { ...task, status: newStatus };
      }
      return task;
    });

    this.setData({ tasks });
    this.generateCalendar();
    this.loadTasksForSelectedDate();
  },

  // 上一年
  onPrevYear: function () {
    this.setData({
      currentYear: this.data.currentYear - 1
    });
    this.loadTasks();
  },

  // 下一年
  onNextYear: function () {
    this.setData({
      currentYear: this.data.currentYear + 1
    });
    this.loadTasks();
  },

  // 上一月
  onPrevMonth: function () {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 1) {
      currentYear--;
      currentMonth = 12;
    } else {
      currentMonth--;
    }
    this.setData({ currentYear, currentMonth });
    this.loadTasks();
  },

  // 下一月
  onNextMonth: function () {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 12) {
      currentYear++;
      currentMonth = 1;
    } else {
      currentMonth++;
    }
    this.setData({ currentYear, currentMonth });
    this.loadTasks();
  },

  // 选择日期
  onSelectDate: function (e) {
    const date = e.currentTarget.dataset.date;
    // 先设置 selectedDate，然后在回调中重新生成日历
    this.setData({ selectedDate: date }, () => {
      this.generateCalendar();
      this.loadTasksForSelectedDate();
    });
  },

  // 加载选中日期的任务
  loadTasksForSelectedDate: function () {
    const { selectedDate, tasks, currentCategory } = this.data;
    if (!selectedDate) return;

    const selectedDateMode = getSelectedDateMode(selectedDate);
    const selectedDateTasks = this.getSelectedDateDisplayTasks(selectedDate, tasks, currentCategory);

    const processedTasks = selectedDateTasks.map(task => {
      const taskStatus = Number(task.status);
      const priorityColor = this.getPriorityColor(task.priority);
      let time = '';
      if (task.dueDate) {
        const dateObj = new Date(task.dueDate);
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        time = `${hours}:${minutes}`;
      }
      const category = this.getCategoryById(task.categoryId);
      return {
        ...task,
        isPersonalTask: isPersonalStandaloneTask(task),
        status: taskStatus,
        isOverdue: selectedDateMode === 'past' && taskStatus === 0,
        priorityColor,
        time,
        categoryName: category ? category.name : '未分类',
        categoryColor: category ? category.color : '#999'
      };
    });

    const {
      inProgressTasks,
      overdueTasks,
      completedTasks
    } = this.splitSelectedDateTasksByMode(processedTasks, selectedDateMode);

    this.setData({
      selectedDateMode,
      selectedDateTasks: processedTasks,
      inProgressTasks,
      overdueTasks,
      completedTasks
    });
  },

  // 根据ID获取分类
  getCategoryById: function (categoryId) {
    return this.data.categories.find(cat => cat._id === categoryId);
  },

  // 获取优先级颜色 - 根据 data_design.md 的 priority 数值设计
  // priority: 1-不重要不紧急，2-紧急不重要，3-重要不紧急，4-重要且紧急
  getPriorityColor: function (priority) {
    const colors = {
      4: '#ee0a24', // 重要且紧急 - 红色
      3: '#ff976a', // 重要不紧急 - 橙色
      2: '#ffd01e', // 紧急不重要 - 黄色
      1: '#07c160'  // 不重要不紧急 - 绿色
    };
    return colors[priority] || '#999';
  },

  // 获取优先级文本
  getPriorityText: function (priority) {
    const texts = {
      4: '重要且紧急',
      3: '重要不紧急',
      2: '紧急不重要',
      1: '不重要不紧急'
    };
    return texts[priority] || '无优先级';
  },

  // 分类切换
  onCategoryChange: function (e) {
    const categoryId = e.currentTarget.dataset.id;
    this.setData({ currentCategory: categoryId });
    this.loadTasksForSelectedDate();
  },

  // 任务完成状态切换
  // status 只持久化 0=未完成、1=已完成，逾期由 isOverdue 派生
  onTaskComplete: async function (e) {
    const taskId = e.currentTarget.dataset.id;
    const newStatus = normalizeCheckboxValue(e.detail) ? 1 : 0;
    const task = this.data.selectedDateTasks.find(t => t._id === taskId) || this.data.tasks.find(t => t._id === taskId);

    await handleTaskStatusToggle({
      taskId,
      task,
      newStatus,
      selectedDate: this.data.selectedDate,
      refreshView: () => this.loadTasksForSelectedDate(),
      reloadTasks: () => this.loadTasks(),
      updateLocalTaskStatus: (status) => this.updateLocalTaskStatus(taskId, status),
      navigateToDate: (dateStr) => this.jumpToDate(dateStr),
      notTodayConfirmText: '切换日期'
    });
  },

  // 阻止复选框点击事件冒泡
  onCheckboxTap: function (e) {
    // 阻止事件冒泡，防止触发任务项的点击事件
  },

  // 点击任务项跳转到任务详情
  onTaskTap: function (e) {
    if (!this.data.isRegistered) {
      return;
    }

    const taskId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/task-detail/task-detail?id=${taskId}`
    });
  },

  // 查看周期任务统计
  onViewStats: function (e) {
    if (!this.data.isRegistered) {
      return;
    }

    const taskId = e.currentTarget.dataset.id;
    const title = e.currentTarget.dataset.title;
    wx.navigateTo({
      url: `/pages/periodic-stats/periodic-stats?taskId=${taskId}`
    });
  },

  // 跳转到指定日期
  jumpToDate: function (dateStr) {
    const [year, month] = dateStr.split('-').map(Number);
    const needsReload = year !== this.data.currentYear || month !== this.data.currentMonth;

    this.setData({
      selectedDate: dateStr,
      currentYear: year,
      currentMonth: month
    }, () => {
      if (needsReload) {
        this.loadTasks();
        return;
      }

      this.generateCalendar();
      this.loadTasksForSelectedDate();
    });
  },

  onCreateTask: function () {
    if (!this.data.isRegistered) {
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
      // 跳转到任务创建页面，并传递当前选中的日期
      const selectedDate = this.data.selectedDate;
      wx.navigateTo({
        url: `/pages/task-edit/task-edit?dueDate=${selectedDate}`
      });
    }
  }
});
