import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import cors from "cors";
import { authenticate, linkedInSession } from "./helpers/scraping";
import type { HttpsOptions } from "firebase-functions/v2/https";
import { google } from "googleapis";
import axios from "axios";

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
  memory: "4GiB",
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

export const isVMRunning = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/compute"],
    });

    const compute = google.compute({
      version: "v1",
      auth,
    });

    const projectId = "introer-prod";
    const zone = "us-east4-c";
    const instanceName = "introer-instance-1";

    try {
      const response = await compute.instances.get({
        project: projectId,
        zone,
        instance: instanceName,
      });

      const isRunning = response.data.status === "RUNNING";
      res.status(200).send({ data: isRunning });
    } catch (err) {
      console.error(err);
      res.status(500).send({ data: {
        error: err,
      },
      });
    }
  });
});

export const runScriptOnVM = functions.https.onRequest(
  async (req, res) => {
    corsHandler(req, res, async () => {
      const vmIp = "34.85.224.239:3000";

      try {
        const response = await axios.post(
          `http://${vmIp}/run-script`,
          req.body
        );

        return { data: response.data };
      } catch (err) {
        console.error(err);
        return { data: {
          error: err,
        },
        };
      }
    });
  });

export const passParams = functions.https.onCall(
  async (request) => {
    const vmIp = "34.85.224.34:3000";

    try {
      const response = await axios.post(
        `http://${vmIp}/run-script`,
        request.data,
      );

      console.log(response.data);

      return { data: response.data };
    } catch (err) {
      console.error(err);
      return { data: {
        error: err,
      },
      };
    }
  });
