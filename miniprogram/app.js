// app.js
App({
  globalData: {
    // env 参数说明：
    // env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会请求到哪个云环境的资源
    // 此处请填入环境 ID, 环境 ID 可在微信开发者工具右上顶部工具栏点击云开发按钮打开获取
    env: "cloud1-0g144inb6530ffb6",
    userInfo: null,
    isLoggedIn: false
  },

  userCacheKeys: [
    'userInfo',
    'isLoggedIn',
    'loginTime',
    'cachedTasks',
    'cachedTasksTime',
    'cachedCategories',
    'notificationSettings',
    'jumpToDate'
  ],

  onLaunch: function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }

    // 检查登录状态
    this.checkLoginStatus();
  },

  // 检查登录状态
  checkLoginStatus: function () {
    const userInfo = wx.getStorageSync('userInfo');
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    const loginTime = wx.getStorageSync('loginTime');

    if (userInfo && isLoggedIn) {
      // 检查登录是否过期（30天）
      const now = new Date().getTime();
      const expireTime = 30 * 24 * 60 * 60 * 1000; // 30天

      if (loginTime && (now - loginTime) > expireTime) {
        // 登录已过期，清除登录状态
        this.clearLoginStatus();
        wx.setStorageSync('loginExpired', true);
      } else {
        // 登录有效，更新全局数据
        this.globalData.userInfo = userInfo;
        this.globalData.isLoggedIn = true;

        // 同步更新用户信息（从云端获取最新数据）
        this.syncUserInfo();
      }
    }
  },

  // 同步用户信息
  syncUserInfo: function () {
    wx.cloud.callFunction({
      name: 'profileFunctions',
      data: {
        action: 'getUserInfo'
      }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        const userInfo = res.result.data;
        this.globalData.userInfo = userInfo;
        wx.setStorageSync('userInfo', userInfo);
      }
    }).catch(err => {
      console.error('同步用户信息失败:', err);
    });
  },

  // 清除登录状态
  clearLoginStatus: function () {
    this.userCacheKeys.forEach(key => {
      wx.removeStorageSync(key);
    });

    const storageInfo = wx.getStorageInfoSync();
    storageInfo.keys
      .filter(key => key.startsWith('calendarTasks_'))
      .forEach(key => wx.removeStorageSync(key));

    wx.removeTabBarBadge({ index: 3 });

    this.globalData.userInfo = null;
    this.globalData.isLoggedIn = false;
  },

  logout: function () {
    this.clearLoginStatus();
  },

  // 设置登录状态
  setLoginStatus: function (userInfo) {
    this.globalData.userInfo = userInfo;
    this.globalData.isLoggedIn = true;

    wx.setStorageSync('userInfo', userInfo);
    wx.setStorageSync('isLoggedIn', true);
    wx.setStorageSync('loginTime', new Date().getTime());
    wx.removeStorageSync('loginExpired');
  },

  getLoginState: function () {
    return {
      userInfo: wx.getStorageSync('userInfo') || null,
      isLoggedIn: wx.getStorageSync('isLoggedIn') || false,
      loginTime: wx.getStorageSync('loginTime') || null
    };
  },

  clearTaskCaches: function () {
    ['cachedTasks', 'cachedTasksTime'].forEach(key => {
      wx.removeStorageSync(key);
    });

    const storageInfo = wx.getStorageInfoSync();
    storageInfo.keys
      .filter(key => key.startsWith('calendarTasks_'))
      .forEach(key => wx.removeStorageSync(key));
  }
});
