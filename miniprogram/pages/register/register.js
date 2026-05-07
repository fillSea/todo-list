const app = getApp();

Page({
  data: {
    // 用户基本信息
    avatarUrl: '',
    nickname: '',
    enableNotifications: true,

    // 页面状态
    canSubmit: false,
    isLoggedIn: false,
    isLoading: false,
    pageTitle: '完善个人资料',
    pageSubtitle: '完成后即可使用任务、清单和通知等功能',
    submitButtonText: '保存并开始使用',
    statusText: ''
  },

  onLoad: function () {
    this.checkLoginStatus();
  },

  onShow: function () {
    // 每次显示页面时检查登录状态
    this.checkLoginStatus();
  },

  // 检查登录状态
  checkLoginStatus: function () {
    const userInfo = wx.getStorageSync('userInfo');
    const isLoggedIn = wx.getStorageSync('isLoggedIn');

    if (userInfo && isLoggedIn) {
      this.setData({
        avatarUrl: userInfo.avatarUrl || '',
        nickname: userInfo.nickname || '',
        enableNotifications: userInfo.enableNotifications !== false,
        isLoggedIn: true,
        pageTitle: '个人资料',
        pageSubtitle: '可随时修改头像、昵称和通知偏好',
        submitButtonText: '保存修改',
        statusText: '个人资料已完善'
      });
      this.checkCanSubmit();
      return;
    }

    this.setData({
      avatarUrl: '',
      nickname: '',
      enableNotifications: true,
      canSubmit: false,
      isLoggedIn: false,
      pageTitle: '完善个人资料',
      pageSubtitle: '完成后即可使用任务、清单和通知等功能',
      submitButtonText: '保存并开始使用',
      statusText: ''
    });
  },

  // 选择头像
  onChooseAvatar: function (e) {
    const { avatarUrl } = e.detail;
    this.setData({
      avatarUrl: avatarUrl
    });
    this.checkCanSubmit();
  },

  // 昵称输入
  onNicknameInput: function (e) {
    this.setData({
      nickname: e.detail.value
    });
    this.checkCanSubmit();
  },

  // 昵称失焦（微信昵称输入组件专用）
  onNicknameBlur: function (e) {
    this.setData({
      nickname: e.detail.value
    });
    this.checkCanSubmit();
  },

  // 通知设置变更
  onNotificationChange: function (e) {
    this.setData({
      enableNotifications: e.detail.value
    });
  },

  // 检查是否可以提交
  checkCanSubmit: function () {
    const { avatarUrl, nickname } = this.data;
    const canSubmit = avatarUrl && nickname.trim().length > 0;
    this.setData({ canSubmit });
  },

  // 上传头像到云存储
  uploadAvatarToCloud: function (avatarUrl) {
    return new Promise((resolve, reject) => {
      // 如果头像已经是云存储URL，直接返回
      if (avatarUrl.startsWith('cloud://')) {
        resolve(avatarUrl);
        return;
      }

      // 获取文件扩展名
      const ext = avatarUrl.match(/\.([^.]+)$/) ? avatarUrl.match(/\.([^.]+)$/)[1] : 'jpg';
      const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;

      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: avatarUrl,
        success: res => {
          resolve(res.fileID);
        },
        fail: err => {
          console.error('上传头像失败:', err);
          reject(err);
        }
      });
    });
  },

  // 提交表单
  onSubmit: async function () {
    const { avatarUrl, nickname, enableNotifications } = this.data;

    if (!avatarUrl || !nickname.trim()) {
      wx.showToast({
        title: '请完善头像和昵称',
        icon: 'none'
      });
      return;
    }

    this.setData({ isLoading: true });

    try {
      // 先上传头像到云存储
      const cloudAvatarUrl = await this.uploadAvatarToCloud(avatarUrl);

      // 调用云函数保存用户信息
      const res = await wx.cloud.callFunction({
        name: 'profileFunctions',
        data: {
          action: 'registerOrUpdateUser',
          data: {
            avatarUrl: cloudAvatarUrl,
            nickname: nickname.trim(),
            enableNotifications: enableNotifications
          }
        }
      });

      this.setData({ isLoading: false });

      if (res.result && res.result.code === 0) {
        // 保存到本地存储
        const userInfo = {
          ...res.result.data,
          avatarUrl: cloudAvatarUrl,
          nickname: nickname.trim(),
          enableNotifications: enableNotifications
        };

        wx.setStorageSync('userInfo', userInfo);
        wx.setStorageSync('isLoggedIn', true);
        wx.setStorageSync('loginTime', new Date().getTime());

        // 更新全局数据
        app.globalData.userInfo = userInfo;
        app.globalData.isLoggedIn = true;

        wx.showToast({
          title: '保存成功',
          icon: 'success',
          duration: 1500
        });

        setTimeout(() => {
          // 返回上一页并触发刷新
          const pages = getCurrentPages();
          const prevPage = pages[pages.length - 2];
          if (prevPage && prevPage.checkLoginStatus) {
            prevPage.checkLoginStatus();
          }
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({
          title: res.result?.message || '保存失败',
          icon: 'none'
        });
      }
    } catch (err) {
      this.setData({ isLoading: false });
      console.error('保存用户信息失败:', err);

      // 网络失败时，先保存到本地
      const userInfo = {
        avatarUrl: avatarUrl,
        nickname: nickname.trim(),
        enableNotifications: enableNotifications
      };

      wx.setStorageSync('userInfo', userInfo);
      wx.setStorageSync('isLoggedIn', true);
      wx.setStorageSync('loginTime', new Date().getTime());

      app.globalData.userInfo = userInfo;
      app.globalData.isLoggedIn = true;

      wx.showToast({
        title: '已本地保存',
        icon: 'success',
        duration: 1500
      });

      setTimeout(() => {
        // 返回上一页并触发刷新
        const pages = getCurrentPages();
        const prevPage = pages[pages.length - 2];
        if (prevPage && prevPage.checkLoginStatus) {
          prevPage.checkLoginStatus();
        }
        wx.navigateBack();
      }, 1500);
    }
  },

  // 退出登录
  logout: function () {
    wx.showModal({
      title: '确认退出当前资料状态',
      content: '退出后将清除当前设备上的资料状态和本地缓存，云端数据不会被删除。',
      success: (res) => {
        if (res.confirm) {
          app.logout();

          this.setData({
            avatarUrl: '',
            nickname: '',
            enableNotifications: true,
            canSubmit: false,
            isLoggedIn: false,
            pageTitle: '完善个人资料',
            pageSubtitle: '完成后即可使用任务、清单和通知等功能',
            submitButtonText: '保存并开始使用',
            statusText: ''
          });

          wx.showToast({
            title: '已退出当前资料状态',
            icon: 'success'
          });
        }
      }
    });
  }
});
