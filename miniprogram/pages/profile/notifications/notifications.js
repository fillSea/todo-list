const app = getApp();

Page({
  data: {
    // 通知列表
    notifications: [],
    isLoggedIn: false,
    // 加载状态
    loading: false,
    // 是否还有更多数据
    hasMore: true,
    // 当前页码
    page: 1,
    // 每页数量
    pageSize: 10,
    // 当前选中的通知类型筛选
    currentType: 'all',
    // 通知类型
    typeOptions: [
      { value: 'all', label: '全部' },
      { value: 'task_assigned', label: '任务分配' },
      { value: 'task_updated', label: '任务更新' },
      { value: 'list_shared', label: '清单共享' },
      { value: 'deadline_reminder', label: '截止提醒' },
      { value: 'task_reminder', label: '任务提醒' }
    ]
  },

  onLoad: function () {
    this.syncLoginState();
  },

  onShow: function () {
    this.syncLoginState();
  },

  onPullDownRefresh: function () {
    if (!this.data.isLoggedIn) {
      wx.stopPullDownRefresh();
      return;
    }

    this.setData({ page: 1, hasMore: true });
    this.loadNotifications().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom: function () {
    if (this.data.isLoggedIn && this.data.hasMore && !this.data.loading) {
      this.loadMoreNotifications();
    }
  },

  syncLoginState: function () {
    const { isLoggedIn } = app.getLoginState();

    if (!isLoggedIn) {
      this.setData({
        isLoggedIn: false,
        notifications: [],
        loading: false,
        hasMore: false,
        page: 1
      });
      return;
    }

    this.setData({ isLoggedIn: true });
    this.loadNotifications();
  },

  // 加载通知列表
  loadNotifications: async function () {
    if (!this.data.isLoggedIn) return;

    this.setData({ loading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'profileFunctions',
        data: {
          action: 'getNotifications',
          data: {
            type: this.data.currentType,
            page: 1,
            pageSize: this.data.pageSize
          }
        }
      });

      if (res.result && res.result.code === 0) {
        const notifications = this.enrichNotifications(res.result.data);
        const total = res.result.total || 0;
        this.setData({
          notifications,
          hasMore: notifications.length < total,
          page: 1
        });
      } else {
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('加载通知失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 加载更多通知
  loadMoreNotifications: async function () {
    if (!this.data.isLoggedIn || this.data.loading || !this.data.hasMore) return;

    this.setData({ loading: true });
    const nextPage = this.data.page + 1;

    try {
      const res = await wx.cloud.callFunction({
        name: 'profileFunctions',
        data: {
          action: 'getNotifications',
          data: {
            type: this.data.currentType,
            page: nextPage,
            pageSize: this.data.pageSize
          }
        }
      });

      if (res.result && res.result.code === 0) {
        const newNotifications = this.enrichNotifications(res.result.data);
        const allNotifications = [...this.data.notifications, ...newNotifications];
        const total = res.result.total || 0;
        this.setData({
          notifications: allNotifications,
          hasMore: allNotifications.length < total,
          page: nextPage
        });
      }
    } catch (error) {
      console.error('加载更多通知失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 切换通知类型
  onTypeChange: function (e) {
    if (!this.data.isLoggedIn) return;

    const type = e.currentTarget.dataset.type;
    this.setData({ currentType: type, page: 1, hasMore: true });
    this.loadNotifications();
  },

  // 点击通知
  onNotificationTap: function (e) {
    if (!this.data.isLoggedIn) return;

    const notification = e.currentTarget.dataset.item;

    // 标记为已读
    if (!notification.isRead) {
      this.markAsRead(notification._id);
    }

    // 根据通知类型跳转到对应页面
    switch (notification.type) {
      case 'task_assigned':
      case 'task_updated':
      case 'task_reminder':
        if (notification.relatedId) {
          wx.navigateTo({
            url: `/pages/task-detail/task-detail?id=${notification.relatedId}`
          });
        }
        break;
      case 'list_shared':
        if (notification.relatedId) {
          wx.navigateTo({
            url: `/pages/list-detail/list-detail?id=${notification.relatedId}`
          });
        }
        break;
      case 'deadline_reminder':
        wx.switchTab({
          url: '/pages/index/index'
        });
        break;
    }
  },

  // 标记单条通知为已读
  markAsRead: async function (notificationId) {
    if (!this.data.isLoggedIn) return;

    try {
      const res = await wx.cloud.callFunction({
        name: 'profileFunctions',
        data: {
          action: 'markNotificationAsRead',
          data: { notificationId }
        }
      });

      if (res.result && res.result.code === 0) {
        // 更新本地状态
        const notifications = this.data.notifications.map(item => {
          if (item._id === notificationId) {
            return { ...item, isRead: true };
          }
          return item;
        });
        this.setData({ notifications });
      }
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  },

  // 标记所有通知为已读
  onMarkAllRead: async function () {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({
        url: '/pages/register/register'
      });
      return;
    }

    try {
      wx.showLoading({ title: '处理中...' });

      const res = await wx.cloud.callFunction({
        name: 'profileFunctions',
        data: {
          action: 'markAllNotificationsAsRead'
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 0) {
        wx.showToast({
          title: '已全部标记为已读',
          icon: 'success'
        });
        // 更新本地状态
        const notifications = this.data.notifications.map(item => ({
          ...item,
          isRead: true
        }));
        this.setData({ notifications });
      } else {
        wx.showToast({
          title: res.result?.message || '操作失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('标记全部已读失败:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  // 删除通知
  onDeleteNotification: function (e) {
    if (!this.data.isLoggedIn) return;

    const notificationId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条通知吗？',
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (res.confirm) {
          this.deleteNotification(notificationId);
        }
      }
    });
  },

  // 执行删除
  deleteNotification: async function (notificationId) {
    if (!this.data.isLoggedIn) return;

    try {
      const res = await wx.cloud.callFunction({
        name: 'profileFunctions',
        data: {
          action: 'deleteNotification',
          data: { notificationId }
        }
      });

      if (res.result && res.result.code === 0) {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        // 从列表中移除
        const notifications = this.data.notifications.filter(item => item._id !== notificationId);
        this.setData({ notifications });
      } else {
        wx.showToast({
          title: res.result?.message || '删除失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('删除通知失败:', error);
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    }
  },

  // 获取通知类型文本
  getNotificationTypeText: function (type) {
    const typeMap = {
      'task_assigned': '任务分配',
      'task_updated': '任务更新',
      'list_shared': '清单共享',
      'deadline_reminder': '截止提醒',
      'task_reminder': '任务提醒'
    };
    return typeMap[type] || '系统通知';
  },

  // 获取通知图标
  getNotificationIcon: function (type) {
    const iconMap = {
      'task_assigned': 'todo-list-o',
      'task_updated': 'edit',
      'list_shared': 'share-o',
      'deadline_reminder': 'clock-o',
      'task_reminder': 'bell'
    };
    return iconMap[type] || 'info-o';
  },

  // 为通知数据补充图标名和类型文本（wxml 无法直接调用 JS 方法）
  enrichNotifications: function (list) {
    return list.map(item => ({
      ...item,
      iconName: this.getNotificationIcon(item.type),
      typeText: this.getNotificationTypeText(item.type)
    }));
  }
});
