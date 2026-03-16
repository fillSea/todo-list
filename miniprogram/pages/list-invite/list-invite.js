// 调试模式开关
const DEBUG_MODE = true;

Page({
  data: {
    // 清单ID
    listId: '',

    // 清单信息
    listInfo: {},

    // 成员上限
    maxMemberCount: 10,

    // 待处理邀请
    pendingInvites: [],

    // 最近协作成员
    recentMembers: [],

    // 权限设置弹窗
    showRolePopup: false,
    selectedRole: 2,
    selectedUser: null,
    inviteType: '',

    // 搜索弹窗
    showSearchPopup: false,
    searchKeyword: '',
    searchResults: [],
    hasSearched: false,

    // 成员上限提示
    showLimitDialog: false,

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
    this.loadData();
  },

  onShow: function () {
    if (this.data.listId) {
      this.loadPendingInvites();
    }
  },

  // 加载数据
  async loadData() {
    await Promise.all([
      this.loadListInfo(),
      this.loadPendingInvites(),
      this.loadRecentMembers()
    ]);
  },

  // 加载清单信息
  async loadListInfo() {
    try {
      if (DEBUG_MODE) {
        // 伪造数据
        const mockListInfo = {
          _id: this.data.listId,
          name: '工作任务',
          isShared: true,
          color: '#1976D2',
          memberCount: 3
        };

        this.setData({ listInfo: mockListInfo });
      } else {
        const result = await wx.cloud.callFunction({
          name: 'getListDetail',
          data: { listId: this.data.listId }
        });

        if (result.result && result.result.success) {
          this.setData({
            listInfo: result.result.list
          });
        }
      }
    } catch (error) {
      console.error('加载清单信息失败:', error);
    }
  },

  // 加载待处理邀请
  async loadPendingInvites() {
    try {
      if (DEBUG_MODE) {
        // 伪造数据
        await this.simulateDelay(300);

        const mockInvites = [
          {
            _id: 'invite_001',
            inviteeInfo: {
              nickname: '赵六',
              avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=6'
            },
            role: 2,
            status: 0,
            timeText: '2小时前'
          },
          {
            _id: 'invite_002',
            inviteeInfo: {
              nickname: '钱七',
              avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=7'
            },
            role: 3,
            status: 3,
            timeText: '1天前'
          }
        ];

        this.setData({ pendingInvites: mockInvites });
      } else {
        const result = await wx.cloud.callFunction({
          name: 'getInviteList',
          data: {
            listId: this.data.listId,
            status: 0
          }
        });

        if (result.result && result.result.success) {
          const invites = result.result.invites.map(invite => ({
            ...invite,
            timeText: this.formatTime(invite.createdAt)
          }));
          this.setData({ pendingInvites: invites });
        }
      }
    } catch (error) {
      console.error('加载待处理邀请失败:', error);
    }
  },

  // 加载最近协作成员
  async loadRecentMembers() {
    try {
      if (DEBUG_MODE) {
        // 伪造数据
        await this.simulateDelay(300);

        const mockMembers = [
          {
            userId: 'user_010',
            nickname: '周九',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=10'
          },
          {
            userId: 'user_011',
            nickname: '吴十',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=11'
          },
          {
            userId: 'user_012',
            nickname: '郑十一',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=12'
          }
        ];

        this.setData({ recentMembers: mockMembers });
      } else {
        const result = await wx.cloud.callFunction({
          name: 'getRecentCollaborators',
          data: {}
        });

        if (result.result && result.result.success) {
          this.setData({ recentMembers: result.result.members });
        }
      }
    } catch (error) {
      console.error('加载最近协作成员失败:', error);
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

  // 检查成员上限
  checkMemberLimit() {
    const { listInfo, maxMemberCount } = this.data;
    if (listInfo.memberCount >= maxMemberCount) {
      this.setData({ showLimitDialog: true });
      return false;
    }
    return true;
  },

  // ==================== 导航操作 ====================

  onBack() {
    wx.navigateBack();
  },

  // 查看全部邀请
  onViewAllInvites() {
    wx.navigateTo({
      url: `/pages/list-invite-manage/list-invite-manage?listId=${this.data.listId}`
    });
  },

  // ==================== 微信好友邀请 ====================

  onWechatInvite() {
    if (!this.checkMemberLimit()) return;

    // 检查是否支持微信好友邀请
    wx.showActionSheet({
      itemList: ['发送给微信好友', '分享到微信群'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.showRolePopup('wechat');
        } else {
          this.showRolePopup('wechat_group');
        }
      }
    });
  },

  // 打开微信选择器邀请好友
  async openWechatPicker(role) {
    wx.showLoading({ title: '准备中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(500);
        wx.hideLoading();

        // 调试模式下提示用户
        wx.showModal({
          title: '调试模式',
          content: '调试模式下无法调用真实微信选择器，请在真机测试',
          showCancel: false
        });
      } else {
        const { listId } = this.data;

        // 调用云函数生成邀请信息
        const result = await wx.cloud.callFunction({
          name: 'createWechatInvite',
          data: {
            listId,
            role
          }
        });

        if (result.result && result.result.success) {
          const { inviteCode, scene } = result.result;

          wx.hideLoading();

          // 打开微信好友选择器
          wx.shareAppMessage({
            title: `邀请你加入"${this.data.listInfo.name}"`,
            path: `/pages/list-invite-accept/list-invite-accept?code=${inviteCode}`,
            imageUrl: '/images/share-invite.png',
            success: (res) => {
              console.log('分享成功:', res);
              wx.showToast({
                title: '邀请已发送',
                icon: 'success'
              });
            },
            fail: (err) => {
              console.error('分享失败:', err);
            }
          });
        } else {
          throw new Error(result.result?.message || '生成邀请失败');
        }
      }
    } catch (error) {
      console.error('微信邀请失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: error.message || '邀请失败',
        icon: 'none'
      });
    }
  },

  // ==================== 邀请链接 ====================

  onLinkInvite() {
    if (!this.checkMemberLimit()) return;

    wx.navigateTo({
      url: `/pages/list-invite-link/list-invite-link?listId=${this.data.listId}`
    });
  },

  // ==================== 搜索用户 ====================

  onSearchInvite() {
    if (!this.checkMemberLimit()) return;

    this.setData({
      showSearchPopup: true,
      searchKeyword: '',
      searchResults: [],
      hasSearched: false
    });
  },

  onSearchPopupClose() {
    this.setData({ showSearchPopup: false });
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  onClearSearch() {
    this.setData({
      searchKeyword: '',
      searchResults: [],
      hasSearched: false
    });
  },

  async onSearchConfirm() {
    const { searchKeyword } = this.data;

    if (!searchKeyword || searchKeyword.trim().length === 0) {
      wx.showToast({
        title: '请输入搜索关键词',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '搜索中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(500);

        // 伪造搜索结果
        const mockResults = [
          {
            userId: 'user_' + searchKeyword,
            nickname: '用户' + searchKeyword,
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + searchKeyword
          }
        ];

        this.setData({
          searchResults: mockResults,
          hasSearched: true
        });
      } else {
        const result = await wx.cloud.callFunction({
          name: 'searchUser',
          data: { keyword: searchKeyword.trim() }
        });

        if (result.result && result.result.success) {
          this.setData({
            searchResults: result.result.users,
            hasSearched: true
          });
        }
      }
    } catch (error) {
      console.error('搜索用户失败:', error);
      wx.showToast({
        title: '搜索失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // ==================== 最近协作成员 ====================

  onRecentInvite() {
    if (!this.checkMemberLimit()) return;

    // 显示最近协作成员列表
    wx.showToast({
      title: '请选择下方成员',
      icon: 'none'
    });
  },

  onInviteRecent(e) {
    const user = e.currentTarget.dataset.user;
    this.setData({
      selectedUser: user,
      inviteType: 'recent'
    });
    this.showRolePopup('recent');
  },

  // ==================== 权限设置 ====================

  showRolePopup(inviteType) {
    this.setData({
      showRolePopup: true,
      inviteType,
      selectedRole: 2
    });
  },

  onRolePopupClose() {
    this.setData({ showRolePopup: false });
  },

  onRoleSelect(e) {
    const role = parseInt(e.currentTarget.dataset.role);
    this.setData({ selectedRole: role });
  },

  async onConfirmRole() {
    const { listId, selectedRole, inviteType, selectedUser } = this.data;

    this.setData({ showRolePopup: false });

    // 微信邀请特殊处理 - 打开微信选择器
    if (inviteType === 'wechat' || inviteType === 'wechat_group') {
      this.openWechatPicker(selectedRole);
      return;
    }

    wx.showLoading({ title: '发送邀请中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(800);

        wx.showToast({
          title: '邀请已发送',
          icon: 'success'
        });

        // 刷新待处理邀请列表
        this.loadPendingInvites();
      } else {
        let result;

        if (inviteType === 'search' && selectedUser) {
          // 搜索用户邀请
          result = await wx.cloud.callFunction({
            name: 'inviteMemberBySearch',
            data: {
              listId,
              userId: selectedUser.userId,
              role: selectedRole
            }
          });
        } else if (inviteType === 'recent' && selectedUser) {
          // 最近成员邀请
          result = await wx.cloud.callFunction({
            name: 'inviteMemberBySearch',
            data: {
              listId,
              userId: selectedUser.userId,
              role: selectedRole
            }
          });
        }

        if (result && result.result && result.result.success) {
          wx.showToast({
            title: '邀请已发送',
            icon: 'success'
          });
          this.loadPendingInvites();
        } else {
          throw new Error(result.result?.message || '邀请失败');
        }
      }
    } catch (error) {
      console.error('发送邀请失败:', error);
      wx.showToast({
        title: error.message || '邀请失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 邀请搜索到的用户
  onInviteUser(e) {
    const user = e.currentTarget.dataset.user;
    this.setData({
      selectedUser: user,
      inviteType: 'search',
      showSearchPopup: false
    });
    this.showRolePopup('search');
  },

  // ==================== 成员上限提示 ====================

  onLimitDialogClose() {
    this.setData({ showLimitDialog: false });
  }
});
