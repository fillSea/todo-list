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

    // 统一分享状态
    shareMode: '',
    shareInviteCode: '',
    shareInviteRole: 3,
    shareInviteLink: '',
    shareNeedApproval: false,
    shareExpireDays: 7,
    shareExpireText: '7天',
    shareReady: false,
    shareStatusText: '',
    shareHelpText: '',

    // 邀请链接轻量设置
    showLinkAdvancedSettings: false,
    showExpirePopup: false,
    linkDraftExpireDays: 7,
    linkDraftExpireText: '7天',
    linkDraftNeedApproval: false,

    myRole: null,
    canChooseApproval: false,
    forceApproval: false,

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

    // 加载数据
    this.loadData();
  },

  onShow: function () {
    if (this.data.listId && this.data.myRole === 1) {
      this.loadPendingInvites();
    }
  },

  onShareAppMessage: function () {
    const inviteCode = this.data.shareInviteCode || '';
    const listName = this.data.listInfo?.name || '共享清单';
    const isLinkInvite = this.data.shareMode === 'link';

    if (!inviteCode) {
      return {
        title: `邀请你加入"${listName}"`,
        path: '/pages/index/index',
        imageUrl: '/images/share-invite.png'
      };
    }

    this.setData({
      shareStatusText: '分享面板已打开，请发送给微信好友',
      shareHelpText: isLinkInvite
        ? '好友打开后会进入统一的邀请接受页；如已调整高级设置，请先重新生成后再分享'
        : '好友打开后需先完善资料，再确认是否加入清单'
    });

    return {
      title: `邀请你加入"${listName}"`,
      path: `/pages/list-invite-accept/list-invite-accept?code=${inviteCode}`,
      imageUrl: '/images/share-invite.png'
    };
  },

  // 加载数据
  async loadData() {
    await this.loadListInfo();

    if (!this.data.myRole) {
      return;
    }

    await Promise.all([
      this.data.myRole === 1 ? this.loadPendingInvites() : Promise.resolve(),
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

          if (![1, 2].includes(detail.myRole)) {
            wx.showToast({
              title: '仅创建者和编辑者可邀请成员',
              icon: 'none'
            });
            setTimeout(() => wx.navigateBack(), 1200);
            return;
          }

          const forceApproval = detail.myRole === 2;
          this.setData({
            listInfo,
            myRole: detail.myRole,
            canChooseApproval: detail.myRole === 1,
            forceApproval,
            linkDraftNeedApproval: forceApproval ? true : this.data.linkDraftNeedApproval
          });
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
            data: {
              listId: this.data.listId
            }
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

  // 创建邀请并准备分享
  async createInviteAndPrepare(role) {
    wx.showLoading({ title: '准备中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(500);

        this.setShareState({
          mode: 'wechat',
          inviteCode: 'debug_invite_' + Date.now(),
          role
        });
      } else {
        const { listId, forceApproval } = this.data;

        // 调用云函数生成邀请信息
        const result = await wx.cloud.callFunction({
          name: 'listFunctions',
          data: {
            action: 'createWechatInvite',
            data: {
              listId,
              role: role || 3,
              needApproval: forceApproval
            }
          }
        });

        if (result.result && result.result.success) {
          const { inviteCode } = result.result;
          this.setShareState({
            mode: 'wechat',
            inviteCode,
            role
          });
        } else if (result.result && result.result.code === -1) {
          throw new Error(result.result.message || '生成邀请失败');
        } else {
          throw new Error('生成邀请失败');
        }
      }
    } catch (error) {
      console.error('微信邀请失败:', error);
      wx.showToast({
        title: error.message || '邀请失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  getExpireText(days) {
    return days === 0 ? '永久有效' : `${days}天`;
  },

  setShareState({ mode, inviteCode, role, inviteLink = '', needApproval = false, expireDays = 7 }) {
    const expireText = this.getExpireText(expireDays);
    const finalNeedApproval = this.data.forceApproval ? true : !!needApproval;

    this.setData({
      shareMode: mode,
      shareInviteCode: inviteCode,
      shareInviteRole: role || 3,
      shareInviteLink: inviteLink,
      shareNeedApproval: finalNeedApproval,
      shareExpireDays: expireDays,
      shareExpireText: expireText,
      shareReady: true,
      shareStatusText: '邀请已准备好',
      shareHelpText: mode === 'link'
        ? '可直接分享给微信好友，或复制链接发送给其他成员；修改高级设置后需重新生成才会生效'
        : '点击下方按钮后会拉起微信分享面板，好友打开后可查看并处理邀请',
      showLinkAdvancedSettings: false
    });
  },

  onWechatShareReady() {
    if (!this.data.shareReady) {
      wx.showToast({
        title: '请先确认邀请配置',
        icon: 'none'
      });
    }
  },

  onCloseSharePanel() {
    this.setData({
      shareReady: false,
      shareMode: '',
      shareInviteCode: '',
      shareInviteLink: '',
      shareStatusText: '',
      shareHelpText: ''
    });
  },

  // ==================== 邀请链接 ====================

  onLinkInvite() {
    if (!this.checkMemberLimit()) return;

    this.showRolePopup('link');
  },

  async generateLinkInviteAndPrepare(role, showSuccessToast = false) {
    wx.showLoading({ title: '准备中...' });

    try {
      const { listId, linkDraftExpireDays, linkDraftNeedApproval, forceApproval } = this.data;
      const finalNeedApproval = forceApproval ? true : linkDraftNeedApproval;

      if (DEBUG_MODE) {
        await this.simulateDelay(500);

        const inviteCode = 'debug_link_' + Date.now();
        this.setShareState({
          mode: 'link',
          inviteCode,
          role,
          inviteLink: `https://todo.app/invite/${inviteCode}`,
          needApproval: finalNeedApproval,
          expireDays: linkDraftExpireDays
        });
      } else {
        const result = await wx.cloud.callFunction({
          name: 'listFunctions',
          data: {
            action: 'generateInviteLink',
            data: {
              listId,
              role: role || 3,
              expireDays: linkDraftExpireDays,
              needApproval: finalNeedApproval
            }
          }
        });

        if (result.result && result.result.success) {
          const { inviteCode, inviteLink } = result.result;
          this.setShareState({
            mode: 'link',
            inviteCode,
            role,
            inviteLink,
            needApproval: finalNeedApproval,
            expireDays: linkDraftExpireDays
          });
        } else {
          throw new Error(result.result?.message || '生成邀请链接失败');
        }
      }

      if (showSuccessToast) {
        wx.showToast({
          title: '链接已重新生成',
          icon: 'success'
        });
      }
    } catch (error) {
      console.error('生成邀请链接失败:', error);
      wx.showToast({
        title: error.message || '生成邀请链接失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  onToggleLinkAdvancedSettings() {
    this.setData({
      showLinkAdvancedSettings: !this.data.showLinkAdvancedSettings
    });
  },

  onChangeLinkExpire() {
    this.setData({ showExpirePopup: true });
  },

  onExpirePopupClose() {
    this.setData({ showExpirePopup: false });
  },

  onExpireSelect(e) {
    const days = parseInt(e.currentTarget.dataset.days, 10);
    this.setData({
      showExpirePopup: false,
      linkDraftExpireDays: days,
      linkDraftExpireText: this.getExpireText(days)
    });
  },

  onApprovalChange(e) {
    if (this.data.forceApproval) {
      this.setData({ linkDraftNeedApproval: true });
      return;
    }

    this.setData({
      linkDraftNeedApproval: !!e.detail
    });
  },

  onCopyInviteLink() {
    const { shareInviteLink, shareMode } = this.data;

    if (shareMode !== 'link' || !shareInviteLink) {
      wx.showToast({
        title: '请先生成邀请链接',
        icon: 'none'
      });
      return;
    }

    wx.setClipboardData({
      data: shareInviteLink,
      success: () => {
        wx.showToast({
          title: '链接已复制',
          icon: 'success'
        });
      }
    });
  },

  onRegenerateLinkInvite() {
    if (this.data.shareMode !== 'link') {
      wx.showToast({
        title: '请先生成邀请链接',
        icon: 'none'
      });
      return;
    }

    this.generateLinkInviteAndPrepare(this.data.shareInviteRole, true);
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
    const { listId, searchKeyword } = this.data;

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
            data: {
              listId,
              keyword: searchKeyword.trim()
            }
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

  onRecentAvatarError(e) {
    const index = e.currentTarget.dataset.index;
    if (index === undefined || index === null) return;

    this.setData({
      [`recentMembers[${index}].avatarUrl`]: '/images/default-avatar.png'
    });
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
      this.createInviteAndPrepare(selectedRole);
      return;
    }

    if (inviteType === 'link') {
      this.generateLinkInviteAndPrepare(selectedRole);
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
          title: this.data.forceApproval ? '邀请已发送，需创建者审核' : '邀请已发送',
          icon: 'success'
        });

        // 刷新待处理邀请列表和最近协作者
        if (this.data.myRole === 1) {
          this.loadPendingInvites();
        }
        this.loadRecentMembers();
      } else {
        // 调用云函数邀请成员
        const result = await wx.cloud.callFunction({
          name: 'listFunctions',
          data: {
            action: 'inviteMember',
            data: {
              listId,
              userId: selectedUser.userId,
              role: selectedRole,
              inviteType
            }
          }
        });

        if (result && result.result && result.result.code === 0) {
          wx.showToast({
            title: this.data.forceApproval ? '邀请已发送，需创建者审核' : '邀请已发送',
            icon: 'success'
          });
          // 刷新清单信息、待处理邀请列表和最近协作者
          this.loadListInfo();
          if (this.data.myRole === 1) {
            this.loadPendingInvites();
          }
          this.loadRecentMembers();
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
