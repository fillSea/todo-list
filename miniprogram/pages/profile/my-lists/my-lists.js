const app = getApp();

Page({
  data: {
    // 清单列表
    lists: [],
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
    const type = options.type || 'all';
    this.setData({ type });

    // 设置页面标题
    const title = type === 'shared' ? '共享清单' : '我的清单';
    wx.setNavigationBarTitle({ title });

    this.loadLists();
  },

  onShow: function () {
    this.loadLists();
  },

  onPullDownRefresh: function () {
    this.setData({ page: 1, hasMore: true });
    this.loadLists().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMoreLists();
    }
  },

  // 加载清单列表
  loadLists: async function () {
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
          hasMore: res.result.data.hasMore || (res.result.data.length >= this.data.pageSize),
          page: 1
        });
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
    if (this.data.loading || !this.data.hasMore) return;

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
      }
    } catch (error) {
      console.error('加载更多清单失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 点击清单项
  onListTap: function (e) {
    const listId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/list-detail/list-detail?id=${listId}`
    });
  },

  // 创建新清单
  onCreateList: function () {
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
