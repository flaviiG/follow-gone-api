const mongoose = require('mongoose');
const dotenv = require('dotenv');
const puppeteerBrowser = require('./puppeteerBrowser');

dotenv.config({
  path: './config.env',
});

process.on('uncaughtException', (err) => {
  console.log('Uncaught exception Shutting down...eeee');
  console.log(err.name, err.message);
  process.exit(1);
});

const app = require('./app');

const connectDatabase = async () => {
  try {
    await mongoose.connect(
      `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@follow-gone-cluster.we2vaor.mongodb.net/follow-gone?retryWrites=true&w=majority&appName=follow-gone-cluster`,
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useCreateIndex: true,
        useFindAndModify: false,
      },
    );
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const startServer = async () => {
  const port = process.env.PORT || 3000;
  const server = app.listen(port, () => {
    console.log(`App running on port ${port}...hehehe`);
  });

  process.on('unhandledRejection', (err) => {
    console.log('Unhandled Rejection Shutting down...');
    console.log(err.name, err.message);
    server.close(() => {
      process.exit(1);
    });
  });
};

const initialize = async () => {
  try {
    await connectDatabase();
    await puppeteerBrowser.openBrowser({
      INSTAGRAM_USERNAME: process.env.INSTAGRAM_USERNAME,
      INSTAGRAM_PASSWORD: process.env.INSTAGRAM_PASSWORD,
      PROXY_USERNAME: process.env.PROXY_USERNAME,
      PROXY_PASSWORD: process.env.PROXY_PASSWORD,
      PROXY_SERVER: process.env.PROXY_SERVER,
    });
    await startServer();
  } catch (error) {
    console.error('Initialization error:', error);
    process.exit(1);
  }
};

initialize();
