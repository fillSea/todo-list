// 调试模式开关
const DEBUG_MODE = false;

// 引入公共 mixin
const taskMixin = require('../../mixins/taskMixin');

Page({
  ...taskMixin,

  data: {
    ...taskMixin.data,

    // 是否编辑模式
    isEditing: false,
    taskId: null,
    listId: null,

    // 任务数据
    task: {
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
      reminderValue: 0,
      repeatType: 0,
      repeatValue: ''
    },

    reminderIndex: [0, 0],

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
    this.loadAvailableLists().then(() => {
      // 清单列表加载完成后，设置默认清单
      if (!id && listId) {
        this.setDefaultList(listId);
      }
    });
    this.loadAvailableCategories();

    // 如果是编辑模式，加载任务数据
    if (id) {
      this.loadTaskData(id);
    }
  },

  // 设置默认清单
  setDefaultList(listId) {
    const list = this.data.availableLists.find(item => item._id === listId);
    if (list) {
      this.setData({
        'task.listId': list._id,
        'task.listName': list.name
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
          dueDate: '2024-03-20T14:00:00.000Z',
          priority: 3,
          categoryId: 'cat_001',
          categoryName: '工作',
          categoryColor: '#1976D2',
          reminderText: '提前30分钟',
          repeatType: 0
        };
        this.setTaskData(mockTask);
      } else {
        const result = await wx.cloud.callFunction({
          name: 'taskFunctions',
          data: {
            action: 'getTaskDetail',
            data: { taskId }
          }
        });

        if (result.result && result.result.code === 0) {
          this.setTaskData(result.result.data);
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

  // 设置任务数据
  setTaskData(task) {
    // 解析截止日期和时间
    let dueDate = '';
    let dueTime = '';
    if (task.dueDate) {
      const date = new Date(task.dueDate);
      dueDate = this.formatDate(date);
      dueTime = this.formatTime(date);
    }

    // 解析重复设置
    const { weekdays, monthdays } = this.parseRepeat(task, this.data.weekdays, this.data.monthdays);

    // 解析提醒设置
    const { reminderText, reminderValue, reminderIndex } = this.parseReminder(task);

    this.setData({
      task: {
        title: task.title,
        description: task.description || '',
        listId: task.listId || '',
        listName: task.listInfo ? task.listInfo.name : (task.listName || ''),
        dueDate: dueDate,
        dueTime: dueTime,
        priority: task.priority || 1,
        categoryId: task.categoryId || '',
        categoryName: task.categoryInfo ? task.categoryInfo.name : (task.categoryName || ''),
        categoryColor: task.categoryInfo ? task.categoryInfo.color : (task.categoryColor || ''),
        reminderText: reminderText,
        reminderValue: reminderValue,
        repeatType: task.repeatType || 0,
        repeatValue: task.repeatValue || ''
      },
      weekdays,
      monthdays,
      reminderIndex
    });

    // 加载附件
    this.loadAttachments(task.attachments || []);
  },

  // 加载已有附件并获取临时URL
  async loadAttachments(rawAttachments) {
    if (!rawAttachments || rawAttachments.length === 0) {
      this.setData({ attachments: [] });
      return;
    }

    const fileIds = rawAttachments.map(a => a.fileId).filter(Boolean);
    let urlMap = {};
    if (fileIds.length > 0) {
      try {
        const res = await wx.cloud.getTempFileURL({ fileList: fileIds });
        res.fileList.forEach(f => {
          urlMap[f.fileID] = f.tempFileURL;
        });
      } catch (e) {
        console.error('获取附件URL失败:', e);
      }
    }

    const attachments = rawAttachments.map(a => ({
      ...a,
      url: urlMap[a.fileId] || '',
      sizeText: this.formatFileSize(a.size)
    }));
    this.setData({ attachments });
  },

  // 模拟网络延迟
  simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // ==================== 保存和删除 ====================

  // 取消
  onCancel() {
    wx.navigateBack();
  },

  // 保存
  async onSave() {
    const { task, isEditing, taskId } = this.data;

    // 表单验证
    if (!this.validateForm(task)) {
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
        const action = isEditing ? 'updateTask' : 'createTask';
        const params = this.buildSaveParams(task, taskId, isEditing);

        const result = await wx.cloud.callFunction({
          name: 'taskFunctions',
          data: { action, data: params }
        });

        if (result.result && result.result.code === 0) {
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
          name: 'taskFunctions',
          data: {
            action: 'deleteTask',
            data: { taskId }
          }
        });

        if (result.result && result.result.code === 0) {
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
