const Contact = require('../../models/contact');

exports.getNewsletterSubscribers = async (req, res, next) => {
    try {
        const subscribers = await Contact.findAllNewsletterSubscribers();
        res.render('admin/newsletter-subscribers', {
            pageTitle: 'Danh sách nhận tin',
            path: '/admin/newsletter',
            subscribers: subscribers,
            totalCount: subscribers.length
        });
    } catch (err) {
        next(err);
    }
};

exports.sendNewsletter = async (req, res, next) => {
    try {
        const { subject, content } = req.body;
        const subscribers = await Contact.findAllNewsletterSubscribers();
        // Here you would integrate with an email service to send the newsletter
        console.log('Sending newsletter to:', subscribers);
        res.redirect('/admin/newsletter');
    } catch (err) {
        next(err);
    }
}; 