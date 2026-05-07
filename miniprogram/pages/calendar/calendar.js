const app = getApp();
const {
  getTodayInUTC8,
  toUTC8DateOnly
} = require('../../utils/taskDisplay');

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
      // 清除存储的日期
      wx.removeStorageSync('jumpToDate');
      // 使用跳转日期
      this.setData({
        isRegistered: isLoggedIn,
        userId,
        selectedDate: jumpToDate
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
    // 统一提取日期部分（支持多种格式）
    const taskDateObj = new Date(task.dueDate);
    const taskDate = this.formatDate(taskDateObj.getFullYear(), taskDateObj.getMonth() + 1, taskDateObj.getDate());

    // 如果任务日期就是目标日期，直接匹配
    if (taskDate === dateStr) {
      return true;
    }

    // 不重复
    if (task.repeatType === 0) {
      return false;
    }

    // 对于预生成的周期任务实例，只匹配dueDate，不重复计算
    if (task.isPeriodicInstance) {
      return false;
    }

    // 以下逻辑只适用于原始的父周期任务（用于计算周期徽章数量）
    const targetDate = new Date(dateStr);
    const targetDayOfWeek = targetDate.getDay() || 7; // 1-7 (周一到周日)
    const targetDayOfMonth = targetDate.getDate();

    // 每天重复 (repeatType = 1)
    if (task.repeatType === 1) {
      return true;
    }

    // 每周重复 (repeatType = 2)
    if (task.repeatType === 2) {
      if (!task.repeatValue) return false;
      const repeatDays = task.repeatValue.split(',').map(v => parseInt(v.trim()));
      return repeatDays.includes(targetDayOfWeek);
    }

    // 每月重复 (repeatType = 3)
    if (task.repeatType === 3) {
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
    const { tasks, selectedDate } = this.data;
    if (!selectedDate || !tasks || tasks.length === 0) return 0;

    const currentDateTime = new Date(dateStr).getTime();
    const selectedDateTime = new Date(selectedDate).getTime();

    // 选中日期当天：显示该日期的进行中周期任务数量
    if (dateStr === selectedDate) {
      const periodicTasks = tasks.filter(task => {
        return task.repeatType > 0 && Number(task.status) === 0 && this.isTaskRepeatingOnDate(task, dateStr);
      });
      return periodicTasks.length;
    }

    // 只计算选中日期之后的日期
    if (currentDateTime <= selectedDateTime) {
      return 0;
    }

    // 找到选中日期上存在的进行中周期任务的系列ID
    const selectedDatePeriodicTasks = tasks.filter(task => {
      return task.repeatType > 0 && Number(task.status) === 0 && this.isTaskRepeatingOnDate(task, selectedDate);
    });

    const seriesIds = new Set();
    selectedDatePeriodicTasks.forEach(task => {
      seriesIds.add(task.parentTaskId || task._id);
    });

    if (seriesIds.size === 0) return 0;

    // 在目标日期上，检查这些系列是否有未完成的实例
    let count = 0;
    seriesIds.forEach(seriesId => {
      const hasUnfinishedInstance = tasks.some(task => {
        const belongsToSeries = (task.parentTaskId === seriesId || task._id === seriesId);
        if (!belongsToSeries) return false;
        if (Number(task.status) !== 0) return false; // 只计算未完成的
        return this.isTaskRepeatingOnDate(task, dateStr);
      });
      if (hasUnfinishedInstance) count++;
    });

    return count;
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

    // 过滤选中日期的任务（包括重复任务）
    let selectedDateTasks = tasks.filter(task => {
      return this.isTaskRepeatingOnDate(task, selectedDate);
    });

    // 按分类过滤
    if (currentCategory !== 'all') {
      selectedDateTasks = selectedDateTasks.filter(task => task.categoryId === currentCategory);
    }

    // 处理任务数据
    const now = new Date();
    const today = getTodayInUTC8();

    // 判断选中日期是否是今天
    // 将 YYYY-MM-DD 格式转换为本地日期，避免时区问题
    const [selectedYear, selectedMonth, selectedDay] = selectedDate.split('-').map(Number);
    const selectedDateObj = toUTC8DateOnly(new Date(`${selectedDate}T00:00:00+08:00`));
    const isToday = selectedDateObj.getTime() === today.getTime();

    const processedTasks = selectedDateTasks.map(task => {
      const dueDate = new Date(task.dueDate);
      let isOverdue;
      const taskStatus = Number(task.status);
      const isPeriodic = task.repeatType > 0;

      // 过期判断逻辑以系统时间为基准，周期任务与非周期任务统一处理
      if (isToday) {
        // 选中当天时，判断日期和时间（周期任务按选中日期当天结束判断）
        if (isPeriodic) {
          isOverdue = false;
        } else {
          isOverdue = dueDate < now && taskStatus === 0;
        }
      } else if (selectedDateObj < today) {
        // 选中过去的日期：该日期的所有未完成任务都显示为已过期
        isOverdue = taskStatus === 0;
      } else {
        // 选中未来的日期：不显示为过期
        isOverdue = false;
      }

      const priorityColor = this.getPriorityColor(task.priority);
      // 处理时间显示 - 支持多种日期格式
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
        isOverdue,
        priorityColor,
        time,
        categoryName: category ? category.name : '未分类',
        categoryColor: category ? category.color : '#999'
      };
    });

    // status 只持久化 0=未完成、1=已完成，逾期由 isOverdue 派生
    // 过期判断以系统时间为基准
    const inProgressTasks = processedTasks.filter(task => task.status === 0 && !task.isOverdue);
    const overdueTasks = processedTasks.filter(task => task.status === 0 && task.isOverdue);
    const completedTasks = processedTasks.filter(task => task.status === 1);

    this.setData({
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
    const completed = e.detail;
    const newStatus = completed ? 1 : 0;

    // 前端拦截：已过期任务完成确认 & 周期任务只能在当日完成
    let confirmedOverdue = false;
    if (newStatus === 1) {
      const task = this.data.tasks.find(t => t._id === taskId);
      if (task && task.repeatType > 0) {
        const { selectedDate } = this.data;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [sy, sm, sd] = selectedDate.split('-').map(Number);
        const selDateObj = new Date(sy, sm - 1, sd);
        selDateObj.setHours(0, 0, 0, 0);

        if (selDateObj < today) {
          // 已过期的周期任务：弹出确认框
          const confirmRes = await new Promise(resolve => {
            wx.showModal({
              title: '提示',
              content: '该任务已过期，确认要标记为已完成吗？',
              confirmText: '确认完成',
              cancelText: '取消',
              success: resolve
            });
          });
          if (!confirmRes.confirm) {
            this.loadTasksForSelectedDate();
            return;
          }
          confirmedOverdue = true;
        } else if (selDateObj.getTime() !== today.getTime()) {
          // 非当日（未来日期）的周期任务：直接拦截，提示无法完成
          wx.showModal({
            title: '提示',
            content: '无法完成非当日的周期任务',
            showCancel: false,
            confirmText: '知道了'
          });
          // 恢复 checkbox 状态
          this.loadTasksForSelectedDate();
          return;
        }
        // 当日周期任务：正常完成，不拦截
      } else if (task && task.isOverdue) {
        // 非周期的已过期任务：弹出确认框
        const confirmRes = await new Promise(resolve => {
          wx.showModal({
            title: '提示',
            content: '该任务已过期，确认要标记为已完成吗？',
            confirmText: '确认完成',
            cancelText: '取消',
            success: resolve
          });
        });
        if (!confirmRes.confirm) {
          this.loadTasksForSelectedDate();
          return;
        }
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
          confirmText: '切换日期',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              // 切换到该日期
              const dueDate = resultData.dueDate;
              if (dueDate) {
                this.jumpToDate(dueDate);
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
                  this.generateCalendar();
                  this.loadTasksForSelectedDate();

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

      // 如果生成了重复任务，需要重新加载所有任务
        if (resultData && (resultData.newPeriodicTasks || resultData.isRepeatTask)) {
          await this.loadTasks();
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
      this.generateCalendar();
      this.loadTasksForSelectedDate();
    } catch (error) {
      console.error('更新任务状态失败:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
      // 刷新列表恢复正确状态
      this.loadTasksForSelectedDate();
    }
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
    // dateStr 格式: YYYY-MM-DD
    this.setData({
      selectedDate: dateStr
    });
    this.generateCalendar();
    this.loadTasksForSelectedDate();
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
