const app = getApp();

Page({
  data: {
    // 分类列表
    categories: [],
    isLoggedIn: false,
    // 加载状态
    loading: false,
    // 编辑中的分类
    editingCategory: null,
    // 是否显示编辑弹窗
    showEditModal: false,
    // 表单数据
    formData: {
      name: '',
      color: '#1989fa'
    },
    // 预设颜色
    presetColors: [
      '#FF4D4F', '#FAAD14', '#52C41A', '#1890FF',
      '#722ED1', '#EB2F96', '#13C2C2', '#FA8C16'
    ]
  },

  onLoad: function () {
    this.syncLoginState();
  },

  onShow: function () {
    this.syncLoginState();
  },

  onPullDownRefresh: function () {
    if (!this.data.isLoggedIn) {
      wx.stopPullDownRefresh();
      return;
    }

    this.loadCategories().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  syncLoginState: function () {
    const { isLoggedIn } = app.getLoginState();

    if (!isLoggedIn) {
      this.setData({
        isLoggedIn: false,
        categories: [],
        loading: false,
        showEditModal: false,
        editingCategory: null
      });
      return;
    }

    this.setData({ isLoggedIn: true });
    this.loadCategories();
  },

  // 加载分类列表
  loadCategories: async function () {
    if (!this.data.isLoggedIn) return;

    this.setData({ loading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'categoryFunctions',
        data: {
          action: 'getCategories'
        }
      });

      if (res.result && res.result.code === 0) {
        this.setData({
          categories: res.result.data
        });
      } else {
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 显示创建弹窗
  onShowCreateModal: function () {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({
        url: '/pages/register/register'
      });
      return;
    }

    this.setData({
      editingCategory: null,
      showEditModal: true,
      formData: {
        name: '',
        color: '#1989fa'
      }
    });
  },

  // 显示编辑弹窗
  onShowEditModal: function (e) {
    if (!this.data.isLoggedIn) return;

    const category = e.currentTarget.dataset.category;
    this.setData({
      editingCategory: category,
      showEditModal: true,
      formData: {
        name: category.name,
        color: category.color
      }
    });
  },

  // 关闭弹窗
  onCloseModal: function () {
    this.setData({
      showEditModal: false,
      editingCategory: null
    });
  },

  // 输入分类名称
  onNameInput: function (e) {
    this.setData({
      'formData.name': e.detail.value
    });
  },

  // 选择颜色
  onColorSelect: function (e) {
    const color = e.currentTarget.dataset.color;
    this.setData({
      'formData.color': color
    });
  },

  // 保存分类
  onSaveCategory: async function () {
    if (!this.data.isLoggedIn) return;

    const { formData, editingCategory } = this.data;

    if (!formData.name.trim()) {
      wx.showToast({
        title: '请输入分类名称',
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({ title: '保存中...' });

      const action = editingCategory ? 'updateCategory' : 'createCategory';
      const data = {
        name: formData.name.trim(),
        color: formData.color
      };

      if (editingCategory) {
        data.categoryId = editingCategory._id;
      }

      const res = await wx.cloud.callFunction({
        name: 'categoryFunctions',
        data: {
          action,
          data
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 0) {
        wx.showToast({
          title: editingCategory ? '更新成功' : '创建成功',
          icon: 'success'
        });
        this.onCloseModal();
        this.loadCategories();
      } else {
        wx.showToast({
          title: res.result?.message || '保存失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('保存分类失败:', error);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  },

  // 删除分类
  onDeleteCategory: function (e) {
    if (!this.data.isLoggedIn) return;

    const category = e.currentTarget.dataset.category;

    wx.showModal({
      title: '确认删除',
      content: `确定要删除分类"${category.name}"吗？`,
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (res.confirm) {
          this.deleteCategory(category._id);
        }
      }
    });
  },

  // 执行删除
  deleteCategory: async function (categoryId) {
    if (!this.data.isLoggedIn) return;

    try {
      wx.showLoading({ title: '删除中...' });

      const res = await wx.cloud.callFunction({
        name: 'categoryFunctions',
        data: {
          action: 'deleteCategory',
          data: { categoryId }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 0) {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        this.loadCategories();
      } else {
        wx.showToast({
          title: res.result?.message || '删除失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('删除分类失败:', error);
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    }
  }
});
