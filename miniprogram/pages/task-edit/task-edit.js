const app = getApp();

// 调试模式开关
const DEBUG_MODE = false;

// 引入公共 mixin
const taskMixin = require('../../mixins/taskMixin');

Page({
  ...taskMixin,

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
      'task.listId': listId || '',
      'task.listName': currentListContext ? currentListContext.name : '',
      'task.dueDate': dueDate || ''
    });

    this.resetAttachmentSessionState([]);

    // 加载可选清单和分类
    this.loadAvailableLists().then(() => {
      // 清单列表加载完成后，设置默认清单
      if (!id && listId) {
        this.setDefaultList(listId, currentListContext);
      }
    });
    this.loadAvailableCategories();

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

        const resultData = await this.submitTaskWithConfirm(action, params, isEditing ? '保存成功' : '创建成功');
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

    if (task.repeatType > 0) {
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
    const isSeries = deleteScope === 'series';
    this.setData({
      deleteScope,
      showDeleteDialog: true,
      deleteDialogTitle: isSeries ? '确认删除整个周期' : '确认删除',
      deleteDialogMessage: isSeries
        ? '确定删除整个周期任务吗？该周期下所有任务实例将一并删除。'
        : (this.data.task.repeatType > 0
          ? '确定删除本次任务吗？后续周期任务将保留。'
          : '删除后无法恢复，确定要删除此任务吗？')
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

  async submitTaskWithConfirm(action, params, successTitle) {
    const result = await wx.cloud.callFunction({
      name: 'taskFunctions',
      data: { action, data: params }
    });
    const resultData = result.result;

    if (!resultData || resultData.code !== 0) {
      return resultData;
    }

    const confirmPayload = resultData.data || {};

    if (confirmPayload.needConfirmComplete) {
      wx.hideLoading();
      const confirmed = await this.showConfirmModal('提示', '任务已过期，是否确认完成？', '确定');
      if (!confirmed) {
        return { code: -2, message: '已取消' };
      }
      wx.showLoading({ title: this.data.isEditing ? '保存中...' : '创建中...' });
      return this.submitTaskWithConfirm(action, { ...params, confirmCompleteOverdue: true }, successTitle);
    }

    if (confirmPayload.needConfirmCompleteNotToday) {
      wx.hideLoading();
      const confirmed = await this.showConfirmModal('提示', confirmPayload.confirmMessage || '只能完成当天的周期任务', '去查看');
      if (confirmed && confirmPayload.dueDate) {
        wx.setStorageSync('jumpToDate', confirmPayload.dueDate);
        wx.switchTab({ url: '/pages/calendar/calendar' });
      }
      return { code: -2, message: '已取消' };
    }

    if (confirmPayload.needConfirmUncheck) {
      wx.hideLoading();
      const confirmed = await this.showConfirmModal('提示', confirmPayload.confirmMessage || '确定要取消完成此任务吗？', '确认');
      if (!confirmed) {
        return { code: -2, message: '已取消' };
      }
      wx.showLoading({ title: this.data.isEditing ? '保存中...' : '创建中...' });
      return this.submitTaskWithConfirm(action, { ...params, confirmUncheck: true }, successTitle);
    }

    await this.cleanupRemovedSessionAttachmentsAfterSave();
    this.setData({ hasSavedSuccessfully: true });
    app.clearTaskCaches();
    wx.showToast({
      title: successTitle,
      icon: 'success'
    });
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
    return resultData;
  },

  showConfirmModal(title, content, confirmText) {
    return new Promise((resolve) => {
      wx.showModal({
        title,
        content,
        confirmText,
        cancelText: '取消',
        success: (res) => resolve(!!res.confirm),
        fail: () => resolve(false)
      });
    });
  },

  onUnload() {
    this.cleanupUncommittedAttachments();
  }
});
