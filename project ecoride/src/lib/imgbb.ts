const IMGBB_API_KEY = 'your_api_key';

export const uploadImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(
    `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
    {
      method: 'POST',
      body: formData
    }
  );

  const data = await response.json();
  return data.data.url;
};