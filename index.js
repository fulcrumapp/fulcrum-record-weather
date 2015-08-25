var express = require('express');
var fulcrumMiddleware = require('connect-fulcrum-webhook');
var Forecast = require('forecast.io');

var app = express();

var formId = 'c407958e-997d-460d-a8d0-d2aa4187a2a2';
var forecastApiKey = process.env.FORECAST_API_KEY;
var fulcrumApiKey = process.env.FULCRUM_API_KEY;

var forecast = new Forecast({ APIKey: forecastApiKey });
var fulcrum = new Fulcrum({ api_key: fulcrumApiKey });

var fulcrumWeatherFieldKeys = {
  summary: '6403',
  temperature: 'ebf9',
  humidity: 'cd65',
  pressure: '654f'
};

function payloadProcessor (payload, done) {
  if (payload.data.form_id !== formId) {
    return done();
  }

  var latitude        = payload.data.latitude;
  var longitude       = payload.data.longitude;
  var clientCreatedAt = payload.data.client_created_at;
  var date            = new Date(clientCreatedAt);
  var unixTimestamp   = date.getTime() / 1000;
  var exclude         = 'minutely,hourly,daily,alerts,flags';
  var forecastOptions = { exclude: exclude };

  if (!(latitude && longitude)) {
    console.log('Skipping record because latitude and/or longitude is missing. Latitude: ' + latitude + '. Longitude: ' + longitude + '.');
    return done();
  }

  forecast.getAtTime(latitude, longitude, unixTimestamp, forecastOptions, function (error, res, data) {
    if (error) {
      return done(error);
    }

    var currentWeather = data.currently;
    var fulcrumRecord = {
      record: payload.data
    };

    Object.keys(fulcrumWeatherFieldKeys).forEach(function (metric) {
      if (currently[metric]) {
        fulcrumRecord.form_values[fulcrumWeatherFieldKeys[metric]] = currently[metric];
      }
    });

    console.log('Updated record: ', fulcrumRecord);

    fulcrum.records.update(fulcrumRecord.record.id, fulcrumRecord, function (error, updatedRecord) {
      if (error) {
        return done(error);
      }
      console.log('Updated record: ', updatedRecord);
      done();
    });
  });
}

var fulcrumConfig = {
  actions: ['record.create'],
  processor: payloadProcessor
};

app.use('/fulcrum', fulcrumMiddleware(fulcrumConfig));

app.listen(5000, function () {
  console.log('Listening on port 5000');
});
