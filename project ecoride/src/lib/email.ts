import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID = 'service_n17sbu5';
const EMAILJS_TEMPLATE_ID = 'template_rj8w9q8';
const EMAILJS_PUBLIC_KEY = 'iSKmEqlZRbXcI12Wk';

export const sendCancellationEmail = async (
  to_email: string,
  to_name: string,
  trip_date: string,
  trip_departure: string,
  trip_arrival: string,
  refund_amount: number
) => {
  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID, 
      {
        to_email,
        to_name,
        trip_date,
        trip_departure,
        trip_arrival,
        refund_amount,
      },
      {
        publicKey: EMAILJS_PUBLIC_KEY,
      }
    );
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};