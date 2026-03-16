import Dialog from '@vant/weapp/dialog/dialog';

Page({
  data: {
    // 任务数据 - 对齐 data_design.md 中的 tasks 集合
    task: {
      _id: '',
      title: '',
      description: '',
      dueDate: '',
      priority: 4,
      status: 0,
      categoryId: '',
      repeatType: 0,      // 0-不重复，1-每周重复，2-每月重复
      repeatValue: '',
      reminderAt: null,   // 提醒时间
      reminderSent: false,// 提醒是否已发送
      listId: '',
      creatorId: '',
      createdAt: null,
      updatedAt: null
    },
    // 是否是新建任务
    isNewTask: false,
    // 优先级选项 - priority: 1-不重要不紧急，2-紧急不重要，3-重要不紧急，4-重要且紧急
    priorityOptions: [
      { value: 4, label: '重要且紧急', color: '#ee0a24' },
      { value: 3, label: '重要不紧急', color: '#ff976a' },
      { value: 2, label: '紧急不重要', color: '#ffd01e' },
      { value: 1, label: '不重要不紧急', color: '#07c160' }
    ],
    priorityIndex: 0,
    // 分类选项
    categoryOptions: [],
    categoryIndex: 0,
    // 周期类型选项 - repeatType: 0-不重复，1-每周重复，2-每月重复
    repeatTypeOptions: [
      { value: 1, label: '每周重复' },
      { value: 2, label: '每月重复' }
    ],
    repeatTypeIndex: 0,
    // 星期选择 - repeatValue: "1,3,5" 表示周一、周三、周五（1-7代表周一到周日）
    weekDays: ['一', '二', '三', '四', '五', '六', '日'],
    selectedWeekDays: [false, false, false, false, false, false, false],
    // 月份日期 - repeatValue: "1,15" 表示每月1号和15号
    monthDays: Array.from({ length: 31 }, (_, i) => (i + 1) + '日'),
    monthDayIndex: 0,
    // 截止日期选择器
    dueDateRange: [],
    dueDateIndex: [0, 0, 0, 0, 0],
    formattedDueDate: '',
    // 提醒设置
    enableReminder: false,
    reminderRange: [],
    reminderIndex: [0, 0, 0, 0],
    formattedReminderTime: ''
  },

  onLoad: function (options) {
    // 初始化日期选择器数据
    this.initDatePicker();
    this.initReminderPicker();

    // 加载分类数据
    this.loadCategories();

    if (options.id) {
      // 编辑现有任务
      this.loadTask(options.id);
    } else {
      // 新建任务
      this.setData({ isNewTask: true });
      this.initNewTask();
    }
  },

  // 初始化日期选择器
  initDatePicker: function () {
    const now = new Date();
    const years = [];
    const months = [];
    const days = [];
    const hours = [];
    const minutes = [];

    // 年份范围：当前年份前后5年
    for (let i = now.getFullYear() - 5; i <= now.getFullYear() + 5; i++) {
      years.push(i + '年');
    }

    // 月份
    for (let i = 1; i <= 12; i++) {
      months.push(i + '月');
    }

    // 日期（根据月份动态计算，这里先初始化为31天）
    for (let i = 1; i <= 31; i++) {
      days.push(i + '日');
    }

    // 小时
    for (let i = 0; i < 24; i++) {
      hours.push(String(i).padStart(2, '0') + '时');
    }

    // 分钟
    for (let i = 0; i < 60; i++) {
      minutes.push(String(i).padStart(2, '0') + '分');
    }

    this.setData({
      dueDateRange: [years, months, days, hours, minutes]
    });
  },

  // 初始化提醒选择器
  initReminderPicker: function () {
    const days = ['当天', '提前1天', '提前2天', '提前3天', '提前7天'];
    const hours = [];
    const minutes = [];

    for (let i = 0; i < 24; i++) {
      hours.push(String(i).padStart(2, '0') + '时');
    }

    for (let i = 0; i < 60; i += 5) {
      minutes.push(String(i).padStart(2, '0') + '分');
    }

    this.setData({
      reminderRange: [days, hours, minutes]
    });
  },

  // 加载分类数据
  loadCategories: function () {
    // TODO: 从云数据库加载
    const categories = [
      { _id: '', name: '无' },
      { _id: 'personal', name: '个人', color: '#07c160' },
      { _id: 'work', name: '工作', color: '#ff976a' }
    ];
    this.setData({ categoryOptions: categories });
  },

  // 加载任务数据
  loadTask: function (taskId) {
    // TODO: 从云数据库加载
    // 模拟数据
    const mockTask = {
      _id: taskId,
      title: '完成项目文档',
      description: '需要完成项目的技术文档编写',
      dueDate: '2026-03-14 18:00',
      priority: 4,
      status: 0,
      categoryId: 'work',
      repeatType: 0,
      repeatValue: '',
      listId: '',
      creatorId: 'user_001',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.setTaskData(mockTask);
  },

  // 初始化新任务
  initNewTask: function () {
    const now = new Date();
    const dueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 默认明天
    const formattedDueDate = this.formatDateTime(dueDate);

    this.setData({
      'task.dueDate': formattedDueDate,
      formattedDueDate: formattedDueDate,
      priorityIndex: 0,
      categoryIndex: 0
    });
  },

  // 设置任务数据到页面
  setTaskData: function (task) {
    // 找到优先级索引
    const priorityIndex = this.data.priorityOptions.findIndex(
      item => item.value === task.priority
    );

    // 找到分类索引
    const categoryIndex = this.data.categoryOptions.findIndex(
      item => item._id === task.categoryId
    );

    // 解析重复设置
    let selectedWeekDays = [false, false, false, false, false, false, false];
    let repeatTypeIndex = 0;
    let monthDayIndex = 0;

    if (task.repeatType === 1 && task.repeatValue) {
      // 每周重复
      const days = task.repeatValue.split(',').map(v => parseInt(v));
      days.forEach(day => {
        if (day >= 1 && day <= 7) {
          selectedWeekDays[day - 1] = true;
        }
      });
      repeatTypeIndex = 0;
    } else if (task.repeatType === 2 && task.repeatValue) {
      // 每月重复
      monthDayIndex = parseInt(task.repeatValue) - 1;
      repeatTypeIndex = 1;
    }

    this.setData({
      task: task,
      priorityIndex: priorityIndex >= 0 ? priorityIndex : 0,
      categoryIndex: categoryIndex >= 0 ? categoryIndex : 0,
      selectedWeekDays: selectedWeekDays,
      repeatTypeIndex: repeatTypeIndex,
      monthDayIndex: monthDayIndex >= 0 ? monthDayIndex : 0,
      formattedDueDate: task.dueDate
    });
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

  // 任务状态切换
  onStatusChange: function (e) {
    this.setData({
      'task.status': e.detail ? 1 : 0
    });
  },

  // 任务名称变更
  onTitleChange: function (e) {
    this.setData({
      'task.title': e.detail.value
    });
  },

  // 优先级变更
  onPriorityChange: function (e) {
    const index = parseInt(e.detail.value);
    this.setData({
      priorityIndex: index,
      'task.priority': this.data.priorityOptions[index].value
    });
  },

  // 分类变更
  onCategoryChange: function (e) {
    const index = parseInt(e.detail.value);
    this.setData({
      categoryIndex: index,
      'task.categoryId': this.data.categoryOptions[index]._id
    });
  },

  // 截止日期变更
  onDueDateChange: function (e) {
    const value = e.detail.value;
    const year = parseInt(this.data.dueDateRange[0][value[0]]);
    const month = parseInt(this.data.dueDateRange[1][value[1]]);
    const day = parseInt(this.data.dueDateRange[2][value[2]]);
    const hour = parseInt(this.data.dueDateRange[3][value[3]]);
    const minute = parseInt(this.data.dueDateRange[4][value[4]]);

    const date = new Date(year, month - 1, day, hour, minute);
    const formattedDueDate = this.formatDateTime(date);

    this.setData({
      dueDateIndex: value,
      'task.dueDate': formattedDueDate,
      formattedDueDate: formattedDueDate
    });
  },

  // 截止日期列变更（处理日期联动）
  onDueDateColumnChange: function (e) {
    // 可以在这里处理年月日联动，简化处理暂不实现
  },

  // 周期开关切换
  onRepeatToggle: function (e) {
    const enabled = e.detail.value;
    this.setData({
      'task.repeatType': enabled ? 1 : 0,
      'task.repeatValue': enabled ? '' : ''
    });
  },

  // 周期类型变更
  onRepeatTypeChange: function (e) {
    const index = parseInt(e.detail.value);
    const repeatType = this.data.repeatTypeOptions[index].value;
    this.setData({
      repeatTypeIndex: index,
      'task.repeatType': repeatType,
      'task.repeatValue': ''
    });
  },

  // 星期选择切换
  onWeekDayToggle: function (e) {
    const index = parseInt(e.currentTarget.dataset.index);
    const selectedWeekDays = [...this.data.selectedWeekDays];
    selectedWeekDays[index] = !selectedWeekDays[index];

    // 转换为repeatValue
    const selectedDays = [];
    selectedWeekDays.forEach((selected, idx) => {
      if (selected) {
        selectedDays.push(idx + 1);
      }
    });

    this.setData({
      selectedWeekDays: selectedWeekDays,
      'task.repeatValue': selectedDays.join(',')
    });
  },

  // 每月日期变更
  onMonthDayChange: function (e) {
    const index = parseInt(e.detail.value);
    const day = index + 1;
    this.setData({
      monthDayIndex: index,
      'task.repeatValue': String(day)
    });
  },

  // 任务描述变更
  onDescriptionChange: function (e) {
    this.setData({
      'task.description': e.detail.value
    });
  },

  // 提醒开关切换
  onReminderToggle: function (e) {
    this.setData({
      enableReminder: e.detail.value
    });
  },

  // 提醒时间变更
  onReminderTimeChange: function (e) {
    const value = e.detail.value;
    this.setData({
      reminderIndex: value
    });
  },

  // 取消按钮
  onCancel: function () {
    wx.navigateBack();
  },

  // 删除任务
  onDelete: function () {
    Dialog.confirm({
      title: '确认删除',
      message: '确定要删除这个任务吗？删除后无法恢复。'
    }).then(() => {
      // 确认删除
      this.deleteTask();
    }).catch(() => {
      // 取消删除
    });
  },

  // 执行删除
  deleteTask: function () {
    // TODO: 调用云函数删除任务
    wx.showToast({
      title: '删除成功',
      icon: 'success'
    });

    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  },

  // 保存任务
  onSave: function () {
    // 验证必填项
    if (!this.data.task.title.trim()) {
      wx.showToast({
        title: '请输入任务名称',
        icon: 'none'
      });
      return;
    }

    // 验证周期设置
    if (this.data.task.repeatType > 0 && !this.data.task.repeatValue) {
      wx.showToast({
        title: '请选择重复日期',
        icon: 'none'
      });
      return;
    }

    // TODO: 调用云函数保存任务
    const task = {
      ...this.data.task,
      updatedAt: new Date()
    };

    if (this.data.isNewTask) {
      task.createdAt = new Date();
      // TODO: 创建新任务
    } else {
      // TODO: 更新现有任务
    }

    wx.showToast({
      title: '保存成功',
      icon: 'success'
    });

    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  }
});
