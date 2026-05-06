// 调试模式开关
const DEBUG_MODE = false;

Page({
  data: {
    // 清单ID
    listId: '',

    // 清单信息
    listInfo: {},

    // 成员列表
    members: [],
    creators: [],
    editors: [],
    viewers: [],

    // 权限
    canManageMembers: false,
    myRole: null,

    // 加载状态
    isLoading: false,
    isRefreshing: false,

    // 添加成员弹窗
    showAddPopup: false,
    newMemberId: '',
    newMemberRole: 2,

    // 修改权限弹窗
    showRolePopup: false,
    selectedMemberId: '',
    selectedUserId: '',
    selectedRole: 2,

    // 移除确认弹窗
    showRemoveDialog: false,
    removeMemberId: '',
    removeUserId: '',
    removeMemberName: '',

    // 待处理邀请数量
    pendingInviteCount: 0,

    // 用户信息
    userInfo: null,

    // 调试模式标识（用于显示调试信息）
    DEBUG_MODE: DEBUG_MODE
  },

  onLoad: function (options) {
    const { listId, mode } = options;

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
      userInfo,
      showAddPopup: mode === 'add'
    });

    // 加载成员列表
    this.loadMembers();
  },

  onShow: function () {
    if (this.data.listId) {
      this.loadMembers();
    }
  },

  // 加载成员列表
  async loadMembers() {
    this.setData({ isLoading: true });

    try {
      if (DEBUG_MODE) {
        // 伪造数据
        await this.simulateDelay(500);

        const mockListInfo = {
          _id: this.data.listId,
          name: '工作任务',
          isShared: true
        };

        const mockMembers = [
          {
            _id: 'member_001',
            userId: 'user_001',
            role: 1,
            nickname: '张三',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=1'
          },
          {
            _id: 'member_002',
            userId: 'user_002',
            role: 2,
            nickname: '李四',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=2'
          },
          {
            _id: 'member_003',
            userId: 'user_003',
            role: 3,
            nickname: '王五',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=3'
          }
        ];

        // 检查当前用户权限
        const myMemberInfo = mockMembers.find(m => m.userId === 'user_001');
        const myRole = myMemberInfo ? myMemberInfo.role : null;

        // 分类成员
        const creators = mockMembers.filter(m => m.role === 1);
        const editors = mockMembers.filter(m => m.role === 2);
        const viewers = mockMembers.filter(m => m.role === 3);

        this.setData({
          listInfo: mockListInfo,
          members: mockMembers,
          creators,
          editors,
          viewers,
          myRole,
          canManageMembers: myRole === 1,
          pendingInviteCount: 2, // 伪造待处理邀请数量
          isLoading: false,
          isRefreshing: false
        });
      } else {
        // 生产模式：调用云函数
        const result = await wx.cloud.callFunction({
          name: 'listFunctions',
          data: {
            action: 'getListMembers',
            data: { listId: this.data.listId }
          }
        });

        if (result.result && result.result.code === 0) {
          const { listInfo, members, myRole } = result.result.data;

          const creators = members.filter(m => m.role === 1);
          const editors = members.filter(m => m.role === 2);
          const viewers = members.filter(m => m.role === 3);

          this.setData({
            listInfo,
            members,
            creators,
            editors,
            viewers,
            myRole,
            canManageMembers: myRole === 1,
            isLoading: false,
            isRefreshing: false
          });
        } else {
          throw new Error(result.result?.message || '加载失败');
        }
      }
    } catch (error) {
      console.error('加载成员列表失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({
        isLoading: false,
        isRefreshing: false
      });
    }
  },

  // 模拟网络延迟
  simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // ==================== 导航操作 ====================

  // 返回
  onBack() {
    wx.navigateBack();
  },

  // 下拉刷新
  onRefresh() {
    this.setData({ isRefreshing: true });
    this.loadMembers();
  },

  // ==================== 添加成员 ====================

  // 显示添加成员弹窗
  onInviteMember() {
    const { listId } = this.data;
    wx.navigateTo({
      url: `/pages/list-invite/list-invite?listId=${listId}`
    });
  },

  // 跳转到邀请管理页面
  onManageInvites() {
    const { listId } = this.data;
    wx.navigateTo({
      url: `/pages/list-invite-manage/list-invite-manage?listId=${listId}`
    });
  },

  // 兼容旧版添加成员（保留原有弹窗方式作为备选）
  onAddMember() {
    this.setData({
      showAddPopup: true,
      newMemberId: '',
      newMemberRole: 2
    });
  },

  // 关闭添加成员弹窗
  onAddPopupClose() {
    this.setData({ showAddPopup: false });
  },

  // 输入成员ID
  onMemberIdInput(e) {
    this.setData({ newMemberId: e.detail.value });
  },

  // 选择角色
  onRoleSelect(e) {
    const role = parseInt(e.currentTarget.dataset.role);
    this.setData({ newMemberRole: role });
  },

  // 提交添加成员
  async onSubmitAdd() {
    const { listId, newMemberId, newMemberRole } = this.data;

    if (!newMemberId || newMemberId.trim().length === 0) {
      wx.showToast({
        title: '请输入用户ID',
        icon: 'none'
      });
      return;
    }

    // 检查是否已存在
    const exists = this.data.members.some(m => m.userId === newMemberId.trim());
    if (exists) {
      wx.showToast({
        title: '该用户已是成员',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '添加中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(800);

        // 创建新成员
        const newMember = {
          _id: 'member_' + Date.now(),
          userId: newMemberId.trim(),
          role: newMemberRole,
          nickname: '用户' + newMemberId.slice(-4),
          avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + newMemberId
        };

        const members = [...this.data.members, newMember];
        const editors = members.filter(m => m.role === 2);
        const viewers = members.filter(m => m.role === 3);

        this.setData({
          members,
          editors,
          viewers,
          showAddPopup: false,
          newMemberId: ''
        });

        wx.showToast({
          title: '添加成功',
          icon: 'success'
        });
      } else {
        const result = await wx.cloud.callFunction({
          name: 'listFunctions',
          data: {
            action: 'inviteMember',
            data: {
              listId,
              userId: newMemberId.trim(),
              role: newMemberRole
            }
          }
        });

        if (result.result && result.result.code === 0) {
          this.setData({
            showAddPopup: false,
            newMemberId: ''
          });
          this.loadMembers();
          wx.showToast({
            title: '添加成功',
            icon: 'success'
          });
        } else {
          throw new Error(result.result?.message || '添加失败');
        }
      }
    } catch (error) {
      console.error('添加成员失败:', error);
      wx.showToast({
        title: error.message || '添加失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // ==================== 修改权限 ====================

  // 显示修改权限弹窗
  onChangeRole(e) {
    const { id, userid, role } = e.currentTarget.dataset;
    this.setData({
      showRolePopup: true,
      selectedMemberId: id,
      selectedUserId: userid,
      selectedRole: parseInt(role)
    });
  },

  // 关闭修改权限弹窗
  onRolePopupClose() {
    this.setData({ showRolePopup: false });
  },

  // 选择新角色
  onNewRoleSelect(e) {
    const role = parseInt(e.currentTarget.dataset.role);
    this.setData({ selectedRole: role });
  },

  // 提交权限修改
  async onSubmitRoleChange() {
    const { listId, selectedMemberId, selectedRole } = this.data;

    wx.showLoading({ title: '保存中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(500);

        // 更新本地数据
        const members = this.data.members.map(m => {
          if (m._id === selectedMemberId) {
            return { ...m, role: selectedRole };
          }
          return m;
        });

        const editors = members.filter(m => m.role === 2);
        const viewers = members.filter(m => m.role === 3);

        this.setData({
          members,
          editors,
          viewers,
          showRolePopup: false
        });

        wx.showToast({
          title: '修改成功',
          icon: 'success'
        });
      } else {
        const result = await wx.cloud.callFunction({
          name: 'listFunctions',
          data: {
            action: 'updateMemberRole',
            data: {
              listId,
              memberId: selectedMemberId,
              role: selectedRole
            }
          }
        });

        if (result.result && result.result.code === 0) {
          this.setData({ showRolePopup: false });
          this.loadMembers();
          wx.showToast({
            title: '修改成功',
            icon: 'success'
          });
        } else {
          throw new Error(result.result?.message || '修改失败');
        }
      }
    } catch (error) {
      console.error('修改权限失败:', error);
      wx.showToast({
        title: error.message || '修改失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // ==================== 移除成员 ====================

  // 显示移除确认
  onRemoveMember(e) {
    const { id, userid, name } = e.currentTarget.dataset;
    this.setData({
      showRemoveDialog: true,
      removeMemberId: id,
      removeUserId: userid,
      removeMemberName: name || '该成员'
    });
  },

  // 关闭移除弹窗
  onRemoveDialogClose() {
    this.setData({ showRemoveDialog: false });
  },

  // 确认移除
  async onConfirmRemove() {
    const { listId, removeMemberId, removeUserId } = this.data;

    this.setData({ showRemoveDialog: false });

    wx.showLoading({ title: '移除中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(500);

        // 更新本地数据
        const members = this.data.members.filter(m => m._id !== removeMemberId);
        const creators = members.filter(m => m.role === 1);
        const editors = members.filter(m => m.role === 2);
        const viewers = members.filter(m => m.role === 3);

        this.setData({
          members,
          creators,
          editors,
          viewers
        });

        wx.showToast({
          title: '移除成功',
          icon: 'success'
        });
      } else {
        const result = await wx.cloud.callFunction({
          name: 'listFunctions',
          data: {
            action: 'removeMember',
            data: {
              listId,
              userId: removeUserId
            }
          }
        });

        if (result.result && result.result.code === 0) {
          this.loadMembers();
          wx.showToast({
            title: '移除成功',
            icon: 'success'
          });
        } else {
          throw new Error(result.result?.message || '移除失败');
        }
      }
    } catch (error) {
      console.error('移除成员失败:', error);
      wx.showToast({
        title: error.message || '移除失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  }
});
