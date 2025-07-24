const Contact = require('../../models/contact');
const emailService = require('../../util/email-service');

exports.getContacts = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const tab = req.query.tab || 'all';
        const search = req.query.search || '';
        const status = req.query.status || '';
        const sort = req.query.sort || 'newest';

        // Build filter
        let filter = {};
        if (tab === 'contact') filter.type = 'contact';
        if (tab === 'newsletter') filter.type = 'newsletter';
        if (status) filter.status = status;
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filter.$or = [
                { email: searchRegex },
                { name: searchRegex },
                { subject: searchRegex },
                { message: searchRegex }
            ];
        }

        // Build sort object
        let sortObject = { createdAt: -1 };
        switch (sort) {
            case 'oldest':
                sortObject = { createdAt: 1 };
                break;
            case 'email':
                sortObject = { email: 1 };
                break;
            case 'name':
                sortObject = { name: 1 };
                break;
            default:
                sortObject = { createdAt: -1 };
        }

        // Lấy dữ liệu
        const contacts = await Contact.findWithPagination(filter, sortObject, skip, limit);
        const total = await Contact.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);

        res.render('admin/contacts', {
            pageTitle: 'Quản lý liên hệ',
            path: '/admin/contacts',
            contacts,
            total,
            totalPages,
            currentPage: page,
            limit,
            tab,
            search,
            status,
            sort
        });
    } catch (err) {
        next(err);
    }
};

exports.getContactsData = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const tab = req.query.tab || 'all';
        const search = req.query.search || '';
        const status = req.query.status || '';
        const sort = req.query.sort || 'newest';

        // Build filter
        let filter = {};
        if (tab === 'contact') filter.type = 'contact';
        if (tab === 'newsletter') filter.type = 'newsletter';
        if (status) filter.status = status;
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filter.$or = [
                { email: searchRegex },
                { name: searchRegex },
                { subject: searchRegex },
                { message: searchRegex }
            ];
        }

        // Build sort object
        let sortObject = { createdAt: -1 };
        switch (sort) {
            case 'oldest':
                sortObject = { createdAt: 1 };
                break;
            case 'email':
                sortObject = { email: 1 };
                break;
            case 'name':
                sortObject = { name: 1 };
                break;
            default:
                sortObject = { createdAt: -1 };
        }

        // Lấy dữ liệu
        const Contact = require('../../models/contact');
        const contacts = await Contact.findWithPagination(filter, sortObject, skip, limit);
        const total = await Contact.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);

        res.json({
            success: true,
            contacts,
            pagination: {
                total,
                totalPages,
                currentPage: page,
                pageSize: limit
            }
        });
    } catch (err) {
        console.error('Lỗi khi lấy dữ liệu contacts:', err);
        res.json({ success: false, message: 'Lỗi khi lấy dữ liệu contacts' });
    }
};

exports.getContactDetail = async (req, res, next) => {
    try {
        const contact = await Contact.findById(req.params.id);
        res.render('admin/contact-detail', {
            pageTitle: 'Chi tiết liên hệ',
            path: '/admin/contacts',
            contact: contact
        });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi khi tải chi tiết liên hệ' });
    }
};

exports.getContactDetailJson = async (req, res, next) => {
    try {
        const contact = await Contact.findById(req.params.id);
        if (!contact) {
            return res.json({ success: false, message: 'Không tìm thấy liên hệ' });
        }
        res.json({ success: true, contact });
    } catch (err) {
        res.json({ success: false, message: 'Lỗi khi tải chi tiết liên hệ' });
    }
};

exports.updateContactStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        await Contact.updateStatus(req.params.id, status);
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Updating contact status failed.' });
    }
};

exports.replyToContact = async (req, res, next) => {
    try {
        const contactId = req.params.id;
        const replyMessage = req.body.replyMessage;
        if (!replyMessage) {
            return res.json({ success: false, message: 'Nội dung phản hồi không được để trống' });
        }
        const contact = await Contact.findById(contactId);
        if (!contact) {
            return res.json({ success: false, message: 'Không tìm thấy liên hệ' });
        }
        await Contact.replyToContact(contactId, replyMessage);
        // Gửi email phản hồi cho khách hàng
        await emailService.sendContactReply(contact.email, contact.name, replyMessage);
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, message: 'Lỗi khi gửi phản hồi' });
    }
};

exports.approveNewsletter = async (req, res, next) => {
    // Implementation needed
    res.status(501).send('Not Implemented');
};

exports.rejectNewsletter = async (req, res, next) => {
    try {
        const contactId = req.params.id;
        const adminNotes = req.body.adminNotes || null;
        await Contact.rejectNewsletter(contactId, adminNotes);
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, message: 'Lỗi khi từ chối newsletter' });
    }
};

exports.deleteContact = async (req, res, next) => {
    try {
        await Contact.delete(req.params.id);
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Deleting contact failed.' });
    }
};

exports.exportContacts = async (req, res, next) => {
    // Implementation needed
    res.status(501).send('Not Implemented');
};

exports.getContactStats = async (req, res, next) => {
    try {
        const stats = await Contact.getContactStats();
        res.json({ success: true, stats });
    } catch (err) {
        console.error('Lỗi khi lấy thống kê liên hệ:', err);
        res.json({ success: false, message: 'Lỗi khi lấy thống kê' });
    }
}; 