import pupeeteer from "puppeteer";
import type { Browser, ElementHandle, Page } from "puppeteer";
import * as admin from "firebase-admin";
import { UserInfo } from "../types/user";
import * as functions from "firebase-functions";

const puppeteerConfig = {
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
};

/**
 * Search for intros on LinkedIn
 * @param {string} name - (Optional) The name of the person to search for
 * @param {string} url - (Optional) The url of the person to search for
 * @return {Promise<UserInfo[]>}
 *
 */
async function linkedInSession(
  name?: string,
  url?: string
): Promise<UserInfo | UserInfo[]> {
  const cookies = await admin
    .firestore()
    .collection("cookies")
    .doc("cookies")
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return null;
      } else {
        return doc.data();
      }
    });

  const browser: Browser = await pupeeteer.launch(puppeteerConfig);

  const page: Page = await browser.newPage();

  if (cookies) {
    functions.logger.info("Using cookies from firestore");
    functions.logger.info("url: ", url);
    functions.logger.info("name: ", name);
    await page.setCookie(...cookies.cookies);
  } else {
    functions.logger.info("Authenticating");
    const cookies = await authenticate(page);
    await page.setCookie(...cookies);
  }

  let result: UserInfo | UserInfo[] = [];

  if (url) {
    functions.logger.info("Getting user from url");
    result = await getUserFromUrl(page, url);
  } else if (name) {
    functions.logger.info("Searching for user");
    result = await searchUser(page, name);
  }

  browser.close().catch((err) => {
    functions.logger.error(err);
  });

  functions.logger.info("Returning result");
  functions.logger.info(result);
  return result;
}

/**
 * Authenticate with LinkedIn and save the cookies
 * @param {Page} page - The puppeteer page to authenticate on
 * @param {boolean} alreadyOnLoginPage - Is page already on the login page
 */
async function authenticate(page?: Page, alreadyOnLoginPage = false) {
  if (!page) {
    const browser: Browser = await pupeeteer.launch(puppeteerConfig);
    page = await browser.newPage();
  }

  functions.logger.info(page.url());

  if (!alreadyOnLoginPage) {
    await page.goto("https://www.linkedin.com/login");
  }

  // If #username does not exist we only need to enter the password
  if (await page.$$eval("#username", (el) => el.length) === 0) {
    await page.type("#password", "Introer2023!");
  } else {
    await page.type("#username", "chris.ozgo@atlantaventures.com");
    await page.type("#password", "Introer2023!");
  }

  await page.click(".btn__primary--large");

  functions.logger.info("Logged in");

  const cookies = await page.cookies();

  // Write the cookies to a firebase document in the cookies collection
  await admin
    .firestore()
    .collection("cookies")
    .doc("cookies")
    .set({ cookies: cookies });

  functions.logger.info("Cookies saved");

  return cookies;
}

/**
 * Search for the user on LinkedIn
 *
 * @param {Page} page - The puppeteer page to search on
 * @param {string} name - The name to search
 */
async function searchUser(page: Page, name: string) {
  const url = `https://www.linkedin.com/search/results/people/?keywords=${name}&origin=GLOBAL_SEARCH_HEADER`;

  await page.goto(url);

  if (
    page.url().includes("signup")
  ) {
    // Click the log in button with class main__sign-in-link
    await page.click(".main__sign-in-link");

    await authenticate(page, true);

    await page.goto(url);
  }

  // Get the search results
  const elements = await selectQuery(page, "div.entity-result__item");

  functions.logger.info("Found results");

  const contentPromises = elements.map(async (element) => {
    const profilePhoto = await page.evaluate((el) => {
      const imgElement = el.querySelector(".presence-entity__image");
      return imgElement?.getAttribute("src") ?? "";
    }, element);

    const name = await page.evaluate((el) => {
      const spanElement = el.querySelector(
        ".entity-result__title-text a span span"
      );
      return spanElement?.textContent ?? "";
    }, element);

    const title = await page.evaluate((el) => {
      const divElement = el.querySelector(".entity-result__primary-subtitle");
      return divElement?.textContent ?? "";
    }, element);

    const location = await page.evaluate((el) => {
      const divElement = el.querySelector(".entity-result__secondary-subtitle");
      return divElement?.textContent ?? "";
    }, element);

    const linkedInUrl = await page.evaluate((el) => {
      const aElement = el.querySelector(".app-aware-link");
      return aElement?.getAttribute("href") ?? "";
    }, element);

    const user: UserInfo = {
      name,
      title: title.split("\n")[1].trim(),
      location: location.split("\n")[1].trim(),
      profilePhoto,
      linkedInUrl,
    };

    return user;
  });

  const content = await Promise.all(contentPromises);

  functions.logger.info("Returning content");

  page.close();

  return content;
}

/**
 *
 *
 * @param {Page} page
 * @param {string} url
 */
async function getUserFromUrl(page: Page, url: string) {
  await page.goto(url);
  // await page.waitForNavigation({ waitUntil: "networkidle0" });

  if (page.url().includes("authwall") || page.url().includes("checkpoint")) {
    functions.logger.info("Tried to make us authenticate...authenticating");
    await authenticate(page);

    await page.goto(url);
    await page.waitForSelector("main.scaffold-layout__main");
  }

  functions.logger.info("Beat the authwall");

  const elements = await selectQuery(page, "main.scaffold-layout__main");

  const profilePicture = await page.evaluate((html) => {
    const imgElement = html.querySelector(
      "img.pv-top-card-profile-picture__image"
    );
    return imgElement?.getAttribute("src") ?? "";
  }, elements[0]);

  const name = await page.evaluate((html) => {
    const h1Element = html.querySelector(
      "div.pv-text-details__left-panel > div > h1"
    );
    return h1Element?.textContent ?? "";
  }, elements[0]);

  // The user's occupation (if they are employed, it is their job,
  //  otherwise it is their school)
  // const occupation = await page.evaluate((html) => {
  //   const occupationElement = html.querySelector(
  //     "li.pv-text-details__right-panel-item > button > span > div"
  //   );
  //   return occupationElement?.textContent ?? "";
  // }, elements[0]);

  const location = await page.evaluate((html) => {
    const locationElement = html.querySelector(
      // eslint-disable-next-line max-len
      "section.artdeco-card > div.ph5 > div.mt2 > div.pv-text-details__left-panel > span"
    );
    return locationElement?.textContent ?? "";
  }, elements[0]);

  // The user's bio
  // const description = await page.evaluate((html) => {
  //   const divElement = html.querySelector("div.text-body-medium.break-words")
  //   return divElement?.textContent ?? "";
  // }, elements[0]);

  // The one liner that is displayed on the profile
  // const oneLiner = await page.evaluate((html) => {
  //   const spanElement = html.querySelector(
  //     "div.pv-shared-text-with-see-more > div > span"
  //   );
  //   return spanElement?.textContent ?? "";
  // }, elements[0]);

  const firstSpanText = await page.evaluate((html) => {
    const spanElement = html.querySelector(
      // eslint-disable-next-line max-len
      "div.pvs-list__item--no-padding-in-columns > div.display-flex > div > div > div > div > div > div > span"
    );
    return spanElement?.textContent ?? "";
  }, elements[0]);

  const secondSpanText = await page.evaluate((html) => {
    const spanElement = html.querySelector(
      // eslint-disable-next-line max-len
      "div.pvs-list__item--no-padding-in-columns > div > div > div > span > span"
    );
    return spanElement?.textContent ?? "";
  }, elements[0]);

  // Get the user's info
  const user: UserInfo = {
    name,
    title: firstSpanText + " at " + secondSpanText.split(" ·")[0],
    location: location?.split("\n")[1]?.trim(),
    profilePhoto: profilePicture,
    linkedInUrl: url,
  };

  functions.logger.info("Returning user");

  return user;
}

/**
 * Select an element from the page
 *
 * @param {Page} page
 * @param {string} query
 * @param {number} [timeout]
 * @return {*}  {Promise<puppeeteer.ElementHandle<Element>>}
 */
async function selectQuery(
  page: Page,
  query: string,
  timeout?: number
): Promise<ElementHandle<Element>[]> {
  await page.waitForSelector(query, { timeout: timeout ?? 30000 });
  const elements = await page.$$(query);
  if (elements.length <= 0) {
    throw new Error(`Could not find element with query: ${query}`);
  }

  return elements;
}

export { linkedInSession, authenticate };
