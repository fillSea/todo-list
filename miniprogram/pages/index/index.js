Page({
  data: {
    isRegistered: false,
    currentCategory: 'all',
    categories: [
      { _id: 'all', name: '全部', color: '#1989fa' },
      { _id: 'personal', name: '个人', color: '#07c160' },
      { _id: 'work', name: '工作', color: '#ff976a' }
    ],
    tasks: [
      { _id: 'task_001', title: '完成项目文档', description: '需要完成项目的技术文档编写', dueDate: '2026-03-14 18:00', priority: 4, status: 0, repeatType: 0, repeatValue: '', categoryId: 'work', reminderAt: null, reminderSent: false, listId: '', creatorId: 'user_001', createdAt: '2026-03-10T10:00:00Z', updatedAt: '2026-03-10T10:00:00Z' },
      { _id: 'task_002', title: '购买生活用品', description: '', dueDate: '2026-03-15 12:00', priority: 3, status: 0, repeatType: 0, repeatValue: '', categoryId: 'personal', reminderAt: null, reminderSent: false, listId: '', creatorId: 'user_001', createdAt: '2026-03-10T10:00:00Z', updatedAt: '2026-03-10T10:00:00Z' },
      { _id: 'task_003', title: '参加团队会议', description: '参加每周团队例会', dueDate: '2026-03-13 14:00', priority: 2, status: 0, repeatType: 1, repeatValue: '1,3,5', categoryId: 'work', reminderAt: '2026-03-13 13:30', reminderSent: false, listId: '', creatorId: 'user_001', createdAt: '2026-03-10T10:00:00Z', updatedAt: '2026-03-10T10:00:00Z' },
      { _id: 'task_004', title: '阅读技术书籍', description: '阅读《JavaScript高级程序设计》', dueDate: '2026-03-20 22:00', priority: 1, status: 0, repeatType: 0, repeatValue: '', categoryId: 'personal', reminderAt: null, reminderSent: false, listId: '', creatorId: 'user_001', createdAt: '2026-03-10T10:00:00Z', updatedAt: '2026-03-10T10:00:00Z' },
      { _id: 'task_005', title: '提交周报', description: '提交本周工作总结', dueDate: '2026-03-12 17:00', priority: 4, status: 1, repeatType: 1, repeatValue: '5', categoryId: 'work', reminderAt: '2026-03-12 16:00', reminderSent: true, listId: '', creatorId: 'user_001', createdAt: '2026-03-10T10:00:00Z', updatedAt: '2026-03-10T10:00:00Z' }
    ],
    inProgressTasks: [],
    overdueTasks: [],
    completedTasks: [],
    categoryTasks: [],
    categoryInProgressTasks: [],
    categoryOverdueTasks: [],
    categoryCompletedTasks: []
  },

  onLoad: function (options) {
    const isRegistered = wx.getStorageSync('isRegistered') || false;
    this.setData({ isRegistered });
    this.processTasks();
  },

  onShow: function () {
    const isRegistered = wx.getStorageSync('isRegistered') || false;
    this.setData({ isRegistered });
  },

  processTasks: function () {
    //TODO: 从数据库中读取数据
    const tasks = this.data.tasks;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 构造 tasks 集合
    const processedTasks = tasks.map(task => {
      const dueDate = new Date(task.dueDate);
      const dueDateOnly = new Date(task.dueDate);
      dueDateOnly.setHours(0, 0, 0, 0);
      // status: 0-未完成，1-已完成，2-逾期
      const isOverdue = dueDateOnly < today && task.status === 0;
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

    // 构造不同分类的 tasks 集合: 正在进行、已过期、已完成
    // status: 0-未完成，1-已完成，2-逾期
    const inProgressTasks = processedTasks.filter(task => task.status === 0 && !task.isOverdue);
    const overdueTasks = processedTasks.filter(task => task.status === 0 && task.isOverdue);
    const completedTasks = processedTasks.filter(task => task.status === 1);

    // 分类任务的三个分组
    let categoryInProgressTasks = [];
    let categoryOverdueTasks = [];
    let categoryCompletedTasks = [];

    if (this.data.currentCategory !== 'all') {
      const categoryTasks = processedTasks.filter(task => task.categoryId === this.data.currentCategory);
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

  onTaskComplete: function (e) {
    const taskId = e.currentTarget.dataset.id;
    const tasks = this.data.tasks.map(task => {
      if (task._id === taskId) {
        // status: 0-未完成，1-已完成
        return { ...task, status: e.detail ? 1 : 0 };
      }
      return task;
    });
    this.setData({ tasks });
    this.processTasks();
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
