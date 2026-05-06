// 调试模式开关
const DEBUG_MODE = false;

Page({
  data: {
    // 清单ID
    listId: '',

    // 当前标签
    currentTab: 'pending',

    // 邀请列表
    pendingInvites: [],
    acceptedInvites: [],
    rejectedInvites: [],
    expiredInvites: [],
    applications: [],
    pendingCount: 0,
    applicationCount: 0,

    // 加载状态
    isRefreshing: false,
    isLoadingMore: false,
    hasMore: true,

    // 弹窗
    showCancelDialog: false,
    showClearDialog: false,
    showTipDialog: false,
    cancelInviteId: '',
    cancelUserName: '',
    tipTitle: '',
    tipMessage: '',

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

    // 加载数据
    this.loadInvites();
  },

  onShow: function () {
    if (this.data.listId) {
      this.loadInvites();
    }
  },

  // 加载邀请列表
  async loadInvites() {
    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(500);

        // 伪造待处理邀请
        const mockPending = [
          {
            _id: 'invite_001',
            inviteeInfo: {
              nickname: '赵六',
              avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=6'
            },
            role: 2,
            status: 0,
            inviteType: 'wechat',
            timeText: '2小时前'
          },
          {
            _id: 'invite_002',
            inviteeInfo: {
              nickname: '钱七',
              avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=7'
            },
            role: 3,
            status: 0,
            inviteType: 'link',
            timeText: '5小时前'
          }
        ];

        // 伪造已接受邀请
        const mockAccepted = [
          {
            _id: 'invite_003',
            inviteeInfo: {
              nickname: '孙八',
              avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=8'
            },
            role: 2,
            status: 1,
            timeText: '3天前'
          },
          {
            _id: 'invite_004',
            inviteeInfo: {
              nickname: '周九',
              avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=9'
            },
            role: 3,
            status: 1,
            timeText: '1周前'
          }
        ];

        // 伪造已拒绝邀请
        const mockRejected = [
          {
            _id: 'invite_005',
            inviteeInfo: {
              nickname: '吴十',
              avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=10'
            },
            role: 2,
            status: 2,
            timeText: '2天前'
          }
        ];

        // 伪造已过期邀请
        const mockExpired = [
          {
            _id: 'invite_006',
            inviteeInfo: {
              nickname: '郑十一',
              avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=11'
            },
            role: 3,
            status: 3,
            timeText: '3天前'
          }
        ];

        // 伪造申请列表 (status: 4 表示待审批)
        const mockApplications = [
          {
            _id: 'apply_001',
            applicantInfo: {
              nickname: '郑十二',
              avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=12'
            },
            role: 2,
            status: 4,
            message: '我是团队的新成员，希望能加入这个清单协助完成任务',
            timeText: '1小时前'
          },
          {
            _id: 'apply_002',
            applicantInfo: {
              nickname: '王十三',
              avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=13'
            },
            role: 3,
            status: 4,
            message: '',
            timeText: '3小时前'
          }
        ];

        this.setData({
          pendingInvites: mockPending,
          acceptedInvites: mockAccepted,
          rejectedInvites: mockRejected,
          expiredInvites: mockExpired,
          applications: mockApplications,
          pendingCount: mockPending.length,
          applicationCount: mockApplications.length,
          isRefreshing: false,
          isLoadingMore: false
        });
      } else {
        const { listId, currentTab } = this.data;

        // 根据当前标签确定要查询的状态
        // status: 0-待接受, 1-已接受, 2-已拒绝, 3-已过期, 4-待审批
        let status;
        if (currentTab === 'pending') {
          status = 0;
        } else if (currentTab === 'accepted') {
          status = 1;
        } else if (currentTab === 'rejected') {
          status = 2;
        } else if (currentTab === 'expired') {
          status = 3;
        } else if (currentTab === 'applications') {
          status = 4;
        }

        // 加载申请列表(待审批)或邀请列表
        if (currentTab === 'applications') {
          // 查询待审批的申请
          const result = await wx.cloud.callFunction({
            name: 'listFunctions',
            data: {
              action: 'getInviteList',
              data: {
                listId,
                status: 4
              }
            }
          });

          if (result.result && result.result.success) {
            const applications = result.result.invites.map(invite => ({
              ...invite,
              applicantInfo: invite.inviteeInfo,
              timeText: this.formatTime(invite.createdAt)
            }));

            this.setData({
              applications,
              applicationCount: applications.length,
              isRefreshing: false
            });
          }
        } else {
          // 查询邀请列表
          const result = await wx.cloud.callFunction({
            name: 'listFunctions',
            data: {
              action: 'getInviteList',
              data: {
                listId,
                status
              }
            }
          });

          if (result.result && result.result.success) {
            const invites = result.result.invites.map(invite => ({
              ...invite,
              timeText: this.formatTime(invite.createdAt)
            }));

            if (currentTab === 'pending') {
              this.setData({
                pendingInvites: invites,
                pendingCount: invites.length,
                isRefreshing: false
              });
            } else if (currentTab === 'accepted') {
              this.setData({
                acceptedInvites: invites,
                isRefreshing: false
              });
            } else if (currentTab === 'rejected') {
              this.setData({
                rejectedInvites: invites,
                isRefreshing: false
              });
            } else if (currentTab === 'expired') {
              this.setData({
                expiredInvites: invites,
                isRefreshing: false
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('加载邀请列表失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({
        isRefreshing: false,
        isLoadingMore: false
      });
    }
  },

  // 模拟网络延迟
  simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // 格式化时间
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 3600000) {
      return Math.floor(diff / 60000) + '分钟前';
    }
    if (diff < 86400000) {
      return Math.floor(diff / 3600000) + '小时前';
    }
    if (diff < 604800000) {
      return Math.floor(diff / 86400000) + '天前';
    }

    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  },

  // ==================== 导航操作 ====================

  onBack() {
    wx.navigateBack();
  },

  // 切换标签
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab }, () => {
      this.loadInvites();
    });
  },

  // 下拉刷新
  onRefresh() {
    this.setData({ isRefreshing: true });
    this.loadInvites();
  },

  // 上拉加载更多
  onLoadMore() {
    if (this.data.isLoadingMore || !this.data.hasMore) return;
    this.setData({ isLoadingMore: true });
    // 实际项目中这里需要分页加载
    setTimeout(() => {
      this.setData({ isLoadingMore: false });
    }, 500);
  },

  // ==================== 邀请操作 ====================

  // 发起新邀请
  onNewInvite() {
    const { listId } = this.data;
    wx.navigateTo({
      url: `/pages/list-invite/list-invite?listId=${listId}`
    });
  },

  // 提醒
  async onRemind(e) {
    const { id } = e.currentTarget.dataset;

    wx.showLoading({ title: '发送中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(500);
        wx.showToast({
          title: '提醒已发送',
          icon: 'success'
        });
      } else {
        const result = await wx.cloud.callFunction({
          name: 'listFunctions',
          data: {
            action: 'remindInvite',
            data: { inviteId: id }
          }
        });

        if (result.result && result.result.success) {
          wx.showToast({
            title: '提醒已发送',
            icon: 'success'
          });
        } else {
          throw new Error(result.result?.message || '发送失败');
        }
      }
    } catch (error) {
      console.error('发送提醒失败:', error);
      wx.showToast({
        title: error.message || '发送失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 取消邀请
  onCancel(e) {
    const { id } = e.currentTarget.dataset;
    const invite = this.data.pendingInvites.find(item => item._id === id);

    this.setData({
      showCancelDialog: true,
      cancelInviteId: id,
      cancelUserName: invite?.inviteeInfo?.nickname || '该用户'
    });
  },

  onCancelDialogClose() {
    this.setData({ showCancelDialog: false });
  },

  async onConfirmCancel() {
    const { cancelInviteId } = this.data;

    this.setData({ showCancelDialog: false });

    wx.showLoading({ title: '取消中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(500);

        // 更新本地数据
        const pendingInvites = this.data.pendingInvites.filter(item => item._id !== cancelInviteId);
        this.setData({
          pendingInvites,
          pendingCount: pendingInvites.length
        });

        wx.showToast({
          title: '已取消邀请',
          icon: 'success'
        });
      } else {
        const result = await wx.cloud.callFunction({
          name: 'listFunctions',
          data: {
            action: 'cancelInvite',
            data: { inviteId: cancelInviteId }
          }
        });

        if (result.result && result.result.success) {
          this.loadInvites();
          wx.showToast({
            title: '已取消邀请',
            icon: 'success'
          });
        } else {
          throw new Error(result.result?.message || '取消失败');
        }
      }
    } catch (error) {
      console.error('取消邀请失败:', error);
      wx.showToast({
        title: error.message || '取消失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 重新邀请
  onReinvite(e) {
    const user = e.currentTarget.dataset.user;
    const { listId } = this.data;

    // 跳转到邀请页面，并传递用户信息
    wx.navigateTo({
      url: `/pages/list-invite/list-invite?listId=${listId}&mode=reinvite&userId=${user.userId}`
    });
  },

  // ==================== 申请审核操作 ====================

  // 同意申请
  async onApproveApplication(e) {
    const { id } = e.currentTarget.dataset;

    wx.showLoading({ title: '处理中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(500);

        // 更新本地数据
        const applications = this.data.applications.filter(item => item._id !== id);
        this.setData({
          applications,
          applicationCount: applications.length
        });

        wx.showToast({
          title: '已同意加入',
          icon: 'success'
        });
      } else {
        const result = await wx.cloud.callFunction({
          name: 'listFunctions',
          data: {
            action: 'approveApplication',
            data: { applicationId: id }
          }
        });

        if (result.result && result.result.success) {
          this.loadInvites();
          wx.showToast({
            title: '已同意加入',
            icon: 'success'
          });
        } else {
          throw new Error(result.result?.message || '处理失败');
        }
      }
    } catch (error) {
      console.error('同意申请失败:', error);
      wx.showToast({
        title: error.message || '处理失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 拒绝申请
  async onRejectApplication(e) {
    const { id } = e.currentTarget.dataset;

    wx.showLoading({ title: '处理中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(500);

        // 更新本地数据
        const applications = this.data.applications.filter(item => item._id !== id);
        this.setData({
          applications,
          applicationCount: applications.length
        });

        wx.showToast({
          title: '已拒绝申请',
          icon: 'none'
        });
      } else {
        const result = await wx.cloud.callFunction({
          name: 'listFunctions',
          data: {
            action: 'rejectApplication',
            data: { applicationId: id }
          }
        });

        if (result.result && result.result.success) {
          this.loadInvites();
          wx.showToast({
            title: '已拒绝申请',
            icon: 'none'
          });
        } else {
          throw new Error(result.result?.message || '处理失败');
        }
      }
    } catch (error) {
      console.error('拒绝申请失败:', error);
      wx.showToast({
        title: error.message || '处理失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // ==================== 清空操作 ====================

  onClearAll() {
    const { currentTab } = this.data;

    // 待处理和申请审核标签不允许清空
    if (currentTab === 'pending' || currentTab === 'applications') return;

    this.setData({ showClearDialog: true });
  },

  onClearDialogClose() {
    this.setData({ showClearDialog: false });
  },

  async onConfirmClear() {
    this.setData({ showClearDialog: false });

    wx.showLoading({ title: '清空中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(500);

        // 清空当前标签的数据
        if (this.data.currentTab === 'accepted') {
          this.setData({ acceptedInvites: [] });
        } else if (this.data.currentTab === 'rejected') {
          this.setData({ rejectedInvites: [] });
        } else if (this.data.currentTab === 'expired') {
          this.setData({ expiredInvites: [] });
        }

        wx.showToast({
          title: '已清空',
          icon: 'success'
        });
      } else {
        const { listId, currentTab } = this.data;

        // 根据当前标签确定要清空的状态
        // status: 0-待接受, 1-已接受, 2-已拒绝, 3-已过期, 4-待审批
        let status;
        if (currentTab === 'accepted') {
          status = 1;
        } else if (currentTab === 'rejected') {
          status = 2;
        } else if (currentTab === 'expired') {
          status = 3;
        }

        const result = await wx.cloud.callFunction({
          name: 'listFunctions',
          data: {
            action: 'clearInvites',
            data: {
              listId,
              status
            }
          }
        });

        if (result.result && result.result.success) {
          this.loadInvites();
          wx.showToast({
            title: '已清空',
            icon: 'success'
          });
        } else {
          throw new Error(result.result?.message || '清空失败');
        }
      }
    } catch (error) {
      console.error('清空邀请失败:', error);
      wx.showToast({
        title: error.message || '清空失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // ==================== 提示弹窗 ====================

  onTipDialogClose() {
    this.setData({ showTipDialog: false });
  },

  // 计算属性：是否可以清空
  canClear() {
    const { currentTab, acceptedInvites, rejectedInvites, expiredInvites } = this.data;
    if (currentTab === 'accepted') {
      return acceptedInvites.length > 0;
    }
    if (currentTab === 'rejected') {
      return rejectedInvites.length > 0;
    }
    if (currentTab === 'expired') {
      return expiredInvites.length > 0;
    }
    return false;
  }
});
