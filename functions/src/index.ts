/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import cors from "cors";
import { authenticate, linkedInSession } from "./helpers/scraping";

admin.initializeApp();

const corsHandler = cors({ origin: true });

export const searchIntros = onRequest(async (request, response) => {
  return corsHandler(request, response, async () => {
    const { name, url } = request.body;
    await linkedInSession(name, url).then((res) => {
      response.json({ data: res });
    });
  });
});

export const auth = onRequest(async (request, response) => {
  return corsHandler(request, response, async () => {
    authenticate();
  });
});
