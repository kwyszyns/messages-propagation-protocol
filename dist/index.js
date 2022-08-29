"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const body_parser_1 = __importDefault(require("body-parser"));
const axios_1 = __importDefault(require("axios"));
const node_cache_1 = __importDefault(require("node-cache"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
const port = process.env.PORT;
const appCache = new node_cache_1.default();
const sendMessage = (url, message, successfulDeliveries, failedDeliveries, attempt = 1) => axios_1.default
    .post(url, { message })
    .then(() => {
    console.log(`I have successfully delivered a message to ${url}`);
    successfulDeliveries.push(url);
})
    .catch(() => {
    console.log(`I have failed to deliver a message to ${url}`);
    if (attempt < 4) {
        console.log(`I am going to try again after 2 seconds - attempt ${attempt}`);
        setTimeout(() => {
            console.log(`I am trying to deliver a message to ${url}.`);
            sendMessage(url, message, successfulDeliveries, failedDeliveries, ++attempt);
        }, 2000);
        return;
    }
    failedDeliveries.push(url);
    appCache.del(url);
    console.log(`I have removed the URL: ${url} from cache`);
});
app.get("/unsubscribe", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { origin } = req.headers;
    if (!origin) {
        return res.status(400).json("Please specify the origin header");
    }
    console.log("I have detected the origin header: " + origin);
    const topic = req.query.topic;
    if (!topic) {
        return res
            .status(400)
            .json(`Please specify the topic that you would like to cancel your subscription for.`);
    }
    const urlToDelete = `${origin}/${topic}`;
    console.log(`I have detected the topic: ${topic}. I'm going to remove ${urlToDelete} from cache.`);
    if (!appCache.has(urlToDelete)) {
        console.log(`I have not found url: ${urlToDelete} in cache.`);
        return res
            .status(500)
            .json(`Operation failed. It seems that the origin: ${origin} is not a subscriber of topic: ${topic}.`);
    }
    appCache.del(urlToDelete);
    console.log(`I have removed ${urlToDelete} from cache.`);
    return res
        .status(200)
        .json(`You have unsubscribed the topic: ${topic} successfully. You will no longer receive messages regarding this topic.`);
}));
app.get("/subscribe", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { origin } = req.headers;
    if (!origin) {
        return res.status(400).json("Please specify the origin header");
    }
    console.log("I have detected the origin header: " + origin);
    const topic = req.query.topic;
    if (!topic) {
        return res
            .status(400)
            .json(`Please specify the topic which you would like to receive messages at. Example: ${origin}?topic=example`);
    }
    const url = `${origin}/${topic}`;
    if (appCache.has(url)) {
        console.log(`The url: ${url} is already stored in cache. Cancelling subscription.`);
        return res
            .status(500)
            .json(`The origin: ${origin} is already a subscriber of topic: ${topic}.`);
    }
    console.log(`I have detected the topic: ${topic}. I'm going to send a test message to ${origin}/${topic}.`);
    try {
        const testMessage = "This is a test message";
        yield axios_1.default.post(url, { message: testMessage });
        console.log(`I have successfully delivered a test message to ${url}`);
        appCache.set(url, topic);
        console.log("I have stored the URL in cache");
        return res
            .status(200)
            .json(`You subscription has been successful. You will receive messages under the following address : ${url}`);
    }
    catch (err) {
        const message = `I have failed to deliver a test message to ${url}`;
        console.log(message);
        return res
            .status(500)
            .json(`${message}. Please make sure that the URL you have provided is configured correctly`);
    }
}));
app.post("/", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { message, topic } = req.body;
    if (!message) {
        res.status(400).json("Message is required");
        return;
    }
    const successfulDeliveries = [];
    const failedDeliveries = [];
    let receivers = appCache.keys();
    console.log(receivers);
    if (topic) {
        console.log(`I have detected a topic: ${topic}. I will deliver the message only to receivers with specified topic`);
        receivers = receivers.filter((key) => appCache.get(key) === topic);
    }
    else {
        console.log("I have not detected a topic. I will send the message to all receivers with global topic specified");
        receivers = receivers.filter((key) => appCache.get(key) === "global");
    }
    yield Promise.allSettled(receivers.map((key) => 
    // sendMessage(key, message, successfulDeliveries, failedDeliveries)
    axios_1.default
        .post(key, { message })
        .then(() => {
        console.log(`I have successfully delivered a message to ${key}`);
        successfulDeliveries.push(key);
    })
        .catch(() => {
        failedDeliveries.push(key);
        console.log(`I have failed to deliver a message to ${key}`);
        appCache.del(key);
        console.log(`I have removed the URL: ${key} from cache`);
    })));
    return res.status(200).json({
        Message: message,
        Topic: topic,
        Receivers: receivers.length,
        "Successful deliveries": successfulDeliveries,
        "Failed deliveries": failedDeliveries,
    });
}));
app.listen(port, () => {
    console.log(`⚡️[server]: Server is running at https://localhost:${port}`);
});
