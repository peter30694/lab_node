const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Tiêu đề không được để trống'],
    trim: true,
    maxlength: [200, 'Tiêu đề không được quá 200 ký tự']
  },
  imageUrl: {
    type: String,
    required: [true, 'Hình ảnh không được để trống'],
    trim: true
  },
  content: {
    type: String,
    required: [true, 'Nội dung không được để trống'],
    trim: true
  },
  summary: {
    type: String,
    trim: true,
    maxlength: [500, 'Tóm tắt không được quá 500 ký tự']
  },
  category: {
    type: String,
    default: 'Tin tức',
    trim: true
  },
  author: {
    type: String,
    default: 'Pet Store',
    trim: true
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published'
  },
  views: {
    type: Number,
    default: 0
  },
  slug: {
    type: String,
    unique: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Tạo slug từ title trước khi lưu
newsSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }
  this.updatedAt = new Date();
  next();
});

// Tăng lượt xem
newsSchema.methods.incrementViews = async function() {
  this.views += 1;
  return await this.save();
};

// Tạo summary từ content nếu không có
newsSchema.pre('save', function(next) {
  if (!this.summary && this.content) {
    this.summary = this.content
      .replace(/<[^>]*>/g, '') // Loại bỏ HTML tags
      .substring(0, 150)
      .trim() + '...';
  }
  next();
});

// Static methods
newsSchema.statics.fetchAll = async function(limit = 10, page = 1, category = null, status = 'published') {
  const skip = (page - 1) * limit;
  const query = {};
  
  if (category) {
    query.category = category;
  }
  
  if (status) {
    query.status = status;
  }
  
  const [news, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    this.countDocuments(query)
  ]);
  
  return {
    news,
    total,
    totalPages: Math.ceil(total / limit)
  };
};

// Method để tìm theo ID (tránh xung đột với Mongoose's findById)
newsSchema.statics.findByIdCustom = async function(id) {
  return await this.findOne({ _id: id });
};

newsSchema.statics.findBySlug = async function(slug) {
  return await this.findOne({ slug: slug });
};

newsSchema.statics.deleteById = async function(id) {
  return await this.findByIdAndDelete(id);
};

const News = mongoose.model('News', newsSchema);

module.exports = News;