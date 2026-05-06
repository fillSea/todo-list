Page({
  data: {
    taskId: '',
    loading: true,
    error: '',
    taskInfo: {},
    stats: {
      totalCount: 0,
      completedCount: 0,
      incompleteCount: 0,
      completionRate: 0,
      currentStreak: 0,
      longestStreak: 0,
      futureCount: 0
    },
    calendarMonths: [],
    historyRecords: [],
    priorityColor: '#999',
    priorityText: '无优先级'
  },

  onLoad: function (options) {
    const { taskId } = options;
    if (!taskId) {
      this.setData({ loading: false, error: '任务ID不能为空' });
      return;
    }
    this.setData({ taskId });
    this.loadPeriodicTaskStats();
  },

  loadPeriodicTaskStats: async function () {
    try {
      this.setData({ loading: true, error: '' });

      const result = await wx.cloud.callFunction({
        name: 'taskFunctions',
        data: {
          action: 'getPeriodicTaskStats',
          data: { taskId: this.data.taskId }
        }
      });

      if (result.result && result.result.code === 0) {
        const { taskInfo, stats, allRecords } = result.result.data;
        const priorityInfo = this.getPriorityInfo(taskInfo.priority);
        const calendarMonths = this.generateCalendarMonths(allRecords);
        const historyRecords = this.generateHistoryRecords(allRecords);

        this.setData({
          loading: false,
          taskInfo,
          stats,
          calendarMonths,
          historyRecords,
          priorityColor: priorityInfo.color,
          priorityText: priorityInfo.text
        });
      } else {
        this.setData({
          loading: false,
          error: result.result?.message || '加载失败'
        });
      }
    } catch (error) {
      console.error('加载周期任务统计失败:', error);
      this.setData({ loading: false, error: '网络错误，请重试' });
    }
  },

  getPriorityInfo: function (priority) {
    const priorityMap = {
      1: { color: '#07c160', text: '不重要不紧急' },
      2: { color: '#ffd01e', text: '紧急不重要' },
      3: { color: '#ff976a', text: '重要不紧急' },
      4: { color: '#ee0a24', text: '重要且紧急' }
    };
    return priorityMap[priority] || { color: '#999', text: '无优先级' };
  },

  // 按月分组生成日历数据
  generateCalendarMonths: function (records) {
    if (!records || records.length === 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 按日期字符串建立索引
    const recordMap = {};
    records.forEach(r => {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      recordMap[key] = r;
    });

    // 找到最早和最晚日期
    const dates = records.map(r => new Date(r.date));
    const earliest = new Date(Math.min(...dates));
    const latest = new Date(Math.max(...dates));
    earliest.setDate(1);

    const months = [];
    const current = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const endMonth = new Date(latest.getFullYear(), latest.getMonth(), 1);

    while (current <= endMonth) {
      const year = current.getFullYear();
      const month = current.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=周日

      const days = [];
      // 填充月初空白
      for (let i = 0; i < firstDayOfWeek; i++) {
        days.push({ day: '', status: -2, date: '' });
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const record = recordMap[key];
        const dateObj = new Date(year, month, d);
        dateObj.setHours(0, 0, 0, 0);

        let status;
        if (record) {
          if (record.isFuture) {
            status = 2; // 未来待完成
          } else {
            status = record.status; // 0=未完成, 1=已完成
          }
        } else {
          status = -1; // 无任务
        }

        days.push({ day: d, status, date: key });
      }

      months.push({
        label: `${year}年${month + 1}月`,
        days
      });

      current.setMonth(current.getMonth() + 1);
    }

    return months;
  },

  generateHistoryRecords: function (records) {
    if (!records) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return records
      .filter(r => !r.isFuture)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 50)
      .map(record => {
        const date = new Date(record.date);
        const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return { ...record, formattedDate };
      });
  },

  onBack: function () {
    wx.navigateBack();
  }
});
