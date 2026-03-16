Page({
  data: {
    isRegistered: false,
    userId: null,
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    selectedDate: null,
    calendarDays: [],
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    // 任务数据 - 根据 data_design.md 设计
    tasks: [
      {
        _id: 'task_001',
        title: '完成项目文档',
        dueDate: '2026-03-14 18:00',
        priority: 4,
        status: 0,
        repeatType: 0,
        categoryId: 'cat_work'
      },
      {
        _id: 'task_002',
        title: '购买生活用品',
        dueDate: '2026-03-15 12:00',
        priority: 3,
        status: 0,
        repeatType: 0,
        categoryId: 'cat_personal'
      },
      {
        _id: 'task_003',
        title: '参加团队会议',
        dueDate: '2026-03-13 14:00',
        priority: 2,
        status: 0,
        repeatType: 0,
        categoryId: 'cat_work'
      },
      {
        _id: 'task_004',
        title: '阅读技术书籍',
        dueDate: '2026-03-20 22:00',
        priority: 1,
        status: 0,
        repeatType: 1,
        repeatValue: '1,3,5',
        categoryId: 'cat_personal'
      },
      {
        _id: 'task_009',
        title: '每日晨跑',
        dueDate: '2026-03-14 07:00',
        priority: 3,
        status: 0,
        repeatType: 1,
        repeatValue: '1,2,3,4,5,6,7',
        categoryId: 'cat_personal'
      },
      {
        _id: 'task_010',
        title: '每月总结',
        dueDate: '2026-03-01 18:00',
        priority: 4,
        status: 0,
        repeatType: 2,
        repeatValue: '1',
        categoryId: 'cat_work'
      },
      {
        _id: 'task_005',
        title: '提交周报',
        dueDate: '2026-03-12 17:00',
        priority: 4,
        status: 1,
        repeatType: 0,
        categoryId: 'cat_work'
      },
      {
        _id: 'task_006',
        title: '日常待办任务',
        dueDate: '2026-03-18 13:00',
        priority: 2,
        status: 0,
        repeatType: 0,
        categoryId: 'cat_personal'
      },
      {
        _id: 'task_007',
        title: '日常待办任务',
        dueDate: '2026-03-18 18:30',
        priority: 2,
        status: 0,
        repeatType: 0,
        categoryId: 'cat_personal'
      },
      {
        _id: 'task_008',
        title: '日常待办任务',
        dueDate: '2026-03-18 18:00',
        priority: 2,
        status: 0,
        repeatType: 0,
        categoryId: 'cat_personal'
      }
    ],
    // 分类数据 - 根据 data_design.md 设计，从 categories 集合获取
    categories: [
      { _id: 'all', name: '全部', color: '#999' },
      { _id: 'cat_personal', name: '日常', color: '#07c160' },
      { _id: 'cat_work', name: '工作', color: '#1989fa' },
      { _id: 'cat_other', name: '其他', color: '#ff976a' }
    ],
    currentCategory: 'all',
    selectedDateTasks: [],
    inProgressTasks: [],
    overdueTasks: [],
    completedTasks: []
  },

  onLoad: function (options) {
    const isRegistered = wx.getStorageSync('isRegistered') || false;
    const userId = wx.getStorageSync('userId') || null;
    const today = new Date();
    const selectedDate = this.formatDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
    this.setData({
      isRegistered,
      userId,
      selectedDate
    });
    this.loadCategories();
    this.loadTasks();
    this.generateCalendar();
    this.loadTasksForSelectedDate();
  },

  onShow: function () {
    const isRegistered = wx.getStorageSync('isRegistered') || false;
    const userId = wx.getStorageSync('userId') || null;
    this.setData({ isRegistered, userId });
    // 重新加载数据
    this.loadCategories();
    this.loadTasks();
  },

  // 从数据库加载分类数据
  loadCategories: function () {
    // TODO: 从云数据库 categories 集合读取
    // const db = wx.cloud.database();
    // db.collection('categories').where({
    //   userId: this.data.userId
    // }).orderBy('sortOrder', 'asc').get().then(res => {
    //   const categories = [{ _id: 'all', name: '全部', color: '#999' }, ...res.data];
    //   this.setData({ categories });
    // });

    // 目前使用本地数据
    console.log('加载分类数据');
  },

  // 从数据库加载任务数据
  loadTasks: function () {
    // TODO: 从云数据库 tasks 集合读取
    // const db = wx.cloud.database();
    // db.collection('tasks').where({
    //   creatorId: this.data.userId
    // }).get().then(res => {
    //   this.setData({ tasks: res.data });
    //   this.generateCalendar();
    //   this.loadTasksForSelectedDate();
    // });

    // 目前使用本地数据
    console.log('加载任务数据');
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
  // 根据 data_design.md: repeatType 0-不重复, 1-周重复, 2-月重复
  // repeatValue 格式: "1,3,5"-每周一三五, "1,15"-每月1号和15号
  isTaskRepeatingOnDate: function (task, dateStr) {
    const taskDate = task.dueDate.split(' ')[0];
    const targetDate = new Date(dateStr);
    const targetDayOfWeek = targetDate.getDay() || 7; // 1-7 (周一到周日)
    const targetDayOfMonth = targetDate.getDate();

    // 如果任务日期就是目标日期
    if (taskDate === dateStr) return true;

    // 不重复
    if (task.repeatType === 0) return false;

    // 周重复 (repeatType = 1)
    if (task.repeatType === 1) {
      if (!task.repeatValue) return false;
      const repeatDays = task.repeatValue.split(',').map(v => parseInt(v.trim()));
      return repeatDays.includes(targetDayOfWeek);
    }

    // 月重复 (repeatType = 2)
    if (task.repeatType === 2) {
      if (!task.repeatValue) return false;
      const repeatDays = task.repeatValue.split(',').map(v => parseInt(v.trim()));
      return repeatDays.includes(targetDayOfMonth);
    }

    return false;
  },

  // 计算周期性任务数量
  // 只显示当前点击日期中存在的周期任务在后面的日期中的数量
  calculatePeriodicCount: function (dateStr) {
    const { tasks, selectedDate } = this.data;
    if (!selectedDate) return 0;

    const selectedDateTime = new Date(selectedDate).getTime();
    const currentDateTime = new Date(dateStr).getTime();

    // 只计算选中日期之后的日期
    if (currentDateTime <= selectedDateTime) return 0;

    // 获取当前点击日期中存在的周期任务
    const selectedDatePeriodicTasks = tasks.filter(task => {
      // 只统计在选中日期有实例的周期任务
      return task.repeatType === 1 && this.isTaskRepeatingOnDate(task, selectedDate);
    });

    // 计算这些周期任务在目标日期之前（包括目标日期）还会出现的次数
    let count = 0;
    const targetDate = new Date(dateStr);

    selectedDatePeriodicTasks.forEach(task => {
      // 检查该周期任务在目标日期是否有实例
      if (this.isTaskRepeatingOnDate(task, dateStr)) {
        count++;
      }
    });

    return count;
  },

  // 上一年
  onPrevYear: function () {
    this.setData({
      currentYear: this.data.currentYear - 1
    });
    this.generateCalendar();
  },

  // 下一年
  onNextYear: function () {
    this.setData({
      currentYear: this.data.currentYear + 1
    });
    this.generateCalendar();
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
    this.generateCalendar();
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
    this.generateCalendar();
  },

  // 选择日期
  onSelectDate: function (e) {
    const date = e.currentTarget.dataset.date;
    this.setData({ selectedDate: date });
    this.generateCalendar();
    this.loadTasksForSelectedDate();
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 判断选中日期是否是今天
    const selectedDateObj = new Date(selectedDate);
    selectedDateObj.setHours(0, 0, 0, 0);
    const isToday = selectedDateObj.getTime() === today.getTime();

    const processedTasks = selectedDateTasks.map(task => {
      const dueDate = new Date(task.dueDate);
      let isOverdue;

      if (isToday) {
        // 选中当天时，判断日期和时间
        isOverdue = dueDate < now && task.status === 0;
      } else {
        // 其他日期，只判断日期
        dueDate.setHours(0, 0, 0, 0);
        isOverdue = dueDate < today && task.status === 0;
      }

      const priorityColor = this.getPriorityColor(task.priority);
      const time = task.dueDate.split(' ')[1];
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

    // 分类任务：status 0-未完成, 1-已完成, 2-逾期
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

  // 任务完成状态切换 - 根据 data_design.md 的 status 字段设计
  // status: 0-未完成, 1-已完成, 2-逾期
  onTaskComplete: function (e) {
    const taskId = e.currentTarget.dataset.id;
    const completed = e.detail;
    const tasks = this.data.tasks.map(task => {
      if (task._id === taskId) {
        return { ...task, status: completed ? 1 : 0 };
      }
      return task;
    });
    this.setData({ tasks });
    this.loadTasksForSelectedDate();

    // TODO: 更新云数据库
    // const db = wx.cloud.database();
    // db.collection('tasks').doc(taskId).update({
    //   data: {
    //     status: completed ? 1 : 0,
    //     updatedAt: new Date()
    //   }
    // });
  },

  // 阻止复选框点击事件冒泡
  onCheckboxTap: function (e) {
    // 阻止事件冒泡，防止触发任务项的点击事件
  },

  // 点击任务项跳转到任务详情
  onTaskTap: function (e) {
    const taskId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/task-detail/task-detail?id=${taskId}`
    });
  },

  onCreateTask: function () {
    if (!this.data.isRegistered) {
      wx.showModal({
        title: '提示',
        content: '您需要先注册才能创建任务',
        confirmText: '去注册',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/register/register'
            });
          }
        }
      });
    } else {
      wx.showToast({
        title: '创建任务',
        icon: 'none'
      });
    }
  }
});
