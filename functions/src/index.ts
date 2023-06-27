/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import cors from "cors";
import { authenticate, linkedInSession } from "./helpers/scraping";
import type { HttpsOptions } from "firebase-functions/v2/https";

admin.initializeApp();

const corsHandler = cors({
  origin: "*",
  methods: ["POST", "OPTIONS"],
});

export const helloWorld = functions.https.onRequest(
  async (request, response) => {
    corsHandler(request, response, () => {
      const name = request.body.data.name;

      response.json({ data: `Hello ${name}` });
    });
  });

const httpsOptions: HttpsOptions = {
  memory: "1GiB",
};

export const searchIntros = functions.https.onRequest(httpsOptions,
  async (request, response) => {
    return corsHandler(request, response, async () => {
      const { name, url } = request.body.data;
      functions.logger.info("name: ", name);
      functions.logger.info("url: ", url);
      linkedInSession(name, url).then((res) => {
        response.json({ data: res });
      });
    });
  });

export const auth = functions.https.onRequest(async (request, response) => {
  return corsHandler(request, response, async () => {
    authenticate();
  });
});
