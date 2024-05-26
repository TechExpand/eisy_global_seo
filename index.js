const fs = require('fs');
var request = require('request');
var { google } = require('googleapis');
var key = require('./service_account.json');

const puppeteer = require('puppeteer');

const bodyParser = require('body-parser');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
let cookieParser = require('cookie-parser');
const multer = require('multer');

const upload = multer();
const path = require('path');


const app = express();

// index page

app.use(cors());
app.use(morgan(':method :url :status :user-agent - :response-time ms'));

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));;


app.use(express.static(__dirname + '/public'));


app.get('/', async function (req, res) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath:
      process.env.NODE_ENV === "production"
        ? process.env.PUPPETEER_EXECUTABLE_PATH
        : puppeteer.executablePath(),
    args: [
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--single-process",
      "--no-zygote",
    ],
  });
  const page = await browser.newPage();
  await page.goto('https://eisyglobal.xyz/category/general/', { waitUntil: 'networkidle2' });
  await page.waitForSelector('#page');
  const spanContents = await page.evaluate(() => {
    const spans = document.querySelectorAll('h4.entry-title a');
    return Array.from(spans).map(span => span.href);
  });

  // console.log(spanContents[0])

  const jwtClient = new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    ['https://www.googleapis.com/auth/indexing'],
    null
  );
  const batch = [spanContents[0]]
  jwtClient.authorize(function (err, tokens) {
    // console.log(tokens)
    if (err) {
      console.log(err);
      return;
    }
    const items = batch.map(line => {
      return {
        'Content-Type': 'application/http',
        'Content-ID': '',
        body:
          'POST /v3/urlNotifications:publish HTTP/1.1\n' +
          'Content-Type: application/json\n\n' +
          JSON.stringify({
            url: line,
            type: 'URL_UPDATED'
          })
      };
    });
    const options = {
      url: 'https://indexing.googleapis.com/batch',
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/mixed'
      },
      auth: { bearer: tokens.access_token },
      multipart: items
    };
    request(options, async (err, resp, body) => {
      console.log(body);
      console.log(items)
      await browser.close();
      res.send({ message: 'successful' });
    });
  });
});





app.use(function (err, req, res, next) {
  res.status(422).send({ error: err.message });
});


app.get('*', function (req, res) {
  res.send('Sorry, this is an invalid URL.');
});

app.listen(process.env.PORT || 3000, function () {
  console.log('Express app running on port ' + (process.env.PORT || 3000))
});









