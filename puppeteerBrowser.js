/* eslint-disable camelcase */
/* eslint-disable no-await-in-loop */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const dotenv = require('dotenv');
const axios = require('axios');

const helpers = require('./utils/helpers');

dotenv.config({
  path: './config.env',
});

puppeteer.use(StealthPlugin());

const WAIT_TIME = 1400;

let browser = null;

let idBrowser = null;

let cookies = null;

let page = null;

exports.openBrowser = async (envVariables) => {
  const { INSTAGRAM_USERNAME, INSTAGRAM_PASSWORD, PROXY_PASSWORD, PROXY_USERNAME, PROXY_SERVER } =
    envVariables;
  const browserArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
  ];

  console.log('Checking proxy server');
  if (PROXY_SERVER && PROXY_USERNAME && PROXY_PASSWORD) {
    console.log('Proxy server added');
    browserArgs.push(`--proxy-server=${PROXY_SERVER}`);
  }

  idBrowser = await puppeteer.launch({ args: browserArgs });
  browser = await puppeteer.launch({ headless: true, args: browserArgs });

  page = await browser.newPage();
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

  // page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

  await page.goto('https://www.instagram.com/');

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

  cookies = await page.cookies();
};

exports.runPuppeteerScript = async (usernameToScrape) => {
  console.log(`Getting followers for ${usernameToScrape}`);

  const idPage = await idBrowser.newPage();

  await idPage.authenticate({
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
  });

  await idPage.goto(`https://www.instagram.com/${usernameToScrape}`);

  const source = await idPage.content({ waitUntil: 'domcontentloaded' });

  // Finding the user id in the source
  const regex = /"profilePage_([^"]+)"/;
  const match = source.match(regex);
  const userToScrapeId = match ? match[1] : 'User ID not found';
  console.log('User id:', userToScrapeId);

  await idPage.close();

  const username = process.env.OXY_USERNAME;
  const password = process.env.OXY_PASSWORD;

  let after = null;
  let has_next = true;

  let followers = [];

  let numTries = 0;

  while (has_next && numTries < 3) {
    const url = `https://www.instagram.com/graphql/query/?query_hash=c76146de99bb02f6415203be841dd25a&variables=${encodeURIComponent(
      JSON.stringify({
        id: userToScrapeId,
        include_reel: true,
        fetch_mutual: true,
        first: 50,
        after: after,
      }),
    )}`;

    const body = {
      source: 'universal',
      url: url,
      geo_location: 'Romania',
      context: [
        {
          key: 'force_cookies',
          value: true,
        },
        {
          key: 'cookies',
          value: [...cookies.map((c) => ({ key: c.name, value: c.value }))],
        },
      ],
    };

    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

    try {
      const response = await axios.post('https://realtime.oxylabs.io/v1/queries', body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
      });

      console.log(response.data.results[0].content);

      // Failed to get the followers
      if (!response.data.results[0].content) {
        console.log('Request failed, trying again...');
        numTries += 1;
        try {
          await page.goto('https://www.instagram.com');

          const dismissButton = await page.waitForSelector('text/Dismiss', { timeout: 5000 });
          await new Promise((r) => {
            setTimeout(r, WAIT_TIME);
          });
          await dismissButton.click();

          await page.waitForNavigation();
        } catch (err) {
          console.log('No dismiss button found');
        }
        cookies = await page.cookies();
      } else {
        const data = JSON.parse(response.data.results[0].content);
        has_next = data.data.user.edge_followed_by.page_info.has_next_page;
        after = data.data.user.edge_followed_by.page_info.end_cursor;
        followers = followers.concat(
          data.data.user.edge_followed_by.edges.map(({ node }) => ({
            username: node.username,
            userId: node.id,
          })),
        );
      }
    } catch (error) {
      console.error('Error:', error.response ? error.response.data : error.message);
      return null;
    }
  }

  return followers;
};

// Another account can be used to scrape the followers
// as long as it follows the account to be scraped
exports.runPuppeteerScript2 = async (usernameToScrape) => {
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

  page = await browser.newPage();

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
