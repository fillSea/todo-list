// 任务编辑页面的公共逻辑 mixin
// 用于 task-edit 和 task-detail 页面共享代码

module.exports = {
  // 公共数据
  data: {
    // 提醒选项
    reminderRanges: [
      ['不提醒', '准时', '提前5分钟', '提前15分钟', '提前30分钟', '提前1小时', '提前2小时', '提前1天', '提前2天', '提前1周'],
      ['']
    ],

    // 星期选项
    weekdays: [
      { label: '日', value: 0, selected: false },
      { label: '一', value: 1, selected: false },
      { label: '二', value: 2, selected: false },
      { label: '三', value: 3, selected: false },
      { label: '四', value: 4, selected: false },
      { label: '五', value: 5, selected: false },
      { label: '六', value: 6, selected: false }
    ],

    // 日期选项
    monthdays: Array.from({ length: 31 }, (_, i) => ({
      label: String(i + 1),
      value: i + 1,
      selected: false
    })),

    // 可选清单列表
    availableLists: [],

    // 可选分类列表
    availableCategories: [],

    // 弹窗显示状态
    showListPopup: false,
    showCategoryPopup: false,
    showDeleteDialog: false,

    // 附件相关
    attachments: [],       // 当前附件列表 [{fileId, name, size, type, url}]
    uploadingCount: 0,     // 正在上传的数量
    initialAttachmentFileIds: [],
    pendingDeleteAttachmentFileIds: [],
    sessionUploadedAttachmentFileIds: [],
    attachmentDirty: false,
    hasSavedSuccessfully: false
  },

  // ==================== 数据加载 ====================

  // 加载可选清单
  async loadAvailableLists() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'listFunctions',
        data: { action: 'getAvailableLists' }
      });
      if (result.result && result.result.code === 0) {
        this.setData({ availableLists: result.result.data || [] });
      }
    } catch (error) {
      console.error('加载清单列表失败:', error);
    }
  },

  // 加载可选分类
  async loadAvailableCategories() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'categoryFunctions',
        data: { action: 'getCategories' }
      });
      if (result.result && result.result.code === 0) {
        this.setData({ availableCategories: result.result.data || [] });
      }
    } catch (error) {
      console.error('加载分类列表失败:', error);
    }
  },

  // ==================== 表单输入处理 ====================

  // 标题输入
  onTitleInput(e) {
    this.setData({ 'task.title': e.detail.value });
  },

  // 描述输入
  onDescInput(e) {
    this.setData({ 'task.description': e.detail.value });
  },

  // 截止日期选择
  onDueDateChange(e) {
    const value = e.detail.value;
    // 如果用户取消选择或清空，保持原值（截止日期必填）
    if (!value) {
      wx.showToast({
        title: '截止日期不能为空',
        icon: 'none'
      });
      return;
    }
    this.setData({ 'task.dueDate': value });
  },

  // 截止时间选择
  onDueTimeChange(e) {
    this.setData({ 'task.dueTime': e.detail.value });
  },

  // 优先级选择
  onPriorityChange(e) {
    const priority = parseInt(e.currentTarget.dataset.priority);
    this.setData({ 'task.priority': priority });
  },

  // 重复类型选择
  onRepeatTypeChange(e) {
    const type = parseInt(e.currentTarget.dataset.type);
    this.setData({
      'task.repeatType': type,
      'task.repeatValue': ''
    });

    // 重置选择状态
    if (type === 2) {
      const weekdays = this.data.weekdays.map(d => ({ ...d, selected: false }));
      this.setData({ weekdays });
    } else if (type === 3) {
      const monthdays = this.data.monthdays.map(d => ({ ...d, selected: false }));
      this.setData({ monthdays });
    }
  },

  // 星期切换
  onWeekdayToggle(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    const weekdays = [...this.data.weekdays];
    weekdays[index].selected = !weekdays[index].selected;

    const selectedValues = weekdays.filter(d => d.selected).map(d => d.value).join(',');

    this.setData({
      weekdays,
      'task.repeatValue': selectedValues
    });
  },

  // 日期切换
  onMonthdayToggle(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    const monthdays = [...this.data.monthdays];
    monthdays[index].selected = !monthdays[index].selected;

    const selectedValues = monthdays.filter(d => d.selected).map(d => d.value).join(',');

    this.setData({
      monthdays,
      'task.repeatValue': selectedValues
    });
  },

  // 提醒时间选择
  onReminderChange(e) {
    const index = e.detail.value;
    const reminderText = this.data.reminderRanges[0][index[0]];
    this.setData({
      reminderIndex: index,
      'task.reminderText': reminderText,
      'task.reminderValue': index[0]
    });
  },

  // ==================== 清单选择 ====================

  // 显示清单选择弹窗
  onSelectList() {
    this.setData({ showListPopup: true });
  },

  // 关闭清单选择弹窗
  onListPopupClose() {
    this.setData({ showListPopup: false });
  },

  // 选择清单
  onListSelect(e) {
    const listId = e.currentTarget.dataset.id;

    if (!listId) {
      this.setData({
        'task.listId': '',
        'task.listName': '',
        showListPopup: false
      });
      return;
    }

    const list = this.data.availableLists.find(item => item._id === listId);

    if (list) {
      this.setData({
        'task.listId': list._id,
        'task.listName': list.name,
        showListPopup: false
      });
    }
  },

  // ==================== 分类选择 ====================

  // 显示分类选择弹窗
  onSelectCategory() {
    this.setData({ showCategoryPopup: true });
  },

  // 关闭分类选择弹窗
  onCategoryPopupClose() {
    this.setData({ showCategoryPopup: false });
  },

  // 选择分类
  onCategorySelect(e) {
    const id = e.currentTarget.dataset.id;

    if (!id) {
      // 不设置分类
      this.setData({
        'task.categoryId': '',
        'task.categoryName': '',
        'task.categoryColor': '',
        showCategoryPopup: false
      });
    } else {
      const name = e.currentTarget.dataset.name;
      const color = e.currentTarget.dataset.color;

      this.setData({
        'task.categoryId': id,
        'task.categoryName': name,
        'task.categoryColor': color,
        showCategoryPopup: false
      });
    }
  },

  // ==================== 附件管理 ====================

  // 选择附件（图片或文件）
  onAddAttachment() {
    const that = this;
    wx.showActionSheet({
      itemList: ['选择图片', '选择文件'],
      success(res) {
        if (res.tapIndex === 0) {
          that.chooseImage();
        } else if (res.tapIndex === 1) {
          that.chooseFile();
        }
      }
    });
  },

  // 选择图片
  chooseImage() {
    const currentCount = this.data.attachments.length;
    if (currentCount >= 9) {
      wx.showToast({ title: '最多添加9个附件', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: 9 - currentCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const files = res.tempFiles.map(f => ({
          tempPath: f.tempFilePath,
          name: f.tempFilePath.split('/').pop(),
          size: f.size,
          type: 'image'
        }));
        this.uploadFiles(files);
      }
    });
  },

  // 选择文件
  chooseFile() {
    const currentCount = this.data.attachments.length;
    if (currentCount >= 9) {
      wx.showToast({ title: '最多添加9个附件', icon: 'none' });
      return;
    }
    wx.chooseMessageFile({
      count: 9 - currentCount,
      type: 'file',
      success: (res) => {
        const files = res.tempFiles.map(f => ({
          tempPath: f.path,
          name: f.name,
          size: f.size,
          type: this.getFileType(f.name)
        }));
        this.uploadFiles(files);
      }
    });
  },

  // 上传文件到云存储
  async uploadFiles(files) {
    this.setData({ uploadingCount: files.length });

    for (const file of files) {
      try {
        // 限制单文件 10MB
        if (file.size > 10 * 1024 * 1024) {
          wx.showToast({ title: `${file.name} 超过10MB`, icon: 'none' });
          continue;
        }

        const ext = file.name.split('.').pop() || 'file';
        const cloudPath = `attachments/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: file.tempPath
        });

        // 获取临时访问链接
        const urlRes = await wx.cloud.getTempFileURL({
          fileList: [uploadRes.fileID]
        });
        const url = urlRes.fileList[0]?.tempFileURL || '';

        const attachment = {
          fileId: uploadRes.fileID,
          name: file.name,
          size: file.size,
          type: file.type,
          url: url,
          sizeText: this.formatFileSize(file.size)
        };

        const attachments = [...this.data.attachments, attachment];
        const sessionUploadedAttachmentFileIds = [
          ...(this.data.sessionUploadedAttachmentFileIds || []),
          uploadRes.fileID
        ];
        this.setData({
          attachments,
          sessionUploadedAttachmentFileIds,
          attachmentDirty: true
        });
      } catch (err) {
        console.error('上传附件失败:', err);
        wx.showToast({ title: '上传失败', icon: 'none' });
      }
    }

    this.setData({ uploadingCount: 0 });
  },

  // 预览附件
  onPreviewAttachment(e) {
    const index = e.currentTarget.dataset.index;
    const attachment = this.data.attachments[index];
    if (!attachment) return;

    if (attachment.type === 'image') {
      const imageUrls = this.data.attachments
        .filter(a => a.type === 'image')
        .map(a => a.url || a.fileId);
      const current = attachment.url || attachment.fileId;
      wx.previewImage({ urls: imageUrls, current });
    } else {
      // 非图片文件，下载后用系统打开
      wx.showLoading({ title: '打开中...' });
      wx.cloud.downloadFile({
        fileID: attachment.fileId,
        success: (res) => {
          wx.openDocument({
            filePath: res.tempFilePath,
            showMenu: true,
            fail: () => {
              wx.showToast({ title: '无法打开此文件', icon: 'none' });
            }
          });
        },
        fail: () => {
          wx.showToast({ title: '下载失败', icon: 'none' });
        },
        complete: () => {
          wx.hideLoading();
        }
      });
    }
  },

  // 删除附件
  onDeleteAttachment(e) {
    const index = e.currentTarget.dataset.index;
    const attachment = this.data.attachments[index];
    if (!attachment) return;

    wx.showModal({
      title: '删除附件',
      content: `确定删除 ${attachment.name} 吗？`,
      success: (res) => {
        if (res.confirm) {
          const attachments = this.data.attachments.filter((_, i) => i !== index);
          const initialAttachmentFileIds = this.data.initialAttachmentFileIds || [];
          const pendingDeleteAttachmentFileIds = this.data.pendingDeleteAttachmentFileIds || [];
          const shouldTrackPendingDelete = attachment.fileId && initialAttachmentFileIds.includes(attachment.fileId);

          this.setData({
            attachments,
            pendingDeleteAttachmentFileIds: shouldTrackPendingDelete
              ? [...new Set([...pendingDeleteAttachmentFileIds, attachment.fileId])]
              : pendingDeleteAttachmentFileIds,
            attachmentDirty: true
          });
        }
      }
    });
  },

  async loadAttachments(rawAttachments) {
    if (!rawAttachments || rawAttachments.length === 0) {
      this.resetAttachmentSessionState([]);
      return;
    }

    const fileIds = rawAttachments.map(a => a.fileId).filter(Boolean);
    let urlMap = {};
    if (fileIds.length > 0) {
      try {
        const res = await wx.cloud.getTempFileURL({ fileList: fileIds });
        res.fileList.forEach(f => {
          urlMap[f.fileID] = f.tempFileURL;
        });
      } catch (e) {
        console.error('获取附件URL失败:', e);
      }
    }

    const attachments = rawAttachments.map(a => ({
      ...a,
      url: urlMap[a.fileId] || '',
      sizeText: this.formatFileSize(a.size)
    }));
    this.resetAttachmentSessionState(attachments);
  },

  resetAttachmentSessionState(rawAttachments) {
    const attachments = Array.isArray(rawAttachments) ? rawAttachments : [];
    this.setData({
      attachments,
      initialAttachmentFileIds: attachments.map(item => item.fileId).filter(Boolean),
      pendingDeleteAttachmentFileIds: [],
      sessionUploadedAttachmentFileIds: [],
      attachmentDirty: false,
      hasSavedSuccessfully: false
    });
  },

  async cleanupUncommittedAttachments() {
    if (this.data.hasSavedSuccessfully) {
      return;
    }

    const fileList = [...new Set((this.data.sessionUploadedAttachmentFileIds || []).filter(Boolean))];
    if (fileList.length === 0) {
      return;
    }

    try {
      await wx.cloud.deleteFile({ fileList });
    } catch (error) {
      console.error('清理未保存附件失败:', error);
    }
  },

  async cleanupRemovedSessionAttachmentsAfterSave() {
    const currentAttachmentFileIds = new Set(
      (this.data.attachments || []).map(item => item.fileId).filter(Boolean)
    );
    const fileList = [...new Set(
      (this.data.sessionUploadedAttachmentFileIds || []).filter(fileId => fileId && !currentAttachmentFileIds.has(fileId))
    )];

    if (fileList.length === 0) {
      return;
    }

    try {
      await wx.cloud.deleteFile({ fileList });
    } catch (error) {
      console.error('清理未保留附件失败:', error);
    }
  },

  // 根据文件名判断类型
  getFileType(name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
    if (imageExts.includes(ext)) return 'image';
    const docExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'txt'];
    if (docExts.includes(ext)) return 'document';
    return 'file';
  },

  // 格式化文件大小
  formatFileSize(size) {
    if (!size) return '';
    if (size < 1024) return size + 'B';
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + 'KB';
    return (size / (1024 * 1024)).toFixed(1) + 'MB';
  },

  // ==================== 工具方法 ====================

  // 格式化日期
  formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 格式化时间
  formatTime(date) {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  // 解析提醒设置
  parseReminder(task) {
    let reminderText = '';
    let reminderValue = 0;
    let reminderIndex = [0, 0];

    if (task.reminderAt && task.dueDate) {
      const reminderDate = new Date(task.reminderAt);
      const dueDateObj = new Date(task.dueDate);
      const diffMs = dueDateObj.getTime() - reminderDate.getTime();
      const diffMinutes = Math.floor(diffMs / (60 * 1000));

      const reminderMap = [
        { minutes: 0, text: '准时', value: 1 },
        { minutes: 5, text: '提前5分钟', value: 2 },
        { minutes: 15, text: '提前15分钟', value: 3 },
        { minutes: 30, text: '提前30分钟', value: 4 },
        { minutes: 60, text: '提前1小时', value: 5 },
        { minutes: 120, text: '提前2小时', value: 6 },
        { minutes: 1440, text: '提前1天', value: 7 },
        { minutes: 2880, text: '提前2天', value: 8 },
        { minutes: 10080, text: '提前1周', value: 9 }
      ];

      const match = reminderMap.find(r => r.minutes === diffMinutes);
      if (match) {
        reminderText = match.text;
        reminderValue = match.value;
        reminderIndex[0] = match.value;
      }
    }

    return { reminderText, reminderValue, reminderIndex };
  },

  // 解析重复设置
  parseRepeat(task, weekdays, monthdays) {
    let newWeekdays = weekdays.map(d => ({ ...d, selected: false }));
    let newMonthdays = monthdays.map(d => ({ ...d, selected: false }));

    if (task.repeatType === 2 && task.repeatValue) {
      // 每周重复
      const days = task.repeatValue.split(',').map(v => parseInt(v));
      newWeekdays = newWeekdays.map((d) => ({
        ...d,
        selected: days.includes(d.value) || (d.value === 0 && days.includes(7))
      }));
    } else if (task.repeatType === 3 && task.repeatValue) {
      // 每月重复
      const days = task.repeatValue.split(',').map(v => parseInt(v));
      newMonthdays = newMonthdays.map((d, idx) => ({
        ...d,
        selected: days.includes(idx + 1)
      }));
    }

    return { weekdays: newWeekdays, monthdays: newMonthdays };
  },

  // ==================== 表单验证 ====================

  // 验证表单
  validateForm(task) {
    if (!task.title || task.title.trim().length === 0) {
      wx.showToast({
        title: '请输入任务标题',
        icon: 'none'
      });
      return false;
    }

    // 截止日期必填
    if (!task.dueDate) {
      wx.showToast({
        title: '请选择截止日期',
        icon: 'none'
      });
      return false;
    }

    if (task.repeatType === 2 && !task.repeatValue) {
      wx.showToast({
        title: '请选择重复的星期',
        icon: 'none'
      });
      return false;
    }

    if (task.repeatType === 3 && !task.repeatValue) {
      wx.showToast({
        title: '请选择重复的日期',
        icon: 'none'
      });
      return false;
    }

    return true;
  },

  // 构建保存参数
  buildSaveParams(task, taskId, isEditing) {
    const params = {
      title: task.title.trim(),
      description: (task.description || '').trim(),
      priority: task.priority,
      categoryId: task.categoryId || '',
      listId: task.listId || '',
      repeatType: task.repeatType || 0,
      repeatValue: task.repeatValue || '',
      dueDate: task.dueDate || null,
      dueTime: task.dueTime || null,
      reminderValue: task.reminderValue || 0,
      pendingDeleteAttachmentFileIds: this.data.pendingDeleteAttachmentFileIds || [],
      attachments: (this.data.attachments || []).map(a => ({
        fileId: a.fileId,
        name: a.name,
        size: a.size,
        type: a.type
      }))
    };

    // 如果有状态字段，也传递
    if (task.status !== undefined) {
      params.status = task.status;
    }

    if (isEditing && taskId) {
      params.taskId = taskId;
    }

    return params;
  }
};
