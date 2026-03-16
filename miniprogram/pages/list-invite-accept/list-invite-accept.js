// 调试模式开关
const DEBUG_MODE = true;

Page({
  data: {
    // 邀请码
    inviteCode: '',

    // 邀请信息
    inviteInfo: {},

    // 状态
    isLoading: true,
    errorMsg: '',
    errorDesc: '',
    isMember: false,
    isProcessed: false,
    processStatus: 0,

    // 弹窗
    showConfirmDialog: false,
    dialogTitle: '',
    dialogMessage: '',
    confirmText: '',
    confirmColor: '',
    pendingAction: '',

    // 用户信息
    userInfo: null
  },

  onLoad: function (options) {
    const { code, scene } = options;

    // 支持两种方式传入邀请码
    const inviteCode = code || scene;

    if (!inviteCode) {
      this.setData({
        isLoading: false,
        errorMsg: '邀请链接无效',
        errorDesc: '请检查链接是否完整或已过期'
      });
      return;
    }

    const userInfo = wx.getStorageSync('userInfo');

    this.setData({
      inviteCode,
      userInfo
    });

    // 加载邀请信息
    this.loadInviteInfo();
  },

  // 加载邀请信息
  async loadInviteInfo() {
    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(800);

        // 伪造邀请信息
        const mockInviteInfo = {
          listId: 'list_001',
          listName: '工作任务',
          listDescription: '日常工作任务清单，包含项目开发、会议、文档编写等任务',
          listColor: '#1976D2',
          isShared: true,
          inviterId: 'user_001',
          inviterName: '张三',
          inviterAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=1',
          role: 2,
          needApproval: false,
          memberCount: 3,
          members: [
            { avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=1' },
            { avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=2' },
            { avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=3' }
          ],
          status: 0,
          expireAt: new Date(Date.now() + 86400000).toISOString()
        };

        this.setData({
          inviteInfo: mockInviteInfo,
          isLoading: false,
          isMember: false,
          isProcessed: false
        });
      } else {
        const result = await wx.cloud.callFunction({
          name: 'getInviteInfo',
          data: { inviteCode: this.data.inviteCode }
        });

        if (result.result && result.result.success) {
          const { inviteInfo, isMember, isProcessed, processStatus } = result.result;

          this.setData({
            inviteInfo,
            isMember,
            isProcessed,
            processStatus,
            isLoading: false
          });
        } else {
          throw new Error(result.result?.message || '加载失败');
        }
      }
    } catch (error) {
      console.error('加载邀请信息失败:', error);
      this.setData({
        isLoading: false,
        errorMsg: '邀请链接无效或已过期',
        errorDesc: '请联系邀请人重新发送邀请'
      });
    }
  },

  // 模拟网络延迟
  simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // ==================== 导航操作 ====================

  onBack() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  onViewList() {
    const { listId } = this.data.inviteInfo;
    wx.redirectTo({
      url: `/pages/list-detail/list-detail?id=${listId}`
    });
  },

  // ==================== 接受邀请 ====================

  onAccept() {
    this.setData({
      showConfirmDialog: true,
      dialogTitle: '确认接受',
      dialogMessage: `接受邀请后，你将成为"${this.data.inviteInfo.listName}"的${this.data.inviteInfo.role === 2 ? '编辑者' : '查看者'}，是否继续？`,
      confirmText: '接受',
      confirmColor: '#1976D2',
      pendingAction: 'accept'
    });
  },

  // ==================== 申请加入 ====================

  onApplyJoin() {
    this.setData({
      showConfirmDialog: true,
      dialogTitle: '确认申请',
      dialogMessage: `申请加入"${this.data.inviteInfo.listName}"，等待邀请人审核，是否继续？`,
      confirmText: '申请',
      confirmColor: '#1976D2',
      pendingAction: 'apply'
    });
  },

  // ==================== 拒绝邀请 ====================

  onReject() {
    this.setData({
      showConfirmDialog: true,
      dialogTitle: '确认拒绝',
      dialogMessage: '拒绝后将无法通过此链接加入清单，是否继续？',
      confirmText: '拒绝',
      confirmColor: '#999',
      pendingAction: 'reject'
    });
  },

  // ==================== 弹窗操作 ====================

  onDialogClose() {
    this.setData({ showConfirmDialog: false });
  },

  async onDialogConfirm() {
    const { pendingAction, inviteCode } = this.data;

    this.setData({ showConfirmDialog: false });

    wx.showLoading({ title: '处理中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(800);

        if (pendingAction === 'accept' || pendingAction === 'apply') {
          wx.showToast({
            title: pendingAction === 'accept' ? '已接受邀请' : '申请已提交',
            icon: 'success'
          });

          setTimeout(() => {
            if (pendingAction === 'accept') {
              // 直接进入清单
              wx.redirectTo({
                url: `/pages/list-detail/list-detail?id=${this.data.inviteInfo.listId}`
              });
            } else {
              // 返回首页
              this.setData({
                isProcessed: true,
                processStatus: 0
              });
            }
          }, 1500);
        } else if (pendingAction === 'reject') {
          wx.showToast({
            title: '已拒绝邀请',
            icon: 'none'
          });

          setTimeout(() => {
            this.setData({
              isProcessed: true,
              processStatus: 2
            });
          }, 1500);
        }
      } else {
        let result;

        if (pendingAction === 'accept') {
          result = await wx.cloud.callFunction({
            name: 'acceptInvite',
            data: { inviteCode }
          });
        } else if (pendingAction === 'apply') {
          result = await wx.cloud.callFunction({
            name: 'applyJoinList',
            data: { inviteCode }
          });
        } else if (pendingAction === 'reject') {
          result = await wx.cloud.callFunction({
            name: 'rejectInvite',
            data: { inviteCode }
          });
        }

        if (result && result.result && result.result.success) {
          wx.showToast({
            title: pendingAction === 'reject' ? '已拒绝邀请' : '操作成功',
            icon: 'success'
          });

          if (pendingAction === 'accept') {
            setTimeout(() => {
              wx.redirectTo({
                url: `/pages/list-detail/list-detail?id=${this.data.inviteInfo.listId}`
              });
            }, 1500);
          } else {
            this.loadInviteInfo();
          }
        } else {
          throw new Error(result.result?.message || '操作失败');
        }
      }
    } catch (error) {
      console.error('处理邀请失败:', error);
      wx.showToast({
        title: error.message || '操作失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  }
});
