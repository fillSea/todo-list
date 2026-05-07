const app = getApp();

Page({
  data: {
    // 用户信息
    userInfo: null,
    isLogin: false,

    // 快捷统计数据
    statistics: {
      myLists: 0,
      sharedLists: 0,
      completedTasks: 0
    },

    // 数据看板
    dashboardData: {
      pieChart: {
        completed: 0,
        uncompleted: 0,
        overdue: 0,
        total: 0
      },
      barChart: []
    },

    // 未读通知数量
    unreadCount: 0,

    // 功能列表
    featureList: [
      { icon: 'orders-o', name: '我的清单', path: '/pages/profile/my-lists/my-lists', badge: 0 },
      { icon: 'label-o', name: '分类标签', path: '/pages/profile/categories/categories', badge: 0 },
      { icon: 'bell', name: '我的通知', path: '/pages/profile/notifications/notifications', badge: 0 },
      { icon: 'setting-o', name: '通知设置', path: '/pages/profile/notification-settings/notification-settings', badge: 0 },
      { icon: 'question-o', name: '帮助中心', path: '/pages/profile/help/help', badge: 0 },
      { icon: 'info-o', name: '关于我们', path: '/pages/profile/about/about', badge: 0 }
    ],

    // 加载状态
    loading: {
      userInfo: false,
      statistics: false,
      dashboard: false,
      notifications: false
    },

    expiredToastShown: false
  },

  onLoad: function (options) {
    this.checkLoginStatus();
  },

  onShow: function () {
    this.checkLoginStatus();
  },

  onPullDownRefresh: function () {
    if (!this.data.isLogin) {
      wx.stopPullDownRefresh();
      return;
    }

    wx.showLoading({ title: '刷新中...' });

    this.loadAllData().finally(() => {
      wx.hideLoading();
      wx.stopPullDownRefresh();
      wx.showToast({
        title: '刷新成功',
        icon: 'success'
      });
    });
  },

  // 检查登录状态
  checkLoginStatus: function () {
    const { isLoggedIn, userInfo } = app.getLoginState();

    if (!isLoggedIn) {
      this.resetGuestView();

      const loginExpired = wx.getStorageSync('loginExpired');
      if (loginExpired && !this.data.expiredToastShown) {
        wx.removeStorageSync('loginExpired');
        this.setData({ expiredToastShown: true });
        wx.showToast({
          title: '资料状态已过期',
          icon: 'none'
        });
      }

      return;
    }

    this.setData({
      isLogin: isLoggedIn,
      userInfo: userInfo,
      expiredToastShown: false
    });

    this.loadAllData();
  },

  resetGuestView: function () {
    const featureList = this.data.featureList.map(item => ({ ...item, badge: 0 }));

    this.setData({
      isLogin: false,
      userInfo: null,
      statistics: {
        myLists: 0,
        sharedLists: 0,
        completedTasks: 0
      },
      dashboardData: {
        pieChart: {
          completed: 0,
          uncompleted: 0,
          overdue: 0,
          total: 0
        },
        barChart: []
      },
      unreadCount: 0,
      maxBarValue: 1,
      featureList,
      loading: {
        userInfo: false,
        statistics: false,
        dashboard: false,
        notifications: false
      }
    });

    wx.removeTabBarBadge({ index: 3 });
  },

  // 加载所有数据
  loadAllData: async function () {
    if (!this.data.isLogin) return;

    this.setData({
      'loading.userInfo': true,
      'loading.statistics': true,
      'loading.dashboard': true,
      'loading.notifications': true
    });

    try {
      await Promise.all([
        this.loadUserInfo(),
        this.loadStatistics(),
        this.loadDashboardData(),
        this.loadUnreadCount()
      ]);
    } catch (error) {
      console.error('加载数据失败:', error);
      wx.showToast({
        title: '数据加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({
        'loading.userInfo': false,
        'loading.statistics': false,
        'loading.dashboard': false,
        'loading.notifications': false
      });
    }
  },

  // 加载用户信息
  loadUserInfo: async function () {
    try {
      const res = await wx.cloud.callFunction({
        name: 'profileFunctions',
        data: {
          action: 'getUserInfo'
        }
      });

      if (res.result && res.result.code === 0) {
        const userInfo = res.result.data;
        this.setData({ userInfo });
        wx.setStorageSync('userInfo', userInfo);
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
      // 使用本地缓存数据
      const localUserInfo = wx.getStorageSync('userInfo');
      if (localUserInfo) {
        this.setData({ userInfo: localUserInfo });
      }
    }
  },

  // 加载统计数据
  loadStatistics: async function () {
    try {
      const res = await wx.cloud.callFunction({
        name: 'profileFunctions',
        data: {
          action: 'getUserStatistics'
        }
      });

      if (res.result && res.result.code === 0) {
        this.setData({
          statistics: res.result.data
        });
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  },

  // 加载数据看板
  loadDashboardData: async function () {
    try {
      const res = await wx.cloud.callFunction({
        name: 'profileFunctions',
        data: {
          action: 'getDashboardData'
        }
      });

      if (res.result && res.result.code === 0) {
        const dashboardData = res.result.data;
        const maxBarValue = Math.max(...dashboardData.barChart.map(item => item.count), 1);

        this.setData({
          dashboardData: dashboardData,
          maxBarValue: maxBarValue
        });
      }
    } catch (error) {
      console.error('加载数据看板失败:', error);
    }
  },

  // 加载未读通知数量
  loadUnreadCount: async function () {
    try {
      const res = await wx.cloud.callFunction({
        name: 'profileFunctions',
        data: {
          action: 'getUnreadNotificationCount'
        }
      });

      if (res.result && res.result.code === 0) {
        const count = res.result.data.count;

        // 更新功能列表中的通知角标
        const featureList = this.data.featureList.map((item, index) => {
          if (index === 2) { // 我的通知
            return { ...item, badge: count };
          }
          return item;
        });

        this.setData({
          unreadCount: count,
          featureList: featureList
        });

        // 设置TabBar红点
        if (count > 0) {
          wx.setTabBarBadge({
            index: 3,
            text: count > 99 ? '99+' : String(count)
          });
        } else {
          wx.removeTabBarBadge({ index: 3 });
        }
      }
    } catch (error) {
      console.error('加载未读通知数量失败:', error);
    }
  },

  // 点击用户卡片 - 编辑资料
  onUserCardTap: function () {
    wx.navigateTo({
      url: '/pages/register/register'
    });
  },

  // 点击统计项
  onStatisticTap: function (e) {
    if (!this.data.isLogin) {
      this.promptLoginBeforeAccess();
      return;
    }

    const type = e.currentTarget.dataset.type;

    // 跳转到对应页面
    if (type === 'myLists') {
      wx.navigateTo({
        url: '/pages/profile/my-lists/my-lists'
      });
    } else if (type === 'sharedLists') {
      wx.navigateTo({
        url: '/pages/profile/my-lists/my-lists?type=shared'
      });
    } else if (type === 'completedTasks') {
      // 跳转到任务页面并筛选已完成
      wx.switchTab({
        url: '/pages/index/index'
      });
    }
  },

  // 点击功能项
  onFeatureTap: function (e) {
    const index = e.currentTarget.dataset.index;
    const feature = this.data.featureList[index];

     const publicPaths = [
      '/pages/profile/help/help',
      '/pages/profile/about/about'
    ];

    if (!this.data.isLogin && feature.path && !publicPaths.includes(feature.path)) {
      this.promptLoginBeforeAccess();
      return;
    }

    if (feature.path) {
      wx.navigateTo({
        url: feature.path
      });
    }
  },

  // 扇形图点击事件
  onPieChartTap: function (e) {
    const type = e.currentTarget.dataset.type;
    const typeNames = {
      completed: '已完成',
      uncompleted: '未完成',
      overdue: '已逾期'
    };

    wx.showModal({
      title: `${typeNames[type]}任务`,
      content: `数量: ${this.data.dashboardData.pieChart[type]}`,
      showCancel: false
    });
  },

  // 柱状图点击事件
  onBarChartTap: function (e) {
    const date = e.currentTarget.dataset.date;
    const count = e.currentTarget.dataset.count;

    wx.showModal({
      title: `${date} 完成统计`,
      content: `完成任务数: ${count || 0}`,
      showCancel: false
    });
  },

  // 显示功能开发中提示
  showDevelopingToast: function (featureName) {
    wx.showToast({
      title: `${featureName}功能开发中`,
      icon: 'none',
      duration: 2000
    });
  },

  onLogoutTap: function () {
    wx.showModal({
      title: '确认退出',
      content: '退出后将清除当前设备上的资料状态和本地缓存，云端数据不会被删除。',
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        app.logout();
        this.resetGuestView();

        wx.showToast({
          title: '已退出当前资料状态',
          icon: 'success'
        });
      }
    });
  },

  promptLoginBeforeAccess: function () {
    wx.showModal({
      title: '请先完善资料',
      content: '完善头像和昵称后即可开始使用该功能。',
      confirmText: '去完善',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: '/pages/register/register'
          });
        }
      }
    });
  }
});
