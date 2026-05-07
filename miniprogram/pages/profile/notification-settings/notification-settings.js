const app = getApp();

Page({
  data: {
    isLoggedIn: false,
    // 通知设置
    settings: {
      enableNotifications: true,
      taskReminder: true,
      listCollaboration: true,
      systemNotice: true
    },
    // 加载状态
    loading: false,
    // 设置项说明
    settingItems: [
      {
        key: 'enableNotifications',
        title: '接收通知',
        desc: '关闭后将不再接收任何通知',
        icon: 'bell',
        color: '#1989fa'
      },
      {
        key: 'taskReminder',
        title: '任务提醒',
        desc: '任务截止前和提醒时间到达时通知我',
        icon: 'clock-o',
        color: '#52C41A'
      },
      {
        key: 'listCollaboration',
        title: '协作通知',
        desc: '清单共享、成员变动等协作相关通知',
        icon: 'friends-o',
        color: '#FAAD14'
      },
      {
        key: 'systemNotice',
        title: '系统通知',
        desc: '系统更新、维护等重要通知',
        icon: 'info-o',
        color: '#722ED1'
      }
    ]
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
          enableNotifications: true,
          taskReminder: true,
          listCollaboration: true,
          systemNotice: true
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
        this.setData({ settings: localSettings });
      }

      // 从云端获取最新设置
      const res = await wx.cloud.callFunction({
        name: 'profileFunctions',
        data: {
          action: 'getNotificationSettings'
        }
      });

      if (res.result && res.result.code === 0) {
        const settings = res.result.data;
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

    // 更新本地状态
    const settings = { ...this.data.settings, [key]: value };
    this.setData({ settings });

    // 保存到本地
    wx.setStorageSync('notificationSettings', settings);

    // 同步到云端
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
        // 恢复原状态
        this.setData({
          settings: { ...this.data.settings, [key]: !value }
        });
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
      // 恢复原状态
      this.setData({
        settings: { ...this.data.settings, [key]: !value }
      });
    }
  },

  // 请求订阅消息权限
  onRequestSubscribe: function () {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({
        url: '/pages/register/register'
      });
      return;
    }

    wx.requestSubscribeMessage({
      tmplIds: [
        'TASK_REMINDER', // 任务提醒模板ID
        'DEADLINE_REMINDER', // 截止提醒模板ID
        'LIST_SHARED' // 清单共享模板ID
      ],
      success: (res) => {
        console.log('订阅成功:', res);
        wx.showToast({
          title: '订阅成功',
          icon: 'success'
        });
      },
      fail: (err) => {
        console.error('订阅失败:', err);
        wx.showToast({
          title: '订阅失败',
          icon: 'none'
        });
      }
    });
  },

  // 打开系统通知设置
  onOpenSystemSettings: function () {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({
        url: '/pages/register/register'
      });
      return;
    }

    wx.openSetting({
      withSubscriptions: true
    });
  }
});
