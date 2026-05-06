// 调试模式开关
const DEBUG_MODE = false;

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

    // 启用分享菜单
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage']
    });

    // 预生成邀请码（用于微信分享）
    this.preGenerateInviteCode();

    // 加载数据
    this.loadData();
  },

  onShow: function () {
    if (this.data.listId) {
      this.loadPendingInvites();
    }
  },

  onShareAppMessage: function () {
    const inviteCode = this._pendingInviteCode || '';
    const listName = this.data.listInfo?.name || '共享清单';
    const role = this._pendingRole || 3;

    return {
      title: `邀请你加入"${listName}"`,
      path: `/pages/list-invite-accept/list-invite-accept?code=${inviteCode}&role=${role}`,
      imageUrl: '/images/share-invite.png'
    };
  },

  // 预生成邀请码（在页面加载时调用）
  async preGenerateInviteCode() {
    try {
      const { listId } = this.data;
      if (!listId || DEBUG_MODE) return;

      const result = await wx.cloud.callFunction({
        name: 'listFunctions',
        data: {
          action: 'createWechatInvite',
          data: {
            listId,
            role: 3 // 默认角色
          }
        }
      });

      if (result.result && result.result.success) {
        this._pendingInviteCode = result.result.inviteCode;
        console.log('预生成邀请码成功:', this._pendingInviteCode);
      }
    } catch (error) {
      console.error('预生成邀请码失败:', error);
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
          name: 'listFunctions',
          data: {
            action: 'getListDetail',
            data: { listId: this.data.listId }
          }
        });

        if (result.result && result.result.code === 0) {
          const detail = result.result.data;
          const listInfo = {
            ...detail.listInfo,
            memberCount: (detail.members || []).length
          };
          this.setData({ listInfo });
        } else {
          console.error('获取清单信息失败:', result.result?.message);
          wx.showToast({
            title: '加载清单信息失败',
            icon: 'none'
          });
        }
      }
    } catch (error) {
      console.error('加载清单信息失败:', error);
      wx.showToast({
        title: '加载清单信息失败',
        icon: 'none'
      });
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
            status: 0,
            timeText: '1天前'
          }
        ];

        this.setData({ pendingInvites: mockInvites });
      } else {
        const result = await wx.cloud.callFunction({
          name: 'listFunctions',
          data: {
            action: 'getInviteList',
            data: {
              listId: this.data.listId,
              status: 0
            }
          }
        });

        if (result.result && result.result.success) {
          const invites = (result.result.invites || []).map(invite => ({
            ...invite,
            timeText: this.formatTime(invite.createdAt)
          }));
          this.setData({ pendingInvites: invites });
        } else {
          console.error('获取待处理邀请失败:', result.result?.message);
          this.setData({ pendingInvites: [] });
        }
      }
    } catch (error) {
      console.error('加载待处理邀请失败:', error);
      this.setData({ pendingInvites: [] });
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
          name: 'listFunctions',
          data: {
            action: 'getRecentCollaborators',
            data: {}
          }
        });

        if (result.result && result.result.success) {
          this.setData({ recentMembers: result.result.members || [] });
        } else {
          console.error('获取最近协作成员失败:', result.result?.message);
          this.setData({ recentMembers: [] });
        }
      }
    } catch (error) {
      console.error('加载最近协作成员失败:', error);
      this.setData({ recentMembers: [] });
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

    if (diff < 60000) {
      return '刚刚';
    }
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

    // 显示角色选择弹窗，微信邀请默认选择查看者(3)
    this.showRolePopup('wechat');
  },

  // 创建邀请并触发分享
  async createInviteAndShare(role) {
    wx.showLoading({ title: '准备中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(500);

        // 调试模式下模拟生成邀请码
        this._pendingInviteCode = 'debug_invite_' + Date.now();
        this._pendingRole = role;

        wx.hideLoading();

        // 触发分享
        this.triggerShare();
      } else {
        const { listId } = this.data;

        // 调用云函数生成邀请信息
        const result = await wx.cloud.callFunction({
          name: 'listFunctions',
          data: {
            action: 'createWechatInvite',
            data: {
              listId,
              role: role || 3
            }
          }
        });

        if (result.result && result.result.success) {
          const { inviteCode } = result.result;

          wx.hideLoading();

          // 保存邀请信息，供 onShareAppMessage 使用
          this._pendingInviteCode = inviteCode;
          this._pendingRole = role;

          // 触发分享
          this.triggerShare();
        } else if (result.result && result.result.code === -1) {
          throw new Error(result.result.message || '生成邀请失败');
        } else {
          throw new Error('生成邀请失败');
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

  // 触发分享
  triggerShare() {
    // 提示用户使用右上角菜单分享
    // 注意：微信小程序无法通过代码自动触发分享，必须由用户点击右上角菜单
    wx.showModal({
      title: '邀请已生成',
      content: '请点击右上角"..."按钮，选择"转发"来分享邀请给好友',
      showCancel: false,
      confirmText: '我知道了'
    });
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
          name: 'listFunctions',
          data: {
            action: 'searchUser',
            data: { keyword: searchKeyword.trim() }
          }
        });

        if (result.result && result.result.success) {
          this.setData({
            searchResults: result.result.users || [],
            hasSearched: true
          });
        } else {
          throw new Error(result.result?.message || '搜索失败');
        }
      }
    } catch (error) {
      console.error('搜索用户失败:', error);
      wx.showToast({
        title: error.message || '搜索失败',
        icon: 'none'
      });
      this.setData({
        searchResults: [],
        hasSearched: true
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
    // 微信邀请默认选择查看者(3)，其他邀请默认选择编辑者(2)
    const defaultRole = (inviteType === 'wechat') ? 3 : 2;
    this.setData({
      showRolePopup: true,
      inviteType,
      selectedRole: defaultRole
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

    // 微信邀请特殊处理 - 创建邀请并显示分享菜单
    if (inviteType === 'wechat') {
      this.createInviteAndShare(selectedRole);
      return;
    }

    // 检查是否有选中的用户
    if (!selectedUser || !selectedUser.userId) {
      wx.showToast({
        title: '请选择要邀请的用户',
        icon: 'none'
      });
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
        // 调用云函数邀请成员
        const result = await wx.cloud.callFunction({
          name: 'listFunctions',
          data: {
            action: 'inviteMember',
            data: {
              listId,
              userId: selectedUser.userId,
              role: selectedRole
            }
          }
        });

        if (result && result.result && result.result.code === 0) {
          wx.showToast({
            title: '已添加成员',
            icon: 'success'
          });
          // 刷新清单信息和待处理邀请列表
          this.loadListInfo();
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
