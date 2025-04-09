const IMGUR_CLIENT_ID = 'your_client_id';

export const uploadImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: {
      Authorization: `Client-ID ${IMGUR_CLIENT_ID}`
    },
    body: formData
  });

  const data = await response.json();
  return data.data.link;
};