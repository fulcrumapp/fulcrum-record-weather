var express           = require('express');
var Fulcrum           = require('fulcrum-app');
var models            = require('fulcrum-models');
var fulcrumMiddleware = require('connect-fulcrum-webhook');
var Forecast          = require('forecast.io');

var app = express();

var form;

// Change the variables below to match your app and api keys
var formId               = '3f45825d-f123-46d0-927c-925db4a63618';
var forecastApiKey       = process.env.FORECAST_API_KEY;
var fulcrumApiKey        = process.env.FULCRUM_API_KEY;
var fulcrumWeatherFields = {
  summary     : 'wx_summary',
  temperature : 'wx_air_temperature',
  humidity    : 'wx_relative_humidity',
  pressure    : 'wx_barometric_pressure'
};

var forecast = new Forecast({ APIKey: forecastApiKey });
var fulcrum  = new Fulcrum({ api_key: fulcrumApiKey });

fulcrum.forms.find(formId, function (error, response) {
  if (error) {
    return console.log('Error fetching form: ', error);
  }

  form = new models.Form(response.form);
});

function payloadProcessor (payload, done) {
  if (payload.data.form_id !== formId) {
    return done();
  }

  var record = new models.Record(payload.data);
  record.setForm(form);

  var latitude        = record.get('latitude');
  var longitude       = record.get('longitude');
  var clientCreatedAt = record.get('client_created_at');
  var date            = new Date(clientCreatedAt);
  var unixTimestamp   = date.getTime() / 1000;
  var forecastOptions = {
    exclude : 'minutely,hourly,daily,alerts,flags',
    units   : 'si'
  };

  if (!(latitude && longitude)) {
    console.log('Skipping record because latitude and/or longitude is missing.');
    return done();
  }

  forecast.getAtTime(latitude, longitude, unixTimestamp, forecastOptions, function (error, res, data) {
    if (error) { return done(error); }

    // The "currently" value represents weather metrics at the time when the
    // record was created.
    var currentWeather = data.currently;

    // Loop through each of the weather fields in our app. If the current reading
    // from forecast.io contains this metric, update the record with this info.
    Object.keys(fulcrumWeatherFields).forEach(function (metric) {
      if (currentWeather[metric]) {
        record.updateFieldByDataName(fulcrumWeatherFields[metric], currentWeather[metric].toString());
      }
    });

    // Update the record to include our freshly populated fields.
    fulcrum.records.update(record.get('id'), record.toJSON(), function (error, resp) {
      if (error) { return done(error); }
      done();
    });
  });
}

var fulcrumConfig = {
  actions   : ['record.create'],
  processor : payloadProcessor
};

app.use('/fulcrum', fulcrumMiddleware(fulcrumConfig));

app.get('/', function (req, resp) {
  resp.send('fulcrum-record-weather is up and running!');
});

var port = (process.env.PORT || 5000);
app.listen(port, function () {
  console.log('Listening on port ' + port);
});
