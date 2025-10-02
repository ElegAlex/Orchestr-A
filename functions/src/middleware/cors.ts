import corsLib from 'cors';

const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5000',
    'https://orchestr-a.web.app',
    'https://orchestr-a.firebaseapp.com',
    'https://orchestr-a-3b48e.web.app',
    'https://orchestr-a-3b48e.firebaseapp.com',
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

export const cors = corsLib(corsOptions);