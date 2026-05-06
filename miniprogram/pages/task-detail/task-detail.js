import Dialog from '@vant/weapp/dialog/dialog';

// 引入公共 mixin
const taskMixin = require('../../mixins/taskMixin');

Page({
  data: {
    ...taskMixin.data,

    // 是否是新建任务
    isNewTask: false,
    taskId: null,

    // 任务数据
    task: {
      _id: '',
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
      repeatValue: '',
      status: 0
    },

    reminderIndex: [0, 0]
  },

  onLoad: function (options) {
    const { id } = options;

    this.setData({
      isNewTask: !id,
      taskId: id || null
    });

    // 加载可选清单和分类
    this.loadAvailableLists();
    this.loadAvailableCategories();

    // 如果是编辑模式，加载任务数据
    if (id) {
      this.loadTask(id);
    }
  },

  // 加载任务数据
  async loadTask(taskId) {
    wx.showLoading({ title: '加载中...' });

    try {
      const result = await wx.cloud.callFunction({
        name: 'taskFunctions',
        data: {
          action: 'getTaskDetail',
          data: { taskId }
        }
      });

      if (result.result && result.result.code === 0) {
        this.setTaskData(result.result.data);
      } else {
        throw new Error(result.result?.message || '加载失败');
      }
    } catch (error) {
      console.error('加载任务失败:', error);
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 设置任务数据到页面
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
        _id: task._id,
        title: task.title,
        description: task.description || '',
        listId: task.listId || '',
        listName: task.listInfo ? task.listInfo.name : '',
        dueDate: dueDate,
        dueTime: dueTime,
        priority: task.priority || 1,
        categoryId: task.categoryId || '',
        categoryName: task.categoryInfo ? task.categoryInfo.name : '',
        categoryColor: task.categoryInfo ? task.categoryInfo.color : '',
        reminderText: reminderText,
        reminderValue: reminderValue,
        repeatType: task.repeatType || 0,
        repeatValue: task.repeatValue || '',
        status: task.status || 0
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

  // ==================== 从 mixin 引入的方法 ====================

  // 数据加载
  loadAvailableLists: taskMixin.loadAvailableLists,
  loadAvailableCategories: taskMixin.loadAvailableCategories,

  // 表单输入处理
  onTitleInput: taskMixin.onTitleInput,
  onDescInput: taskMixin.onDescInput,
  onDueDateChange: taskMixin.onDueDateChange,
  onDueTimeChange: taskMixin.onDueTimeChange,
  onPriorityChange: taskMixin.onPriorityChange,
  onRepeatTypeChange: taskMixin.onRepeatTypeChange,
  onWeekdayToggle: taskMixin.onWeekdayToggle,
  onMonthdayToggle: taskMixin.onMonthdayToggle,
  onReminderChange: taskMixin.onReminderChange,

  // 清单选择
  onSelectList: taskMixin.onSelectList,
  onListPopupClose: taskMixin.onListPopupClose,
  onListSelect: taskMixin.onListSelect,

  // 分类选择
  onSelectCategory: taskMixin.onSelectCategory,
  onCategoryPopupClose: taskMixin.onCategoryPopupClose,
  onCategorySelect: taskMixin.onCategorySelect,

  // 工具方法
  formatDate: taskMixin.formatDate,
  formatTime: taskMixin.formatTime,
  parseReminder: taskMixin.parseReminder,
  parseRepeat: taskMixin.parseRepeat,
  validateForm: taskMixin.validateForm,
  buildSaveParams: taskMixin.buildSaveParams,

  // 附件方法
  onAddAttachment: taskMixin.onAddAttachment,
  chooseImage: taskMixin.chooseImage,
  chooseFile: taskMixin.chooseFile,
  uploadFiles: taskMixin.uploadFiles,
  onPreviewAttachment: taskMixin.onPreviewAttachment,
  onDeleteAttachment: taskMixin.onDeleteAttachment,
  getFileType: taskMixin.getFileType,
  formatFileSize: taskMixin.formatFileSize,

  // ==================== 表单输入处理（覆盖 mixin 方法）====================

  // 任务状态切换
  onStatusChange(e) {
    this.setData({
      'task.status': e.detail ? 1 : 0
    });
  },

  // 标题变更（覆盖 mixin 的 onTitleInput）
  onTitleChange(e) {
    this.setData({ 'task.title': e.detail.value });
  },

  // 描述变更（覆盖 mixin 的 onDescInput）
  onDescriptionChange(e) {
    this.setData({ 'task.description': e.detail.value });
  },

  // ==================== 保存和删除 ====================

  // 取消
  onCancel() {
    wx.navigateBack();
  },

  // 保存任务
  async onSave() {
    const { task, isNewTask, taskId } = this.data;

    // 表单验证
    if (!this.validateForm(task)) {
      return;
    }

    wx.showLoading({ title: isNewTask ? '创建中...' : '保存中...' });

    try {
      const action = isNewTask ? 'createTask' : 'updateTask';
      const params = this.buildSaveParams(task, taskId, !isNewTask);

      const result = await wx.cloud.callFunction({
        name: 'taskFunctions',
        data: { action, data: params }
      });

      if (result.result && result.result.code === 0) {
        // 检查是否需要确认完成过期任务
        if (result.result.data && result.result.data.needConfirmComplete) {
          wx.hideLoading();
          wx.showModal({
            title: '提示',
            content: '任务已过期，是否确认完成？',
            confirmText: '确定',
            cancelText: '取消',
            success: async (res) => {
              if (res.confirm) {
                wx.showLoading({ title: '保存中...' });
                try {
                  const confirmResult = await wx.cloud.callFunction({
                    name: 'taskFunctions',
                    data: {
                      action,
                      data: { ...params, confirmCompleteOverdue: true }
                    }
                  });
                  if (confirmResult.result && confirmResult.result.code === 0) {
                    wx.showToast({
                      title: isNewTask ? '创建成功' : '保存成功',
                      icon: 'success'
                    });
                    setTimeout(() => {
                      wx.navigateBack();
                    }, 1500);
                  } else {
                    throw new Error(confirmResult.result?.message || '操作失败');
                  }
                } catch (error) {
                  wx.showToast({
                    title: error.message || '操作失败',
                    icon: 'none'
                  });
                } finally {
                  wx.hideLoading();
                }
              } else {
                // 用户取消，保持原状态
                this.setData({ 'task.status': task.status });
              }
            }
          });
        } else {
          wx.showToast({
            title: isNewTask ? '创建成功' : '保存成功',
            icon: 'success'
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      } else {
        throw new Error(result.result?.message || '操作失败');
      }
    } catch (error) {
      console.error(isNewTask ? '创建任务失败:' : '保存任务失败:', error);
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
    Dialog.confirm({
      title: '确认删除',
      message: '确定要删除这个任务吗？删除后无法恢复。'
    }).then(() => {
      this.deleteTask();
    }).catch(() => {
      // 取消删除
    });
  },

  // 执行删除
  async deleteTask() {
    wx.showLoading({ title: '删除中...' });

    try {
      const result = await wx.cloud.callFunction({
        name: 'taskFunctions',
        data: {
          action: 'deleteTask',
          data: { taskId: this.data.taskId }
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
