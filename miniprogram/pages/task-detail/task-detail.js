// 引入公共 mixin
const taskMixin = require('../../mixins/taskMixin');
const app = getApp();

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
      hasDueTime: false,
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

    reminderIndex: [0, 0],
    deleteScope: 'single',
    deleteDialogTitle: '确认删除',
    deleteDialogMessage: '删除后无法恢复，确定要删除此任务吗？'
  },

  onLoad: function (options) {
    const { id } = options;

    this.setData({
      isNewTask: !id,
      taskId: id || null,
      canUseCategory: true
    });

    this.resetAttachmentSessionState([]);

    // 加载可选清单。分类是否需要加载取决于任务实际所属上下文。
    this.loadAvailableLists();

    // 如果是编辑模式，加载任务数据
    if (id) {
      this.loadTask(id);
    } else {
      this.loadAvailableCategories();
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
    const formData = this.buildTaskFormData(task);
    const currentListContext = task.listInfo
      ? {
        _id: task.listInfo._id,
        name: task.listInfo.name,
        isShared: !!task.listInfo.isShared
      }
      : null;
    const canUseCategory = !(currentListContext && currentListContext.isShared);

    this.setData({
      currentListContext,
      canUseCategory,
      availableCategories: canUseCategory ? this.data.availableCategories : [],
      showCategoryPopup: false,
      task: {
        ...formData.task,
        categoryId: canUseCategory ? formData.task.categoryId : '',
        categoryName: canUseCategory ? formData.task.categoryName : '',
        categoryColor: canUseCategory ? formData.task.categoryColor : ''
      },
      weekdays: formData.weekdays,
      monthdays: formData.monthdays,
      reminderIndex: formData.reminderIndex
    });

    if (canUseCategory) {
      this.loadAvailableCategories();
    }

    // 加载附件
    this.loadAttachments(task.attachments || []);
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
  buildTaskFormData: taskMixin.buildTaskFormData,
  buildDeleteDialogConfig: taskMixin.buildDeleteDialogConfig,
  isPeriodicTask: taskMixin.isPeriodicTask,
  getDueTimeDisplayText: taskMixin.getDueTimeDisplayText,
  handleTaskSaveResponse: taskMixin.handleTaskSaveResponse,
  showConfirmModal: taskMixin.showConfirmModal,
  loadAttachments: taskMixin.loadAttachments,
  resetAttachmentSessionState: taskMixin.resetAttachmentSessionState,
  cleanupUncommittedAttachments: taskMixin.cleanupUncommittedAttachments,
  cleanupRemovedSessionAttachmentsAfterSave: taskMixin.cleanupRemovedSessionAttachmentsAfterSave,
  clearDueTime: taskMixin.clearDueTime,

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

      const resultData = await this.handleTaskSaveResponse(
        result.result,
        action,
        params,
        isNewTask ? '创建成功' : '保存成功',
        isNewTask ? '创建中...' : '保存中...'
      );
      if (resultData && resultData.code === -2) {
        return;
      }

      if (resultData && resultData.code !== 0) {
        throw new Error(resultData.message || '操作失败');
      }
    } catch (error) {
      console.error(isNewTask ? '创建任务失败:' : '保存任务失败:', error);
      if (error.message !== '已取消') {
        wx.showToast({
          title: error.message || '操作失败',
          icon: 'none'
        });
      }
    } finally {
      wx.hideLoading();
    }
  },

  // 删除任务
  onDelete() {
    if (this.isPeriodicTask(this.data.task)) {
      wx.showActionSheet({
        itemList: ['删除本次', '删除整个周期'],
        success: (res) => {
          const deleteScope = res.tapIndex === 0 ? 'single' : 'series';
          this.openDeleteDialog(deleteScope);
        }
      });
      return;
    }

    this.openDeleteDialog('single');
  },

  openDeleteDialog(deleteScope) {
    const dialogConfig = this.buildDeleteDialogConfig(this.data.task, deleteScope);
    this.setData({
      deleteScope,
      showDeleteDialog: true,
      ...dialogConfig
    });
  },

  onDeleteDialogClose() {
    this.setData({ showDeleteDialog: false });
  },

  async onDeleteConfirm() {
    this.setData({ showDeleteDialog: false });
    return this.deleteTask();
  },

  // 执行删除
  async deleteTask() {
    wx.showLoading({ title: '删除中...' });

    try {
      const result = await wx.cloud.callFunction({
        name: 'taskFunctions',
        data: {
          action: 'deleteTask',
          data: {
            taskId: this.data.taskId,
            deleteScope: this.data.deleteScope
          }
        }
      });

      if (result.result && result.result.code === 0) {
        app.clearTaskCaches();
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
  },

  onUnload() {
    this.cleanupUncommittedAttachments();
  }
});
