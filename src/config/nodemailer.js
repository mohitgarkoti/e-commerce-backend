const nodemailer = require('nodemailer');

const isMock = process.env.SMTP_USER === 'mock_user' || !process.env.SMTP_HOST;

let transporter = null;

if (!isMock) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '2525', 10),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const sendEmail = async ({ to, subject, html }) => {
  if (isMock || !transporter) {
    console.log('\n=================== MOCK EMAIL ===================');
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:    ${html.replace(/<[^>]*>?/gm, ' ').substring(0, 200)}...`);
    console.log('==================================================\n');
    return { messageId: `mock_${Date.now()}` };
  } else {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || '"Garkoti E-Commerce" <noreply@garkoti.com>',
        to,
        subject,
        html,
      };
      const info = await transporter.sendMail(mailOptions);
      return info;
    } catch (error) {
      console.error('Email Send Error:', error);
      // Fallback to console log in case of SMTP failure to avoid crashing the request
      return { messageId: `failed_but_logged_${Date.now()}`, error: error.message };
    }
  }
};

module.exports = sendEmail;
