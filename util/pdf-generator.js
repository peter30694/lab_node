const puppeteer = require('puppeteer');
const path = require('path');

class PDFGenerator {
    constructor() {
        this.browser = null;
    }

    async init() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    async generateContactsPDF(contacts, type = 'all') {
        await this.init();
        
        const page = await this.browser.newPage();
        
        // Tạo HTML content
        const html = this.generateContactsHTML(contacts, type);
        
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        // Tạo PDF
        const pdf = await page.pdf({
            format: 'A4',
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            },
            printBackground: true
        });
        
        await page.close();
        return pdf;
    }

    generateContactsHTML(contacts, type) {
        const title = this.getTitle(type);
        const currentDate = new Date().toLocaleDateString('vi-VN');
        
        return `
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                    
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        background: #fff;
                    }
                    
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                        padding-bottom: 20px;
                        border-bottom: 2px solid #e5e7eb;
                    }
                    
                    .header h1 {
                        font-size: 28px;
                        font-weight: 700;
                        color: #1f2937;
                        margin-bottom: 8px;
                    }
                    
                    .header p {
                        font-size: 14px;
                        color: #6b7280;
                    }
                    
                    .stats {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 30px;
                        padding: 20px;
                        background: #f9fafb;
                        border-radius: 8px;
                        border: 1px solid #e5e7eb;
                    }
                    
                    .stat-item {
                        text-align: center;
                    }
                    
                    .stat-number {
                        font-size: 24px;
                        font-weight: 700;
                        color: #1f2937;
                    }
                    
                    .stat-label {
                        font-size: 12px;
                        color: #6b7280;
                        margin-top: 4px;
                    }
                    
                    .table-container {
                        margin-top: 20px;
                    }
                    
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                        font-size: 12px;
                    }
                    
                    th {
                        background: #f3f4f6;
                        color: #374151;
                        font-weight: 600;
                        text-align: left;
                        padding: 12px 8px;
                        border-bottom: 2px solid #e5e7eb;
                        font-size: 11px;
                    }
                    
                    td {
                        padding: 10px 8px;
                        border-bottom: 1px solid #e5e7eb;
                        vertical-align: top;
                    }
                    
                    tr:nth-child(even) {
                        background: #f9fafb;
                    }
                    
                    tr:hover {
                        background: #f3f4f6;
                    }
                    
                    .badge {
                        display: inline-block;
                        padding: 2px 8px;
                        border-radius: 12px;
                        font-size: 10px;
                        font-weight: 500;
                    }
                    
                    .badge-contact {
                        background: #dbeafe;
                        color: #1e40af;
                    }
                    
                    .badge-newsletter {
                        background: #dcfce7;
                        color: #166534;
                    }
                    
                    .badge-pending {
                        background: #fef3c7;
                        color: #92400e;
                    }
                    
                    .badge-read {
                        background: #d1fae5;
                        color: #065f46;
                    }
                    
                    .badge-replied {
                        background: #dbeafe;
                        color: #1e40af;
                    }
                    
                    .badge-unsubscribed {
                        background: #fee2e2;
                        color: #991b1b;
                    }
                    
                    .email {
                        font-weight: 500;
                        color: #1f2937;
                    }
                    
                    .name {
                        font-weight: 500;
                        color: #374151;
                    }
                    
                    .message {
                        max-width: 200px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    
                    .date {
                        color: #6b7280;
                        font-size: 11px;
                    }
                    
                    .footer {
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        text-align: center;
                        color: #6b7280;
                        font-size: 12px;
                    }
                    
                    .page-break {
                        page-break-before: always;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${title}</h1>
                    <p>Xuất ngày: ${currentDate}</p>
                </div>
                
                <div class="stats">
                    <div class="stat-item">
                        <div class="stat-number">${contacts.length}</div>
                        <div class="stat-label">Tổng số</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${contacts.filter(c => c.type === 'contact').length}</div>
                        <div class="stat-label">Liên hệ</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${contacts.filter(c => c.type === 'newsletter').length}</div>
                        <div class="stat-label">Newsletter</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${contacts.filter(c => c.status === 'pending').length}</div>
                        <div class="stat-label">Chưa đọc</div>
                    </div>
                </div>
                
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Email</th>
                                <th>Tên</th>
                                <th>Loại</th>
                                <th>Trạng thái</th>
                                <th>Nội dung</th>
                                <th>Ngày tạo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${contacts.map(contact => `
                                <tr>
                                    <td class="email">${contact.email}</td>
                                    <td class="name">${contact.name || '-'}</td>
                                    <td>
                                        <span class="badge badge-${contact.type}">
                                            ${contact.type === 'contact' ? 'Liên hệ' : 'Newsletter'}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="badge badge-${contact.status}">
                                            ${this.getStatusText(contact.status)}
                                        </span>
                                    </td>
                                    <td class="message" title="${contact.message || ''}">
                                        ${contact.message ? (contact.message.length > 50 ? contact.message.substring(0, 50) + '...' : contact.message) : '-'}
                                    </td>
                                    <td class="date">
                                        ${new Date(contact.createdAt).toLocaleDateString('vi-VN')}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="footer">
                    <p>© ${new Date().getFullYear()} Pet Store - Báo cáo được tạo tự động</p>
                    <p>Trang 1</p>
                </div>
            </body>
            </html>
        `;
    }

    getTitle(type) {
        switch (type) {
            case 'contact':
                return 'Báo cáo Liên hệ Khách hàng';
            case 'newsletter':
                return 'Báo cáo Newsletter Subscribers';
            default:
                return 'Báo cáo Liên hệ & Newsletter';
        }
    }

    getStatusText(status) {
        const statusMap = {
            'pending': 'Chưa đọc',
            'read': 'Đã đọc',
            'replied': 'Đã trả lời',
            'unsubscribed': 'Đã hủy',
            'active': 'Hoạt động',
            'inactive': 'Không hoạt động'
        };
        return statusMap[status] || status;
    }
}

module.exports = PDFGenerator; 