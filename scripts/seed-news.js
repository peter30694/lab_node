const mongoose = require('mongoose');
const News = require('../models/news');

// Kết nối MongoDB
mongoose.connect('mongodb+srv://ITCschool:8GZ4Vs2IufF9uwFY@cluster0.unzei.mongodb.net/Shop?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Mongoose connected!');
}).catch(err => {
  console.error('Mongoose connection error:', err);
});

const sampleNews = [
  {
    title: "Khai trương cửa hàng mới tại Hà Nội",
    content: `
      <p>Ngày 17/07/2024, Pet Store hân hoan khai trương cửa hàng mới tại số 123 Đường Láng, Hà Nội. Đây là cột mốc quan trọng đánh dấu sự phát triển không ngừng của hệ thống Pet Store trên toàn quốc.</p>
      <p>Nhân dịp khai trương, chúng tôi gửi tới quý khách hàng những ưu đãi đặc biệt:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Giảm giá lên đến <b>30%</b> cho tất cả các sản phẩm trong tuần lễ khai trương.</li>
        <li>Quà tặng hấp dẫn cho 100 khách hàng đầu tiên mỗi ngày.</li>
        <li>Miễn phí tư vấn chăm sóc thú cưng cùng các chuyên gia giàu kinh nghiệm.</li>
      </ul>
      <p>Không gian cửa hàng được thiết kế hiện đại, thân thiện với thú cưng, cùng đội ngũ nhân viên nhiệt tình, chuyên nghiệp. Hãy đến trải nghiệm dịch vụ và sản phẩm chất lượng dành cho thú cưng của bạn tại Pet Store Hà Nội!</p>
      <p class="mt-4 italic">Pet Store - Nơi gửi trọn niềm tin cho thú cưng của bạn.</p>
    `,
    imageUrl: "/images/about-1.jpg",
    category: "Tin tức",
    author: "Pet Store",
    status: "published",
    views: 1250
  },
  {
    title: "Bí quyết chăm sóc thú cưng mùa hè",
    content: `
      <p>Mùa hè với nền nhiệt cao có thể gây ra nhiều vấn đề sức khỏe cho thú cưng. Để đảm bảo thú cưng luôn khỏe mạnh, bạn cần lưu ý:</p>
      <ul class="list-disc pl-6 mb-4">
        <li><b>Bổ sung nước thường xuyên:</b> Đặt nhiều bát nước sạch ở các vị trí khác nhau trong nhà.</li>
        <li><b>Hạn chế ra ngoài vào giờ nắng gắt:</b> Chỉ nên dắt thú cưng đi dạo vào sáng sớm hoặc chiều muộn.</li>
        <li><b>Chế độ dinh dưỡng hợp lý:</b> Ưu tiên thực phẩm giàu vitamin, rau củ quả tươi, tránh thức ăn nhiều dầu mỡ.</li>
        <li><b>Giữ vệ sinh cơ thể:</b> Tắm rửa định kỳ, kiểm tra lông và da để phát hiện sớm ve, bọ chét.</li>
      </ul>
      <p>Ngoài ra, hãy chú ý các dấu hiệu sốc nhiệt như thở gấp, lưỡi tím, mệt mỏi... Nếu phát hiện, cần đưa thú cưng đến cơ sở thú y gần nhất để được hỗ trợ kịp thời.</p>
      <p class="mt-4">Chúc bạn và thú cưng có một mùa hè vui khỏe!</p>
    `,
    imageUrl: "/images/gallery-2.jpg",
    category: "Chăm sóc",
    author: "Dr. Nguyễn Văn A",
    status: "published",
    views: 890
  },
  {
    title: "Top 5 loại thức ăn tốt nhất cho chó mèo năm 2024",
    content: `
      <p>Việc lựa chọn thức ăn phù hợp là yếu tố then chốt giúp thú cưng phát triển khỏe mạnh, tăng sức đề kháng và kéo dài tuổi thọ. Dưới đây là 5 thương hiệu thức ăn được các chuyên gia thú y khuyên dùng năm 2024:</p>
      <ol class="list-decimal pl-6 mb-4">
        <li><b>Royal Canin:</b> Đa dạng dòng sản phẩm theo giống, độ tuổi, tình trạng sức khỏe.</li>
        <li><b>SmartHeart:</b> Giá thành hợp lý, bổ sung Omega 3,6 tốt cho lông và da.</li>
        <li><b>Pedigree:</b> Dễ tiêu hóa, phù hợp với nhiều giống chó mèo phổ biến tại Việt Nam.</li>
        <li><b>Whiskas:</b> Hương vị hấp dẫn, giàu protein, hỗ trợ hệ tiêu hóa khỏe mạnh.</li>
        <li><b>ANF:</b> Nguyên liệu tự nhiên, không chất bảo quản, phù hợp thú cưng nhạy cảm.</li>
      </ol>
      <p><b>Lưu ý:</b> Khi đổi loại thức ăn, nên chuyển đổi từ từ để tránh rối loạn tiêu hóa. Tham khảo ý kiến bác sĩ thú y nếu thú cưng có bệnh lý đặc biệt.</p>
    `,
    imageUrl: "/images/image_3.jpg",
    category: "Dinh dưỡng",
    author: "Pet Store",
    status: "published",
    views: 1560
  },
  {
    title: "Cảnh báo bệnh truyền nhiễm ở thú cưng",
    content: `
      <p>Thời gian gần đây, các bệnh truyền nhiễm như Care, Parvo ở chó và viêm mũi ở mèo đang có dấu hiệu gia tăng, đặc biệt trong mùa mưa ẩm.</p>
      <p><b>Dấu hiệu nhận biết:</b></p>
      <ul class="list-disc pl-6 mb-4">
        <li>Chó: Sốt cao, bỏ ăn, nôn mửa, tiêu chảy ra máu, lờ đờ.</li>
        <li>Mèo: Hắt hơi, chảy nước mũi, mắt đỏ, biếng ăn.</li>
      </ul>
      <p><b>Phòng tránh:</b></p>
      <ul class="list-disc pl-6 mb-4">
        <li>Tiêm phòng đầy đủ các loại vaccine định kỳ.</li>
        <li>Giữ vệ sinh chuồng trại, khay ăn uống sạch sẽ.</li>
        <li>Hạn chế tiếp xúc với động vật lạ hoặc có dấu hiệu bệnh.</li>
      </ul>
      <p>Nếu phát hiện thú cưng có dấu hiệu bất thường, hãy đưa đến cơ sở thú y uy tín để được khám và điều trị kịp thời.</p>
    `,
    imageUrl: "/images/gallery-4.jpg",
    category: "Sức khỏe",
    author: "Dr. Trần Thị B",
    status: "published",
    views: 2100
  },
  {
    title: "Workshop: Huấn luyện chó cơ bản miễn phí cuối tuần này!",
    content: `
      <p>Pet Store tổ chức workshop miễn phí "Huấn luyện chó cơ bản" vào Chủ nhật tuần này tại cửa hàng. Chương trình dành cho tất cả khách hàng yêu thích và đang nuôi chó.</p>
      <p><b>Nội dung workshop:</b></p>
      <ul class="list-disc pl-6 mb-4">
        <li>Giới thiệu các phương pháp huấn luyện tích cực, không bạo lực.</li>
        <li>Thực hành các lệnh cơ bản: ngồi, nằm, lại đây, bắt tay...</li>
        <li>Giải đáp thắc mắc về hành vi và tâm lý chó.</li>
        <li>Giao lưu, chia sẻ kinh nghiệm giữa các chủ nuôi.</li>
      </ul>
      <p><b>Thời gian:</b> 9h00 - 11h30, Chủ nhật ngày 21/07/2024</p>
      <p><b>Địa điểm:</b> Pet Store, 123 Đường Láng, Hà Nội</p>
      <p class="mt-4">Đăng ký ngay tại quầy lễ tân hoặc qua hotline: 0123 456 789. Số lượng có hạn!</p>
    `,
    imageUrl: "/images/gallery-5.jpg",
    category: "Sự kiện",
    author: "Pet Store",
    status: "published",
    views: 750
  },
  {
    title: "Pet Store đồng hành cùng chương trình 'Ngày hội thú cưng 2024'",
    content: `
      <p>Ngày hội thú cưng 2024 sẽ diễn ra vào ngày 28/07/2024 tại Công viên Thống Nhất, Hà Nội với sự tham gia của hàng ngàn chủ nuôi và các bạn nhỏ yêu động vật.</p>
      <p>Pet Store hân hạnh đồng hành cùng chương trình với nhiều hoạt động hấp dẫn:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Gian hàng trải nghiệm sản phẩm mới, nhận quà tặng miễn phí.</li>
        <li>Cuộc thi "Thú cưng tài năng" với nhiều phần thưởng giá trị.</li>
        <li>Chụp ảnh lưu niệm miễn phí cùng thú cưng.</li>
        <li>Giao lưu với các chuyên gia chăm sóc và huấn luyện thú cưng.</li>
      </ul>
      <p>Đừng bỏ lỡ sự kiện lớn nhất năm dành cho cộng đồng yêu thú cưng! Hẹn gặp bạn tại Ngày hội thú cưng 2024.</p>
    `,
    imageUrl: "/images/gallery-6.jpg",
    category: "Sự kiện",
    author: "Pet Store",
    status: "published",
    views: 980
  }
];

async function seedNews() {
  try {
    console.log('Bắt đầu thêm tin tức mẫu...');
    
    // Xóa tất cả tin tức cũ (tùy chọn)
    await News.deleteMany({});
    console.log('Đã xóa tin tức cũ');
    
    // Thêm tin tức mẫu
    for (const newsData of sampleNews) {
      const news = new News(newsData);
      await news.save();
      console.log(`Đã thêm tin tức: ${newsData.title}`);
    }
    
    console.log('Hoàn thành thêm tin tức mẫu!');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi thêm tin tức mẫu:', error);
    process.exit(1);
  }
}

seedNews(); 