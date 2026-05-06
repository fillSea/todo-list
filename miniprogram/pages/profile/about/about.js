Page({
  data: {
    // 应用信息
    appInfo: {
      name: '协同待办清单',
      version: '1.0.0',
      slogan: '高效协作，轻松管理',
      description: '一款简洁高效的协同待办清单小程序，支持个人任务管理和团队清单共享，帮助您更好地规划时间和任务。'
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
      { role: '产品设计', name: '产品团队' },
      { role: '前端开发', name: '前端团队' },
      { role: '后端开发', name: '后端团队' },
      { role: 'UI设计', name: '设计团队' }
    ],
    // 更新日志
    changelog: [
      {
        version: 'v1.0.0',
        date: '2024-03-17',
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
  },

  // 检查更新
  onCheckUpdate: function () {
    const updateManager = wx.getUpdateManager();

    updateManager.onCheckForUpdate((res) => {
      if (res.hasUpdate) {
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

    updateManager.onUpdateReady(() => {
      wx.hideLoading();
      wx.showModal({
        title: '更新提示',
        content: '新版本已准备好，是否重启应用？',
        success: (res) => {
          if (res.confirm) {
            updateManager.applyUpdate();
          }
        }
      });
    });

    updateManager.onUpdateFailed(() => {
      wx.hideLoading();
      wx.showModal({
        title: '更新失败',
        content: '新版本下载失败，请检查网络后重试',
        showCancel: false
      });
    });
  },

  // 复制邮箱
  onCopyEmail: function () {
    wx.setClipboardData({
      data: 'support@example.com',
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
      path: '/pages/index/index',
      imageUrl: '/images/share-cover.png'
    };
  }
});
