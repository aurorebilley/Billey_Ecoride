const CLOUDINARY_CLOUD_NAME = 'do6otyhpt';
const CLOUDINARY_UPLOAD_PRESET = 'ecoway_preset';

export const uploadImage = async (file: File): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`,
      {
        method: 'POST',
        body: formData
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Cloudinary error:', errorData);
      throw new Error(errorData.error?.message || 'Erreur lors du téléchargement de l\'image');
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('Erreur Cloudinary:', error);
    throw error;
  }
};