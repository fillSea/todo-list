// 调试模式开关
const DEBUG_MODE = true;

// 预设颜色选项
const COLOR_OPTIONS = [
  '#1976D2', // 蓝色
  '#2E7D32', // 绿色
  '#F57C00', // 橙色
  '#C62828', // 红色
  '#7B1FA2', // 紫色
  '#00695C', // 青色
  '#455A64', // 灰色
  '#E91E63'  // 粉色
];

Page({
  data: {
    // 是否编辑模式
    isEditing: false,
    listId: null,

    // 表单数据
    formData: {
      name: '',
      description: '',
      isShared: false,
      visibility: 1,
      color: '#1976D2'
    },

    // 颜色选项
    colorOptions: COLOR_OPTIONS,

    // 删除确认弹窗
    showDeleteDialog: false,

    // 用户信息
    userInfo: null
  },

  onLoad: function (options) {
    const { id } = options;
    const userInfo = wx.getStorageSync('userInfo');

    this.setData({
      userInfo,
      isEditing: !!id,
      listId: id || null
    });

    // 如果是编辑模式，加载清单数据
    if (id) {
      this.loadListData(id);
    }
  },

  // 加载清单数据
  async loadListData(listId) {
    wx.showLoading({ title: '加载中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(500);

        // 伪造清单数据
        const mockList = {
          _id: listId,
          name: '工作任务',
          description: '日常工作任务清单',
          isShared: true,
          visibility: 1,
          color: '#1976D2'
        };

        this.setData({
          formData: {
            name: mockList.name,
            description: mockList.description,
            isShared: mockList.isShared,
            visibility: mockList.visibility,
            color: mockList.color
          }
        });
      } else {
        // 生产模式：调用云函数
        const result = await wx.cloud.callFunction({
          name: 'getListDetail',
          data: { listId }
        });

        if (result.result && result.result.success) {
          const list = result.result.list;
          this.setData({
            formData: {
              name: list.name,
              description: list.description || '',
              isShared: list.isShared,
              visibility: list.visibility,
              color: list.color || '#1976D2'
            }
          });
        } else {
          throw new Error(result.result?.message || '加载失败');
        }
      }
    } catch (error) {
      console.error('加载清单数据失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 模拟网络延迟
  simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // ==================== 表单操作 ====================

  // 输入清单名称
  onNameInput(e) {
    this.setData({
      'formData.name': e.detail.value
    });
  },

  // 输入描述
  onDescInput(e) {
    this.setData({
      'formData.description': e.detail.value
    });
  },

  // 切换清单类型
  onTypeChange(e) {
    const type = e.currentTarget.dataset.type;
    const isShared = type === 'shared';

    this.setData({
      'formData.isShared': isShared,
      // 切换到个人清单时，重置可见性为公开
      'formData.visibility': isShared ? this.data.formData.visibility : 1
    });
  },

  // 切换可见性
  onVisibilityChange(e) {
    const visibility = parseInt(e.currentTarget.dataset.visibility);
    this.setData({
      'formData.visibility': visibility
    });
  },

  // 选择颜色
  onColorChange(e) {
    const color = e.currentTarget.dataset.color;
    this.setData({
      'formData.color': color
    });
  },

  // ==================== 保存操作 ====================

  // 取消
  onCancel() {
    wx.navigateBack();
  },

  // 保存
  async onSave() {
    const { formData, isEditing, listId } = this.data;

    // 表单验证
    if (!formData.name || formData.name.trim().length === 0) {
      wx.showToast({
        title: '请输入清单名称',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: isEditing ? '保存中...' : '创建中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(800);

        wx.showToast({
          title: isEditing ? '保存成功' : '创建成功',
          icon: 'success'
        });

        setTimeout(() => {
          // 返回并刷新上一页
          const pages = getCurrentPages();
          const prevPage = pages[pages.length - 2];
          if (prevPage && prevPage.loadData) {
            prevPage.loadData();
          }
          wx.navigateBack();
        }, 1500);
      } else {
        const cloudFnName = isEditing ? 'updateList' : 'createList';
        const params = {
          name: formData.name.trim(),
          description: formData.description.trim(),
          isShared: formData.isShared,
          visibility: formData.isShared ? formData.visibility : 1,
          color: formData.color
        };

        if (isEditing) {
          params.listId = listId;
        }

        const result = await wx.cloud.callFunction({
          name: cloudFnName,
          data: params
        });

        if (result.result && result.result.success) {
          wx.showToast({
            title: isEditing ? '保存成功' : '创建成功',
            icon: 'success'
          });

          setTimeout(() => {
            const pages = getCurrentPages();
            const prevPage = pages[pages.length - 2];
            if (prevPage && prevPage.loadData) {
              prevPage.loadData();
            }
            wx.navigateBack();
          }, 1500);
        } else {
          throw new Error(result.result?.message || '操作失败');
        }
      }
    } catch (error) {
      console.error(isEditing ? '保存清单失败:' : '创建清单失败:', error);
      wx.showToast({
        title: error.message || '操作失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // ==================== 删除操作 ====================

  // 显示删除确认
  onDelete() {
    this.setData({ showDeleteDialog: true });
  },

  // 关闭删除弹窗
  onDeleteDialogClose() {
    this.setData({ showDeleteDialog: false });
  },

  // 确认删除
  async onDeleteConfirm() {
    const { listId } = this.data;

    this.setData({ showDeleteDialog: false });

    wx.showLoading({ title: '删除中...' });

    try {
      if (DEBUG_MODE) {
        await this.simulateDelay(800);

        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });

        setTimeout(() => {
          // 返回清单列表页
          wx.navigateBack({
            delta: 2 // 返回到清单列表
          });
        }, 1500);
      } else {
        const result = await wx.cloud.callFunction({
          name: 'deleteList',
          data: { listId }
        });

        if (result.result && result.result.success) {
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });

          setTimeout(() => {
            wx.navigateBack({
              delta: 2
            });
          }, 1500);
        } else {
          throw new Error(result.result?.message || '删除失败');
        }
      }
    } catch (error) {
      console.error('删除清单失败:', error);
      wx.showToast({
        title: error.message || '删除失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  }
});
