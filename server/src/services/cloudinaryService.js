const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');
const path = require('path');
const fs = require('fs');

/**
 * Checks whether all required Cloudinary environment variables are configured.
 * @returns {boolean}
 */
const isCloudinaryConfigured = () => {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

// Configure Cloudinary globally if credentials exist
if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Upload an image buffer to Cloudinary or fall back to local disk storage if Cloudinary is not configured.
 *
 * @param {Object} file - Multer file object containing buffer, originalname, mimetype
 * @param {string} folder - Target Cloudinary folder or subfolder (default: 'civicpulse')
 * @returns {Promise<{ secureUrl: string, publicId: string | null, isCloud: boolean }>}
 */
const uploadImage = async (file, folder = 'civicpulse') => {
  if (!file) {
    return null;
  }

  // 1. Cloudinary upload path when credentials are present
  if (isCloudinaryConfigured()) {
    // Re-verify configuration in case env vars were set dynamically
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload stream error:', error);
            return reject(new Error(`Cloudinary upload failed: ${error.message || 'Unknown error'}`));
          }
          if (!result || !result.secure_url) {
            return reject(new Error('Cloudinary upload failed: No secure URL returned'));
          }
          resolve({
            secureUrl: result.secure_url,
            publicId: result.public_id,
            isCloud: true,
          });
        }
      );

      // Pipe file buffer into the Cloudinary upload stream
      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  // 2. Local fallback storage when Cloudinary credentials are absent
  const uploadsDir = path.resolve(__dirname, '../../../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = (file.originalname ? path.extname(file.originalname).toLowerCase() : '') || '.jpg';
  const filename = `report-${uniqueSuffix}${ext}`;
  const filePath = path.join(uploadsDir, filename);

  await fs.promises.writeFile(filePath, file.buffer);

  return {
    secureUrl: `/uploads/${filename}`,
    publicId: null,
    isCloud: false,
  };
};

/**
 * Safely delete an asset from Cloudinary (e.g. if database insertion fails).
 *
 * @param {string} publicId - Cloudinary asset public_id
 * @returns {Promise<boolean>}
 */
const deleteCloudinaryAsset = async (publicId) => {
  if (!publicId || !isCloudinaryConfigured()) {
    return false;
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result && result.result === 'ok';
  } catch (err) {
    console.error(`Failed to delete Cloudinary asset (${publicId}):`, err.message);
    return false;
  }
};

module.exports = {
  isCloudinaryConfigured,
  uploadImage,
  deleteCloudinaryAsset,
};
