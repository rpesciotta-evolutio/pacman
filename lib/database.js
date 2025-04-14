'use strict';

var MongoClient = require('mongodb').MongoClient;
var config = require('./config');
var { trace, context } = require('@opentelemetry/api'); // Import OpenTelemetry API and context API
var _db;
var _client;
const tracer = trace.getTracer('database-module'); // Instantiate tracer

function Database() {
    this.connect = function(app, callback) {
        const activeSpan = trace.getSpan(context.active());

        // Determine correct parent context
        const parentCtx = activeSpan
            ? context.active()
            : trace.setSpan(context.active(), undefined); // No active span → create root context

        const connectSpan = tracer.startSpan('MongoClient.connect', {
            attributes: { 'db.url': config.database.url, required_db: true }
        }, parentCtx);

        context.with(trace.setSpan(context.active(), connectSpan), () => {
            // This context is used to propagate the span
            MongoClient.connect(config.database.url, config.database.options, function (err, client) {
                if (err) {
                    connectSpan.recordException(err); // Record exception in connectSpan
                    connectSpan.setStatus({ code: 2, message: 'Error connecting to MongoDB' }); // Set connectSpan status
                    connectSpan.setAttribute('db.connection_error', true);
                    console.log(err);
                    console.log(config.database.url);
                    console.log(config.database.options);
                } else {
                    _client = client;
                    _db = client.db();  // Get the actual db object
                    app.locals.db = _db;
                    connectSpan.setStatus({ code: 1, message: 'Success' }); // Set connectSpan status
                }
                connectSpan.end(); // End connectSpan
                callback(err);
            });    
        });
    }

    this.getDb = function(app, callback) {
        if (!_db) {
            this.connect(app, function(err) {
                if (err) {
                    console.log('Failed to connect to database server');
                } else {
                    console.log('Connected to database server successfully');
                }
                callback(err, _db);
            });
        } else {
            callback(null, _db);
        }
    }
}

module.exports = exports = new Database(); // Singleton
