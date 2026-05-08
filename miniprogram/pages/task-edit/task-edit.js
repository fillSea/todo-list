const app = getApp();

// 调试模式开关
const DEBUG_MODE = false;

// 引入公共 mixin
const taskMixin = require('../../mixins/taskMixin');

Page({
  ...taskMixin,

  loadAvailableLists: taskMixin.loadAvailableLists,
  loadAvailableCategories: taskMixin.loadAvailableCategories,
  buildTaskFormData: taskMixin.buildTaskFormData,
  buildDeleteDialogConfig: taskMixin.buildDeleteDialogConfig,
  isPeriodicTask: taskMixin.isPeriodicTask,
  clearDueTime: taskMixin.clearDueTime,
  handleTaskSaveResponse: taskMixin.handleTaskSaveResponse,
  showConfirmModal: taskMixin.showConfirmModal,

  data: {
    ...taskMixin.data,

    statusBarHeight: 0,
    navBarHeight: 44,
    headerSideWidth: 40,

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
      hasDueTime: false,
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

    deleteScope: 'single',
    deleteDialogTitle: '确认删除',
    deleteDialogMessage: '删除后无法恢复，确定要删除此任务吗？',

    // 用户信息
    userInfo: null
  },

  onLoad: function (options) {
    const { id, listId, listName = '', listShared = '', dueDate = '' } = options;
    const userInfo = wx.getStorageSync('userInfo');
    const { statusBarHeight, navBarHeight, headerSideWidth } = this.getCustomNavMetrics();
    const currentListContext = listId ? {
      _id: listId,
      name: decodeURIComponent(listName || ''),
      isShared: listShared === '1'
    } : null;
    const lockListSelection = !!listId && !id;

    this.setData({
      statusBarHeight,
      navBarHeight,
      headerSideWidth,
      userInfo,
      isEditing: !!id,
      taskId: id || null,
      listId: listId || null,
      currentListContext,
      lockListSelection,
      canUseCategory: !(currentListContext && currentListContext.isShared),
      'task.listId': listId || '',
      'task.listName': currentListContext ? currentListContext.name : '',
      'task.dueDate': dueDate || ''
    });

    this.resetAttachmentSessionState([]);

    // 加载可选清单。编辑态分类可用性依赖任务实际所属上下文。
    this.loadAvailableLists().then(() => {
      // 清单列表加载完成后，设置默认清单
      if (!id && listId) {
        this.setDefaultList(listId, currentListContext);
      }
    });
    if (!id && !(currentListContext && currentListContext.isShared)) {
      this.loadAvailableCategories();
    }

    // 如果是编辑模式，加载任务数据
    if (id) {
      this.loadTaskData(id);
    }
  },

  getCustomNavMetrics() {
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight || 0;
    const menuButton = typeof wx.getMenuButtonBoundingClientRect === 'function'
      ? wx.getMenuButtonBoundingClientRect()
      : null;
    const navBarHeight = menuButton && menuButton.height
      ? menuButton.height + Math.max((menuButton.top - statusBarHeight) * 2, 0)
      : 44;
    const capsuleWidth = menuButton && systemInfo.windowWidth
      ? Math.max(systemInfo.windowWidth - menuButton.left, 0)
      : 0;
    const leftActionWidth = 40;

    return {
      statusBarHeight,
      navBarHeight,
      headerSideWidth: Math.max(leftActionWidth, capsuleWidth + 8)
    };
  },

  // 设置默认清单
  setDefaultList(listId, fallbackList = null) {
    const list = this.data.availableLists.find(item => item._id === listId) || fallbackList;
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
        await this.cleanupRemovedSessionAttachmentsAfterSave();
        this.setData({ hasSavedSuccessfully: true });
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
        const resultData = await this.handleTaskSaveResponse(
          result.result,
          action,
          params,
          isEditing ? '保存成功' : '创建成功',
          isEditing ? '保存中...' : '创建中...'
        );
        if (resultData && resultData.code === -2) {
          return;
        }

        if (resultData && resultData.code !== 0) {
          throw new Error(resultData.message || '操作失败');
        }
      }
    } catch (error) {
      console.error(isEditing ? '保存任务失败:' : '创建任务失败:', error);
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
    const { task } = this.data;

    if (this.isPeriodicTask(task)) {
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

  // 关闭删除弹窗
  onDeleteDialogClose() {
    this.setData({ showDeleteDialog: false });
  },

  // 确认删除
  async onDeleteConfirm() {
    const { taskId, deleteScope } = this.data;
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
            data: { taskId, deleteScope }
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
