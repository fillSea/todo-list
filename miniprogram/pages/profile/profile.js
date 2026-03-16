const app = getApp();
const db = wx.cloud.database();

// 测试数据模式 - 始终使用本地测试数据
const USE_TEST_DATA = true;

// 本地测试数据
const TEST_DATA = {
  // 测试用户信息
  userInfo: {
    _id: 'test_user_001',
    openid: 'test_openid_001',
    nickname: '测试用户',
    avatarUrl: 'https://thirdwx.qlogo.cn/mmopen/vi_32/POgEwh4mIHO4nibH0KlMECNjjGxQUq24ZEaGT4poC6icRiccVGKSyXwibcPq4BWmiaIGuG1icwxaQX6grC9VemZoJNbrg/132',
    signature: '这是一个测试签名，用于展示效果',
    enableNotifications: true,
    notificationSettings: {
      taskReminder: true,
      listCollaboration: true,
      systemNotice: true
    }
  },

  // 测试统计数据
  statistics: {
    myLists: 12,
    sharedLists: 5,
    completedTasks: 156
  },

  // 测试数据看板
  dashboardData: {
    pieChart: {
      completed: 156,
      uncompleted: 23,
      overdue: 8,
      total: 187
    },
    barChart: [
      { date: '3-10', count: 5 },
      { date: '3-11', count: 8 },
      { date: '3-12', count: 12 },
      { date: '3-13', count: 7 },
      { date: '3-14', count: 15 },
      { date: '3-15', count: 10 },
      { date: '3-16', count: 6 }
    ]
  },

  // 测试未读通知数量
  unreadCount: 8
};

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
    }
  },

  onLoad: function (options) {
    // 使用测试数据加载页面
    this.setData({ isLogin: true });
    this.loadAllData();
  },

  onShow: function () {
    // 始终加载数据（使用测试数据）
    this.loadAllData();
  },

  onPullDownRefresh: function () {
    // 模拟刷新操作
    wx.showLoading({ title: '刷新中...' });

    setTimeout(() => {
      this.loadAllData().finally(() => {
        wx.hideLoading();
        wx.stopPullDownRefresh();
        wx.showToast({
          title: '刷新成功',
          icon: 'success'
        });
      });
    }, 800);
  },

  // 检查登录状态
  // 加载所有数据
  loadAllData: async function () {
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

  // 加载用户信息 - 使用本地测试数据
  loadUserInfo: async function () {
    console.log('[测试数据] 加载用户信息');

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 300));

    this.setData({
      userInfo: TEST_DATA.userInfo
    });
    wx.setStorageSync('userInfo', TEST_DATA.userInfo);

    console.log('[测试数据] 用户信息:', TEST_DATA.userInfo);
  },

  // 加载统计数据 - 使用本地测试数据
  loadStatistics: async function () {
    console.log('[测试数据] 加载统计数据');

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 400));

    this.setData({
      statistics: TEST_DATA.statistics
    });

    console.log('[测试数据] 统计数据:', TEST_DATA.statistics);
  },

  // 加载数据看板 - 使用本地测试数据
  loadDashboardData: async function () {
    console.log('[测试数据] 加载数据看板');

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 500));

    // 计算柱状图最大值
    const maxBarValue = Math.max(...TEST_DATA.dashboardData.barChart.map(item => item.count), 1);

    this.setData({
      dashboardData: TEST_DATA.dashboardData,
      maxBarValue: maxBarValue
    });

    console.log('[测试数据] 数据看板:', TEST_DATA.dashboardData);
  },

  // 加载未读通知数量 - 使用本地测试数据
  loadUnreadCount: async function () {
    console.log('[测试数据] 加载未读通知数量');

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 200));

    const count = TEST_DATA.unreadCount;

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

    console.log('[测试数据] 未读通知数量:', count);
  },

  // 点击用户卡片 - 编辑资料
  onUserCardTap: function () {
    // 添加点击反馈
    wx.vibrateShort({ type: 'light' });

    console.log('[点击事件] 用户卡片');
    wx.showModal({
      title: '用户资料',
      content: `昵称: ${this.data.userInfo.nickname}\n签名: ${this.data.userInfo.signature}`,
      showCancel: false
    });
  },

  // 点击统计项
  onStatisticTap: function (e) {
    const type = e.currentTarget.dataset.type;
    const typeNames = {
      myLists: '我的清单',
      sharedLists: '共享清单',
      completedTasks: '已完成任务'
    };
    const typeValues = {
      myLists: this.data.statistics.myLists,
      sharedLists: this.data.statistics.sharedLists,
      completedTasks: this.data.statistics.completedTasks
    };

    // 添加点击反馈
    wx.vibrateShort({ type: 'light' });

    console.log(`[点击事件] 统计项: ${typeNames[type]}`);
    wx.showModal({
      title: typeNames[type],
      content: `数量: ${typeValues[type]}`,
      showCancel: false
    });
  },

  // 点击功能项
  onFeatureTap: function (e) {
    const index = e.currentTarget.dataset.index;
    const feature = this.data.featureList[index];

    // 添加点击反馈
    wx.vibrateShort({ type: 'light' });

    console.log(`[点击事件] 功能项: ${feature.name}`);

    // 根据功能显示不同的提示
    const featureDescriptions = {
      '我的清单': '查看和管理您的所有待办清单',
      '分类标签': '管理任务分类标签',
      '我的通知': `您有 ${this.data.unreadCount} 条未读通知`,
      '通知设置': '配置消息提醒方式',
      '帮助中心': '查看使用帮助和常见问题',
      '关于我们': '应用版本信息和开发者信息'
    };

    wx.showModal({
      title: feature.name,
      content: featureDescriptions[feature.name] || '功能详情',
      showCancel: false
    });
  },

  // 扇形图点击事件
  onPieChartTap: function (e) {
    const type = e.currentTarget.dataset.type;
    const typeNames = {
      completed: '已完成',
      uncompleted: '未完成',
      overdue: '已逾期'
    };
    const typeValues = {
      completed: this.data.dashboardData.pieChart.completed,
      uncompleted: this.data.dashboardData.pieChart.uncompleted,
      overdue: this.data.dashboardData.pieChart.overdue
    };

    // 添加点击反馈
    wx.vibrateShort({ type: 'light' });

    console.log(`[点击事件] 扇形图: ${typeNames[type]}`);
    wx.showModal({
      title: `${typeNames[type]}任务`,
      content: `数量: ${typeValues[type]}`,
      showCancel: false
    });
  },

  // 柱状图点击事件
  onBarChartTap: function (e) {
    const date = e.currentTarget.dataset.date;
    const count = e.currentTarget.dataset.count;

    // 添加点击反馈
    wx.vibrateShort({ type: 'light' });

    console.log(`[点击事件] 柱状图: ${date}`);
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
  }
});
