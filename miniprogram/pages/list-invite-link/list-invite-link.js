// 调试模式开关
const DEBUG_MODE = false;

Page({
  data: {
    // 清单ID
    listId: '',

    // 清单信息
    listInfo: {},

    // 邀请链接
    inviteLink: '',
    inviteCode: '',
    qrcodeUrl: '',

    // 链接设置
    role: 2,
    expireDays: 7,
    expireText: '7天',
    needApproval: false,

    // 使用统计
    inviteStats: null,

    // 弹窗显示
    showRolePopup: false,
    showExpirePopup: false,
    showRegenerateDialog: false,

    // 用户信息
    userInfo: null
  },

  onLoad: function (options) {
    const { listId } = options;

    if (!listId) {
      wx.showToast({
        title: '清单ID不能为空',
        icon: 'none'
      });
      wx.navigateBack();
      return;
    }

    const userInfo = wx.getStorageSync('userInfo');

    this.setData({
      listId,
      userInfo
    });

    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });

    // 生成邀请链接
    this.generateInviteLink();
    this.loadListInfo();
  },

  onShareAppMessage() {
    return {
      title: `邀请你加入"${this.data.listInfo?.name || '共享清单'}"`,
      path: `/pages/list-invite-accept/list-invite-accept?code=${this.data.inviteCode}`,
      imageUrl: '/images/share-invite.png'
    };
  },

  async loadListInfo() {
    if (DEBUG_MODE || !this.data.listId) {
      if (DEBUG_MODE) {
        this.setData({
          listInfo: {
            name: '工作任务'
          }
        });
      }
      return;
    }

    try {
      const result = await wx.cloud.callFunction({
        name: 'listFunctions',
        data: {
          action: 'getListDetail',
          data: { listId: this.data.listId }
        }
      });

      if (result.result && result.result.code === 0) {
        this.setData({
          listInfo: result.result.data.listInfo || {}
        });
      }
    } catch (error) {
      console.error('加载清单信息失败:', error);
    }
  },

  // 生成邀请链接
  async generateInviteLink() {
    wx.showLoading({ title: '生成中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(800);

        // 伪造数据
        const inviteCode = this.generateRandomCode();
        const inviteLink = `https://todo.app/invite/${inviteCode}`;

        // 生成调试模式的小程序码（使用临时图片）
        const qrcodeUrl = await this.generateMiniProgramCode(inviteCode, true);

        this.setData({
          inviteCode,
          inviteLink,
          qrcodeUrl,
          inviteStats: {
            joinedCount: 3,
            appliedCount: 1,
            activeTemplateCount: 1
          }
        });
      } else {
        const { listId, role, expireDays, needApproval } = this.data;

        const result = await wx.cloud.callFunction({
          name: 'listFunctions',
          data: {
            action: 'generateInviteLink',
            data: {
              listId,
              role,
              expireDays,
              needApproval
            }
          }
        });

        if (result.result && result.result.success) {
          const { inviteCode, inviteLink, stats } = result.result;

          // 生成小程序码
          const qrcodeUrl = await this.generateMiniProgramCode(inviteCode, false);

          this.setData({
            inviteCode,
            inviteLink,
            qrcodeUrl,
            inviteStats: stats
          });
        } else {
          throw new Error(result.result?.message || '生成失败');
        }
      }
    } catch (error) {
      console.error('生成邀请链接失败:', error);
      wx.showToast({
        title: error.message || '生成失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 生成随机邀请码
  generateRandomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 16; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  },

  // 生成微信小程序码
  async generateMiniProgramCode(inviteCode, isDebug = false) {
    if (isDebug) {
      // 调试模式下返回一个占位图
      return '/images/qrcode-placeholder.png';
    }

    try {
      // 调用云函数生成小程序码
      const result = await wx.cloud.callFunction({
        name: 'listFunctions',
        data: {
          action: 'generateMiniProgramCode',
          data: {
            scene: `invite=${inviteCode}`,
            page: 'pages/list-invite-accept/list-invite-accept',
            width: 280
          }
        }
      });

      if (result.result && result.result.success) {
        // 返回云存储的文件ID或临时URL
        return result.result.fileID || result.result.qrcodeUrl;
      } else if (result.result && result.result.code === -1) {
        // 云函数返回错误，可能是权限问题
        console.warn('生成小程序码失败:', result.result.message);
        return '/images/qrcode-placeholder.png';
      } else {
        throw new Error(result.result?.message || '生成小程序码失败');
      }
    } catch (error) {
      console.error('生成小程序码失败:', error);
      // 失败时返回占位图，不阻塞主流程
      wx.showToast({
        title: '小程序码生成失败，使用占位图',
        icon: 'none',
        duration: 2000
      });
      return '/images/qrcode-placeholder.png';
    }
  },

  // 模拟网络延迟
  simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // ==================== 导航操作 ====================

  onBack() {
    wx.navigateBack();
  },

  // ==================== 链接操作 ====================

  // 复制链接
  onCopyLink() {
    const { inviteLink } = this.data;

    wx.setClipboardData({
      data: inviteLink,
      success: () => {
        wx.showToast({
          title: '链接已复制',
          icon: 'success'
        });
      }
    });
  },

  // 分享链接
  onShareLink() {
    wx.showToast({
      title: '请点击右上角分享',
      icon: 'none'
    });
  },

  // ==================== 设置操作 ====================

  // 修改权限
  onChangeRole() {
    this.setData({ showRolePopup: true });
  },

  onRolePopupClose() {
    this.setData({ showRolePopup: false });
  },

  async onRoleSelect(e) {
    const role = parseInt(e.currentTarget.dataset.role);

    this.setData({
      showRolePopup: false,
      role
    });

    // 重新生成链接
    await this.generateInviteLink();
  },

  // 修改有效期
  onChangeExpire() {
    this.setData({ showExpirePopup: true });
  },

  onExpirePopupClose() {
    this.setData({ showExpirePopup: false });
  },

  async onExpireSelect(e) {
    const days = parseInt(e.currentTarget.dataset.days);
    const expireText = days === 0 ? '永久有效' : `${days}天`;

    this.setData({
      showExpirePopup: false,
      expireDays: days,
      expireText
    });

    // 重新生成链接
    await this.generateInviteLink();
  },

  // 修改审核设置
  async onApprovalChange(e) {
    const needApproval = e.detail;

    this.setData({ needApproval });

    // 重新生成链接
    await this.generateInviteLink();
  },

  // ==================== 重新生成 ====================

  onRegenerate() {
    this.setData({ showRegenerateDialog: true });
  },

  onRegenerateDialogClose() {
    this.setData({ showRegenerateDialog: false });
  },

  async onConfirmRegenerate() {
    this.setData({ showRegenerateDialog: false });
    await this.generateInviteLink();

    wx.showToast({
      title: '已重新生成',
      icon: 'success'
    });
  }
});
