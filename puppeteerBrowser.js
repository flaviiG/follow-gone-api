/* eslint-disable camelcase */
/* eslint-disable no-await-in-loop */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const dotenv = require('dotenv');

const helpers = require('./utils/helpers');

dotenv.config({
  path: './config.env',
});

puppeteer.use(StealthPlugin());

const WAIT_TIME = 1400;

let browser = null;

let idBrowser = null;

exports.openBrowser = async (envVariables) => {
  const { INSTAGRAM_USERNAME, INSTAGRAM_PASSWORD, PROXY_PASSWORD, PROXY_USERNAME, PROXY_SERVER } =
    envVariables;
  const browserArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
  ];

  idBrowser = await puppeteer.launch({ args: browserArgs });

  console.log('Checking proxy server');
  if (PROXY_SERVER && PROXY_USERNAME && PROXY_PASSWORD) {
    console.log('Proxy server added');
    browserArgs.push(`--proxy-server=${PROXY_SERVER}`);
  }

  browser = await puppeteer.launch({ headless: true, args: browserArgs });

  const page = await browser.newPage();
  // Authenticating the proxy server
  await page.authenticate({
    username: PROXY_USERNAME,
    password: PROXY_PASSWORD,
  });

  // Custom user agent from generateRandomUA() function
  const customUA = helpers.generateRandomUA();
  console.log(customUA);

  // Set custom user agent
  await page.setUserAgent(customUA);

  await page.setViewport({
    width: 1024,
    height: 768,
    deviceScaleFactor: 1,
  });

  await page.setRequestInterception(true);

  page.on('request', (req) => {
    if (req.resourceType() === 'image') {
      req.abort();
    } else {
      req.continue();
    }
  });

  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

  await page.goto('https://www.instagram.com/');

  await page.screenshot({ path: './screenshotinsta.png' });

  // Decline cookies
  const rejectAllButton = await page.waitForSelector(
    'xpath///button[contains(text(), "Decline optional cookies")]',
  );
  await rejectAllButton.click();

  // Fill in login form
  await page.locator('aria/Phone number, username, or email').fill(INSTAGRAM_USERNAME);
  await page.locator('aria/Password').fill(INSTAGRAM_PASSWORD);
  await new Promise((r) => {
    setTimeout(r, WAIT_TIME);
  });

  await page.screenshot({ path: './screenshotlogin.png' });

  // Log in
  const loginButton = await page.waitForSelector('text/Log in');
  await new Promise((r) => {
    setTimeout(r, WAIT_TIME);
  });
  await loginButton.click();
  await new Promise((r) => {
    setTimeout(r, WAIT_TIME);
  });

  await page.waitForNavigation();
  await page.screenshot({ path: './screenshotnav.png' });

  try {
    const dismissButton = await page.waitForSelector('text/Dismiss', { timeout: 5000 });
    await new Promise((r) => {
      setTimeout(r, WAIT_TIME);
    });
    await dismissButton.click();
  } catch (err) {
    console.log('No dismiss button found');
  }

  console.log('Logged in!');
};

// Another account can be used to scrape the followers
// as long as it follows the account to be scraped
exports.runPuppeteerScript = async (usernameToScrape) => {
  console.log(`Getting followers for ${usernameToScrape}`);

  const idPage = await idBrowser.newPage();

  await idPage.goto(`https://www.instagram.com/${usernameToScrape}`);

  const source = await idPage.content({ waitUntil: 'domcontentloaded' });

  // Finding the user id in the source
  const regex = /"profilePage_([^"]+)"/;
  const match = source.match(regex);
  const userToScrapeId = match ? match[1] : 'User ID not found';
  console.log('User id:', userToScrapeId);

  await idPage.close();

  const page = await browser.newPage();

  // Authenticating the proxy server
  await page.authenticate({
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
  });

  // Custom user agent from generateRandomUA() function
  const customUA = helpers.generateRandomUA();
  console.log(customUA);

  // Set custom user agent
  await page.setUserAgent(customUA);

  await page.goto('https://instagram.com');

  try {
    const dismissButton = await page.waitForSelector('text/Dismiss', { timeout: 5000 });
    await new Promise((r) => {
      setTimeout(r, WAIT_TIME);
    });
    await dismissButton.click();

    await page.waitForNavigation({ timeout: 5000 });
  } catch (err) {
    console.log('No dismiss button found');
  }

  let result;
  let numTries = 0;
  while (!result && numTries < 3) {
    try {
      numTries += 1;
      result = await page.evaluate(async (userId) => {
        // Script logic starts here
        let followers = [];

        let after = null;
        let has_next = true;

        while (has_next) {
          const res = await fetch(
            `https://www.instagram.com/graphql/query/?query_hash=c76146de99bb02f6415203be841dd25a&variables=${encodeURIComponent(
              JSON.stringify({
                id: userId,
                include_reel: true,
                fetch_mutual: true,
                first: 50,
                after: after,
              }),
            )}`,
          );
          const data = await res.json();
          has_next = data.data.user.edge_followed_by.page_info.has_next_page;
          after = data.data.user.edge_followed_by.page_info.end_cursor;
          followers = followers.concat(
            data.data.user.edge_followed_by.edges.map(({ node }) => ({
              username: node.username,
              userId: node.id,
            })),
          );
        }
        // Return the results
        return {
          followers,
        };
      }, userToScrapeId);
    } catch (err) {
      console.log(err);
      await page.goto('https://instagram.com');

      try {
        const dismissButton = await page.waitForSelector('text/Dismiss', { timeout: 5000 });
        await new Promise((r) => {
          setTimeout(r, WAIT_TIME);
        });
        await dismissButton.click();

        await page.waitForNavigation({ timeout: 5000 });
      } catch (errDismiss) {
        console.log('No dismiss button found');
      }
    }
  }

  await page.close();

  if (!result) return null;

  return result.followers;
};
