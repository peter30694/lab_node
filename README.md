# 🐾 Pet Store - Đồ án Node.js

## Giới thiệu
Pet Store là hệ thống quản lý bán hàng và dịch vụ chăm sóc thú cưng, xây dựng với Node.js, Express, MongoDB, EJS và Tailwind CSS. Dự án cung cấp giải pháp toàn diện cho cửa hàng thú cưng: quản lý sản phẩm, dịch vụ, đơn hàng, khách hàng, tin tức, khuyến mãi, báo cáo, v.v.

## Tính năng nổi bật
- Quản lý sản phẩm, dịch vụ, đơn hàng, khách hàng, đánh giá
- Trang mua sắm, đặt dịch vụ, giỏ hàng, thanh toán VNPay
- Quản lý tin tức động (CRUD, phân quyền admin)
- Giao diện hiện đại, responsive, sử dụng **Tailwind CSS**
- Hệ thống thông báo, xác thực, phân quyền, bảo mật CSRF
- Báo cáo, xuất PDF, quản lý coupon, newsletter

## Công nghệ sử dụng
| Công nghệ      | Mô tả |
|---------------|-------|
| Node.js       | Nền tảng backend |
| Express.js    | Framework web |
| MongoDB/Mongoose | Cơ sở dữ liệu NoSQL |
| EJS           | Template engine |
| Tailwind CSS  | UI framework (utility-first) |
| VNPay         | Thanh toán trực tuyến |
| Nodemailer    | Gửi email |
| dotenv        | Quản lý biến môi trường |

## Cấu trúc thư mục
```
lab_node/
  ├── app.js                # File khởi động chính
  ├── config/               # Cấu hình môi trường, database, email...
  ├── controllers/          # Xử lý logic cho từng module
  ├── data/                 # Dữ liệu tĩnh, file PDF báo cáo
  ├── logs/                 # Log hệ thống
  ├── middleware/           # Middleware custom (auth, error, upload...)
  ├── models/               # Định nghĩa schema Mongoose
  ├── public/               # Tài nguyên tĩnh (ảnh, css, js)
  ├── routes/               # Định tuyến Express
  ├── scripts/              # Script seed/migrate dữ liệu
  ├── util/                 # Tiện ích, helper
  ├── views/                # Giao diện EJS
  ├── tailwind.config.js    # Cấu hình Tailwind
  └── package.json          # Thông tin dự án, dependencies
```

## Hướng dẫn cài đặt & chạy
### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Thiết lập biến môi trường
Tạo file `.env` ở thư mục gốc, ví dụ:
```env
MONGODB_URI=mongodb://localhost:27017/shop
PORT=3000
SESSION_SECRET=your-secret-key
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-email-password
VNP_TMN_CODE=...
VNP_SECRET_KEY=...
VNP_URL=...
```

### 3. Build CSS (nếu cần)
```bash
npm run build:css
```

### 4. Seed dữ liệu mẫu (tùy chọn)
```bash
node scripts/seed-news.js
```

### 5. Khởi động server
```bash
npm run dev
# hoặc
npm start
```
Truy cập: [http://localhost:3000](http://localhost:3000)

## Quản lý tin tức (News Management)
- Xem danh sách: `/admin/news`
- Thêm mới: `/admin/news/add`
- Sửa: `/admin/news/edit/:id`
- Xóa: qua modal xác nhận
- Xem ngoài trang chủ: `/news`, `/news/:id`

### Mẫu dữ liệu News (Mongoose Schema)
```js
{
  title: String,        // Tiêu đề
  content: String,      // Nội dung (HTML)
  imageUrl: String,     // Ảnh đại diện
  summary: String,      // Tóm tắt
  category: String,     // Danh mục
  author: String,       // Tác giả
  status: String,       // published/draft/archived
  views: Number,        // Lượt xem
  slug: String,         // URL thân thiện
  createdAt: Date,      // Ngày tạo
  updatedAt: Date       // Ngày cập nhật
}
```

## Style & UI
- Giao diện sử dụng **Tailwind CSS** (xem `tailwind.config.js`)
- Responsive, tối ưu trải nghiệm người dùng
- Có thể tùy chỉnh theme qua Tailwind

## Một số lệnh hữu ích
| Lệnh | Chức năng |
|------|-----------|
| npm run dev | Build CSS & chạy server (dev) |
| npm start   | Chạy server bằng nodemon |
| npm run build:css | Build Tailwind CSS |
| node scripts/seed-news.js | Seed dữ liệu tin tức mẫu |

## Đóng góp & liên hệ
- Tác giả: ITC School
- Email: [Liên hệ qua email cấu hình trong .env]
- Đóng góp: Pull request hoặc liên hệ trực tiếp

---
> **Lưu ý:**
> - Đổi các thông tin nhạy cảm trong file cấu hình trước khi deploy.
> - Đảm bảo đã cài đặt MongoDB hoặc cập nhật MONGODB_URI phù hợp.
> - Để bảo mật, không commit file `.env` lên repository công khai.
