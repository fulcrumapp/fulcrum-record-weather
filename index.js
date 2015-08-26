var express = require('express');
var Fulcrum = require('fulcrum-app');
var fulcrumMiddleware = require('connect-fulcrum-webhook');
var Forecast = require('forecast.io');

var app = express();

var formId = '3f45825d-f123-46d0-927c-925db4a63618';
var forecastApiKey = process.env.FORECAST_API_KEY;
var fulcrumApiKey = process.env.FULCRUM_API_KEY;

var forecast = new Forecast({ APIKey: forecastApiKey });
var fulcrum = new Fulcrum({ api_key: fulcrumApiKey });

var fulcrumWeatherFieldKeys = {
  summary: 'b860',
  temperature: '45bf',
  humidity: 'ca28',
  pressure: '947d'
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
  var forecastOptions = { exclude: exclude, units: 'si' };

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
      if (currentWeather[metric]) {
        fulcrumRecord.record.form_values[fulcrumWeatherFieldKeys[metric]] = currentWeather[metric].toString();
      }
    });

    fulcrum.records.update(fulcrumRecord.record.id, fulcrumRecord, function (error, updatedRecord) {
      if (error) {
        return done(error);
      }
      done();
    });
  });
}

var fulcrumConfig = {
  actions: ['record.create'],
  processor: payloadProcessor
};

app.use('/fulcrum', fulcrumMiddleware(fulcrumConfig));

var port = (process.env.PORT || 5000);
app.listen(port, function () {
  console.log('Listening on port ' + port);
});
