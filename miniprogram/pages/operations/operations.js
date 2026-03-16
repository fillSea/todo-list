// 调试模式开关
const DEBUG_MODE = true;

Page({
  data: {
    // 清单ID
    listId: '',

    // 操作记录列表
    operations: [],

    // 加载状态
    isLoading: false,
    isRefreshing: false,
    isLoadingMore: false,
    hasMore: true,

    // 分页参数
    page: 1,
    pageSize: 20
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

    this.setData({ listId });
    this.loadOperations();
  },

  // 加载操作记录
  async loadOperations() {
    this.setData({ isLoading: true });

    try {
      if (DEBUG_MODE) {
        // 伪造数据
        await this.simulateDelay(500);

        const mockOperations = [
          {
            _id: 'op_001',
            type: 'task_create',
            icon: 'plus',
            text: '创建了任务 "完成项目需求文档"',
            userName: '张三',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            timeText: '1小时前'
          },
          {
            _id: 'op_002',
            type: 'task_complete',
            icon: 'success',
            text: '完成了任务 "代码审查"',
            userName: '李四',
            createdAt: new Date(Date.now() - 7200000).toISOString(),
            timeText: '2小时前'
          },
          {
            _id: 'op_003',
            type: 'member_add',
            icon: 'friends-o',
            text: '添加了成员 "王五"',
            userName: '张三',
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            timeText: '1天前'
          },
          {
            _id: 'op_004',
            type: 'list_update',
            icon: 'edit',
            text: '修改了清单信息',
            userName: '张三',
            createdAt: new Date(Date.now() - 172800000).toISOString(),
            timeText: '2天前'
          },
          {
            _id: 'op_005',
            type: 'task_update',
            icon: 'edit',
            text: '更新了任务 "周例会汇报"',
            userName: '李四',
            createdAt: new Date(Date.now() - 259200000).toISOString(),
            timeText: '3天前'
          }
        ];

        this.setData({
          operations: mockOperations,
          isLoading: false,
          isRefreshing: false,
          hasMore: false
        });
      } else {
        // 生产模式：调用云函数
        const result = await wx.cloud.callFunction({
          name: 'getOperations',
          data: {
            listId: this.data.listId,
            page: this.data.page,
            pageSize: this.data.pageSize
          }
        });

        if (result.result && result.result.success) {
          const { operations, hasMore } = result.result;

          // 处理时间显示
          const processedOperations = operations.map(op => ({
            ...op,
            timeText: this.formatTime(op.createdAt)
          }));

          this.setData({
            operations: this.data.page === 1 ? processedOperations : [...this.data.operations, ...processedOperations],
            hasMore,
            isLoading: false,
            isRefreshing: false,
            isLoadingMore: false
          });
        } else {
          throw new Error(result.result?.message || '加载失败');
        }
      }
    } catch (error) {
      console.error('加载操作记录失败:', error);
      wx.showToast({
        title: '加载失败',
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

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 返回
  onBack() {
    wx.navigateBack();
  },

  // 下拉刷新
  onRefresh() {
    this.setData({
      isRefreshing: true,
      page: 1,
      hasMore: true
    }, () => {
      this.loadOperations();
    });
  },

  // 上拉加载更多
  onLoadMore() {
    if (this.data.isLoadingMore || !this.data.hasMore) return;

    this.setData({
      isLoadingMore: true,
      page: this.data.page + 1
    }, () => {
      this.loadOperations();
    });
  }
});
