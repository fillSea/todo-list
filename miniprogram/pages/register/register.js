Page({
  data: {
    username: '',
    phone: '',
    password: ''
  },

  onUsernameInput: function (e) {
    this.setData({ username: e.detail.value });
  },

  onPhoneInput: function (e) {
    this.setData({ phone: e.detail.value });
  },

  onPasswordInput: function (e) {
    this.setData({ password: e.detail.value });
  },

  onRegister: function () {
    const { username, phone, password } = this.data;
    
    if (!username || !phone || !password) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      });
      return;
    }
    
    wx.setStorageSync('isRegistered', true);
    wx.setStorageSync('userInfo', { username, phone });
    
    wx.showToast({
      title: '注册成功',
      icon: 'success',
      duration: 1500
    });
    
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  }
});
