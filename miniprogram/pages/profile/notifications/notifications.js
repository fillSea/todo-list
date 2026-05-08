const app = getApp();

const NOTIFICATION_TYPE_CONFIG = {
  list_invite: {
    text: '清单邀请',
    icon: 'friends-o'
  },
  invite_remind: {
    text: '邀请提醒',
    icon: 'bell'
  },
  join_request: {
    text: '加入申请',
    icon: 'user-o'
  },
  application_approved: {
    text: '申请通过',
    icon: 'success'
  },
  application_rejected: {
    text: '申请被拒',
    icon: 'close'
  },
  task_reminder: {
    text: '任务提醒',
    icon: 'bell'
  }
};

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
      { value: 'list_invite', label: '清单邀请' },
      { value: 'invite_remind', label: '邀请提醒' },
      { value: 'join_request', label: '加入申请' },
      { value: 'application_approved', label: '申请通过' },
      { value: 'application_rejected', label: '申请被拒' },
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
      case 'task_reminder':
        if (notification.relatedId) {
          wx.navigateTo({
            url: `/pages/task-detail/task-detail?id=${notification.relatedId}`
          });
        }
        break;
      case 'list_invite':
      case 'invite_remind':
        if (notification.relatedId) {
          wx.navigateTo({
            url: `/pages/list-invite-accept/list-invite-accept?code=${notification.relatedId}`
          });
        }
        break;
      case 'join_request':
        if (notification.relatedId) {
          wx.navigateTo({
            url: `/pages/list-invite-manage/list-invite-manage?listId=${notification.relatedId}`
          });
        }
        break;
      case 'application_approved':
        if (notification.relatedId) {
          wx.navigateTo({
            url: `/pages/list-detail/list-detail?id=${notification.relatedId}`
          });
        }
        break;
      case 'application_rejected':
        wx.showToast({
          title: '你的加入申请未通过',
          icon: 'none'
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
        this.refreshUnreadCount();
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
        await this.refreshUnreadCount();
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
        await this.refreshUnreadCount();
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

  refreshUnreadCount: async function () {
    if (!this.data.isLoggedIn) {
      app.setUnreadNotificationCount(0);
      return 0;
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'profileFunctions',
        data: {
          action: 'getUnreadNotificationCount'
        }
      });

      if (res.result && res.result.code === 0) {
        const count = res.result.data.count;
        app.setUnreadNotificationCount(count);
        return count;
      }
    } catch (error) {
      console.error('刷新未读通知数量失败:', error);
    }

    return app.getUnreadNotificationCount();
  },

  // 获取通知类型文本
  getNotificationTypeText: function (type) {
    return NOTIFICATION_TYPE_CONFIG[type]?.text || '系统通知';
  },

  // 获取通知图标
  getNotificationIcon: function (type) {
    return NOTIFICATION_TYPE_CONFIG[type]?.icon || 'info-o';
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
