const app = getApp();

Page({
  data: {
    isLoggedIn: false,
    settings: {
      enableNotifications: true
    },
    loading: false
  },

  onLoad: function () {
    this.syncLoginState();
  },

  onShow: function () {
    this.syncLoginState();
  },

  syncLoginState: function () {
    const { isLoggedIn } = app.getLoginState();

    if (!isLoggedIn) {
      this.setData({
        isLoggedIn: false,
        loading: false,
        settings: {
          enableNotifications: true
        }
      });
      return;
    }

    this.setData({ isLoggedIn: true });
    this.loadSettings();
  },

  // 加载设置
  loadSettings: async function () {
    if (!this.data.isLoggedIn) return;

    this.setData({ loading: true });

    try {
      // 先从本地获取
      const localSettings = wx.getStorageSync('notificationSettings');
      if (localSettings) {
        this.setData({
          settings: {
            enableNotifications: localSettings.enableNotifications !== false
          }
        });
      }

      // 从云端获取最新设置
      const res = await wx.cloud.callFunction({
        name: 'profileFunctions',
        data: {
          action: 'getNotificationSettings'
        }
      });

      if (res.result && res.result.code === 0) {
        const settings = {
          enableNotifications: res.result.data?.enableNotifications !== false
        };
        this.setData({ settings });
        wx.setStorageSync('notificationSettings', settings);
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 切换设置
  onSettingChange: async function (e) {
    if (!this.data.isLoggedIn) return;

    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    if (key !== 'enableNotifications') return;

    const previousSettings = { ...this.data.settings };

    const settings = { ...previousSettings, [key]: value };
    this.setData({ settings });
    wx.setStorageSync('notificationSettings', settings);

    try {
      const res = await wx.cloud.callFunction({
        name: 'profileFunctions',
        data: {
          action: 'updateNotificationSettings',
          data: { [key]: value }
        }
      });

      if (res.result && res.result.code !== 0) {
        wx.showToast({
          title: res.result?.message || '保存失败',
          icon: 'none'
        });
        this.setData({ settings: previousSettings });
        wx.setStorageSync('notificationSettings', previousSettings);
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
      this.setData({ settings: previousSettings });
      wx.setStorageSync('notificationSettings', previousSettings);
    }
  }
});
