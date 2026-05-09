const SUPPORT_EMAIL = 'support@todo-list.app';

Page({
  data: {
    currentYear: new Date().getFullYear(),
    // 应用信息
    appInfo: {
      name: '协同待办清单',
      version: '1.0.0',
      slogan: '个人待办与共享清单管理',
      description: '协同待办清单支持任务记录、清单共享、分类标签、提醒和统计，帮助个人与小团队清晰管理日常事项。'
    },
    // 功能特点
    features: [
      {
        icon: 'todo-list-o',
        title: '任务管理',
        desc: '创建、编辑、完成任务，支持设置优先级和截止日期'
      },
      {
        icon: 'orders-o',
        title: '清单组织',
        desc: '将任务归类到不同清单，支持个人和共享清单'
      },
      {
        icon: 'friends-o',
        title: '团队协作',
        desc: '邀请成员共享清单，实时同步任务进度'
      },
      {
        icon: 'bell',
        title: '智能提醒',
        desc: '设置任务提醒，不再错过重要事项'
      },
      {
        icon: 'chart-trending-o',
        title: '数据统计',
        desc: '可视化数据看板，了解任务完成情况'
      },
      {
        icon: 'label-o',
        title: '分类标签',
        desc: '自定义分类标签，灵活组织任务'
      }
    ],
    // 开发团队
    team: [
      { role: '开发与维护', name: '协同待办清单团队' },
      { role: '客服支持', name: SUPPORT_EMAIL }
    ],
    // 更新日志
    changelog: [
      {
        version: 'v1.0.0',
        date: '2026-05-09',
        changes: [
          '初始版本发布',
          '支持任务创建、编辑、删除',
          '支持清单管理和共享',
          '支持分类标签',
          '支持通知提醒',
          '支持数据统计'
        ]
      }
    ]
  },

  onLoad: function () {
    // 获取小程序版本信息
    const accountInfo = wx.getAccountInfoSync();
    if (accountInfo && accountInfo.miniProgram) {
      this.setData({
        'appInfo.version': accountInfo.miniProgram.version || '1.0.0'
      });
    }

    this.initUpdateManager();
  },

  initUpdateManager: function () {
    if (!wx.getUpdateManager) {
      return;
    }

    this.updateManager = wx.getUpdateManager();
    this.hasPendingUpdate = false;
    this.lastUpdateStatus = null;

    this.updateManager.onCheckForUpdate((res) => {
      this.isCheckingUpdate = false;
      this.lastUpdateStatus = res.hasUpdate ? 'available' : 'latest';
      if (res.hasUpdate) {
        this.hasPendingUpdate = true;
        wx.showLoading({
          title: '更新下载中...'
        });
      } else {
        wx.showToast({
          title: '已是最新版本',
          icon: 'success'
        });
      }
    });

    this.updateManager.onUpdateReady(() => {
      wx.hideLoading();
      if (!this.hasPendingUpdate) {
        return;
      }
      this.hasPendingUpdate = false;
      wx.showModal({
        title: '更新提示',
        content: '新版本已准备好，是否重启应用？',
        success: (res) => {
          if (res.confirm) {
            this.updateManager.applyUpdate();
          }
        }
      });
    });

    this.updateManager.onUpdateFailed(() => {
      wx.hideLoading();
      this.isCheckingUpdate = false;
      this.hasPendingUpdate = false;
      this.lastUpdateStatus = 'failed';
      wx.showModal({
        title: '更新失败',
        content: '新版本下载失败，请检查网络后重试',
        showCancel: false
      });
    });
  },

  // 检查更新
  onCheckUpdate: function () {
    if (!this.updateManager) {
      wx.showToast({
        title: '当前环境不支持更新检查',
        icon: 'none'
      });
      return;
    }

    if (this.isCheckingUpdate) {
      wx.showToast({
        title: '正在检查更新',
        icon: 'none'
      });
      return;
    }

    if (this.lastUpdateStatus === 'latest') {
      wx.showToast({
        title: '已是最新版本',
        icon: 'success'
      });
      return;
    }

    if (this.lastUpdateStatus === 'available' || this.hasPendingUpdate) {
      wx.showLoading({
        title: '更新下载中...'
      });
      return;
    }

    if (this.lastUpdateStatus === 'failed') {
      wx.showToast({
        title: '更新检查失败',
        icon: 'none'
      });
      return;
    }

    this.isCheckingUpdate = true;
    wx.showToast({
      title: '正在检查更新',
      icon: 'none'
    });

    setTimeout(() => {
      this.isCheckingUpdate = false;
    }, 1500);
  },

  // 复制邮箱
  onCopyEmail: function () {
    wx.setClipboardData({
      data: SUPPORT_EMAIL,
      success: () => {
        wx.showToast({
          title: '邮箱已复制',
          icon: 'success'
        });
      }
    });
  },

  // 查看用户协议
  onViewAgreement: function () {
    wx.navigateTo({
      url: '/pages/profile/help/agreement/agreement'
    });
  },

  // 查看隐私政策
  onViewPrivacy: function () {
    wx.navigateTo({
      url: '/pages/profile/help/privacy/privacy'
    });
  },

  // 分享给朋友
  onShareAppMessage: function () {
    return {
      title: '协同待办清单 - 高效协作，轻松管理',
      path: '/pages/index/index'
    };
  }
});
