/* eslint-disable camelcase */
/* eslint-disable no-await-in-loop */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const dotenv = require('dotenv');

dotenv.config({
  path: './config.env',
});

puppeteer.use(StealthPlugin());

const WAIT_TIME = 1400;

let browser = null;

const generateRandomUA = () => {
  // Array of random user agents
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15',
  ];
  // Get a random index based on the length of the user agents array
  const randomUAIndex = Math.floor(Math.random() * userAgents.length);
  // Return a random user agent using the index above
  return userAgents[randomUAIndex];
};

exports.openBrowser = async (envVariables) => {
  const { INSTAGRAM_USERNAME, INSTAGRAM_PASSWORD, PROXY_PASSWORD, PROXY_USERNAME, PROXY_SERVER } =
    envVariables;
  const browserArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--disable-web-security',
  ];
  console.log('Checking proxy server');
  if (PROXY_SERVER && PROXY_USERNAME && PROXY_PASSWORD) {
    console.log('Proxy server added');
    browserArgs.push(`--proxy-server=${PROXY_SERVER}`);
  }

  browser = await puppeteer.launch({
    args: browserArgs,
  });

  const page = await browser.newPage();
  // Authenticating the proxy server
  await page.authenticate({
    username: PROXY_USERNAME,
    password: PROXY_PASSWORD,
  });

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
  console.log('Logged in!');

  await page.close();
};

// Another account can be used to scrape the followers
// as long as it follows the account to be scraped
exports.runPuppeteerScript = async (usernameToScrape) => {
  console.log(`Getting followers for ${usernameToScrape}`);
  const page = await browser.newPage();

  // Authenticating the proxy server
  await page.authenticate({
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
  });

  // Custom user agent from generateRandomUA() function
  const customUA = generateRandomUA();
  console.log(customUA);

  // Set custom user agent
  await page.setUserAgent(customUA);

  await page.setBypassCSP(true);

  await page.goto('https://www.instagram.com/');

  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

  let result;
  try {
    result = await page.evaluate(async (username) => {
      // Script logic starts here
      let followers = [];

      const userQueryRes = await fetch(
        `https://www.instagram.com/web/search/topsearch/?query=${username}`,
      );
      const userQueryJson = await userQueryRes.json();
      const userId = userQueryJson.users
        .map((u) => u.user)
        .filter((u) => u.username === username)[0].pk;

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
    }, usernameToScrape);
  } catch (err) {
    console.log(err);
  }

  await page.close();

  if (!result) return null;

  return result.followers;
};
