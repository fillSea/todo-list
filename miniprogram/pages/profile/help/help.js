Page({
  data: {
    // 帮助分类
    categories: [
      {
        id: 'getting-started',
        name: '入门指南',
        icon: 'guide-o',
        color: '#07C160'
      },
      {
        id: 'task-management',
        name: '任务管理',
        icon: 'todo-list-o',
        color: '#1989fa'
      },
      {
        id: 'list-sharing',
        name: '清单共享',
        icon: 'share-o',
        color: '#FAAD14'
      },
      {
        id: 'notification',
        name: '通知提醒',
        icon: 'bell',
        color: '#722ED1'
      },
      {
        id: 'account',
        name: '账号相关',
        icon: 'user-o',
        color: '#EB2F96'
      }
    ],
    // 常见问题
    faqList: [
      {
        id: 1,
        question: '如何创建新任务？',
        answer: '点击首页右下角的"+"按钮，填写任务标题、截止日期等信息后保存即可。',
        category: 'task-management',
        expanded: false
      },
      {
        id: 2,
        question: '如何创建清单？',
        answer: '进入"我的"页面，点击"我的清单"，然后点击右下角的"+"按钮创建新清单。',
        category: 'getting-started',
        expanded: false
      },
      {
        id: 3,
        question: '如何邀请他人协作？',
        answer: '进入清单详情页，点击"成员管理"，选择邀请方式（微信邀请或链接邀请）发送给好友。',
        category: 'list-sharing',
        expanded: false
      },
      {
        id: 4,
        question: '如何设置任务提醒？',
        answer: '创建或编辑任务时，开启"设置提醒"选项，选择提醒时间即可。',
        category: 'notification',
        expanded: false
      },
      {
        id: 5,
        question: '如何修改个人信息？',
        answer: '进入"我的"页面，点击头像区域即可进入个人信息编辑页面。',
        category: 'account',
        expanded: false
      },
      {
        id: 6,
        question: '任务逾期了怎么办？',
        answer: '逾期任务会显示在任务列表中并标红，您可以点击任务修改截止日期或标记为已完成。',
        category: 'task-management',
        expanded: false
      },
      {
        id: 7,
        question: '如何退出共享清单？',
        answer: '进入清单详情页，点击"成员管理"，找到自己的成员记录，选择"退出清单"。',
        category: 'list-sharing',
        expanded: false
      },
      {
        id: 8,
        question: '为什么收不到通知？',
        answer: '请检查"我的"-"通知设置"中的开关是否开启，并确保微信订阅消息权限已授权。',
        category: 'notification',
        expanded: false
      }
    ],
    // 当前选中的分类
    currentCategory: 'all',
    // 搜索关键词
    searchKeyword: '',
    // 过滤后的FAQ列表
    filteredFaqList: []
  },

  onLoad: function () {
    this.setData({
      filteredFaqList: this.data.faqList
    });
  },

  // 切换分类
  onCategoryChange: function (e) {
    const categoryId = e.currentTarget.dataset.id;
    this.setData({ currentCategory: categoryId });
    this.filterFaqList();
  },

  // 搜索输入
  onSearchInput: function (e) {
    this.setData({ searchKeyword: e.detail.value });
    this.filterFaqList();
  },

  // 过滤FAQ列表
  filterFaqList: function () {
    const { faqList, currentCategory, searchKeyword } = this.data;
    
    let filtered = faqList;
    
    // 按分类过滤
    if (currentCategory !== 'all') {
      filtered = filtered.filter(item => item.category === currentCategory);
    }
    
    // 按关键词搜索
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();
      filtered = filtered.filter(item => 
        item.question.toLowerCase().includes(keyword) ||
        item.answer.toLowerCase().includes(keyword)
      );
    }
    
    this.setData({ filteredFaqList: filtered });
  },

  // 展开/收起FAQ
  onToggleFaq: function (e) {
    const id = e.currentTarget.dataset.id;
    const filteredFaqList = this.data.filteredFaqList.map(item => {
      if (item.id === id) {
        return { ...item, expanded: !item.expanded };
      }
      return item;
    });
    this.setData({ filteredFaqList });
  },

  // 联系客服
  onContactSupport: function () {
    wx.showModal({
      title: '联系客服',
      content: '客服邮箱：support@example.com\n工作时间：周一至周五 9:00-18:00',
      showCancel: false
    });
  },

  // 查看用户协议
  onViewAgreement: function () {
    wx.navigateTo({
      url: '/pages/profile/help/agreement/agreement'
    });
  },

  // 查看隐私政策
  onViewPrivacy: function () {
    wx.navigateTo({
      url: '/pages/profile/help/privacy/privacy'
    });
  }
});
