import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Invora — AI quotations & invoices',
    short_name: 'Invora',
    description:
      'AI-assisted quotations and invoices for growing businesses. GST-ready, Razorpay payments built in.',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf8f5',
    theme_color: '#faf8f5',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
