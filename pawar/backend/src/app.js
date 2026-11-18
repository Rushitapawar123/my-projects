const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const routes = require('./routes');
const { globalLimiter } = require('./middlewares/rateLimiters');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: env.clientUrls,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(morgan(env.isProd ? 'combined' : 'dev'));
app.use(globalLimiter);

app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
