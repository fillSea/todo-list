const app = getApp();

// 调试模式开关 - 设置为 true 使用伪造数据
const DEBUG_MODE = false;

// 伪造数据 - 用于调试
const MOCK_DATA = {
  // 当前用户openid
  currentUserId: 'user_001',

  // 伪造清单数据
  lists: [
    {
      _id: 'list_001',
      name: '工作任务',
      description: '日常工作任务清单',
      isShared: true,
      visibility: 1,
      color: '#1976D2',
      creatorId: 'user_001',
      createdAt: '2024-03-10T08:00:00Z',
      updatedAt: new Date(Date.now() - 3600000).toISOString(), // 1小时前
      taskCount: 12,
      pendingCount: 3,
      myRole: 1,
      members: [
        { avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=1' },
        { avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=2' },
        { avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=3' }
      ],
      memberCount: 5
    },
    {
      _id: 'list_002',
      name: '个人生活',
      description: '记录日常生活事项',
      isShared: false,
      visibility: 2,
      color: '#2E7D32',
      creatorId: 'user_001',
      createdAt: '2024-03-08T10:00:00Z',
      updatedAt: new Date(Date.now() - 86400000).toISOString(), // 1天前
      taskCount: 8,
      pendingCount: 2,
      myRole: 1,
      members: [],
      memberCount: 0
    },
    {
      _id: 'list_003',
      name: '团队项目',
      description: 'Q1季度项目规划',
      isShared: true,
      visibility: 1,
      color: '#C62828',
      creatorId: 'user_002',
      createdAt: '2024-03-05T14:00:00Z',
      updatedAt: new Date(Date.now() - 172800000).toISOString(), // 2天前
      taskCount: 20,
      pendingCount: 8,
      myRole: 2,
      members: [
        { avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=4' },
        { avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=5' }
      ],
      memberCount: 4
    },
    {
      _id: 'list_004',
      name: '学习计划',
      description: '技能提升和学习目标',
      isShared: false,
      visibility: 2,
      creatorId: 'user_001',
      createdAt: '2024-03-01T09:00:00Z',
      updatedAt: new Date(Date.now() - 604800000).toISOString(), // 7天前
      taskCount: 15,
      pendingCount: 0,
      myRole: 1,
      members: [],
      memberCount: 0
    },
    {
      _id: 'list_005',
      name: '家庭事务',
      description: '家庭日常事务管理',
      isShared: true,
      visibility: 2,
      creatorId: 'user_003',
      createdAt: '2024-02-28T16:00:00Z',
      updatedAt: new Date(Date.now() - 120000).toISOString(), // 2分钟前
      taskCount: 6,
      pendingCount: 1,
      myRole: 3,
      members: [
        { avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=6' }
      ],
      memberCount: 3
    },
    {
      _id: 'list_006',
      name: '健身计划',
      description: '每周健身安排',
      isShared: false,
      visibility: 2,
      creatorId: 'user_001',
      createdAt: '2024-02-20T07:00:00Z',
      updatedAt: '2024-03-01T10:00:00Z',
      taskCount: 4,
      pendingCount: 4,
      myRole: 1,
      members: [],
      memberCount: 0
    },
    {
      _id: 'list_007',
      name: '旅行清单',
      description: '日本旅行准备事项',
      isShared: true,
      visibility: 1,
      creatorId: 'user_001',
      createdAt: '2024-03-12T11:00:00Z',
      updatedAt: new Date(Date.now() - 300000).toISOString(), // 5分钟前
      taskCount: 25,
      pendingCount: 15,
      myRole: 1,
      members: [
        { avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=7' },
        { avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=8' }
      ],
      memberCount: 3
    },
    {
      _id: 'list_008',
      name: '阅读清单',
      description: '2024年阅读计划',
      isShared: false,
      visibility: 2,
      creatorId: 'user_004',
      createdAt: '2024-01-15T08:00:00Z',
      updatedAt: '2024-02-28T18:00:00Z',
      taskCount: 10,
      pendingCount: 7,
      myRole: 3,
      members: [],
      memberCount: 0
    }
  ]
};

Page({
  data: {
    // 列表数据
    lists: [],
    filteredLists: [],

    // 筛选状态
    currentFilter: 'all',

    // 搜索状态
    isSearching: false,
    searchKeyword: '',

    // 加载状态
    isLoading: false,
    isRefreshing: false,
    isLoadingMore: false,
    hasMore: true,

    // 分页参数
    page: 1,
    pageSize: 20,

    // 弹窗状态
    showDialog: false,
    isEditing: false,
    editingId: null,
    formData: {
      name: '',
      description: '',
      isShared: false,
      visibility: 2
    },

    // 操作菜单
    showActionSheet: false,
    actionSheetActions: [],
    selectedListId: null,

    // 删除确认
    showDeleteDialog: false,
    deletingId: null,

    // 用户信息
    userInfo: null,
    isLoggedIn: false,

    // 滚动区域顶部间距（根据搜索框显示状态动态调整）
    scrollMarginTop: 104,
    // 滚动区域高度
    scrollHeight: 0,

    // 空状态文本
    emptyTitle: '暂无清单',
    emptyDesc: '点击右上角 + 创建清单'
  },

  onLoad: function (options) {
    // 计算滚动区域高度
    const scrollMarginTop = 104;
    const windowHeight = wx.getSystemInfoSync().windowHeight;

    this.setData({
      scrollMarginTop,
      scrollHeight: windowHeight - scrollMarginTop
    });

    this.syncLoginState();
  },

  onShow: function () {
    this.syncLoginState(false);
  },

  syncLoginState(showLoading = true) {
    const { isLoggedIn, userInfo } = app.getLoginState();

    if (!isLoggedIn) {
      this.resetGuestData();
      return;
    }

    this.setData({
      isLoggedIn: true,
      userInfo
    }, () => {
      this.loadLists(showLoading);
    });
  },

  resetGuestData() {
    this.setData({
      isLoggedIn: false,
      userInfo: null,
      lists: [],
      filteredLists: [],
      currentFilter: 'all',
      isSearching: false,
      searchKeyword: '',
      isLoading: false,
      isRefreshing: false,
      isLoadingMore: false,
      hasMore: true,
      page: 1,
      showDialog: false,
      isEditing: false,
      editingId: null,
      showActionSheet: false,
      actionSheetActions: [],
      selectedListId: null,
      showDeleteDialog: false,
      deletingId: null,
      emptyTitle: '完善资料后查看你的清单',
      emptyDesc: '完善个人资料后可创建个人清单和共享清单'
    });
  },

  // ==================== 数据加载 ====================

  // 加载清单列表
  async loadLists(showLoading = true) {
    if (!this.data.isLoggedIn) {
      this.resetGuestData();
      return;
    }

    if (showLoading) {
      this.setData({ isLoading: true });
    }

    try {
      const { page, pageSize, currentFilter } = this.data;

      let lists = [];
      let hasMore = false;

      // 调试模式：使用伪造数据
      if (DEBUG_MODE) {
        await this.simulateDelay(500); // 模拟网络延迟

        // 根据筛选条件过滤数据
        let filteredLists = this.filterMockData(MOCK_DATA.lists, currentFilter);

        // 分页
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        lists = filteredLists.slice(start, end);
        hasMore = end < filteredLists.length;
      } else {
        // 生产模式：调用云函数
        const result = await wx.cloud.callFunction({
          name: 'listFunctions',
          data: {
            action: 'getMyLists',
            data: {
              filter: currentFilter,
              page,
              pageSize
            }
          }
        });

        if (result.result && result.result.code === 0) {
          lists = result.result.data.list || [];
          hasMore = result.result.data.hasMore || false;
        } else {
          throw new Error(result.result?.message || '加载失败');
        }
      }

      // 处理列表数据
      const processedLists = this.processListData(lists);

      this.setData({
        lists: page === 1 ? processedLists : [...this.data.lists, ...processedLists],
        hasMore,
        isLoading: false,
        isRefreshing: false,
        isLoadingMore: false
      });

      // 应用筛选
      this.applyFilter();

    } catch (error) {
      console.error('加载清单列表失败:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
      this.setData({
        isLoading: false,
        isRefreshing: false,
        isLoadingMore: false
      });
    }
  },

  // 模拟网络延迟
  simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // 根据筛选条件过滤伪造数据
  filterMockData(lists, filter) {
    const currentUserId = MOCK_DATA.currentUserId;

    switch (filter) {
      case 'personal':
        // 个人清单：isShared = false
        return lists.filter(list => !list.isShared);
      case 'shared':
        // 共享清单：isShared = true
        return lists.filter(list => list.isShared);
      case 'created':
        // 我创建的：creatorId = 当前用户
        return lists.filter(list => list.creatorId === currentUserId);
      default:
        // 全部：显示所有当前用户有权限的清单
        return lists.filter(list => {
          // 自己创建的
          if (list.creatorId === currentUserId) return true;
          // 是成员（有myRole字段表示是成员）
          if (list.myRole) return true;
          return false;
        });
    }
  },

  // 处理列表数据
  processListData(lists) {
    return lists.map(list => {
      // 计算进度
      const taskCount = list.taskCount || 0;
      const pendingCount = list.pendingCount || 0;
      const completedCount = taskCount - pendingCount;
      const progress = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;

      // 进度条颜色
      let progressColor = '#4CAF50';
      if (progress < 50) progressColor = '#F44336';
      else if (progress < 80) progressColor = '#FF9800';

      // 格式化更新时间
      const updateTimeText = this.formatTime(list.updatedAt);

      // 限制成员头像显示数量
      const members = (list.members || []).slice(0, 3);
      const memberCount = list.memberCount || 0;

      return {
        ...list,
        progress,
        progressColor,
        updateTimeText,
        members,
        memberCount,
        showActions: false
      };
    });
  },

  // 格式化时间
  formatTime(timestamp) {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // 小于1分钟
    if (diff < 60000) {
      return '刚刚';
    }
    // 小于1小时
    if (diff < 3600000) {
      return Math.floor(diff / 60000) + '分钟前';
    }
    // 小于24小时
    if (diff < 86400000) {
      return Math.floor(diff / 3600000) + '小时前';
    }
    // 小于7天
    if (diff < 604800000) {
      return Math.floor(diff / 86400000) + '天前';
    }

    // 超过7天显示日期
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // ==================== 筛选功能 ====================

  // 切换筛选条件
  onFilterChange(e) {
    const filter = e.currentTarget.dataset.filter;
    if (filter === this.data.currentFilter) return;

    this.setData({
      currentFilter: filter,
      page: 1,
      hasMore: true
    }, () => {
      this.loadLists();
    });
  },

  // 应用筛选（本地筛选，用于搜索）
  applyFilter() {
    const { lists, searchKeyword } = this.data;

    let filtered = lists;
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      filtered = lists.filter(list => {
        return (list.name && list.name.toLowerCase().includes(keyword)) ||
          (list.description && list.description.toLowerCase().includes(keyword));
      });
    }

    this.setData({
      filteredLists: filtered,
      emptyTitle: this._getEmptyTitle(),
      emptyDesc: this._getEmptyDesc()
    });
  },

  // ==================== 搜索功能 ====================

  // 显示搜索框
  onSearch() {
    if (!this.data.isLoggedIn) {
      return;
    }

    const windowHeight = wx.getSystemInfoSync().windowHeight;
    const scrollMarginTop = 156;
    this.setData({
      isSearching: true,
      scrollMarginTop: scrollMarginTop,
      scrollHeight: windowHeight - scrollMarginTop
    });
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value }, () => {
      this.applyFilter();
    });
  },

  // 确认搜索
  onSearchConfirm() {
    this.applyFilter();
  },

  // 清除搜索
  onClearSearch() {
    this.setData({ searchKeyword: '' }, () => {
      this.applyFilter();
    });
  },

  // 取消搜索
  onCancelSearch() {
    const windowHeight = wx.getSystemInfoSync().windowHeight;
    const scrollMarginTop = 104;
    const that = this;
    // 先隐藏搜索框并更新 margin-top 和高度
    this.setData({
      isSearching: false,
      searchKeyword: '',
      scrollMarginTop: scrollMarginTop,
      scrollHeight: windowHeight - scrollMarginTop
    }, () => {
      that.applyFilter();
    });
  },

  // ==================== 下拉刷新 & 上拉加载 ====================

  // 下拉刷新
  onRefresh() {
    if (!this.data.isLoggedIn) {
      return;
    }

    this.setData({
      isRefreshing: true,
      page: 1,
      hasMore: true
    }, () => {
      this.loadLists(false);
    });
  },

  // 上拉加载更多
  onLoadMore() {
    if (!this.data.isLoggedIn || this.data.isLoadingMore || !this.data.hasMore) return;

    this.setData({
      isLoadingMore: true,
      page: this.data.page + 1
    }, () => {
      this.loadLists(false);
    });
  },

  // ==================== 清单操作 ====================

  // 点击清单卡片
  onListClick(e) {
    if (!this.data.isLoggedIn) {
      return;
    }

    const listId = e.currentTarget.dataset.id;
    const list = this.data.lists.find(item => item._id === listId);

    if (!list) return;

    // 跳转到清单详情页
    wx.navigateTo({
      url: `/pages/list-detail/list-detail?id=${listId}`
    });
  },

  // 长按清单卡片
  onListLongPress(e) {
    if (!this.data.isLoggedIn) {
      return;
    }

    const listId = e.currentTarget.dataset.id;
    const list = this.data.lists.find(item => item._id === listId);

    if (!list) return;

    // 判断用户权限
    const userInfo = this.data.userInfo || {};
    const currentUserId = userInfo._id || userInfo.openid;
    const isCreator = list.creatorId === currentUserId;
    const myRole = list.myRole;

    // 构建操作菜单
    let actions = [
      { name: '查看详情', type: 'view' }
    ];

    // 创建者或编辑者可以编辑
    if (isCreator || myRole === 2) {
      actions.push({ name: '编辑清单', type: 'edit' });
    }

    // 创建者可以管理成员
    if (isCreator && list.isShared) {
      actions.push({ name: '管理成员', type: 'members' });
    }

    // 创建者可以删除
    if (isCreator) {
      actions.push({ name: '删除清单', type: 'delete', color: '#ee0a24' });
    }

    this.setData({
      showActionSheet: true,
      actionSheetActions: actions,
      selectedListId: listId
    });
  },

  // 选择操作菜单
  onActionSheetSelect(e) {
    const action = e.detail;
    const type = action.type || action.name;
    const { selectedListId } = this.data;

    this.setData({ showActionSheet: false });

    switch (type) {
      case 'view':
      case '查看详情':
        wx.navigateTo({
          url: `/pages/list-detail/list-detail?id=${selectedListId}`
        });
        break;
      case 'edit':
      case '编辑清单':
        this.openEditDialog(selectedListId);
        break;
      case 'members':
      case '管理成员':
        wx.navigateTo({
          url: `/pages/list-members/list-members?listId=${selectedListId}`
        });
        break;
      case 'delete':
      case '删除清单':
        this.setData({
          showDeleteDialog: true,
          deletingId: selectedListId
        });
        break;
    }
  },

  // 关闭操作菜单
  onActionSheetClose() {
    this.setData({ showActionSheet: false });
  },

  // ==================== 创建/编辑清单 ====================

  // 打开创建弹窗
  onCreateList() {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({
        url: '/pages/register/register'
      });
      return;
    }

    this.setData({
      showDialog: true,
      isEditing: false,
      editingId: null,
      formData: {
        name: '',
        description: '',
        isShared: false,
        visibility: 2
      }
    });
  },

  // 打开编辑弹窗
  openEditDialog(listId) {
    const list = this.data.lists.find(item => item._id === listId);
    if (!list) return;

    this.setData({
      showDialog: true,
      isEditing: true,
      editingId: listId,
      formData: {
        name: list.name,
        description: list.description || '',
        isShared: list.isShared,
        visibility: list.visibility || 2
      }
    });
  },

  // 关闭弹窗
  onDialogClose() {
    this.setData({ showDialog: false });
  },

  // 确认创建/编辑
  async onDialogConfirm() {
    const { formData, isEditing, editingId } = this.data;

    // 表单验证
    if (!formData.name || formData.name.trim().length < 2) {
      wx.showToast({
        title: '清单名称至少2个字符',
        icon: 'none'
      });
      return;
    }

    if (formData.name.trim().length > 50) {
      wx.showToast({
        title: '清单名称最多50个字符',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: isEditing ? '保存中...' : '创建中...' });

    try {
      if (DEBUG_MODE) {
        // 调试模式：本地操作数据
        await this.simulateDelay(300);

        if (isEditing) {
          // 编辑清单
          const index = MOCK_DATA.lists.findIndex(item => item._id === editingId);
          if (index !== -1) {
            MOCK_DATA.lists[index] = {
              ...MOCK_DATA.lists[index],
              name: formData.name,
              description: formData.description,
              isShared: formData.isShared,
              visibility: formData.visibility,
              updatedAt: new Date().toISOString()
            };
          }
        } else {
          // 创建清单
          const newList = {
            _id: 'list_' + Date.now(),
            name: formData.name,
            description: formData.description,
            isShared: formData.isShared,
            visibility: formData.visibility,
            creatorId: MOCK_DATA.currentUserId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            taskCount: 0,
            pendingCount: 0,
            myRole: 1,
            members: formData.isShared ? [
              { avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + Date.now() }
            ] : [],
            memberCount: formData.isShared ? 1 : 0
          };
          MOCK_DATA.lists.unshift(newList);
        }

        wx.showToast({
          title: isEditing ? '保存成功' : '创建成功',
          icon: 'success'
        });

        this.setData({ showDialog: false });

        // 刷新列表
        this.setData({ page: 1 }, () => {
          this.loadLists();
        });
      } else {
        // 生产模式：调用云函数
        const cloudFnName = isEditing ? 'updateList' : 'createList';
        const params = {
          ...formData
        };

        if (isEditing) {
          params.listId = editingId;
        }

        const result = await wx.cloud.callFunction({
          name: 'listFunctions',
          data: {
            action: cloudFnName,
            data: params
          }
        });

        if (result.result && result.result.code === 0) {
          wx.hideLoading();
          wx.showToast({
            title: isEditing ? '保存成功' : '创建成功',
            icon: 'success'
          });

          this.setData({ showDialog: false, page: 1 });

          // 刷新列表
          await this.loadLists();
        } else {
          throw new Error(result.result?.message || '操作失败');
        }
      }
    } catch (error) {
      console.error(isEditing ? '编辑清单失败:' : '创建清单失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: error.message || '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  // 输入清单名称
  onNameInput(e) {
    this.setData({
      'formData.name': e.detail.value
    });
  },

  // 输入清单描述
  onDescInput(e) {
    this.setData({
      'formData.description': e.detail.value
    });
  },

  // 切换清单类型
  onTypeChange(e) {
    const isShared = e.detail === 'shared';
    this.setData({
      'formData.isShared': isShared,
      'formData.visibility': isShared ? 1 : 2
    });
  },

  // 切换可见性
  onVisibilityChange(e) {
    const visibility = e.detail === 'public' ? 1 : 2;
    this.setData({
      'formData.visibility': visibility
    });
  },

  // ==================== 删除清单 ====================

  // 关闭删除弹窗
  onDeleteDialogClose() {
    this.setData({
      showDeleteDialog: false,
      deletingId: null
    });
  },

  // 确认删除
  async onDeleteConfirm() {
    const { deletingId } = this.data;

    if (!deletingId) return;

    wx.showLoading({ title: '删除中...' });

    try {
      if (DEBUG_MODE) {
        // 调试模式：本地删除数据
        await this.simulateDelay(300);

        const index = MOCK_DATA.lists.findIndex(item => item._id === deletingId);
        if (index !== -1) {
          MOCK_DATA.lists.splice(index, 1);
        }

        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });

        this.setData({
          showDeleteDialog: false,
          deletingId: null
        });

        // 刷新列表
        this.loadLists();
      } else {
        // 生产模式：调用云函数
        const result = await wx.cloud.callFunction({
          name: 'listFunctions',
          data: {
            action: 'deleteList',
            data: { listId: deletingId }
          }
        });

        if (result.result && result.result.code === 0) {
          wx.hideLoading();
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });

          this.setData({
            showDeleteDialog: false,
            deletingId: null,
            page: 1
          });

          // 刷新列表
          await this.loadLists();
        } else {
          throw new Error(result.result?.message || '删除失败');
        }
      }
    } catch (error) {
      console.error('删除清单失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: error.message || '删除失败，请重试',
        icon: 'none'
      });
    }
  },

  // ==================== 计算属性 ====================

  // 空状态标题
  _getEmptyTitle() {
    const { currentFilter, searchKeyword } = this.data;

    if (searchKeyword) {
      return '未找到匹配的清单';
    }

    switch (currentFilter) {
      case 'personal':
        return '暂无个人清单';
      case 'shared':
        return '暂无共享清单';
      case 'created':
        return '您还没有创建清单';
      default:
        return '暂无清单';
    }
  },

  // 空状态描述
  _getEmptyDesc() {
    const { currentFilter, searchKeyword } = this.data;

    if (searchKeyword) {
      return '请尝试其他关键词';
    }

    switch (currentFilter) {
      case 'personal':
        return '创建个人清单来管理您的任务';
      case 'shared':
        return '创建或加入共享清单与他人协作';
      case 'created':
        return '点击右上角 + 创建您的第一个清单';
      default:
        return '点击右上角 + 创建清单';
    }
  }
});
