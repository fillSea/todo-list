// 调试模式开关
const DEBUG_MODE = true;

Page({
  data: {
    // 是否编辑模式
    isEditing: false,
    taskId: null,
    listId: null,

    // 表单数据
    formData: {
      title: '',
      description: '',
      listId: '',
      listName: '',
      dueDate: '',
      dueTime: '',
      priority: 1,
      categoryId: '',
      categoryName: '',
      categoryColor: '',
      reminderText: '',
      reminderValue: null,
      repeatType: 0,
      repeatValue: ''
    },

    // 提醒选项
    reminderRanges: [
      ['不提醒', '准时', '提前5分钟', '提前15分钟', '提前30分钟', '提前1小时', '提前2小时', '提前1天', '提前2天', '提前1周'],
      ['']
    ],
    reminderIndex: [0, 0],

    // 星期选项
    weekdays: [
      { label: '日', value: 0, selected: false },
      { label: '一', value: 1, selected: false },
      { label: '二', value: 2, selected: false },
      { label: '三', value: 3, selected: false },
      { label: '四', value: 4, selected: false },
      { label: '五', value: 5, selected: false },
      { label: '六', value: 6, selected: false }
    ],

    // 日期选项
    monthdays: Array.from({ length: 31 }, (_, i) => ({
      label: String(i + 1),
      value: i + 1,
      selected: false
    })),

    // 可选清单列表
    availableLists: [],

    // 可选分类列表
    availableCategories: [],

    // 弹窗显示状态
    showListPopup: false,
    showCategoryPopup: false,
    showDeleteDialog: false,

    // 用户信息
    userInfo: null
  },

  onLoad: function (options) {
    const { id, listId } = options;
    const userInfo = wx.getStorageSync('userInfo');

    this.setData({
      userInfo,
      isEditing: !!id,
      taskId: id || null,
      listId: listId || null
    });

    // 加载可选清单和分类
    this.loadAvailableLists();
    this.loadAvailableCategories();

    // 如果是编辑模式，加载任务数据
    if (id) {
      this.loadTaskData(id);
    } else if (listId) {
      // 如果是新建模式且有listId，设置默认清单
      this.setDefaultList(listId);
    }
  },

  // 加载可选清单
  async loadAvailableLists() {
    if (DEBUG_MODE) {
      // 伪造数据
      const mockLists = [
        { _id: 'list_001', name: '工作任务', isShared: true },
        { _id: 'list_002', name: '个人生活', isShared: false },
        { _id: 'list_003', name: '学习计划', isShared: false },
        { _id: 'list_004', name: '团队项目', isShared: true }
      ];
      this.setData({ availableLists: mockLists });
    } else {
      try {
        const result = await wx.cloud.callFunction({
          name: 'getAvailableLists'
        });
        if (result.result && result.result.success) {
          this.setData({ availableLists: result.result.lists });
        }
      } catch (error) {
        console.error('加载清单列表失败:', error);
      }
    }
  },

  // 加载可选分类
  async loadAvailableCategories() {
    if (DEBUG_MODE) {
      // 伪造数据
      const mockCategories = [
        { _id: 'cat_001', name: '工作', color: '#1976D2' },
        { _id: 'cat_002', name: '学习', color: '#4CAF50' },
        { _id: 'cat_003', name: '生活', color: '#FF9800' },
        { _id: 'cat_004', name: '娱乐', color: '#9C27B0' }
      ];
      this.setData({ availableCategories: mockCategories });
    } else {
      try {
        const result = await wx.cloud.callFunction({
          name: 'getCategories'
        });
        if (result.result && result.result.success) {
          this.setData({ availableCategories: result.result.categories });
        }
      } catch (error) {
        console.error('加载分类列表失败:', error);
      }
    }
  },

  // 设置默认清单
  setDefaultList(listId) {
    const list = this.data.availableLists.find(item => item._id === listId);
    if (list) {
      this.setData({
        'formData.listId': list._id,
        'formData.listName': list.name
      });
    }
  },

  // 加载任务数据
  async loadTaskData(taskId) {
    wx.showLoading({ title: '加载中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(500);
        // 伪造任务数据
        const mockTask = {
          _id: taskId,
          title: '示例任务',
          description: '这是一个示例任务描述',
          listId: 'list_001',
          dueDate: '2024-03-20',
          dueTime: '14:00',
          priority: 3,
          categoryId: 'cat_001',
          categoryName: '工作',
          categoryColor: '#1976D2',
          reminderText: '提前30分钟',
          repeatType: 0
        };

        this.setData({
          formData: { ...this.data.formData, ...mockTask }
        });
      } else {
        const result = await wx.cloud.callFunction({
          name: 'getTaskDetail',
          data: { taskId }
        });

        if (result.result && result.result.success) {
          const task = result.result.task;
          this.setData({
            formData: {
              title: task.title,
              description: task.description || '',
              listId: task.listId,
              listName: task.listName,
              dueDate: task.dueDate ? this.formatDate(task.dueDate) : '',
              dueTime: task.dueTime || '',
              priority: task.priority || 1,
              categoryId: task.categoryId || '',
              categoryName: task.categoryName || '',
              categoryColor: task.categoryColor || '',
              reminderText: task.reminderText || '',
              repeatType: task.repeatType || 0,
              repeatValue: task.repeatValue || ''
            }
          });
        }
      }
    } catch (error) {
      console.error('加载任务数据失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 模拟网络延迟
  simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // 格式化日期
  formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // ==================== 表单输入处理 ====================

  // 标题输入
  onTitleInput(e) {
    this.setData({ 'formData.title': e.detail.value });
  },

  // 描述输入
  onDescInput(e) {
    this.setData({ 'formData.description': e.detail.value });
  },

  // 截止日期选择
  onDueDateChange(e) {
    this.setData({ 'formData.dueDate': e.detail.value });
  },

  // 截止时间选择
  onDueTimeChange(e) {
    this.setData({ 'formData.dueTime': e.detail.value });
  },

  // 优先级选择
  onPriorityChange(e) {
    const priority = parseInt(e.currentTarget.dataset.priority);
    this.setData({ 'formData.priority': priority });
  },

  // 重复类型选择
  onRepeatTypeChange(e) {
    const type = parseInt(e.currentTarget.dataset.type);
    this.setData({
      'formData.repeatType': type,
      'formData.repeatValue': ''
    });

    // 重置选择状态
    if (type === 2) {
      const weekdays = this.data.weekdays.map(d => ({ ...d, selected: false }));
      this.setData({ weekdays });
    } else if (type === 3) {
      const monthdays = this.data.monthdays.map(d => ({ ...d, selected: false }));
      this.setData({ monthdays });
    }
  },

  // 星期切换
  onWeekdayToggle(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    const weekdays = [...this.data.weekdays];
    weekdays[index].selected = !weekdays[index].selected;

    const selectedValues = weekdays.filter(d => d.selected).map(d => d.value).join(',');

    this.setData({
      weekdays,
      'formData.repeatValue': selectedValues
    });
  },

  // 日期切换
  onMonthdayToggle(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    const monthdays = [...this.data.monthdays];
    monthdays[index].selected = !monthdays[index].selected;

    const selectedValues = monthdays.filter(d => d.selected).map(d => d.value).join(',');

    this.setData({
      monthdays,
      'formData.repeatValue': selectedValues
    });
  },

  // 提醒时间选择
  onReminderChange(e) {
    const index = e.detail.value;
    const reminderText = this.data.reminderRanges[0][index[0]];
    this.setData({
      reminderIndex: index,
      'formData.reminderText': reminderText,
      'formData.reminderValue': index[0]
    });
  },

  // ==================== 清单选择 ====================

  // 显示清单选择弹窗
  onSelectList() {
    this.setData({ showListPopup: true });
  },

  // 关闭清单选择弹窗
  onListPopupClose() {
    this.setData({ showListPopup: false });
  },

  // 选择清单
  onListSelect(e) {
    const listId = e.currentTarget.dataset.id;
    const list = this.data.availableLists.find(item => item._id === listId);

    this.setData({
      'formData.listId': list._id,
      'formData.listName': list.name,
      showListPopup: false
    });
  },

  // ==================== 分类选择 ====================

  // 显示分类选择弹窗
  onSelectCategory() {
    this.setData({ showCategoryPopup: true });
  },

  // 关闭分类选择弹窗
  onCategoryPopupClose() {
    this.setData({ showCategoryPopup: false });
  },

  // 选择分类
  onCategorySelect(e) {
    const id = e.currentTarget.dataset.id;

    if (!id) {
      // 不设置分类
      this.setData({
        'formData.categoryId': '',
        'formData.categoryName': '',
        'formData.categoryColor': '',
        showCategoryPopup: false
      });
    } else {
      const name = e.currentTarget.dataset.name;
      const color = e.currentTarget.dataset.color;

      this.setData({
        'formData.categoryId': id,
        'formData.categoryName': name,
        'formData.categoryColor': color,
        showCategoryPopup: false
      });
    }
  },

  // ==================== 保存和删除 ====================

  // 取消
  onCancel() {
    wx.navigateBack();
  },

  // 保存
  async onSave() {
    const { formData, isEditing, taskId } = this.data;

    // 表单验证
    if (!formData.title || formData.title.trim().length === 0) {
      wx.showToast({
        title: '请输入任务标题',
        icon: 'none'
      });
      return;
    }

    if (!formData.listId) {
      wx.showToast({
        title: '请选择所属清单',
        icon: 'none'
      });
      return;
    }

    // 验证重复设置
    if (formData.repeatType === 2 && !formData.repeatValue) {
      wx.showToast({
        title: '请选择重复的星期',
        icon: 'none'
      });
      return;
    }

    if (formData.repeatType === 3 && !formData.repeatValue) {
      wx.showToast({
        title: '请选择重复的日期',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: isEditing ? '保存中...' : '创建中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(800);
        wx.showToast({
          title: isEditing ? '保存成功' : '创建成功',
          icon: 'success'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        const cloudFnName = isEditing ? 'updateTask' : 'createTask';
        const params = {
          ...formData,
          title: formData.title.trim(),
          description: formData.description.trim()
        };

        if (isEditing) {
          params.taskId = taskId;
        }

        const result = await wx.cloud.callFunction({
          name: cloudFnName,
          data: params
        });

        if (result.result && result.result.success) {
          wx.showToast({
            title: isEditing ? '保存成功' : '创建成功',
            icon: 'success'
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          throw new Error(result.result?.message || '操作失败');
        }
      }
    } catch (error) {
      console.error(isEditing ? '保存任务失败:' : '创建任务失败:', error);
      wx.showToast({
        title: error.message || '操作失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 删除任务
  onDelete() {
    this.setData({ showDeleteDialog: true });
  },

  // 关闭删除弹窗
  onDeleteDialogClose() {
    this.setData({ showDeleteDialog: false });
  },

  // 确认删除
  async onDeleteConfirm() {
    const { taskId } = this.data;
    this.setData({ showDeleteDialog: false });

    wx.showLoading({ title: '删除中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(500);
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        const result = await wx.cloud.callFunction({
          name: 'deleteTask',
          data: { taskId }
        });

        if (result.result && result.result.success) {
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          throw new Error(result.result?.message || '删除失败');
        }
      }
    } catch (error) {
      console.error('删除任务失败:', error);
      wx.showToast({
        title: error.message || '删除失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  }
});
