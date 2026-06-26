const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

const isMock = process.env.CLOUDINARY_CLOUD_NAME === 'mock_cloud' || !process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY === 'mock_key';

if (!isMock) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const uploadImage = async (filePath, folder = 'garkoti') => {
  if (isMock) {
    const fileName = `${Date.now()}-${path.basename(filePath)}`;
    const destDir = path.join(__dirname, '../../public/uploads');
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    const destPath = path.join(destDir, fileName);
    fs.copyFileSync(filePath, destPath);
    
    return {
      public_id: `mock_${fileName}`,
      secure_url: `/uploads/${fileName}`,
    };
  } else {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'image',
    });
    return {
      public_id: result.public_id,
      secure_url: result.secure_url,
    };
  }
};

const deleteImage = async (publicId) => {
  if (!publicId) return { result: 'not found' };
  
  if (isMock || publicId.startsWith('mock_')) {
    const fileName = publicId.replace('mock_', '');
    const destPath = path.join(__dirname, '../../public/uploads', fileName);
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
    }
    return { result: 'ok' };
  } else {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  }
};

module.exports = {
  cloudinary,
  uploadImage,
  deleteImage,
  isMock,
};
