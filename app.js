const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const cors = require('cors');

const userRouter = require('./routers/userRouter');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');

const app = express();

const corsOptions = {
  origin: [
    'https://follow-gone-frontend.onrender.com',
    'https://follow-gone.com',
    'https://www.follow-gone.com',
  ],
};

app.use(cors(corsOptions));

// GLOBAL Middlewares

// security
app.use(helmet());

// dev logging
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// requests rate limiter
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests for this ip, please try again in an hour',
});

// body parser
app.use(express.json({ limit: '1000kb' }));

// data sanitization against nosql injection
app.use(mongoSanitize());

// data sanitization against xss

// server static files
app.use(express.static(`${__dirname}/public`));

// Enable trust proxy
app.set('trust proxy', true);

app.use('/api', limiter);

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

//Routes

app.use('/api/v1/users', userRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
