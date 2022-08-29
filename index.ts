import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import axios from "axios";
import nodecache from "node-cache";

dotenv.config();

const app: Express = express();
app.use(bodyParser.json());
const port = process.env.PORT;
const appCache = new nodecache();

const sendMessage = (
  url: string,
  message: string,
  successfulDeliveries: string[],
  failedDeliveries: string[]
) =>
  axios
    .post(url, { message })
    .then(() => {
      console.log(`I have successfully delivered a message to ${url}`);
      successfulDeliveries.push(url);
    })
    .catch(() => {
      failedDeliveries.push(url);
      console.log(`I have failed to deliver a message to ${url}`);
      appCache.del(url);
      console.log(`I have removed the URL: ${url} from cache`);
    });

app.get("/unsubscribe", async (req: Request, res: Response) => {
  const { origin } = req.headers;
  if (!origin) {
    return res.status(400).json("Please specify the origin header");
  }
  console.log("I have detected the origin header: " + origin);
  const topic = req.query.topic as string | undefined;
  if (!topic) {
    return res
      .status(400)
      .json(
        `Please specify the topic that you would like to cancel your subscription for.`
      );
  }
  const urlToDelete = `${origin}/${topic}`;
  console.log(
    `I have detected the topic: ${topic}. I'm going to remove ${urlToDelete} from cache.`
  );
  if (!appCache.has(urlToDelete)) {
    console.log(`I have not found url: ${urlToDelete} in cache.`);
    return res
      .status(500)
      .json(
        `Operation failed. It seems that the origin: ${origin} is not a subscriber of topic: ${topic}.`
      );
  }
  appCache.del(urlToDelete);
  console.log(`I have removed ${urlToDelete} from cache.`);
  return res
    .status(200)
    .json(
      `You have unsubscribed the topic: ${topic} successfully. You will no longer receive messages regarding this topic.`
    );
});

app.get("/subscribe", async (req: Request, res: Response) => {
  const { origin } = req.headers;
  if (!origin) {
    return res.status(400).json("Please specify the origin header");
  }
  console.log("I have detected the origin header: " + origin);
  const topic = req.query.topic as string | undefined;
  if (!topic) {
    return res
      .status(400)
      .json(
        `Please specify the topic which you would like to receive messages at. Example: ${origin}?topic=example`
      );
  }
  const url = `${origin}/${topic}`;
  if (appCache.has(url)) {
    console.log(
      `The url: ${url} is already stored in cache. Cancelling subscription.`
    );
    return res
      .status(500)
      .json(
        `The origin: ${origin} is already a subscriber of topic: ${topic}.`
      );
  }
  console.log(
    `I have detected the topic: ${topic}. I'm going to send a test message to ${origin}/${topic}.`
  );
  try {
    const testMessage = "This is a test message";
    await axios.post(url, { message: testMessage });
    console.log(`I have successfully delivered a test message to ${url}`);
    appCache.set(url, topic);
    console.log("I have stored the URL in cache");
    return res
      .status(200)
      .json(
        `You subscription has been successful. You will receive messages under the following address : ${url}`
      );
  } catch (err) {
    const message = `I have failed to deliver a test message to ${url}`;
    console.log(message);
    return res
      .status(500)
      .json(
        `${message}. Please make sure that the URL you have provided is configured correctly`
      );
  }
});

app.post("/", async (req: Request, res: Response, next) => {
  const { message, topic } = req.body;
  if (!message) {
    res.status(400).json("Message is required");
    return;
  }
  const successfulDeliveries: string[] = [];
  const failedDeliveries: string[] = [];
  let receivers = appCache.keys();
  console.log(receivers);
  if (topic) {
    console.log(
      `I have detected a topic: ${topic}. I will deliver the message only to receivers with specified topic`
    );
    receivers = receivers.filter((key) => appCache.get(key) === topic);
  } else {
    console.log(
      "I have not detected a topic. I will send the message to all receivers with global topic specified"
    );
    receivers = receivers.filter((key) => appCache.get(key) === "global");
  }
  await Promise.allSettled(
    receivers.map((key) =>
      sendMessage(key, message, successfulDeliveries, failedDeliveries)
    )
  );
  return res.status(200).json({
    Message: message,
    Topic: topic,
    Receivers: receivers.length,
    "Successful deliveries": successfulDeliveries,
    "Failed deliveries": failedDeliveries,
  });
});

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${port}`);
});
