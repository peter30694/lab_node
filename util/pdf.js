const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const moment = require('moment');
const { fixVietnameseTextForDB, convertNumberToWords } = require('./text-helper');

// Ensure PDF directory exists
const pdfDirPath = path.join(__dirname, '..', 'data', 'pdfs');
if (!fs.existsSync(pdfDirPath)) {
    console.log('Creating PDF directory:', pdfDirPath);
    fs.mkdirSync(pdfDirPath, { recursive: true });
}

// Font paths
const robotoRegularPath = path.join(__dirname, '../public/fonts/Roboto-Regular.ttf');
const robotoBoldPath = path.join(__dirname, '../public/fonts/Roboto-Bold.ttf');
const notoSansRegularPath = path.join(__dirname, '../public/fonts/NotoSans-Regular.ttf');
const notoSansBoldPath = path.join(__dirname, '../public/fonts/NotoSans-Bold.ttf');

// Font registration function with better error handling
function safeRegisterFont(doc, name, path) {
    try {
        if (fs.existsSync(path) && fs.statSync(path).size > 0) {
            doc.registerFont(name, path);
            console.log(`Successfully registered font: ${name}`);
            return true;
        } else {
            console.warn(`Font file not found or empty: ${path}`);
            return false;
        }
    } catch (e) {
        console.warn(`Could not register font ${name}: ${e.message}`);
        return false;
    }
}

// Font setup function for Vietnamese text
function setupVietnameseFonts(doc) {
    let regularFont = 'NotoSans';
    let boldFont = 'NotoSans-Bold';
    // Đăng ký NotoSans
    const notoOk = safeRegisterFont(doc, 'NotoSans', notoSansRegularPath);
    const notoBoldOk = safeRegisterFont(doc, 'NotoSans-Bold', notoSansBoldPath);
    if (notoOk && notoBoldOk) {
            console.log('Using NotoSans fonts for Vietnamese support');
        return { regular: 'NotoSans', bold: 'NotoSans-Bold', useCustomFont: true };
    }
    // Fallback Roboto
    const robotoOk = safeRegisterFont(doc, 'Roboto', robotoRegularPath);
    const robotoBoldOk = safeRegisterFont(doc, 'Roboto-Bold', robotoBoldPath);
    if (robotoOk && robotoBoldOk) {
            console.log('Using Roboto fonts as fallback');
        return { regular: 'Roboto', bold: 'Roboto-Bold', useCustomFont: true };
    }
    // Nếu không có font nào, báo lỗi rõ ràng
    throw new Error('Không tìm thấy font Unicode hỗ trợ tiếng Việt (NotoSans hoặc Roboto). Vui lòng kiểm tra lại file font!');
}

// Function to fix Vietnamese text encoding
function fixVietnameseText(text) {
    if (!text) return '';
    
    // Convert to string if it's not already
    let fixedText = String(text);
    
    // Fix common encoding issues
    const encodingFixes = {
        // Fix common garbled Vietnamese characters
        '£n': 'ản',
        '©m': 'ẩm', 
        'ìæ€': 'ịnh',
        't¯m': 'tắm',
        'Út': 'ột',
        '£': 'ả',
        '©': 'ẩ',
        'ì': 'ị',
        'æ': 'ệ',
        '€': 'h',
        '¯': 'ắ',
        'Ú': 'ộ'
    };
    
    // Apply fixes
    Object.keys(encodingFixes).forEach(wrong => {
        fixedText = fixedText.replace(new RegExp(wrong, 'g'), encodingFixes[wrong]);
    });
    
    // Additional fixes for common patterns
    fixedText = fixedText
        .replace(/S £n ph ©m không xác ìæ€/g, 'Sản phẩm không xác định')
        .replace(/Cát t¯m cho chu Út/g, 'Cát tắm cho chuột')
        .replace(/Thức £n cho chó/g, 'Thức ăn cho chó')
        .replace(/Vòng c cho mèo/g, 'Vòng cổ cho mèo')
        .replace(/ chơi cho thú cưng/g, 'Đồ chơi cho thú cưng')
        .replace(/Sữa t¯m cho chó mèo/g, 'Sữa tắm cho chó mèo')
        .replace(/Bàn chải £nh răng/g, 'Bàn chải đánh răng')
        .replace(/Lồng nuôi chim/g, 'Lồng nuôi chim')
        // Fix remaining individual characters
        .replace(/£nh/g, 'ánh')
        .replace(/£n/g, 'ăn');
    
    return fixedText;
}

// Format currency and date
const formatCurrency = (amount) => {
    try {
        if (typeof amount !== 'number' || isNaN(amount)) return '0 đ';
        return amount.toLocaleString('vi-VN') + ' đ';
    } catch (error) {
        console.error('Error formatting currency:', error);
        return '0 đ';
    }
};

// Format date using Moment.js
const formatDate = (date, format = 'MM/DD/YYYY') => {
    try {
        // Kiểm tra date có hợp lệ không trước khi format
        const mDate = moment(date);
        if (mDate.isValid()) {
            return mDate.format(format);
        } else {
            console.warn('Invalid date provided to formatDate:', date);
            // Trả về ngày hiện tại nếu date không hợp lệ
            return moment().format(format); 
        }
    } catch (error) {
        console.error('Error formatting date:', error);
        return moment().format(format); // Trả về ngày hiện tại nếu có lỗi
    }
};

// Draw a horizontal line
const drawLine = (doc, y) => {
    try {
        doc.strokeColor('#aaa').moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke();
    } catch (error) {
        console.error('Error drawing line:', error);
    }
};

// Generate Order Invoice PDF - NO HEADER/FOOTER
const generateOrderPDF = async (order, user) => {
    return new Promise((resolve, reject) => {
        try {
            const fileName = `order-${order._id}-${moment().format('YYYYMMDD')}.pdf`;
            const filePath = path.join(pdfDirPath, fileName);
            const doc = new PDFDocument({ 
                size: 'A4', 
                margin: 50
            });

            // Setup Vietnamese fonts
            const fonts = setupVietnameseFonts(doc);

            const writeStream = fs.createWriteStream(filePath);
            writeStream.on('error', (error) => reject(error));
            doc.pipe(writeStream);

            // --- Variables & Colors ---
            const pageMargins = doc.page.margins;
            const startY = pageMargins.top;
            const contentWidth = doc.page.width - pageMargins.left - pageMargins.right;
            const endY = doc.page.height - pageMargins.bottom;
            let currentY = startY;
            const lineGap = 4;
            const primaryColor = '#2563EB';
            const greyColor = '#F3F4F6';
            const darkGreyColor = '#E5E7EB';
            const textColor = '#1F2937';
            const lightTextColor = '#6B7280';

            // --- Helper Function to Add New Page ---
            const addNewPageIfNeeded = (neededHeight) => {
                if (currentY + neededHeight > endY - lineGap) {
                    doc.addPage();
                    currentY = startY;
                    return true; 
                }
                return false; 
            };
            
            // --- Tiêu đề và thông tin cửa hàng ---
            addNewPageIfNeeded(60);
            doc.font(fonts.bold).fontSize(22).fillColor(primaryColor)
               .text('PETSTORE', pageMargins.left, currentY, { align: 'center', width: contentWidth });
            currentY += 28;
            doc.font(fonts.bold).fontSize(16).fillColor(textColor)
               .text('HÓA ĐƠN BÁN HÀNG', pageMargins.left, currentY, { align: 'center', width: contentWidth });
            currentY += 24;
            drawLine(doc, currentY);
            currentY += 10;
            doc.font(fonts.regular).fontSize(10).fillColor(textColor)
               .text('Địa chỉ: 123 Đường Pet, Quận Thú Cưng, TP. Hạnh Phúc', pageMargins.left, currentY, { width: contentWidth });
            currentY += 14;
            doc.text('Hotline: 0123 456 789   |   Email: support@petstore.vn', pageMargins.left, currentY, { width: contentWidth });
            currentY += 18;

            // --- Box thông tin hóa đơn & khách hàng ---
            addNewPageIfNeeded(110);
            const infoBoxGap = 16;
            const infoBoxWidth = (contentWidth - infoBoxGap) / 2;
            const infoBoxHeight = 90;
            const infoBoxStartY = currentY;
            const infoBoxPadX = 16;
            const infoBoxPadY = 12;
            // Box 1: Thông tin hóa đơn
            doc.roundedRect(pageMargins.left, infoBoxStartY, infoBoxWidth, infoBoxHeight, 10).fillAndStroke(greyColor, darkGreyColor);
            doc.fillColor(textColor).font(fonts.bold).fontSize(11).text('Thông tin hóa đơn', pageMargins.left + infoBoxPadX, infoBoxStartY + infoBoxPadY - 2);
            doc.font(fonts.regular).fontSize(10);
            let y = infoBoxStartY + infoBoxPadY + 12;
            doc.text(`Mã hóa đơn: ${order._id}`, pageMargins.left + infoBoxPadX, y); y += 13;
            doc.text(`Ngày lập: ${formatDate(order.createdAt, 'DD/MM/YYYY HH:mm')}`, pageMargins.left + infoBoxPadX, y); y += 13;
            doc.text(`Trạng thái: ${order.status === 'delivered' ? 'delivered' : (order.status || 'Chờ xử lý')}`, pageMargins.left + infoBoxPadX, y); y += 13;
            doc.text(`Thanh toán: ${order.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}`, pageMargins.left + infoBoxPadX, y);
            // Box 2: Thông tin khách hàng
            doc.roundedRect(pageMargins.left + infoBoxWidth + infoBoxGap, infoBoxStartY, infoBoxWidth, infoBoxHeight, 10).fillAndStroke(greyColor, darkGreyColor);
            doc.fillColor(textColor).font(fonts.bold).fontSize(11).text('Thông tin khách hàng', pageMargins.left + infoBoxWidth + infoBoxGap + infoBoxPadX, infoBoxStartY + infoBoxPadY - 2);
            doc.font(fonts.regular).fontSize(10);
            y = infoBoxStartY + infoBoxPadY + 12;
            doc.text(`Họ tên: ${(user && user.name) || (order.shippingInfo && order.shippingInfo.name) || 'N/A'}`, pageMargins.left + infoBoxWidth + infoBoxGap + infoBoxPadX, y); y += 13;
            doc.text(`Email: ${(user && user.email) || (order.shippingInfo && order.shippingInfo.email) || 'N/A'}`, pageMargins.left + infoBoxWidth + infoBoxGap + infoBoxPadX, y); y += 13;
            doc.text(`SDT: ${(order.shippingInfo && order.shippingInfo.phone) || (user && user.phone) || 'N/A'}`, pageMargins.left + infoBoxWidth + infoBoxGap + infoBoxPadX, y); y += 13;
            doc.text(`Địa chỉ: ${(order.shippingInfo && order.shippingInfo.address) || (user && user.address) || 'N/A'}`, pageMargins.left + infoBoxWidth + infoBoxGap + infoBoxPadX, y);
            currentY = infoBoxStartY + infoBoxHeight + 18;

            // --- Bảng sản phẩm ---
            addNewPageIfNeeded(32);
            const tableHeaderY = currentY;
            doc.rect(pageMargins.left, tableHeaderY, contentWidth, 24).fill(darkGreyColor);
            doc.fillColor(textColor).font(fonts.bold).fontSize(10);
            doc.text('Sản phẩm', pageMargins.left + 12, tableHeaderY + 8, { width: contentWidth * 0.3 - 12 })
               .text('Mã SP', pageMargins.left + contentWidth * 0.3, tableHeaderY + 8, { width: contentWidth * 0.15, align: 'left' })
               .text('Số lượng', pageMargins.left + contentWidth * 0.45, tableHeaderY + 8, { width: contentWidth * 0.12, align: 'right' })
               .text('Đơn giá', pageMargins.left + contentWidth * 0.57, tableHeaderY + 8, { width: contentWidth * 0.18, align: 'right' })
               .text('Thành tiền', pageMargins.left + contentWidth * 0.75, tableHeaderY + 8, { width: contentWidth * 0.25 - 12, align: 'right' });
            currentY = tableHeaderY + 26;
            doc.font(fonts.regular);
            let i = 0;
            let subtotal = 0;
            order.items.forEach((item) => {
                const productName = fixVietnameseText(item.title || (item.product ? item.product.name : 'Không rõ tên'));
                const sku = item.sku || (item.product ? item.product.sku : '') || (item.productId || '');
                const quantity = item.quantity || 1;
                const price = item.price || 0;
                const totalPrice = price * quantity;
                subtotal += totalPrice;
                const productNameHeight = doc.fontSize(9).heightOfString(productName, { width: contentWidth * 0.3 - 12, lineGap });
                const itemHeight = productNameHeight + lineGap * 3.5;
                const rowNeededHeight = itemHeight + 4;
                if (addNewPageIfNeeded(rowNeededHeight)) {
                    // Draw table header again
                    const newTableHeaderY = currentY;
                    doc.rect(pageMargins.left, newTableHeaderY, contentWidth, 24).fill(darkGreyColor);
                    doc.fillColor(textColor).font(fonts.bold).fontSize(10);
                    doc.text('Sản phẩm', pageMargins.left + 12, newTableHeaderY + 8, { width: contentWidth * 0.3 - 12 })
                       .text('Mã SP', pageMargins.left + contentWidth * 0.3, newTableHeaderY + 8, { width: contentWidth * 0.15, align: 'left' })
                       .text('Số lượng', pageMargins.left + contentWidth * 0.45, newTableHeaderY + 8, { width: contentWidth * 0.12, align: 'right' })
                       .text('Đơn giá', pageMargins.left + contentWidth * 0.57, newTableHeaderY + 8, { width: contentWidth * 0.18, align: 'right' })
                       .text('Thành tiền', pageMargins.left + contentWidth * 0.75, newTableHeaderY + 8, { width: contentWidth * 0.25 - 12, align: 'right' });
                    currentY = newTableHeaderY + 26;
                    doc.font(fonts.regular);
                }
                if (i % 2 !== 0) {
                     doc.rect(pageMargins.left, currentY, contentWidth, itemHeight).fill(greyColor);
                }
                const rowY = currentY + lineGap + 2;
                doc.fillColor(textColor).fontSize(9)
                   .text(productName, pageMargins.left + 12, rowY, { width: contentWidth * 0.3 - 12, lineGap })
                   .text(sku, pageMargins.left + contentWidth * 0.3, rowY, { width: contentWidth * 0.15, align: 'left' })
                   .text(quantity.toString(), pageMargins.left + contentWidth * 0.45, rowY, { width: contentWidth * 0.12, align: 'right' })
                   .text(formatCurrency(price), pageMargins.left + contentWidth * 0.57, rowY, { width: contentWidth * 0.18, align: 'right' })
                   .text(formatCurrency(totalPrice), pageMargins.left + contentWidth * 0.75, rowY, { width: contentWidth * 0.25 - 12, align: 'right' });
                currentY += itemHeight;
                i++;
            });

            // --- Tổng kết ---
            addNewPageIfNeeded(120);
            currentY += 10;
            const shippingFee = order.shippingFee || 0;
            const discount = (typeof order.discountAmount !== 'undefined' ? order.discountAmount : (order.discount || 0));
            const grandTotal = subtotal + shippingFee - discount;
            doc.font(fonts.regular).fontSize(11).fillColor(textColor)
                .text('Tổng tiền hàng:', pageMargins.left + contentWidth * 0.55, currentY, { width: 120 })
                .text(formatCurrency(subtotal), pageMargins.left + contentWidth * 0.75, currentY, { width: 120, align: 'right' });
            currentY += 18;
            doc.text('Phí vận chuyển:', pageMargins.left + contentWidth * 0.55, currentY, { width: 120 })
                .text(formatCurrency(shippingFee), pageMargins.left + contentWidth * 0.75, currentY, { width: 120, align: 'right' });
            currentY += 18;
            doc.text('Giảm giá:', pageMargins.left + contentWidth * 0.55, currentY, { width: 120 })
                .text('- ' + formatCurrency(discount), pageMargins.left + contentWidth * 0.75, currentY, { width: 120, align: 'right' });
            currentY += 18;
            doc.font(fonts.bold).fontSize(12).fillColor(textColor)
                .text('Tổng cộng:', pageMargins.left + contentWidth * 0.55, currentY, { width: 120 })
                .text(formatCurrency(grandTotal), pageMargins.left + contentWidth * 0.75, currentY, { width: 120, align: 'right' });
            currentY += 22;
            // Bằng chữ
            doc.font(fonts.regular).fontSize(10).fillColor(lightTextColor)
                .text('Bằng chữ: ' + (convertNumberToWords ? convertNumberToWords(grandTotal) : ''), pageMargins.left, currentY, { width: contentWidth });
            currentY += 40;
            // --- Chữ ký ---
            doc.font(fonts.regular).fontSize(11).fillColor(textColor)
                .text('Người mua hàng', pageMargins.left + 30, currentY)
                .text('Người lập hóa đơn', pageMargins.left + contentWidth - 150, currentY);
            currentY += 18;
            doc.font(fonts.regular).fontSize(10).fillColor(lightTextColor)
                .text('(Ký, ghi rõ họ tên)', pageMargins.left + 30, currentY)
                .text('(Ký, ghi rõ họ tên)', pageMargins.left + contentWidth - 150, currentY);
            doc.end();
            writeStream.on('finish', () => {
                resolve(filePath);
            });
        } catch (error) {
            reject(error);
        }
    });
};

// Validate product data using Lodash
const validateProduct = (product) => {
    try {
        // Kiểm tra product có phải object không và không phải null/array
        if (!_.isObject(product) || _.isNull(product) || _.isArray(product)) {
            console.error('Invalid product data (not an object):', product);
            return false;
        }

        // Kiểm tra các trường bắt buộc
        const requiredFields = ['title', 'price'];
        if (!_.every(requiredFields, (field) => _.has(product, field))) {
            const missing = _.difference(requiredFields, _.keys(product));
            console.error(`Missing required field(s): ${missing.join(', ')}`, product);
            return false;
        }

        // Kiểm tra kiểu dữ liệu
        if (!_.isString(product.title)) {
            console.error('Invalid title type:', product.title);
            return false;
        }
        // isFinite kiểm tra cả number và không phải Infinity/-Infinity
        if (!_.isFinite(product.price)) {
            console.error('Invalid price type or value:', product.price);
            return false;
        }
        // Kiểm tra giá không âm
        if (product.price < 0) {
            console.error('Invalid price value (negative):', product.price);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error validating product:', error);
        return false;
    }
};

// Format product data using Lodash
const formatProductData = (product) => {
    try {
        return {
            // _.get(object, path, [defaultValue])
            title: fixVietnameseText(_.trim(_.get(product, 'title', 'No name'))),
            category: fixVietnameseText(_.trim(_.get(product, 'category', 'No category'))),
            // _.toNumber chuyển đổi giá trị thành số, trả về 0 nếu không hợp lệ
            price: _.toNumber(_.get(product, 'price', 0)) || 0, 
            description: fixVietnameseText(_.trim(_.get(product, 'description', 'No description')))
        };
    } catch (error) {
        console.error('Error formatting product data:', error);
        // Trả về giá trị mặc định an toàn
        return {
            title: 'No name', category: 'No category', price: 0, description: 'No description'
        };
    }
};

// Generate Product List PDF - Use Lodash for sum
const generateProductsPDF = async (products) => {
    return new Promise((resolve, reject) => {
        try {
            if (!_.isArray(products)) throw new Error('Products must be an array');
            
            // Sử dụng lodash để map và filter (tương tự nhưng có thể thay thế)
            const validProducts = _.chain(products)
                                    .filter(validateProduct)
                                    .map(formatProductData)
                                    .value(); // Kết thúc chain và lấy kết quả

            if (_.isEmpty(validProducts)) throw new Error('No valid products to export');

            // Sử dụng moment để định dạng ngày trong tên file
            const fileName = `products-catalog-${moment().format('YYYY-MM-DD')}.pdf`;
            const filePath = path.join(pdfDirPath, fileName);
            const doc = new PDFDocument({ 
                size: 'A4', margin: 50, bufferPages: true
            });

            // Setup Vietnamese fonts
            const fonts = setupVietnameseFonts(doc);

            const writeStream = fs.createWriteStream(filePath);
            writeStream.on('error', reject);
            doc.pipe(writeStream);

            // --- Variables & Colors ---
            const pageMargins = doc.page.margins;
            const startY = pageMargins.top;
            const contentWidth = doc.page.width - pageMargins.left - pageMargins.right;
            const endY = doc.page.height - pageMargins.bottom - 20;
            let currentY = startY;
            const primaryColor = '#2563EB';
            const greyColor = '#F3F4F6';
            const darkGreyColor = '#D1D5DB';
            const textColor = '#1F2937';
            const lightTextColor = '#6B7280';
            const rowHeight = 30;
            const headerHeight = 20;
            const pageNumber = 1;
            
            // --- Helper to draw table header ---
            const drawTableHeader = (yPos) => {
                doc.rect(pageMargins.left, yPos, contentWidth, headerHeight).fill(darkGreyColor);
                doc.fillColor(textColor).font(fonts.bold).fontSize(9);
                const textY = yPos + 7;
                doc.text('No.', pageMargins.left + 10, textY, { width: 30 });
                doc.text('Product Name', pageMargins.left + 50, textY, { width: 180 }); 
                doc.text('Category', pageMargins.left + 240, textY, { width: 80 });
                doc.text('Price', pageMargins.left + 330, textY, { width: 70, align: 'right' });
                doc.text('Description', pageMargins.left + 410, textY, { width: contentWidth - 410 - 10 });
                doc.font(fonts.regular); 
                return yPos + headerHeight + 5; 
            };

            // --- Title & Info ---
            doc.font(fonts.bold).fontSize(18).fillColor(textColor)
               .text('Product Catalog', pageMargins.left, currentY, { align: 'center', width: contentWidth });
            currentY += 25;
            doc.font(fonts.regular).fontSize(10).fillColor(lightTextColor)
               .text(`Generated on: ${formatDate(new Date(), 'MMMM Do, YYYY')}`, pageMargins.left, currentY, { align: 'right', width: contentWidth });
            currentY += 20;

            // --- Draw Table Header for first page ---
            currentY = drawTableHeader(currentY);

            // --- Table Body ---
            let i = 0;
            validProducts.forEach((product, index) => {
                 if (currentY + rowHeight > endY) {
                    doc.addPage();
                    currentY = startY;
                    currentY = drawTableHeader(currentY);
                }
                if (i % 2 !== 0) {
                     doc.rect(pageMargins.left, currentY, contentWidth, rowHeight).fill(greyColor);
                }
                const textY = currentY + (rowHeight - 10) / 2;
                doc.fillColor(textColor).fontSize(9);
                doc.text(index + 1, pageMargins.left + 10, textY, { width: 30 });
                doc.text(fixVietnameseText(product.title), pageMargins.left + 50, textY, { width: 180, ellipsis: true }); 
                doc.text(fixVietnameseText(product.category), pageMargins.left + 240, textY, { width: 80, ellipsis: true });
                doc.text(formatCurrency(product.price), pageMargins.left + 330, textY, { width: 70, align: 'right' });
                doc.text(fixVietnameseText(product.description), pageMargins.left + 410, textY, { width: contentWidth - 410 - 10, ellipsis: true, lineBreak: false }); 
                currentY += rowHeight;
                i++;
            });

            // --- Total Summary - Use Lodash _.sumBy ---
            if (currentY + 50 > endY) { 
                doc.addPage();
                currentY = startY;
            }
            currentY += 20;
            // Sử dụng _.sumBy(collection, [iteratee=_.identity])
            const totalValue = _.sumBy(validProducts, 'price'); 
            
            const summaryBoxY = currentY;
            const summaryBoxHeight = 40;
            doc.rect(pageMargins.left, summaryBoxY, contentWidth, summaryBoxHeight).fill(darkGreyColor);
            doc.fillColor(textColor).font(fonts.bold).fontSize(10);
            doc.text(`Total Products: ${validProducts.length}`, pageMargins.left + 15, summaryBoxY + 15)
               .text(`Total Value: ${formatCurrency(totalValue)}`, pageMargins.left + contentWidth / 2, summaryBoxY + 15, { width: contentWidth / 2 - 15, align: 'right' });
            currentY = summaryBoxY + summaryBoxHeight + 10;

            // --- Finalize PDF (như cũ) ---
            const range = doc.bufferedPageRange(); 
            for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex++) {
                doc.switchToPage(pageIndex);
                doc.fontSize(8).fillColor(lightTextColor)
                   .text(`Page ${pageIndex + 1} of ${range.count} | Generated: ${formatDate(new Date(), 'L LT')}`,
                         pageMargins.left, 
                         doc.page.height - pageMargins.bottom + 5, 
                         { align: 'center', width: contentWidth });
            }
            doc.flushPages(); 
            doc.end();

            writeStream.on('finish', () => {
                console.log('Products PDF write completed');
                resolve(filePath);
            });
        } catch (error) {
            console.error('Error generating products PDF:', error);
            reject(error);
        }
    });
};

// Generate Inventory PDF
const generateInventoryPDF = async (products, categories, statistics) => {
    return new Promise((resolve, reject) => {
        try {
            const fileName = `inventory-report-${moment().format('YYYYMMDD-HHmmss')}.pdf`;
            const filePath = path.join(pdfDirPath, fileName);
            const doc = new PDFDocument({ 
                size: 'A4', 
                margin: 50
            });

            // Setup Vietnamese fonts
            const fonts = setupVietnameseFonts(doc);

            const writeStream = fs.createWriteStream(filePath);
            writeStream.on('error', (error) => reject(error));
            doc.pipe(writeStream);

            // Variables & Colors
            const pageMargins = doc.page.margins;
            const startY = pageMargins.top;
            const contentWidth = doc.page.width - pageMargins.left - pageMargins.right;
            const endY = doc.page.height - pageMargins.bottom;
            let currentY = startY;
            const lineGap = 4;
            const primaryColor = '#2563EB';
            const greyColor = '#F3F4F6';
            const darkGreyColor = '#E5E7EB';
            const textColor = '#1F2937';
            const lightTextColor = '#6B7280';

            // Helper Function to Add New Page
            const addNewPageIfNeeded = (neededHeight) => {
                if (currentY + neededHeight > endY - lineGap) {
                    doc.addPage();
                    currentY = startY;
                    return true; 
                }
                return false; 
            };

            // Title
            addNewPageIfNeeded(40);
            doc.font(fonts.bold).fontSize(24).fillColor(textColor)
               .text('BÁO CÁO QUẢN LÝ KHO SẢN PHẨM', pageMargins.left, currentY, { align: 'center', width: contentWidth });
            currentY += 32;
            doc.font(fonts.regular).fontSize(10).fillColor(lightTextColor)
               .text(`Ngày xuất báo cáo: ${moment().format('DD/MM/YYYY HH:mm')}`, pageMargins.left, currentY, { align: 'center', width: contentWidth });
            currentY += 20;
            drawLine(doc, currentY);
            currentY += 12;

            // Statistics Section
            addNewPageIfNeeded(80);
            doc.font(fonts.bold).fontSize(14).fillColor(textColor)
               .text('THỐNG KÊ TỔNG QUAN', pageMargins.left, currentY);
            currentY += 20;

            const statBoxWidth = (contentWidth - 30) / 4;
            const statBoxHeight = 50;
            const statBoxY = currentY;

            // Total Items
            doc.roundedRect(pageMargins.left, statBoxY, statBoxWidth, statBoxHeight, 8).fillAndStroke(greyColor, darkGreyColor);
            doc.fillColor(textColor).font(fonts.regular).fontSize(12).text('Tổng sản phẩm', pageMargins.left + 10, statBoxY + 8);
            doc.font(fonts.bold).fontSize(16).text(statistics.totalItems.toString(), pageMargins.left + 10, statBoxY + 25);

            // In Stock
            doc.roundedRect(pageMargins.left + statBoxWidth + 10, statBoxY, statBoxWidth, statBoxHeight, 8).fillAndStroke(greyColor, darkGreyColor);
            doc.fillColor(textColor).font(fonts.regular).fontSize(12).text('Còn hàng', pageMargins.left + statBoxWidth + 20, statBoxY + 8);
            doc.font(fonts.bold).fontSize(16).text(statistics.inStockItems.toString(), pageMargins.left + statBoxWidth + 20, statBoxY + 25);

            // Out of Stock
            doc.roundedRect(pageMargins.left + (statBoxWidth + 10) * 2, statBoxY, statBoxWidth, statBoxHeight, 8).fillAndStroke(greyColor, darkGreyColor);
            doc.fillColor(textColor).font(fonts.regular).fontSize(12).text('Hết hàng', pageMargins.left + (statBoxWidth + 10) * 2 + 10, statBoxY + 8);
            doc.font(fonts.bold).fontSize(16).text(statistics.outOfStockItems.toString(), pageMargins.left + (statBoxWidth + 10) * 2 + 10, statBoxY + 25);

            // Low Stock
            doc.roundedRect(pageMargins.left + (statBoxWidth + 10) * 3, statBoxY, statBoxWidth, statBoxHeight, 8).fillAndStroke(greyColor, darkGreyColor);
            doc.fillColor(textColor).font(fonts.regular).fontSize(12).text('Sắp hết', pageMargins.left + (statBoxWidth + 10) * 3 + 10, statBoxY + 8);
            doc.font(fonts.bold).fontSize(16).text(statistics.lowStockItems.toString(), pageMargins.left + (statBoxWidth + 10) * 3 + 10, statBoxY + 25);

            currentY = statBoxY + statBoxHeight + 20;

            // Total Stock Value
            addNewPageIfNeeded(40);
            doc.font(fonts.regular).fontSize(12).fillColor(textColor)
               .text(`Tổng giá trị kho: ${formatCurrency(statistics.totalStockValue)}`, pageMargins.left, currentY);
            currentY += 20;
            drawLine(doc, currentY);
            currentY += 12;

            // Products Table Header
            addNewPageIfNeeded(32);
            const tableHeaderY = currentY;
            doc.rect(pageMargins.left, tableHeaderY, contentWidth, 24).fill(darkGreyColor);
            doc.fillColor(textColor).font(fonts.bold).fontSize(10);
            doc.text('Sản phẩm', pageMargins.left + 12, tableHeaderY + 8, { width: contentWidth * 0.35 - 12 })
               .text('Danh mục', pageMargins.left + contentWidth * 0.35, tableHeaderY + 8, { width: contentWidth * 0.15, align: 'left' })
               .text('Giá', pageMargins.left + contentWidth * 0.5, tableHeaderY + 8, { width: contentWidth * 0.15, align: 'right' })
               .text('Tồn kho', pageMargins.left + contentWidth * 0.65, tableHeaderY + 8, { width: contentWidth * 0.12, align: 'right' })
               .text('Giá trị', pageMargins.left + contentWidth * 0.77, tableHeaderY + 8, { width: contentWidth * 0.23 - 12, align: 'right' });
            currentY = tableHeaderY + 26;
            doc.font(fonts.regular);

            // Products Table Body
            let i = 0;
            products.forEach((product) => {
                const productName = fixVietnameseText(product.title || 'Unknown product');
                const category = product.category || 'Chưa phân loại';
                const price = product.price || 0;
                const stockQuantity = product.stockQuantity || 0;
                const stockValue = price * stockQuantity;

                const productNameHeight = doc.fontSize(9).heightOfString(productName, { width: contentWidth * 0.35 - 12, lineGap });
                const itemHeight = productNameHeight + lineGap * 3;
                const rowNeededHeight = itemHeight + 4;

                if (addNewPageIfNeeded(rowNeededHeight)) {
                    // Draw table header again
                    const newTableHeaderY = currentY;
                    doc.rect(pageMargins.left, newTableHeaderY, contentWidth, 24).fill(darkGreyColor);
                    doc.fillColor(textColor).font(fonts.bold).fontSize(10);
                    doc.text('Sản phẩm', pageMargins.left + 12, newTableHeaderY + 8, { width: contentWidth * 0.35 - 12 })
                       .text('Danh mục', pageMargins.left + contentWidth * 0.35, newTableHeaderY + 8, { width: contentWidth * 0.15, align: 'left' })
                       .text('Giá', pageMargins.left + contentWidth * 0.5, newTableHeaderY + 8, { width: contentWidth * 0.15, align: 'right' })
                       .text('Tồn kho', pageMargins.left + contentWidth * 0.65, newTableHeaderY + 8, { width: contentWidth * 0.12, align: 'right' })
                       .text('Giá trị', pageMargins.left + contentWidth * 0.77, newTableHeaderY + 8, { width: contentWidth * 0.23 - 12, align: 'right' });
                    currentY = newTableHeaderY + 26;
                    doc.font(fonts.regular);
                }

                if (i % 2 !== 0) {
                     doc.rect(pageMargins.left, currentY, contentWidth, itemHeight).fill(greyColor);
                }

                const rowY = currentY + lineGap + 2;
                doc.fillColor(textColor).fontSize(9)
                   .text(productName, pageMargins.left + 12, rowY, { width: contentWidth * 0.35 - 12, lineGap })
                   .text(category, pageMargins.left + contentWidth * 0.35, rowY, { width: contentWidth * 0.15, align: 'left' })
                   .text(formatCurrency(price), pageMargins.left + contentWidth * 0.5, rowY, { width: contentWidth * 0.15, align: 'right' })
                   .text(stockQuantity.toString(), pageMargins.left + contentWidth * 0.65, rowY, { width: contentWidth * 0.12, align: 'right' })
                   .text(formatCurrency(stockValue), pageMargins.left + contentWidth * 0.77, rowY, { width: contentWidth * 0.23 - 12, align: 'right' });

                currentY += itemHeight;
                i++;
            });

            // Footer
            addNewPageIfNeeded(40);
            currentY += 20;
            drawLine(doc, currentY);
            currentY += 12;
            doc.font(fonts.regular).fontSize(9).fillColor(lightTextColor)
               .text('Báo cáo được tạo tự động bởi hệ thống quản lý kho', pageMargins.left, currentY, { align: 'center', width: contentWidth });

            doc.end();
            writeStream.on('finish', () => {
                resolve(fs.readFileSync(filePath));
            });
        } catch (error) {
            reject(error);
        }
    });
};

// Generate Dashboard Report PDF
const generateDashboardReportPDF = async (dashboardData) => {
    return new Promise((resolve, reject) => {
        try {
            const fileName = `dashboard-report-${moment().format('YYYYMMDD-HHmmss')}.pdf`;
            const filePath = path.join(pdfDirPath, fileName);
            const doc = new PDFDocument({ 
                size: 'A4', 
                margin: 50
            });

            // Setup Vietnamese fonts
            const fonts = setupVietnameseFonts(doc);

            const writeStream = fs.createWriteStream(filePath);
            writeStream.on('error', (error) => reject(error));
            doc.pipe(writeStream);

            // --- Variables & Colors ---
            const pageMargins = doc.page.margins;
            const startY = pageMargins.top;
            const contentWidth = doc.page.width - pageMargins.left - pageMargins.right;
            const endY = doc.page.height - pageMargins.bottom;
            let currentY = startY;
            const lineGap = 4;
            const primaryColor = '#2563EB';
            const greyColor = '#F3F4F6';
            const darkGreyColor = '#E5E7EB';
            const textColor = '#1F2937';
            const lightTextColor = '#6B7280';

            // --- Helper Function to Add New Page ---
            const addNewPageIfNeeded = (neededHeight) => {
                if (currentY + neededHeight > endY - lineGap) {
                    doc.addPage();
                    currentY = startY;
                    return true; 
                }
                return false; 
            };
            
            // --- Report Title ---
            addNewPageIfNeeded(36);
            doc.font(fonts.bold).fontSize(20).fillColor(textColor)
               .text('BÁO CÁO DASHBOARD', pageMargins.left, currentY, { align: 'center', width: contentWidth });
            currentY += 28;
            drawLine(doc, currentY);
            currentY += 8;

            // --- Overview Statistics ---
            addNewPageIfNeeded(160);
            const statsBoxGap = 12;
            const statsBoxWidth = (contentWidth - statsBoxGap) / 2;
            const statsBoxHeight = 150;
            const statsBoxStartY = currentY;
            const statsBoxPadX = 18;
            const statsBoxPadY = 16;

            // Box 1: Tổng quan kinh doanh
            doc.roundedRect(pageMargins.left, statsBoxStartY, statsBoxWidth, statsBoxHeight, 10).fillAndStroke(greyColor, darkGreyColor);
            doc.fillColor(textColor).font(fonts.bold).fontSize(11).text('Tổng quan kinh doanh', pageMargins.left + statsBoxPadX, statsBoxStartY + statsBoxPadY - 2);
            doc.font(fonts.regular).fontSize(9);
            let y = statsBoxStartY + statsBoxPadY + 14;
            doc.text(`Tổng sản phẩm: ${dashboardData.totalProducts}`, pageMargins.left + statsBoxPadX, y, { lineGap }); y += 13;
            doc.text(`Tổng đơn hàng: ${dashboardData.totalOrders}`, pageMargins.left + statsBoxPadX, y, { lineGap }); y += 13;
            doc.text(`Tổng người dùng: ${dashboardData.totalUsers}`, pageMargins.left + statsBoxPadX, y, { lineGap }); y += 13;
            doc.text(`Tổng doanh thu: ${formatCurrency(dashboardData.totalRevenue)}`, pageMargins.left + statsBoxPadX, y, { lineGap }); y += 13;
            doc.text(`Tổng dịch vụ: ${dashboardData.totalServices}`, pageMargins.left + statsBoxPadX, y, { lineGap }); y += 13;
            doc.text(`Tổng đánh giá: ${dashboardData.totalReviews}`, pageMargins.left + statsBoxPadX, y, { lineGap }); y += 13;
            doc.text(`Tổng mã giảm giá: ${dashboardData.totalCoupons}`, pageMargins.left + statsBoxPadX, y, { lineGap }); y += 13;
            doc.text(`Người đăng ký nhận tin: ${dashboardData.totalNewsletterSubscribers}`, pageMargins.left + statsBoxPadX, y, { lineGap });

            // Box 2: Thống kê đơn hàng
            doc.roundedRect(pageMargins.left + statsBoxWidth + statsBoxGap, statsBoxStartY, statsBoxWidth, statsBoxHeight, 10).fillAndStroke(greyColor, darkGreyColor);
            doc.fillColor(textColor).font(fonts.bold).fontSize(11).text('Thống kê đơn hàng', pageMargins.left + statsBoxWidth + statsBoxGap + statsBoxPadX, statsBoxStartY + statsBoxPadY - 2);
            doc.font(fonts.regular).fontSize(9);
            y = statsBoxStartY + statsBoxPadY + 14;
            doc.text(`Đơn chờ xử lý: ${dashboardData.pendingOrders}`, pageMargins.left + statsBoxWidth + statsBoxGap + statsBoxPadX, y, { lineGap }); y += 13;
            doc.text(`Đơn đang xử lý: ${dashboardData.processingOrders}`, pageMargins.left + statsBoxWidth + statsBoxGap + statsBoxPadX, y, { lineGap }); y += 13;
            doc.text(`Đã giao: ${dashboardData.deliveredOrders}`, pageMargins.left + statsBoxWidth + statsBoxGap + statsBoxPadX, y, { lineGap }); y += 13;
            doc.text(`Đã hủy: ${dashboardData.cancelledOrders}`, pageMargins.left + statsBoxWidth + statsBoxGap + statsBoxPadX, y, { lineGap }); y += 13;
            doc.text(`Đã thanh toán: ${dashboardData.paidOrders}`, pageMargins.left + statsBoxWidth + statsBoxGap + statsBoxPadX, y, { lineGap }); y += 13;
            doc.text(`Chờ thanh toán: ${dashboardData.pendingPaymentOrders}`, pageMargins.left + statsBoxWidth + statsBoxGap + statsBoxPadX, y, { lineGap }); y += 13;
            doc.text(`Doanh thu tháng: ${formatCurrency(dashboardData.monthlyRevenue)}`, pageMargins.left + statsBoxWidth + statsBoxGap + statsBoxPadX, y, { lineGap }); y += 13;
            doc.text(`Giá trị tồn kho: ${formatCurrency(dashboardData.totalStockValue)}`, pageMargins.left + statsBoxWidth + statsBoxGap + statsBoxPadX, y, { lineGap });
            currentY = statsBoxStartY + statsBoxHeight + 10;

            // --- Monthly Revenue Chart ---
            if (dashboardData.monthlyStats && dashboardData.monthlyStats.length > 0) {
                addNewPageIfNeeded(32);
                const chartHeaderY = currentY;
                doc.rect(pageMargins.left, chartHeaderY, contentWidth, 24).fill(darkGreyColor);
                doc.fillColor(textColor).font(fonts.bold).fontSize(10);
                doc.text('Tháng', pageMargins.left + 12, chartHeaderY + 8, { width: contentWidth * 0.3 - 12 })
                   .text('Đơn hàng', pageMargins.left + contentWidth * 0.3, chartHeaderY + 8, { width: contentWidth * 0.2, align: 'right' })
                   .text('Doanh thu', pageMargins.left + contentWidth * 0.5, chartHeaderY + 8, { width: contentWidth * 0.3, align: 'right' })
                   .text('TB/Đơn', pageMargins.left + contentWidth * 0.8, chartHeaderY + 8, { width: contentWidth * 0.2 - 12, align: 'right' });
                currentY = chartHeaderY + 26;
                doc.font(fonts.regular);

                // Chart Data
                dashboardData.monthlyStats.forEach((stat, index) => {
                    const avgPerOrder = stat.orders > 0 ? stat.revenue / stat.orders : 0;
                    const itemHeight = 20;
                    if (addNewPageIfNeeded(itemHeight + 4)) {
                                        // Draw table header again
                const newChartHeaderY = currentY;
                doc.rect(pageMargins.left, newChartHeaderY, contentWidth, 24).fill(darkGreyColor);
                doc.fillColor(textColor).font(fonts.bold).fontSize(10);
                doc.text('Tháng', pageMargins.left + 12, newChartHeaderY + 8, { width: contentWidth * 0.3 - 12 })
                   .text('Đơn hàng', pageMargins.left + contentWidth * 0.3, newChartHeaderY + 8, { width: contentWidth * 0.2, align: 'right' })
                   .text('Doanh thu', pageMargins.left + contentWidth * 0.5, newChartHeaderY + 8, { width: contentWidth * 0.3, align: 'right' })
                   .text('TB/Đơn', pageMargins.left + contentWidth * 0.8, newChartHeaderY + 8, { width: contentWidth * 0.2 - 12, align: 'right' });
                currentY = newChartHeaderY + 26;
                doc.font(fonts.regular);
                    }
                    if (index % 2 !== 0) {
                         doc.rect(pageMargins.left, currentY, contentWidth, itemHeight).fill(greyColor);
                    }
                    const rowY = currentY + 6;
                    doc.fillColor(textColor).fontSize(9)
                       .text(stat.month, pageMargins.left + 12, rowY, { width: contentWidth * 0.3 - 12 })
                       .text(stat.orders.toString(), pageMargins.left + contentWidth * 0.3, rowY, { width: contentWidth * 0.2, align: 'right' })
                       .text(formatCurrency(stat.revenue), pageMargins.left + contentWidth * 0.5, rowY, { width: contentWidth * 0.3, align: 'right' })
                       .text(formatCurrency(avgPerOrder), pageMargins.left + contentWidth * 0.8, rowY, { width: contentWidth * 0.2 - 12, align: 'right' });
                    currentY += itemHeight;
                });
            }

            // --- Top Products ---
            if (dashboardData.topProducts && dashboardData.topProducts.length > 0) {
                addNewPageIfNeeded(32);
                const productsHeaderY = currentY;
                doc.rect(pageMargins.left, productsHeaderY, contentWidth, 24).fill(darkGreyColor);
                doc.fillColor(textColor).font(fonts.bold).fontSize(10);
                doc.text('Hạng', pageMargins.left + 12, productsHeaderY + 8, { width: contentWidth * 0.1 - 12 })
                   .text('Sản phẩm', pageMargins.left + contentWidth * 0.1, productsHeaderY + 8, { width: contentWidth * 0.5, align: 'left' })
                   .text('Số lượng', pageMargins.left + contentWidth * 0.6, productsHeaderY + 8, { width: contentWidth * 0.2, align: 'right' })
                   .text('Doanh thu', pageMargins.left + contentWidth * 0.8, productsHeaderY + 8, { width: contentWidth * 0.2 - 12, align: 'right' });
                currentY = productsHeaderY + 26;
                doc.font(fonts.regular);

                            // Top Products Data
            dashboardData.topProducts.forEach((product, index) => {
                const itemHeight = 20;
                if (addNewPageIfNeeded(itemHeight + 4)) {
                    // Draw table header again
                    const newProductsHeaderY = currentY;
                    doc.rect(pageMargins.left, newProductsHeaderY, contentWidth, 24).fill(darkGreyColor);
                    doc.fillColor(textColor).font(fonts.bold).fontSize(10);
                    doc.text('Hạng', pageMargins.left + 12, newProductsHeaderY + 8, { width: contentWidth * 0.1 - 12 })
                       .text('Sản phẩm', pageMargins.left + contentWidth * 0.1, newProductsHeaderY + 8, { width: contentWidth * 0.5, align: 'left' })
                       .text('Số lượng', pageMargins.left + contentWidth * 0.6, newProductsHeaderY + 8, { width: contentWidth * 0.2, align: 'right' })
                       .text('Doanh thu', pageMargins.left + contentWidth * 0.8, newProductsHeaderY + 8, { width: contentWidth * 0.2 - 12, align: 'right' });
                    currentY = newProductsHeaderY + 26;
                    doc.font(fonts.regular);
                }
                if (index % 2 !== 0) {
                     doc.rect(pageMargins.left, currentY, contentWidth, itemHeight).fill(greyColor);
                }
                const rowY = currentY + 6;
                doc.fillColor(textColor).fontSize(9)
                   .text(`#${index + 1}`, pageMargins.left + 12, rowY, { width: contentWidth * 0.1 - 12 })
                   .text(product.title, pageMargins.left + contentWidth * 0.1, rowY, { width: contentWidth * 0.5, align: 'left' })
                   .text(product.quantity.toString(), pageMargins.left + contentWidth * 0.6, rowY, { width: contentWidth * 0.2, align: 'right' })
                   .text(formatCurrency(product.revenue || 0), pageMargins.left + contentWidth * 0.8, rowY, { width: contentWidth * 0.2 - 12, align: 'right' });
                currentY += itemHeight;
            });
            }

            // --- Footer ---
            addNewPageIfNeeded(40);
            currentY += 20;
            drawLine(doc, currentY);
            currentY += 8;
            doc.font(fonts.regular).fontSize(9).fillColor(lightTextColor)
               .text(`Báo cáo Dashboard được tạo lúc ${formatDate(new Date(), 'DD/MM/YYYY HH:mm')}`, pageMargins.left, currentY, { align: 'center', width: contentWidth });

            doc.end();
            writeStream.on('finish', () => resolve(filePath));
        } catch (error) {
            reject(error);
        }
    });
};

module.exports = {
    generateOrderPDF,
    generateProductsPDF,
    generateInventoryPDF,
    generateDashboardReportPDF
};
