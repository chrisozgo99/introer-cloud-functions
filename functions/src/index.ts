import * as functions from "firebase-functions/v2";
import axios from "axios";
import { CallableRequest } from "firebase-functions/v2/https";

export const passParams = functions.https.onCall(
  async (request: CallableRequest) => {
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "only authenticated users can add requests",
      );
    }

    const vmIp = process.env.vm_ip;
    const vmEndpoint = process.env.vm_endpoint;

    try {
      functions.logger.info(request.data);

      functions.logger.info(`http://${vmIp}/${vmEndpoint}`);

      const response = await axios.post(
        `http://${vmIp}/${vmEndpoint}`,
        request.data,
      );

      functions.logger.info(response.data);

      return { data: response.data };
    } catch (err) {
      functions.logger.error(err);
      return { data: {
        error: err,
      },
      };
    }
  });
