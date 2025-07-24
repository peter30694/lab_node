# Hướng dẫn sử dụng hệ thống quản lý tin tức

## Tổng quan

Hệ thống quản lý tin tức đã được chuyển từ dữ liệu cứng sang hệ thống quản lý động, cho phép admin tạo, chỉnh sửa và quản lý tin tức thông qua giao diện admin.

## Các tính năng chính

### 1. **Quản lý tin tức (Admin)**
- **Xem danh sách tin tức**: `/admin/news`
- **Thêm tin tức mới**: `/admin/news/add`
- **Chỉnh sửa tin tức**: `/admin/news/edit/:id`
- **Xóa tin tức**: Thông qua modal xác nhận

### 2. **Xem tin tức (Public)**
- **Danh sách tin tức**: `/news`
- **Chi tiết tin tức**: `/news/:id` hoặc `/news/:slug`

## Cấu trúc dữ liệu

### Model News
```javascript
{
  title: String,        // Tiêu đề tin tức (bắt buộc)
  content: String,      // Nội dung tin tức (bắt buộc)
  imageUrl: String,     // URL hình ảnh (bắt buộc)
  summary: String,      // Tóm tắt (tự động tạo từ content)
  category: String,     // Danh mục (mặc định: "Tin tức")
  author: String,       // Tác giả (mặc định: "Pet Store")
  status: String,       // Trạng thái: "published", "draft", "archived"
  views: Number,        // Lượt xem (mặc định: 0)
  slug: String,         // URL thân thiện (tự động tạo từ title)
  createdAt: Date,      // Ngày tạo
  updatedAt: Date       // Ngày cập nhật
}
```

## Hướng dẫn sử dụng

### 1. **Thêm tin tức mới**

1. Đăng nhập với tài khoản admin
2. Truy cập `/admin/news`
3. Click "Thêm tin tức mới"
4. Điền thông tin:
   - **Tiêu đề**: Tối đa 200 ký tự
   - **URL hình ảnh**: URL hợp lệ của hình ảnh
   - **Danh mục**: Chọn từ danh sách có sẵn
   - **Tác giả**: Tên tác giả
   - **Trạng thái**: Published/Draft/Archived
   - **Nội dung**: Hỗ trợ HTML tags

### 2. **Chỉnh sửa tin tức**

1. Truy cập `/admin/news`
2. Click icon chỉnh sửa (✏️) bên cạnh tin tức
3. Cập nhật thông tin cần thiết
4. Click "Cập nhật"

### 3. **Xóa tin tức**

1. Truy cập `/admin/news`
2. Click icon xóa (🗑️) bên cạnh tin tức
3. Xác nhận trong modal
4. Click "Xóa"

### 4. **Quản lý trạng thái**

- **Published**: Tin tức hiển thị công khai
- **Draft**: Tin tức chỉ admin thấy, chưa xuất bản
- **Archived**: Tin tức đã lưu trữ, không hiển thị

## Tính năng nâng cao

### 1. **Auto-save draft**
- Hệ thống tự động lưu bản nháp mỗi 2 giây
- Khi quay lại trang, sẽ hỏi khôi phục bản nháp

### 2. **Preview nội dung**
- Click "Xem trước nội dung" để xem trước
- Hiển thị đầy đủ HTML formatting

### 3. **Slug tự động**
- Tự động tạo URL thân thiện từ tiêu đề
- Hỗ trợ tiếng Việt và ký tự đặc biệt

### 4. **Tìm kiếm và lọc**
- Tìm kiếm theo tiêu đề
- Lọc theo trạng thái
- Phân trang

## Cài đặt và chạy

### 1. **Chạy script thêm dữ liệu mẫu**
```bash
node scripts/seed-news.js
```

### 2. **Khởi động server**
```bash
npm start
```

### 3. **Truy cập**
- **Admin panel**: `/admin/news`
- **Public news**: `/news`

## Lưu ý quan trọng

### 1. **Quyền truy cập**
- Chỉ admin mới có quyền quản lý tin tức
- Cần đăng nhập với role = 'admin'

### 2. **Validation**
- Tiêu đề: 5-200 ký tự
- Nội dung: Tối thiểu 10 ký tự
- URL hình ảnh: Phải là URL hợp lệ

### 3. **HTML Support**
Hỗ trợ các HTML tags:
- `<p>` - Đoạn văn
- `<ul>`, `<li>` - Danh sách
- `<strong>`, `<b>` - Chữ đậm
- `<em>`, `<i>` - Chữ nghiêng
- `<h2>`, `<h3>` - Tiêu đề

### 4. **SEO Friendly**
- Tự động tạo slug từ tiêu đề
- Hỗ trợ cả ID và slug trong URL
- Meta tags tự động

## Troubleshooting

### 1. **Lỗi "Tin tức không tồn tại"**
- Kiểm tra ID hoặc slug trong URL
- Đảm bảo tin tức có trạng thái "published"

### 2. **Lỗi validation**
- Kiểm tra độ dài tiêu đề (5-200 ký tự)
- Kiểm tra độ dài nội dung (tối thiểu 10 ký tự)
- Kiểm tra URL hình ảnh hợp lệ

### 3. **Lỗi database**
- Kiểm tra kết nối MongoDB
- Kiểm tra quyền truy cập database

## API Endpoints

### Public APIs
- `GET /news` - Danh sách tin tức
- `GET /news/:id` - Chi tiết tin tức

### Admin APIs
- `GET /admin/news` - Quản lý tin tức
- `GET /admin/news/add` - Form thêm tin tức
- `POST /admin/news/add` - Thêm tin tức
- `GET /admin/news/edit/:id` - Form chỉnh sửa
- `POST /admin/news/edit` - Cập nhật tin tức
- `POST /admin/news/delete` - Xóa tin tức

## Tương lai

### Tính năng dự kiến
- Upload hình ảnh trực tiếp
- Rich text editor
- Phân loại tin tức nâng cao
- Analytics và thống kê
- RSS feed
- Social media sharing
- Comments system
- Related posts
- Newsletter integration 