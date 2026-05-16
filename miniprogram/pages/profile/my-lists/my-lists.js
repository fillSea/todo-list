const app = getApp();
const { createListVersionWatcher } = require('../../../utils/realtimeWatcher');

Page({
  data: {
    // 清单列表
    lists: [],
    isLoggedIn: false,
    // 页面类型：all-全部, shared-共享的
    type: 'all',
    // 加载状态
    loading: false,
    // 是否还有更多数据
    hasMore: true,
    // 当前页码
    page: 1,
    // 每页数量
    pageSize: 10
  },

  onLoad: function (options) {
    this.listVersionWatcher = null;
    const type = options.type || 'all';
    this.setData({ type });

    // 设置页面标题
    const title = type === 'shared' ? '共享清单' : '我的清单';
    wx.setNavigationBarTitle({ title });

    this.syncLoginState();
  },

  onShow: function () {
    this.syncLoginState();
  },

  onHide() {
    this.stopListVersionWatcher();
  },

  onUnload() {
    this.stopListVersionWatcher();
  },

  onPullDownRefresh: function () {
    if (!this.data.isLoggedIn) {
      wx.stopPullDownRefresh();
      return;
    }

    this.setData({ page: 1, hasMore: true });
    this.loadLists().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom: function () {
    if (this.data.isLoggedIn && this.data.hasMore && !this.data.loading) {
      this.loadMoreLists();
    }
  },

  syncLoginState: function () {
    const { isLoggedIn } = app.getLoginState();

    if (!isLoggedIn) {
      this.setData({
        isLoggedIn: false,
        lists: [],
        loading: false,
        hasMore: false,
        page: 1
      });
      this.stopListVersionWatcher();
      return;
    }

    this.setData({ isLoggedIn: true });
    this.loadLists();
  },

  restartListVersionWatcher(lists = this.data.lists) {
    const listIds = (lists || []).map(list => list && list._id).filter(Boolean);
    if (!this.listVersionWatcher) {
      this.listVersionWatcher = createListVersionWatcher({
        listIds,
        onChange: events => this.handleRealtimeChange(events),
        onError: err => console.error('个人清单页实时监听失败:', err)
      });
    }

    this.listVersionWatcher.restart(listIds);
  },

  stopListVersionWatcher() {
    if (this.listVersionWatcher) {
      this.listVersionWatcher.stop();
    }
  },

  handleRealtimeChange(events = []) {
    if (events.some(event => event.eventType && event.eventType.indexOf('task_') === 0)) {
      app.clearTaskCaches();
    }

    this.setData({ page: 1, hasMore: true }, () => this.loadLists());
  },

  // 加载清单列表
  loadLists: async function () {
    if (!this.data.isLoggedIn) return;

    this.setData({ loading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'listFunctions',
        data: {
          action: 'getMyLists',
          data: {
            type: this.data.type,
            page: 1,
            pageSize: this.data.pageSize
          }
        }
      });

      if (res.result && res.result.code === 0) {
        const lists = (res.result.data.list || res.result.data).map(item => ({
          ...item,
          updatedAtFormatted: this.formatDate(item.updatedAt)
        }));
        this.setData({
          lists,
          hasMore: res.result.data.hasMore || (lists.length >= this.data.pageSize),
          page: 1
        });
        this.restartListVersionWatcher(lists);
      } else {
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('加载清单失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 加载更多清单
  loadMoreLists: async function () {
    if (!this.data.isLoggedIn || this.data.loading || !this.data.hasMore) return;

    this.setData({ loading: true });
    const nextPage = this.data.page + 1;

    try {
      const res = await wx.cloud.callFunction({
        name: 'listFunctions',
        data: {
          action: 'getMyLists',
          data: {
            type: this.data.type,
            page: nextPage,
            pageSize: this.data.pageSize
          }
        }
      });

      if (res.result && res.result.code === 0) {
        const newLists = (res.result.data.list || res.result.data).map(item => ({
          ...item,
          updatedAtFormatted: this.formatDate(item.updatedAt)
        }));
        this.setData({
          lists: [...this.data.lists, ...newLists],
          hasMore: res.result.data.hasMore || (newLists.length >= this.data.pageSize),
          page: nextPage
        });
        this.restartListVersionWatcher([...this.data.lists, ...newLists]);
      }
    } catch (error) {
      console.error('加载更多清单失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 点击清单项
  onListTap: function (e) {
    if (!this.data.isLoggedIn) return;

    const listId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/list-detail/list-detail?id=${listId}`
    });
  },

  // 创建新清单
  onCreateList: function () {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({
        url: '/pages/register/register'
      });
      return;
    }

    wx.navigateTo({
      url: '/pages/list-edit/list-edit'
    });
  },

  // 删除清单
  onDeleteList: function (e) {
    const listId = e.currentTarget.dataset.id;
    const listName = e.currentTarget.dataset.name;

    wx.showModal({
      title: '确认删除',
      content: `确定要删除清单"${listName}"吗？`,
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (res.confirm) {
          this.deleteList(listId);
        }
      }
    });
  },

  // 执行删除
  deleteList: async function (listId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'listFunctions',
        data: {
          action: 'deleteList',
          data: { listId }
        }
      });

      if (res.result && res.result.code === 0) {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        // 从列表中移除
        const lists = this.data.lists.filter(item => item._id !== listId);
        this.setData({ lists });
      } else {
        wx.showToast({
          title: res.result?.message || '删除失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('删除清单失败:', error);
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    }
  },

  // 格式化日期
  formatDate: function (timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
});
